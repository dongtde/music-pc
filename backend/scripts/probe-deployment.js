import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { io } from 'socket.io-client'
import { ROOM_DIRECTORY_PATH, ROOM_SOCKET_PATH } from '../src/protocol.js'

const [address, seconds = '360'] = process.argv.slice(2)
if (!address) throw new Error('Usage: node scripts/probe-deployment.js https://backend.example.com [hold-seconds]')
const parsed = new URL(address), holdSeconds = Number(seconds)
if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
  throw new Error('Use a backend origin without a path or credentials.')
}
if (!Number.isInteger(holdSeconds) || holdSeconds < 0 || holdSeconds > 900) throw new Error('hold-seconds must be an integer from 0 to 900.')

const url = parsed.origin, startedAt = Date.now(), clients = []
const report = { url, startedAt: new Date(startedAt).toISOString(), checks: [], interruptions: [], recoveryAttempts: [], audioTested: false }
const abort = new AbortController()
process.once('SIGINT', () => abort.abort())
process.once('SIGTERM', () => abort.abort())

function result(name, ok, detail) {
  report.checks.push({ name, ok, ...(detail ? { detail } : {}) })
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ': ' + detail : ''))
}
async function check(name, work, required = true) {
  try { const value = await work(); result(name, true); return value }
  catch (error) { result(name, false, error.message); if (required) throw error }
}
async function json(path, origin) {
  const response = await fetch(url + path, {
    cache: 'no-store', signal: AbortSignal.timeout(12000),
    headers: { 'Cache-Control': 'no-cache', ...(origin ? { Origin: origin } : {}) },
  })
  if (!response.ok) throw new Error(path + ' returned HTTP ' + response.status)
  if (origin) assert.equal(response.headers.get('access-control-allow-origin'), origin, 'frontend origin must be allowed')
  return response.json()
}
async function until(predicate, description, timeout = 12000) {
  const deadline = Date.now() + timeout
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Timed out: ' + description)
    await delay(100, undefined, { signal: abort.signal })
  }
}
function request(client, event, payload = {}) {
  return new Promise((resolve, reject) => {
    if (!client.socket.connected) return reject(new Error(client.name + ': socket disconnected'))
    client.socket.timeout(8000).emit(event, payload, (error, reply) => {
      if (error) reject(new Error(client.name + ': ' + event + ' timed out'))
      else if (!reply?.ok) reject(new Error(client.name + ': ' + (reply?.error || event + ' failed')))
      else resolve(reply)
    })
  })
}
async function connect(name) {
  const client = { name, roomId: '', room: null, ready: false, failure: '', connections: 0, roomLost: false }
  client.socket = io(url, {
    path: ROOM_SOCKET_PATH, transports: ['websocket'], autoConnect: false,
    reconnection: true, reconnectionDelay: 800, reconnectionDelayMax: 3000,
    reconnectionAttempts: 5, timeout: 10000, auth: {},
  })
  clients.push(client)
  client.socket.on('room:state', room => { client.room = room })
  client.socket.on('room:closed', () => { if (client.roomId) client.failure = 'room closed unexpectedly' })
  client.socket.on('connect_error', error => {
    const detail = error.description?.message
    client.failure = error.message + (detail ? ': ' + detail : '')
  })
  client.socket.on('disconnect', reason => {
    client.ready = false
    report.interruptions.push({ client: name, seconds: Math.round((Date.now() - startedAt) / 1000), reason })
  })
  client.socket.on('connect', async () => {
    client.connections++
    try {
      const hello = await request(client, 'session:hello')
      client.socket.auth.token = hello.token
      if (client.roomId && hello.room?.id !== client.roomId) {
        client.roomLost = true
        throw new Error('room was lost after reconnect')
      }
      if (hello.room) {
        client.room = hello.room
        if (hello.room.playback.track) await request(client, 'playback:ready', { generation: hello.room.playback.generation, duration: 900 })
      }
      client.failure = ''; client.ready = true
    } catch (error) { client.failure = error.message }
  })
  client.socket.connect()
  await until(() => client.ready || client.failure, name + ' connection')
  if (client.failure) throw new Error(name + ': ' + client.failure)
  return client
}
async function command(client, type, extra = {}) {
  const { room } = await request(client, 'room:snapshot')
  return request(client, 'playback:command', {
    type, commandId: randomUUID(), generation: room.playback.generation,
    queueVersion: room.queueVersion, ...extra,
  })
}
async function consistent(roomId) {
  await until(() => clients.every(client => client.ready || client.failure), 'clients to reconnect')
  for (const client of clients) if (client.failure) throw new Error(client.name + ': ' + client.failure)
  const rooms = await Promise.all(clients.map(async client => (await request(client, 'room:snapshot')).room))
  for (const room of rooms) {
    assert.equal(room.id, roomId, 'all clients must remain in the same room')
    assert.equal(room.members.length, 3, 'all three clients must remain in the room')
    assert.equal(room.playback.generation, rooms[0].playback.generation, 'track generation differs')
    assert.equal(room.playback.anchorTime, rooms[0].playback.anchorTime, 'playback timeline differs')
    assert.equal(room.playback.playing, rooms[0].playback.playing, 'playback state differs')
    assert.equal(room.queueVersion, rooms[0].queueVersion, 'queue version differs')
  }
  return rooms[0]
}
async function waitForRecovery(roomId) {
  const deadline = Date.now() + 45000
  let lastError
  while (Date.now() < deadline) {
    try { return await consistent(roomId) }
    catch (error) {
      lastError = error
      if (clients.some(client => client.roomLost)) throw error
      await delay(1000, undefined, { signal: abort.signal })
    }
  }
  throw lastError || new Error('room did not recover within 45 seconds')
}

let host
try {
  await check('HTTP health', async () => assert.equal((await json('/health')).ok, true))
  host = await check('host WebSocket session', () => connect('probe-host'))
  const { room } = await check('create room', () => request(host, 'room:create', { name: '部署验证', queue: [] }))
  host.roomId = room.id
  await check('directory discovers the room from a local frontend', async () => {
    const directory = await json(ROOM_DIRECTORY_PATH, 'http://localhost:5173')
    assert.ok(directory.rooms.some(listed => listed.id === room.id), 'created room missing from directory')
  }, false)
  const guest = await check('second WebSocket session', () => connect('probe-guest'))
  const third = await check('third WebSocket session', () => connect('probe-third'))
  for (const client of [guest, third]) {
    await check(client.name + ' joins the room', () => request(client, 'room:join', { code: room.id, name: client.name }))
    client.roomId = room.id
  }
  const tracks = clients.map((client, index) => ({
    id: 'deployment-probe-' + index, hash: String(index + 1).repeat(32),
    name: '部署验证曲目 ' + (index + 1), artist: '协议测试，不加载音频', duration: 900,
  }))
  await check('all members can add tracks concurrently', async () => {
    await Promise.all(clients.map((client, index) => command(client, 'append', { tracks: [tracks[index]] })))
    const snapshot = (await request(host, 'room:snapshot')).room
    for (const track of tracks) assert.ok(snapshot.queue.some(item => item.id === track.id), 'concurrent addition was lost')
  })
  await check('prepare a shared playback timeline', async () => {
    const { room: selected } = await command(guest, 'track', { track: tracks[0] })
    await Promise.all(clients.map(client => request(client, 'playback:ready', { generation: selected.playback.generation, duration: 900 })))
    await consistent(room.id)
  })
  await check('another member pauses and seeks for everyone', async () => {
    await command(third, 'pause')
    const reply = await command(guest, 'seek', { position: 45 })
    await until(() => clients.every(client => client.room?.revision >= reply.room.revision), 'shared state broadcasts')
    for (const client of clients) {
      assert.equal(client.room.playback.playing, false)
      assert.equal(client.room.playback.position, 45)
    }
  })
  await check('member reconnect restores the same room', async () => {
    guest.socket.disconnect()
    await delay(100, undefined, { signal: abort.signal })
    guest.socket.connect()
    await until(() => guest.ready || guest.failure, 'guest reconnection')
    await consistent(room.id)
  })
  await command(host, 'play')
  const deadline = Date.now() + holdSeconds * 1000
  while (Date.now() < deadline) {
    await delay(Math.min(30000, deadline - Date.now()), undefined, { signal: abort.signal })
    let snapshot
    try { snapshot = await consistent(room.id) }
    catch (error) {
      const attempt = { seconds: Math.round((Date.now() - startedAt) / 1000), reason: error.message }
      report.recoveryAttempts.push(attempt)
      console.log('RECOVER ' + attempt.seconds + 's: ' + error.message)
      snapshot = await check('automatic room recovery after connection interruption', () => waitForRecovery(room.id))
      attempt.recoveredAtSeconds = Math.round((Date.now() - startedAt) / 1000)
    }
    assert.equal(snapshot.playback.playing, true, 'room playback stopped; a manual resume is required')
    console.log('HOLD ' + Math.round((Date.now() - startedAt) / 1000) + 's: all three clients share the room')
  }
  if (holdSeconds) result('shared room survives ' + holdSeconds + ' seconds', true)
  await check('directory still reports all members', async () => {
    const directory = await json(ROOM_DIRECTORY_PATH, 'http://localhost:5173')
    assert.equal(directory.rooms.find(listed => listed.id === room.id)?.memberCount, 3)
  }, false)
} catch (error) {
  if (!report.checks.some(check => !check.ok && check.detail === error.message)) result('deployment probe', false, error.message)
} finally {
  if (host?.socket.connected && host.roomId) {
    try { await request(host, 'room:leave') }
    catch (error) { result('cleanup test room', false, error.message) }
  }
  clients.forEach(client => { client.roomId = ''; client.socket.removeAllListeners(); client.socket.disconnect() })
  report.elapsedSeconds = Math.round((Date.now() - startedAt) / 1000)
  report.clients = clients.map(client => ({ name: client.name, connections: client.connections, roomLost: client.roomLost }))
  report.ok = report.checks.every(check => check.ok)
  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exitCode = 1
}
