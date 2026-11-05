import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { io } from 'socket.io-client'
import { createListeningRoomApp } from '../src/app.js'
import { ROOM_SOCKET_PATH } from '../src/protocol.js'

export const track = { id: '101', hash: 'a'.repeat(32), name: '测试音乐', artist: '同步测试', duration: '3:00' }
export const otherTrack = { ...track, id: '102', hash: 'b'.repeat(32), name: '第二首' }
export async function fixture(t, options = {}) {
  const app = createListeningRoomApp({ startDelay: 40, prepareTimeout: 400, reconnectGrace: 180, ...options })
  const address = await app.listen({ port: 0, host: '127.0.0.1' })
  const url = `http://127.0.0.1:${address.port}`, sockets = []
  const request = (socket, event, payload = {}) => new Promise((resolve, reject) => {
    socket.timeout(2000).emit(event, payload, (error, result) => error ? reject(error) : resolve(result))
  })
  async function connect(token, extraHeaders) {
    const socket = io(url, { path: ROOM_SOCKET_PATH, transports: ['websocket'], reconnection: false, auth: { token }, extraHeaders })
    sockets.push(socket)
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject) })
    const hello = await request(socket, 'session:hello')
    return { socket, ...hello, request: (event, payload) => request(socket, event, payload) }
  }
  t.after(async () => { sockets.forEach(socket => socket.disconnect()); await app.close() })
  return { url, connect }
}
export async function create(host, extra = {}) {
  const response = await host.request('room:create', { name: '房主', track, queue: [track, otherTrack], playing: false, ...extra })
  assert.equal(response.ok, true, response.error)
  return response.room
}
export const ready = (member, room, extra = {}) => member.request('playback:ready', { generation: room.playback.generation, duration: 180, ...extra })
export const command = (member, room, type, extra = {}) => member.request('playback:command', { commandId: randomUUID(), generation: room.playback.generation, queueVersion: room.queueVersion, type, ...extra })
