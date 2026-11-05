export function createListeningRoomProxy(target = 'http://127.0.0.1:3030') {
  return {
    '/listening-room/socket.io': { target, changeOrigin: true, ws: true },
    '/listening-room/rooms': { target, changeOrigin: true },
  }
}
