import { reactive } from 'vue'
import { getSongUrl, registerAnonymous } from '../api/modules/netease'
import { STORAGE_KEYS } from '../config/app'
import { currentTrack as fallbackTrack, newSongs } from '../data/music'
import { useAuthStore } from './auth'
import { useLibraryStore } from './library'
import { readJsonStorage, writeJsonStorage } from '../utils/storage'
import { parseCookieString } from '../utils/kugouAuth'
import { clampTime, formatTime, parseDuration, toFiniteNumber } from '../utils/time'

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

audio.addEventListener('error', () => {
  const mediaError = audio.error
  state.error = new Error(mediaError?.message || `Audio playback failed${mediaError?.code ? ` (${mediaError.code})` : ''}`)
  state.isPlaying = false
  console.warn('Audio element error:', {
    code: mediaError?.code,
    message: mediaError?.message,
    src: audio.currentSrc || audio.src
  })
})

audio.addEventListener('stalled', () => {
  console.warn('Audio playback stalled:', audio.currentSrc || audio.src)
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
      const songUrl = await resolvePlaybackUrl(track)

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
      useLibraryStore().addRecentTrack(state.currentTrack)
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

  function getCurrentTime() {
    return Number.isFinite(audio.currentTime)
      ? audio.currentTime
      : state.currentTime
  }

  return {
    state,
    playTrack,
    togglePlay,
    restartCurrentTrack,
    setQueue,
    setVolume,
    seekTo,
    getCurrentTime,
    onTrackEnded
  }
}

async function resolvePlaybackUrl(track) {
  if (track.localUrl) {
    return track.localUrl
  }

  if (String(track.id).startsWith('local-')) {
    throw new Error('本地文件需要重新导入后播放')
  }

  const auth = useAuthStore()
  if (!auth.state.cookie) {
    await auth.loginAsGuest()
  }
  await ensurePlaybackCookie(auth)

  const response = await getSongUrl({
    id: track.id,
    hash: track.hash,
    album_audio_id: track.album_audio_id ?? track.mixsongid ?? track.audio_id,
    mixsongid: track.mixsongid,
    album_id: track.album_id ?? track.albumId,
    quality: '128',
    cookie: auth.state.cookie
  })
  return normalizeDesktopPlaybackUrl(response.data?.[0]?.url || '')
}

function normalizeDesktopPlaybackUrl(url = '') {
  if (!url || typeof window === 'undefined' || !window.mappicDesktop || !/^https?:\/\//i.test(url)) {
    return url
  }

  return `/media?url=${encodeURIComponent(url)}`
}

async function ensurePlaybackCookie(auth) {
  const currentCookie = String(auth.state.cookie || '').trim()

  if (parseCookie(currentCookie).dfid) {
    return currentCookie
  }

  const response = await registerAnonymous({
    timestamp: Date.now(),
    noCookie: true
  }).catch(() => null)
  const guestCookie = response?.cookie || ''

  return auth.mergeAuthCookie?.(guestCookie) || currentCookie
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
  try {
    const snapshot = readJsonStorage(STORAGE_KEYS.playerSnapshot, null)
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
  try {
    if (!isRestorableTrack(state.currentTrack)) {
      writeJsonStorage(STORAGE_KEYS.playerSnapshot, null)
      return
    }

    writeJsonStorage(STORAGE_KEYS.playerSnapshot, {
      track: serializeTrack(state.currentTrack),
      currentTime: state.currentTime,
      duration: state.duration,
      updatedAt: Date.now()
    })
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
    thumbnailUrl: track.thumbnailUrl,
    coverPalette: track.coverPalette,
    source: track.source,
    artistId: track.artistId,
    albumId: track.albumId,
    hash: track.hash,
    album_audio_id: track.album_audio_id,
    mixsongid: track.mixsongid,
    album_id: track.album_id,
    audio_id: track.audio_id,
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

function parseCookie(cookie = '') {
  return parseCookieString(cookie)
}
