import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

class FakeAudio {
  static instance = null

  constructor() {
    this.currentTime = 0
    this.duration = 180
    this.error = null
    this.paused = true
    this._src = ''
    this.listeners = new Map()
    FakeAudio.instance = this
  }

  get src() {
    return this._src
  }

  set src(value) {
    this._src = String(value ?? '')
  }

  get currentSrc() {
    return this._src
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  async play() {
    this.paused = false
    this.dispatch('play')
    return true
  }

  pause() {
    this.paused = true
    this.dispatch('pause')
  }

  dispatch(type) {
    this.listeners.get(type)?.forEach((listener) => listener())
  }
}

globalThis.Audio = FakeAudio
globalThis.window = createWindowMock()

const originalWarn = console.warn
console.warn = (...args) => {
  if (String(args[0] ?? '').startsWith('Failed to play track:')) {
    return
  }

  originalWarn(...args)
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const reportDir = path.join(rootDir, 'reports', 'performance')
const reportPath = path.join(reportDir, 'player-smoke.md')
const vite = await createServer({
  root: rootDir,
  appType: 'custom',
  logLevel: 'error',
  server: {
    middlewareMode: true
  }
})

const { usePlayerStore } = await vite.ssrLoadModule('/src/stores/player.js')
const { getPlaybackErrorDisplay, PLAYBACK_ERROR_CODES } = await vite.ssrLoadModule('/src/utils/playbackError.js')

const checks = []
const player = usePlayerStore()
const tracks = [
  createLocalTrack('smoke-1', 'Smoke Track 1'),
  createLocalTrack('smoke-2', 'Smoke Track 2'),
  createLocalTrack('smoke-3', 'Smoke Track 3')
]

await runCheck('plays a local track without API lookup', async () => {
  player.setQueue(tracks, { type: 'smoke', id: 'player' })
  const played = await player.playTrack(tracks[0])

  assert(played, 'playTrack should resolve true for localUrl tracks')
  assert(player.state.currentTrack.id === 'smoke-1', 'currentTrack should be smoke-1')
  assert(player.state.isPlaying, 'state.isPlaying should be true after play')
})

await runCheck('resolves list and order queue navigation', async () => {
  player.setPlayMode('list')
  assert(player.getRelativeQueueTrack(1)?.id === 'smoke-2', 'list next should wrap through queue')
  assert(player.getRelativeQueueTrack(-1)?.id === 'smoke-3', 'list previous should wrap to queue tail')

  await player.playTrack(tracks[2])
  player.setPlayMode('order')
  assert(player.getRelativeQueueTrack(1) === null, 'order next at tail should stop')
  assert(player.getRelativeQueueTrack(-1)?.id === 'smoke-2', 'order previous should move back')
})

await runCheck('resolves single and shuffle modes', async () => {
  player.setPlayMode('single')
  assert(player.shouldRestartCurrentTrackOnEnded(), 'single mode should restart on ended')
  assert(player.getRelativeQueueTrack(1)?.id === 'smoke-3', 'single next should return current track')

  player.setPlayMode('shuffle')
  const shuffledTrack = player.getRelativeQueueTrack(1)
  assert(Boolean(shuffledTrack?.id), 'shuffle should return a queue track')
  assert(tracks.some((track) => track.id === shuffledTrack.id), 'shuffle result should be in queue')
})

await runCheck('syncs volume and ended listener state', async () => {
  player.setVolume(0.42)
  assert(player.state.volume === 0.42, 'state.volume should keep normalized volume')
  assert(FakeAudio.instance.volume === 0.42, 'audio.volume should sync with store volume')

  let endedTrackId = ''
  const unsubscribe = player.onTrackEnded((track) => {
    endedTrackId = String(track.id)
  })

  FakeAudio.instance.dispatch('ended')
  unsubscribe()

  assert(endedTrackId === String(player.state.currentTrack.id), 'ended listener should receive current track')
  assert(!player.state.isPlaying, 'state.isPlaying should be false after ended')
})

await runCheck('normalizes local file playback errors', async () => {
  const played = await player.playTrack({
    id: 'local-missing',
    name: 'Missing Local Track',
    artist: 'Smoke'
  })

  assert(!played, 'missing local track should fail')
  assert(
    player.state.error?.code === PLAYBACK_ERROR_CODES.LOCAL_FILE_MISSING,
    'missing local track should use LOCAL_FILE_MISSING'
  )
  assert(
    /重新导入/.test(getPlaybackErrorDisplay(player.state.error)),
    'display message should include recovery action'
  )
})

await writeReport()
await vite.close()

const failed = checks.filter((check) => !check.ok)

if (failed.length) {
  console.error(`Player smoke failed: ${failed.length}/${checks.length}`)
  failed.forEach((check) => {
    console.error(`- ${check.name}: ${check.error}`)
  })
  process.exit(1)
}

console.log(`Player smoke passed: ${checks.length}/${checks.length}`)
console.log(`Report written to ${path.relative(rootDir, reportPath).replace(/\\/g, '/')}`)

async function runCheck(name, fn) {
  try {
    await fn()
    checks.push({ name, ok: true })
  } catch (error) {
    checks.push({ name, ok: false, error: error?.message || String(error) })
  }
}

function createLocalTrack(id, name) {
  return {
    id,
    name,
    artist: 'Smoke Artist',
    duration: '3:00',
    localUrl: `blob:smoke-${id}`,
    qualities: []
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function createWindowMock() {
  const storage = new Map()

  return {
    localStorage: {
      getItem: (key) => storage.get(String(key)) ?? null,
      setItem: (key, value) => {
        storage.set(String(key), String(value))
      },
      removeItem: (key) => {
        storage.delete(String(key))
      }
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {}
  }
}

async function writeReport() {
  await fs.mkdir(reportDir, { recursive: true })

  const lines = [
    '# Player Smoke',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '| Check | Status | Detail |',
    '| --- | --- | --- |',
    ...checks.map((check) => (
      `| ${check.name} | ${check.ok ? 'PASS' : 'FAIL'} | ${check.ok ? '-' : escapeCell(check.error)} |`
    )),
    ''
  ]

  await fs.writeFile(reportPath, lines.join('\n'), 'utf8')
}

function escapeCell(value = '') {
  return String(value).replace(/\|/g, '\\|')
}
