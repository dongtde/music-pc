import { fork } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Integration tests talk to a separate backend process, just like deployments.
export async function startListeningBackend(options = {}) {
  const child = fork(fileURLToPath(new URL('../../backend/test/fixture-process.js', import.meta.url)), [], {
    cwd: fileURLToPath(new URL('../../backend/', import.meta.url)),
    stdio: ['ignore', 'ignore', 'inherit', 'ipc'], windowsHide: true,
  })
  const url = await new Promise((resolve, reject) => {
    const finish = (error, value) => {
      clearTimeout(timer); child.off('message', onMessage); child.off('error', onError); child.off('exit', onExit)
      if (error) { child.kill(); reject(error) } else resolve(value)
    }
    const onMessage = message => {
      if (message.type === 'ready') finish(null, message.url)
      else if (message.type === 'error') finish(new Error(message.error))
    }
    const onError = error => finish(error)
    const onExit = code => finish(new Error(`Backend exited before startup (code ${code}). Run npm run backend:install first.`))
    const timer = setTimeout(() => finish(new Error('Backend startup timed out.')), 10000)
    child.on('message', onMessage); child.once('error', onError); child.once('exit', onExit)
    child.send({ type: 'start', options })
  })
  return {
    url,
    close() {
      if (child.exitCode !== null || child.signalCode) return Promise.resolve()
      return new Promise(resolve => {
        const timer = setTimeout(() => child.kill(), 5000)
        child.once('exit', () => { clearTimeout(timer); resolve() })
        if (child.connected) child.send({ type: 'stop' })
        else child.kill()
      })
    },
  }
}
