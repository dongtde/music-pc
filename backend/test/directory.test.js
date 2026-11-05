import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'
import { ROOM_DIRECTORY_PATH } from '../src/protocol.js'
import { fixture, create, track } from './helpers.js'

test('the directory follows room creation, occupancy, reconnects and closure without exposing sessions', async t => {
  const env = await fixture(t, { capacity: 2, reconnectGrace: 1000, prepareTimeout: 3000 })
  const directory = async () => (await (await fetch(`${env.url}${ROOM_DIRECTORY_PATH}`)).json()).rooms
  assert.deepEqual(await directory(), [])
  const host = await env.connect(), guest = await env.connect()
  const room = await create(host, { name: '海边的房主', track: { ...track, url: 'https://private.example/top-secret', cookie: 'top-secret' } })
  let rooms = await directory()
  assert.deepEqual(rooms, [{
    id: room.id, hostName: '海边的房主', memberCount: 1, capacity: 2,
    track: { name: track.name, artist: track.artist }, playing: false, preparing: true,
    joinable: true, unavailableReason: '',
  }])
  for (const secret of [host.token, host.memberId, 'top-secret']) assert.equal(JSON.stringify(rooms).includes(secret), false)
  assert.equal((await host.request('room:snapshot')).room.revision, room.revision)
  await guest.request('room:join', { code: room.id })
  rooms = await directory()
  assert.equal(rooms[0].memberCount, 2)
  assert.equal(rooms[0].joinable, false)
  assert.equal(rooms[0].unavailableReason, 'full')
  await guest.request('room:leave')
  assert.equal((await directory())[0].joinable, true)
  host.socket.disconnect(); await delay(30)
  rooms = await directory()
  assert.equal(rooms[0].joinable, false)
  assert.equal(rooms[0].unavailableReason, 'host-offline')
  const resumed = await env.connect(host.token)
  assert.equal((await directory())[0].joinable, true)
  await resumed.request('room:leave')
  assert.deepEqual(await directory(), [])
  assert.equal((await guest.request('room:join', { code: room.id })).ok, false)
})

test('the public directory supports cross-origin reads, disables caching and rejects disallowed origins and writes', async t => {
  const origin = 'https://music.example.com'
  const env = await fixture(t, { allowedOrigins: [origin] }), url = `${env.url}${ROOM_DIRECTORY_PATH}`
  const response = await fetch(url, { headers: { Origin: origin } })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('access-control-allow-origin'), origin)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(response.headers.get('vary'), 'Origin')
  assert.deepEqual(await response.json(), { rooms: [] })
  const denied = await fetch(url, { headers: { Origin: 'https://unrelated.example.com' } })
  assert.equal(denied.status, 403)
  assert.equal(denied.headers.get('access-control-allow-origin'), null)
  const head = await fetch(url, { method: 'HEAD', headers: { Origin: origin } })
  assert.equal(head.status, 200); assert.equal(await head.text(), '')
  const preflight = await fetch(url, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' } })
  assert.equal(preflight.status, 204)
  assert.match(preflight.headers.get('access-control-allow-methods'), /GET/)
  assert.equal((await fetch(url, { method: 'POST', headers: { Origin: origin } })).status, 405)
})

test('joinable rooms are shown first, with the newest rooms first within each group', async t => {
  const env = await fixture(t, { capacity: 2 })
  const firstHost = await env.connect(), secondHost = await env.connect(), thirdHost = await env.connect(), guest = await env.connect()
  const first = await create(firstHost, { track: null }), second = await create(secondHost, { track: null }), third = await create(thirdHost, { track: null })
  await guest.request('room:join', { code: third.id })
  const { rooms } = await (await fetch(`${env.url}${ROOM_DIRECTORY_PATH}`)).json()
  assert.deepEqual(rooms.map(room => room.id), [second.id, first.id, third.id])
  assert.equal(rooms[0].track, null)
})
