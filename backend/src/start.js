import { networkInterfaces } from 'node:os'
import { fileURLToPath } from 'node:url'
import { readConfig } from './config.js'
import { createListeningRoomApp } from './app.js'

let app
try {
  try { process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url))) }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  const config = readConfig()
  app = createListeningRoomApp(config)
  await app.listen(config)
  console.log(`一起听后端已启动：http://localhost:${config.port}`)
  console.log(`每个房间最多 ${config.capacity} 人，所有成员均可点歌和控制播放。`)
  if (config.publicUrl) console.log(`公共连接地址：${config.publicUrl}`)
  for (const item of Object.values(networkInterfaces()).flat()) {
    if (item?.family === 'IPv4' && !item.internal) console.log(`局域网后端地址：http://${item.address}:${config.port}`)
  }
  console.log('健康检查：/health · 房间列表：/listening-room/rooms · WebSocket：/listening-room/socket.io/')
} catch (error) {
  console.error(`一起听后端启动失败：${error.message}`)
  await app?.close()
  process.exitCode = 1
}

let closing = false
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
  if (closing) return
  closing = true
  await app?.close()
  process.exit(0)
})
