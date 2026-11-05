import { createListeningRoomApp } from '../src/app.js'

let app, closing = false
async function close(code = 0) {
  if (closing) return
  closing = true
  await app?.close()
  process.exit(code)
}
process.on('message', async message => {
  if (message.type === 'stop') return close()
  if (message.type !== 'start' || app) return
  try {
    app = createListeningRoomApp(message.options)
    const address = await app.listen({ host: '127.0.0.1', port: 0 })
    process.send({ type: 'ready', url: `http://127.0.0.1:${address.port}` })
  } catch (error) {
    process.send?.({ type: 'error', error: error.message })
    await close(1)
  }
})
process.on('disconnect', () => close())
