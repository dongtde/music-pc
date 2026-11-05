import { createServer } from 'node:http'
import { attachListeningRoomServer } from './rooms.js'
import { ROOM_DIRECTORY_PATH } from './protocol.js'

export function createListeningRoomApp(options = {}) {
  const http = createServer((request, response) => {
    const path = request.url?.split('?')[0]
    if (path === ROOM_DIRECTORY_PATH) {
      const origin = request.headers.origin
      const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Origin' }
      if (origin && options.allowedOrigins && !options.allowedOrigins.includes(origin)) {
        response.writeHead(403, headers); response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ error: 'Origin not allowed' })); return
      }
      if (origin) headers['Access-Control-Allow-Origin'] = origin
      if (request.method === 'OPTIONS') {
        response.writeHead(204, { ...headers, 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS' }); response.end(); return
      }
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405, { ...headers, Allow: 'GET, HEAD, OPTIONS' }); response.end(JSON.stringify({ error: 'Method not allowed' })); return
      }
      response.writeHead(200, headers)
      response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ rooms: service.listRooms() }))
      return
    }
    const healthy = path === '/health' && ['GET', 'HEAD'].includes(request.method)
    response.writeHead(healthy ? 200 : 404, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    response.end(request.method === 'HEAD' ? undefined : JSON.stringify(healthy ? { ok: true, service: 'lanyin-listening-room' } : { error: 'Not found' }))
  })
  const service = attachListeningRoomServer(http, options)
  return {
    http,
    listen({ port = 3030, host = '0.0.0.0' } = {}) {
      return new Promise((resolve, reject) => {
        const onError = error => { http.off('listening', onListening); reject(error) }
        const onListening = () => { http.off('error', onError); resolve(http.address()) }
        http.once('error', onError); http.once('listening', onListening); http.listen(port, host)
      })
    },
    close: () => service.close(),
  }
}
