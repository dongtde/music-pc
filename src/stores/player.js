import { reactive } from 'vue'
import { getSongUrl } from '../api/modules/netease'
import { currentTrack as fallbackTrack, newSongs } from '../data/music'

const PLAYBACK_STORAGE_KEY = 'mappic:player:last-track'
const audio = new Audio()
const endedListeners = new Set()
const restoredSnapshot = readPlaybackSnapshot()
const initialTrack = restoredSnapshot?.track
  ? normalizeRestoredTrack(restoredSnapshot.track)
  : createEmptyTrack()
const initialDuration = restoredSnapshot?.duration ?? parseDuration(initialTrack.duration)
const initialCurrentTime = clampTime(restoredSnapshot?.currentTime ?? 0, initialDuration)

initialTrack.elapsed = formatTime(initialCurrentTime)

const state = reactive({
  currentTrack: initialTrack,
  queue: newSongs.map((song, index) => ({
    ...song,
    id: song.id ?? `queue-${song.rank}`,
    rank: String(index + 1).padStart(2, '0')
  })),
  isPlaying: false,
  isLoading: false,
  currentTime: initialCurrentTime,
  duration: initialDuration,
  error: null,
  volume: 1
})

let lastPersistedSecond = Math.floor(state.currentTime)

audio.volume = state.volume

audio.addEventListener('timeupdate', () => {
  state.currentTime = audio.currentTime
  state.currentTrack.elapsed = formatTime(audio.currentTime)
  persistPlaybackSnapshotThrottled()
})

audio.addEventListener('loadedmetadata', () => {
  state.duration = Number.isFinite(audio.duration) ? audio.duration : state.duration
  state.currentTrack.duration = formatTime(state.duration)
  persistPlaybackSnapshot()
})

audio.addEventListener('play', () => {
  state.isPlaying = true
})

audio.addEventListener('pause', () => {
  state.isPlaying = false
  persistPlaybackSnapshot()
})

audio.addEventListener('ended', () => {
  state.isPlaying = false
  persistPlaybackSnapshot()
  notifyTrackEnded()
})

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', persistPlaybackSnapshot)
}

export function usePlayerStore() {
  async function playTrack(track) {
    if (!track?.id) {
      return false
    }

    state.isLoading = true
    state.error = null

    try {
      const response = await getSongUrl({ id: track.id, level: 'standard' })
      const songUrl = response.data?.[0]?.url

      if (!songUrl) {
        throw new Error('当前歌曲暂无可播放链接')
      }

      state.currentTrack = normalizeTrack(track, songUrl)
      state.duration = parseDuration(state.currentTrack.duration)
      state.currentTime = 0
      lastPersistedSecond = 0
      audio.src = songUrl
      audio.currentTime = 0
      await audio.play()
      persistPlaybackSnapshot()
      return true
    } catch (error) {
      state.error = error
      state.isPlaying = false
      console.warn('Failed to play track:', error)
      return false
    } finally {
      state.isLoading = false
    }
  }

  async function togglePlay() {
    if (!audio.src) {
      return playTrack(state.currentTrack)
    }

    if (audio.paused) {
      try {
        await audio.play()
        return true
      } catch (error) {
        state.error = error
        state.isPlaying = false
        console.warn('Failed to resume track:', error)
        return false
      }
    }

    audio.pause()
    return true
  }

  async function restartCurrentTrack() {
    state.error = null

    if (!audio.src) {
      return playTrack(state.currentTrack)
    }

    try {
      audio.currentTime = 0
      state.currentTime = 0
      state.currentTrack.elapsed = '0:00'
      lastPersistedSecond = 0
      await audio.play()
      persistPlaybackSnapshot()
      return true
    } catch (error) {
      state.error = error
      state.isPlaying = false
      console.warn('Failed to restart track:', error)
      return false
    }
  }

  function setQueue(tracks) {
    state.queue = tracks
  }

  function setVolume(value) {
    const nextVolume = Math.min(1, Math.max(0, Number(value)))
    state.volume = nextVolume
    audio.volume = nextVolume
  }

  function seekTo(value) {
    const nextTime = Math.max(0, Number(value))

    if (!Number.isFinite(nextTime)) {
      return
    }

    if (audio.src) {
      audio.currentTime = nextTime
    }

    state.currentTime = nextTime
    state.currentTrack.elapsed = formatTime(nextTime)
    persistPlaybackSnapshot()
  }

  function onTrackEnded(listener) {
    endedListeners.add(listener)

    return () => {
      endedListeners.delete(listener)
    }
  }

  return {
    state,
    playTrack,
    togglePlay,
    restartCurrentTrack,
    setQueue,
    setVolume,
    seekTo,
    onTrackEnded
  }
}

function notifyTrackEnded() {
  endedListeners.forEach((listener) => {
    try {
      const result = listener(state.currentTrack)
      result?.catch?.((error) => {
        console.warn('Track ended listener failed:', error)
      })
    } catch (error) {
      console.warn('Track ended listener failed:', error)
    }
  })
}

function normalizeTrack(track, url) {
  return {
    ...track,
    url,
    elapsed: '0:00',
    duration: track.time ?? track.duration ?? '0:00',
    coverPalette: track.coverPalette ?? fallbackTrack.coverPalette
  }
}

function normalizeRestoredTrack(track) {
  const { url, elapsed, ...restoredTrack } = track

  return {
    ...restoredTrack,
    elapsed: elapsed ?? '0:00',
    duration: restoredTrack.duration ?? restoredTrack.time ?? '0:00',
    coverPalette: restoredTrack.coverPalette ?? fallbackTrack.coverPalette
  }
}

function createEmptyTrack() {
  return {
    id: null,
    name: '无播放歌曲',
    artist: '选择歌曲开始播放',
    elapsed: '0:00',
    duration: '0:00',
    coverPalette: fallbackTrack.coverPalette
  }
}

function readPlaybackSnapshot() {
  if (!canUseStorage()) {
    return null
  }

  try {
    const rawSnapshot = window.localStorage.getItem(PLAYBACK_STORAGE_KEY)

    if (!rawSnapshot) {
      return null
    }

    const snapshot = JSON.parse(rawSnapshot)
    const track = snapshot?.track

    if (!isRestorableTrack(track)) {
      return null
    }

    const duration = toFiniteNumber(
      snapshot.duration,
      parseDuration(track.duration ?? track.time ?? '0:00')
    )

    return {
      track,
      duration,
      currentTime: clampTime(snapshot.currentTime, duration)
    }
  } catch (error) {
    console.warn('Failed to restore last playback snapshot:', error)
    return null
  }
}

function persistPlaybackSnapshotThrottled() {
  const currentSecond = Math.floor(state.currentTime)

  if (currentSecond === lastPersistedSecond) {
    return
  }

  lastPersistedSecond = currentSecond
  persistPlaybackSnapshot()
}

function persistPlaybackSnapshot() {
  if (!canUseStorage()) {
    return
  }

  try {
    if (!isRestorableTrack(state.currentTrack)) {
      window.localStorage.removeItem(PLAYBACK_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(
      PLAYBACK_STORAGE_KEY,
      JSON.stringify({
        track: serializeTrack(state.currentTrack),
        currentTime: state.currentTime,
        duration: state.duration,
        updatedAt: Date.now()
      })
    )
  } catch (error) {
    console.warn('Failed to persist playback snapshot:', error)
  }
}

function serializeTrack(track) {
  return {
    id: track.id,
    name: track.name,
    artist: track.artist,
    album: track.album,
    rank: track.rank,
    type: track.type,
    time: track.time,
    duration: track.duration,
    coverUrl: track.coverUrl,
    coverPalette: track.coverPalette,
    likedCount: track.likedCount,
    likedCountLabel: track.likedCountLabel,
    commentCount: track.commentCount,
    commentCountLabel: track.commentCountLabel,
    vip: track.vip,
    hasVideo: track.hasVideo,
    to: track.to
  }
}

function isRestorableTrack(track) {
  return Boolean(track?.id && track?.name)
}

function canUseStorage() {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return Boolean(window.localStorage)
  } catch {
    return false
  }
}

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value)

  return Number.isFinite(number) ? number : fallback
}

function clampTime(value, duration = 0) {
  const currentTime = Math.max(0, toFiniteNumber(value, 0))

  return duration > 0 ? Math.min(currentTime, duration) : currentTime
}

function parseDuration(duration) {
  if (typeof duration !== 'string') {
    return 0
  }

  const parts = duration.split(':').map(Number)

  if (parts.some(Number.isNaN)) {
    return 0
  }

  return parts.reduce((total, part) => total * 60 + part, 0)
}

function formatTime(value = 0) {
  const totalSeconds = Math.max(0, Math.floor(value))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')

  return `${minutes}:${seconds}`
}
