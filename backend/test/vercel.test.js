import assert from 'node:assert/strict'
import test from 'node:test'
import { io } from 'socket.io-client'
import server from '../api/index.js'
import { ROOM_SOCKET_PATH, ROOM_DIRECTORY_PATH } from '../src/protocol.js'

test('the Vercel HTTP server export shares room state between HTTP and WebSocket requests', async t => {
  assert.equal(server.listening, false, 'the function must not open its own production port')
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const url = 'http://127.0.0.1:' + server.address().port
  const sockets = []
  const request = (socket, event, payload = {}) => new Promise((resolve, reject) => {
    socket.timeout(2000).emit(event, payload, (error, result) => error ? reject(error) : resolve(result))
  })
  t.after(async () => {
    sockets.forEach(socket => socket.disconnect())
    await new Promise(resolve => server.close(resolve))
  })
  async function connect() {
    const socket = io(url, { path: ROOM_SOCKET_PATH, transports: ['websocket'], reconnection: false })
    sockets.push(socket)
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject) })
    assert.equal((await request(socket, 'session:hello')).ok, true)
    return socket
  }
  assert.equal((await fetch(url + '/health')).status, 200)
  const host = await connect(), guest = await connect()
  const created = await request(host, 'room:create', { name: '部署测试房主' })
  assert.equal(created.ok, true)
  const directory = await (await fetch(url + ROOM_DIRECTORY_PATH)).json()
  assert.ok(directory.rooms.some(room => room.id === created.room.id))
  const joined = await request(guest, 'room:join', { code: created.room.id, name: '部署测试成员' })
  assert.equal(joined.ok, true, joined.error)
  assert.equal(joined.room.members.length, 2)
  assert.equal((await request(host, 'room:snapshot')).room.members.length, 2)
  await request(guest, 'room:leave')
  await request(host, 'room:leave')
})
