import { ROOM_CAPACITY, ROOM_MAX_CAPACITY } from './protocol.js'

export function readConfig(env = process.env) {
  const port = Number(env.LISTENING_PORT || 3030)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('LISTENING_PORT must be an integer between 1 and 65535.')
  const host = String(env.LISTENING_HOST || '0.0.0.0').trim()
  if (!host) throw new Error('LISTENING_HOST must not be empty.')
  const capacity = Number(env.LISTENING_ROOM_CAPACITY || ROOM_CAPACITY)
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > ROOM_MAX_CAPACITY) throw new Error(`LISTENING_ROOM_CAPACITY must be an integer between 2 and ${ROOM_MAX_CAPACITY}.`)
  const origins = String(env.LISTENING_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean)
  const vercelHost = env.VERCEL === '1' ? env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL : ''
  const publicUrl = String(env.LISTENING_PUBLIC_URL || (vercelHost ? 'https://' + vercelHost : '')).trim()
  if (publicUrl) {
    const url = new URL(publicUrl)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('LISTENING_PUBLIC_URL must be an HTTP(S) origin without credentials or a path.')
    }
  }
  return { host, port, capacity, allowedOrigins: origins.length ? origins : undefined, publicUrl: publicUrl ? new URL(publicUrl).origin : '' }
}
