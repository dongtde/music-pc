import { createListeningRoomApp } from '../src/app.js'
import { readConfig } from '../src/config.js'

// Vercel owns the listener. Keep HTTP discovery and Socket.IO in one function.
const app = createListeningRoomApp(readConfig())
export default app.http
