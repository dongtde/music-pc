import assert from 'node:assert/strict'
import test from 'node:test'
import { readConfig } from '../src/config.js'
import { createListeningRoomApp } from '../src/app.js'
import { fixture } from './helpers.js'

test('backend configuration has independent defaults and validates deployment settings', () => {
  assert.deepEqual(readConfig({}), { host: '0.0.0.0', port: 3030, capacity: 10, allowedOrigins: undefined, publicUrl: '' })
  assert.throws(() => readConfig({ LISTENING_PORT: 'not-a-port' }), /LISTENING_PORT/)
  assert.throws(() => readConfig({ LISTENING_PORT: '65536' }), /LISTENING_PORT/)
  for (const capacity of ['1', '51', '3.5', 'not-a-number']) assert.throws(() => readConfig({ LISTENING_ROOM_CAPACITY: capacity }), /LISTENING_ROOM_CAPACITY/)
  assert.equal(readConfig({ LISTENING_ROOM_CAPACITY: '20' }).capacity, 20)
  assert.throws(() => readConfig({ LISTENING_PUBLIC_URL: 'https://example.com/private/path' }), /LISTENING_PUBLIC_URL/)
  const config = readConfig({ LISTENING_PORT: '4030', LISTENING_ALLOWED_ORIGINS: 'https://music.example.com, http://localhost:5173', LISTENING_PUBLIC_URL: 'https://listen.example.com/' })
  assert.equal(config.port, 4030)
  assert.equal(config.publicUrl, 'https://listen.example.com')
  assert.deepEqual(config.allowedOrigins, ['https://music.example.com', 'http://localhost:5173'])
})

test('standalone backend serves health checks and never serves frontend files', async t => {
  const app = createListeningRoomApp()
  const address = await app.listen({ port: 0, host: '127.0.0.1' })
  t.after(() => app.close())
  const url = `http://127.0.0.1:${address.port}`
  assert.deepEqual(await (await fetch(`${url}/health`)).json(), { ok: true, service: 'lanyin-listening-room' })
  assert.equal((await fetch(`${url}/health`, { method: 'HEAD' })).status, 200)
  assert.equal((await fetch(`${url}/space`)).status, 404)
  assert.equal((await fetch(`${url}/src/main.js`)).status, 404)
  assert.equal((await fetch(`${url}/.env`)).status, 404)
})

test('direct WebSocket connections respect frontend origins and expose the configured invitation origin', async t => {
  const env = await fixture(t, { allowedOrigins: ['https://music.example.com'], publicUrl: 'https://listen.example.com' })
  await assert.rejects(env.connect(undefined, { Origin: 'https://unrelated.example.com' }))
  const member = await env.connect(undefined, { Origin: 'https://music.example.com' })
  assert.equal(member.ok, true)
  assert.equal(member.publicUrl, 'https://listen.example.com')
})
