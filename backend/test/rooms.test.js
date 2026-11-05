import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'
import { playbackPosition, roomTrack } from '../src/protocol.js'
import { fixture, create, ready, command, track, otherTrack } from './helpers.js'

const thirdTrack = { ...track, id: '103', hash: 'c'.repeat(32), name: '第三首' }
const fourthTrack = { ...track, id: '104', hash: 'd'.repeat(32), name: '第四首' }

test('server removes credentials, playback URLs, and local files', () => {
  const cleaned = roomTrack({ ...track, url: 'https://private/audio?token=secret', cookie: 'secret', auth: { token: 'secret' } })
  assert.equal(JSON.stringify(cleaned).includes('secret'), false)
  assert.equal(roomTrack({ ...track, localUrl: 'blob:private' }), null)
})

test('rooms default to ten members including the host and reject the eleventh member', async t => {
  const env = await fixture(t), host = await env.connect()
  const room = await create(host, { track: null, queue: [], capacity: 99 })
  assert.equal(room.capacity, 10)
  for (let index = 1; index < 10; index++) {
    const member = await env.connect()
    assert.equal((await member.request('room:join', { code: room.id })).ok, true)
  }
  const extra = await env.connect()
  assert.match((await extra.request('room:join', { code: room.id })).error, /最多 10 人/)
  assert.equal((await host.request('room:snapshot')).room.members.length, 10)
})

test('configured capacity is authoritative and only room members can control playback', async t => {
  const env = await fixture(t, { capacity: 3 }), host = await env.connect(), guest = await env.connect(), third = await env.connect(), outsider = await env.connect()
  const room = await create(host, { capacity: 99 })
  assert.equal(room.capacity, 3)
  assert.equal((await guest.request('room:join', { code: room.id, name: '好友' })).ok, true)
  assert.equal((await third.request('room:join', { code: room.id })).ok, true)
  assert.match((await outsider.request('room:join', { code: room.id })).error, /最多 3 人/)
  const denied = await command(outsider, room, 'play', { roomId: room.id, hostId: host.memberId, memberId: guest.memberId })
  assert.equal(denied.ok, false)
  assert.equal((await outsider.request('room:snapshot')).ok, false)
  assert.equal((await command(guest, room, 'mode', { mode: 'single' })).ok, true)
  await guest.request('room:leave', { memberId: host.memberId })
  assert.equal((await third.request('room:snapshot')).room.hostId, host.memberId)
})

test('preparation waits for all three members and establishes one future timeline', async t => {
  const env = await fixture(t), host = await env.connect(), guest = await env.connect(), third = await env.connect()
  const room = await create(host, { playing: true, position: 20 })
  await guest.request('room:join', { code: room.id })
  await third.request('room:join', { code: room.id })
  const first = await ready(host, room)
  assert.equal(first.room.playback.preparing, true); assert.equal(first.room.playback.playing, false)
  assert.equal((await ready(guest, room)).room.playback.preparing, true)
  const second = await ready(third, room)
  assert.equal(second.room.playback.preparing, false); assert.equal(second.room.playback.playing, true)
  assert.ok(second.room.playback.anchorTime >= second.serverTime)
  assert.equal(playbackPosition(second.room.playback, second.room.playback.anchorTime + 1500), 21.5)
  assert.deepEqual((await host.request('room:snapshot')).room.playback, second.room.playback)
})

test('every member can add songs, play, pause, seek, change songs and edit the shared queue', async t => {
  const env = await fixture(t), host = await env.connect(), guest = await env.connect(), third = await env.connect()
  let room = await create(host)
  for (const member of [guest, third]) await member.request('room:join', { code: room.id })
  for (const member of [host, guest, third]) await ready(member, room)
  async function act(member, type, data) {
    const result = await command(member, room, type, data)
    assert.equal(result.ok, true, result.error); room = result.room
    return room
  }
  await act(guest, 'append', { tracks: [thirdTrack] })
  assert.equal(room.queue[0].id, thirdTrack.id)
  await act(third, 'play'); assert.equal(room.playback.playing, true)
  await act(guest, 'pause'); assert.equal(room.playback.playing, false)
  await act(third, 'seek', { position: 42 }); assert.equal(room.playback.position, 42)
  await act(guest, 'next'); assert.equal(room.playback.track.id, otherTrack.id)
  await act(third, 'previous'); assert.equal(room.playback.track.id, track.id)
  await act(guest, 'track', { track: thirdTrack }); assert.equal(room.playback.track.id, thirdTrack.id)
  await act(third, 'retry'); assert.equal(room.playback.preparing, true)
  await act(guest, 'mode', { mode: 'single' }); assert.equal(room.playMode, 'single')
  await act(third, 'queue', { tracks: [thirdTrack, otherTrack] })
  assert.deepEqual(room.queue.map(item => item.id), ['103', '102'])
  await act(guest, 'clear'); assert.deepEqual(room.queue, [])
})

test('concurrent additions merge without losing songs and command ids are scoped to the member', async t => {
  const env = await fixture(t), host = await env.connect(), guest = await env.connect(), room = await create(host)
  await guest.request('room:join', { code: room.id })
  const results = await Promise.all([
    command(host, room, 'append', { commandId: 'same-id', tracks: [thirdTrack] }),
    command(guest, room, 'append', { commandId: 'same-id', tracks: [fourthTrack] }),
  ])
  assert.ok(results.every(result => result.ok))
  const current = (await host.request('room:snapshot')).room
  assert.deepEqual(current.queue.map(item => item.id).sort(), ['101', '102', '103', '104'])
  const retry = await command(host, current, 'append', { commandId: 'same-id', tracks: [otherTrack] })
  assert.equal(retry.room.revision, current.revision)
  for (const type of ['queue', 'clear']) {
    assert.match((await command(guest, room, type, { tracks: [track] })).error, /队列.*更新/)
  }
  assert.deepEqual((await guest.request('room:snapshot')).room.queue, current.queue)
})

test('competing next commands for the same song advance only once', async t => {
  const env = await fixture(t), host = await env.connect(), guest = await env.connect()
  const room = await create(host, { queue: [track, otherTrack, thirdTrack] })
  await guest.request('room:join', { code: room.id })
  const results = await Promise.all([command(host, room, 'next'), command(guest, room, 'next')])
  assert.equal(results.filter(result => result.ok).length, 1)
  assert.match(results.find(result => !result.ok).error, /歌曲已经变化/)
  const current = (await host.request('room:snapshot')).room
  assert.equal(current.playback.generation, room.playback.generation + 1)
  assert.equal(current.playback.track.id, otherTrack.id)
})

test('a full queue rejects new additions without evicting other members songs', async t => {
  const env = await fixture(t), host = await env.connect(), guest = await env.connect()
  const queue = Array.from({ length: 200 }, (_, index) => ({ ...track, id: `song-${index}` }))
  const room = await create(host, { queue, track: queue[0] })
  await guest.request('room:join', { code: room.id })
  assert.match((await command(guest, room, 'append', { tracks: [otherTrack] })).error, /最多 200 首/)
  assert.match((await command(guest, room, 'track', { track: otherTrack })).error, /最多 200 首/)
  const current = (await host.request('room:snapshot')).room
  assert.deepEqual(current.queue, room.queue)
  assert.equal(current.playback.track.id, queue[0].id)
})

test('pause, seek, duplicate commands, and obsolete generations are handled authoritatively', async t => {
  const env = await fixture(t), host = await env.connect(), room = await create(host)
  await ready(host, room)
  const played = await command(host, room, 'play')
  const paused = await command(host, room, 'pause', { commandId: 'pause-once' })
  const duplicate = await command(host, room, 'pause', { commandId: 'pause-once' })
  assert.equal(duplicate.room.revision, paused.room.revision)
  const seek = await command(host, room, 'seek', { position: 999 })
  assert.equal(seek.room.playback.position, 180); assert.equal(seek.room.playback.playing, false)
  const changed = await command(host, room, 'track', { track: otherTrack })
  assert.equal(changed.room.playback.track.id, otherTrack.id)
  assert.equal((await command(host, room, 'seek', { position: 10 })).ok, false)
  const obsolete = await ready(host, room)
  assert.equal(obsolete.room.playback.preparing, true)
  assert.equal(obsolete.room.members[0].ready, false)
  assert.equal(played.room.playback.playing, true)
})

test('loading failures and mismatched editions do not start a synchronized room', async t => {
  const env = await fixture(t), host = await env.connect(), guest = await env.connect(), room = await create(host, { playing: true })
  await guest.request('room:join', { code: room.id }); await ready(host, room)
  const mismatch = await ready(guest, room, { duration: 30 })
  assert.equal(mismatch.room.playback.playing, false)
  assert.match(mismatch.room.error, /时长不一致/)
  const retried = await command(host, room, 'retry')
  await ready(host, retried.room); const recovered = await ready(guest, retried.room)
  assert.equal(recovered.room.playback.playing, true)
})

test('duration checks also work when the guest is ready before the host', async t => {
  const env = await fixture(t), host = await env.connect(), guest = await env.connect(), room = await create(host, { playing: true })
  await guest.request('room:join', { code: room.id })
  await ready(guest, room, { duration: 180 })
  const result = await ready(host, room, { duration: 30 })
  assert.equal(result.room.playback.playing, false)
  assert.match(result.room.members.find(member => member.id === guest.memberId).error, /时长不一致/)
})

test('automatic advance happens once on the server and repeated buffering reports do not rebroadcast', async t => {
  const env = await fixture(t, { prepareTimeout: 2000 }), host = await env.connect(), room = await create(host, { playing: true })
  const prepared = await ready(host, room, { duration: .2 })
  await host.request('playback:buffering', { generation: room.playback.generation, buffering: false })
  await host.request('playback:buffering', { generation: room.playback.generation, buffering: false })
  assert.equal((await host.request('room:snapshot')).room.revision, prepared.room.revision)
  await delay(450)
  const advanced = (await host.request('room:snapshot')).room
  assert.equal(advanced.playback.track.id, otherTrack.id)
  assert.equal(advanced.playback.generation, room.playback.generation + 1)
  assert.equal((await command(host, room, 'ended')).ok, false)
})

test('preparation has a timeout and late joins do not stop current playback', async t => {
  const env = await fixture(t, { prepareTimeout: 70 }), host = await env.connect(), guest = await env.connect()
  const room = await create(host, { playing: true })
  await delay(100)
  assert.match((await host.request('room:snapshot')).room.error, /未能准备/)
  const retry = await command(host, room, 'retry'); await ready(host, retry.room)
  const joined = await guest.request('room:join', { code: room.id })
  assert.equal(joined.room.playback.playing, true); assert.equal(joined.room.playback.preparing, false)
})

test('host disconnect pauses playback, secret session resumes, and timeout closes the room', async t => {
  const env = await fixture(t), host = await env.connect(), guest = await env.connect(), room = await create(host, { playing: true })
  await ready(host, room); await guest.request('room:join', { code: room.id }); await ready(guest, room)
  host.socket.disconnect(); await delay(25)
  const paused = await guest.request('room:snapshot')
  assert.equal(paused.room.playback.playing, false)
  const resumed = await env.connect(host.token)
  assert.equal(resumed.memberId, host.memberId); assert.equal(resumed.room.id, room.id)
  await delay(200)
  assert.equal((await resumed.request('room:snapshot')).ok, true)
  resumed.socket.disconnect(); await delay(220)
  assert.equal((await guest.request('room:snapshot')).ok, false)
})

test('guest timeout releases the second place and explicit host leave closes the room', async t => {
  const env = await fixture(t), host = await env.connect(), guest = await env.connect(), room = await create(host)
  await guest.request('room:join', { code: room.id }); guest.socket.disconnect(); await delay(220)
  const replacement = await env.connect()
  assert.equal((await replacement.request('room:join', { code: room.id })).ok, true)
  await host.request('room:leave')
  assert.equal((await replacement.request('room:join', { code: room.id })).ok, false)
})

