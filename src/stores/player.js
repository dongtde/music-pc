import { reactive } from 'vue'
import { getSongUrl, registerAnonymous } from '../api/modules/netease'
import { STORAGE_KEYS } from '../config/app'
import { currentTrack as fallbackTrack, newSongs } from '../data/music'
import { useAuthStore } from './auth'
import { useLibraryStore } from './library'
import { readJsonStorage, readStorage, writeJsonStorage, writeStorage } from '../utils/storage'
import { parseCookieString } from '../utils/kugouAuth'
import { clampTime, formatTime, parseDuration, toFiniteNumber } from '../utils/time'
import {
  DEFAULT_AUDIO_QUALITY,
  getAudioQualityDefinition,
  getAudioQualityValuesForTrack,
  getTrackHighestAudioQuality,
  normalizeAudioQualityValue
} from '../utils/audioQuality'

const audio = new Audio()
const endedListeners = new Set()
const restoredSnapshot = readPlaybackSnapshot()
const initialPlaybackQuality = readPlaybackQuality()
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
  playbackQuality: initialPlaybackQuality,
  volume: 1
})

let lastPersistedSecond = Math.floor(state.currentTime)
let playbackClockFrame = 0

audio.volume = state.volume

audio.addEventListener('timeupdate', () => {
  syncAudioPlaybackTime({ persist: true })
})

audio.addEventListener('loadedmetadata', () => {
  state.duration = Number.isFinite(audio.duration) ? audio.duration : state.duration
  state.currentTrack.duration = formatTime(state.duration)
  syncAudioPlaybackTime()
  persistPlaybackSnapshot()
})

audio.addEventListener('play', () => {
  state.isPlaying = true
  syncAudioPlaybackTime()
  startPlaybackClock()
})

audio.addEventListener('pause', () => {
  syncAudioPlaybackTime({ persist: true })
  state.isPlaying = false
  stopPlaybackClock()
  persistPlaybackSnapshot()
})

audio.addEventListener('ended', () => {
  syncAudioPlaybackTime({ persist: true })
  state.isPlaying = false
  stopPlaybackClock()
  persistPlaybackSnapshot()
  notifyTrackEnded()
})

audio.addEventListener('seeked', () => {
  syncAudioPlaybackTime({ persist: true })
})

audio.addEventListener('error', () => {
  stopPlaybackClock()
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
      const preferredQuality = getTrackHighestAudioQuality(track)
      const playbackSource = await resolveBestPlaybackSource(track, preferredQuality)

      if (!playbackSource.url) {
        throw new Error('当前歌曲暂无可播放链接')
      }

      state.playbackQuality = playbackSource.quality
      persistPlaybackQuality(playbackSource.quality)
      state.currentTrack = normalizeTrack(track, playbackSource.url, playbackSource.quality)
      state.duration = parseDuration(state.currentTrack.duration)
      state.currentTime = 0
      lastPersistedSecond = 0
      audio.src = playbackSource.url
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
    const rawTime = Number(value)

    if (!Number.isFinite(rawTime)) {
      return
    }

    const nextTime = clampTime(rawTime, state.duration)

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
    const currentTime = Number.isFinite(audio.currentTime)
      ? audio.currentTime
      : state.currentTime

    return clampTime(currentTime, state.duration)
  }

  async function setPlaybackQuality(value) {
    const nextQuality = normalizeSelectablePlaybackQuality(value, state.currentTrack)
    const previousQuality = state.playbackQuality

    state.playbackQuality = nextQuality
    persistPlaybackQuality(nextQuality)

    if (previousQuality === nextQuality) {
      return true
    }

    if (!shouldReloadCurrentTrackForQuality(state.currentTrack)) {
      if (isRestorableTrack(state.currentTrack)) {
        state.currentTrack.playbackQuality = nextQuality
        state.currentTrack.playbackQualityLabel = getAudioQualityDefinition(nextQuality).shortLabel
        persistPlaybackSnapshot()
      }

      return true
    }

    const resumeTime = clampTime(getCurrentTime(), state.duration)
    const shouldResume = !audio.paused
    let appliedQuality = false

    state.isLoading = true
    state.error = null

    try {
      const songUrl = await resolvePlaybackUrl(state.currentTrack, nextQuality)

      if (!songUrl) {
        const quality = getAudioQualityDefinition(nextQuality)
        throw new Error(`${quality.shortLabel} 暂无可播放链接`)
      }

      state.currentTrack = normalizeTrack(state.currentTrack, songUrl, nextQuality)
      state.currentTrack.elapsed = formatTime(resumeTime)
      state.currentTime = resumeTime
      audio.src = songUrl
      appliedQuality = true

      try {
        audio.currentTime = resumeTime
      } catch (error) {
        console.warn('Failed to restore playback position after quality switch:', error)
      }

      if (shouldResume) {
        await audio.play()
      }

      persistPlaybackSnapshot()
      useLibraryStore().addRecentTrack(state.currentTrack)
      return true
    } catch (error) {
      if (!appliedQuality) {
        state.playbackQuality = previousQuality
        persistPlaybackQuality(previousQuality)

        if (isRestorableTrack(state.currentTrack)) {
          state.currentTrack.playbackQuality = previousQuality
          state.currentTrack.playbackQualityLabel = getAudioQualityDefinition(previousQuality).shortLabel
        }
      }

      state.error = error
      state.isPlaying = !audio.paused
      console.warn('Failed to switch playback quality:', error)
      return false
    } finally {
      state.isLoading = false
    }
  }

  return {
    state,
    playTrack,
    togglePlay,
    restartCurrentTrack,
    setQueue,
    setVolume,
    setPlaybackQuality,
    seekTo,
    getCurrentTime,
    onTrackEnded
  }
}

function syncAudioPlaybackTime(options = {}) {
  const currentTime = Number.isFinite(audio.currentTime)
    ? audio.currentTime
    : state.currentTime

  state.currentTime = clampTime(currentTime, state.duration)
  state.currentTrack.elapsed = formatTime(state.currentTime)

  if (options.persist) {
    persistPlaybackSnapshotThrottled()
  }

  return state.currentTime
}

function startPlaybackClock() {
  if (playbackClockFrame || typeof window === 'undefined') {
    return
  }

  const tick = () => {
    playbackClockFrame = 0

    if (audio.paused || audio.ended) {
      return
    }

    syncAudioPlaybackTime({ persist: true })
    playbackClockFrame = window.requestAnimationFrame(tick)
  }

  playbackClockFrame = window.requestAnimationFrame(tick)
}

function stopPlaybackClock() {
  if (!playbackClockFrame || typeof window === 'undefined') {
    return
  }

  window.cancelAnimationFrame(playbackClockFrame)
  playbackClockFrame = 0
}

async function resolveBestPlaybackSource(track, preferredQuality) {
  for (const quality of getPlaybackQualityCandidates(track, preferredQuality)) {
    const url = await resolvePlaybackUrl(track, quality)

    if (url) {
      return { url, quality }
    }
  }

  return { url: '', quality: normalizeSelectablePlaybackQuality(preferredQuality, track) }
}

function getPlaybackQualityCandidates(track, preferredQuality) {
  const availableQualities = getAudioQualityValuesForTrack(track)
  const normalizedPreferred = normalizeSelectablePlaybackQuality(preferredQuality, track)

  return [
    normalizedPreferred,
    ...availableQualities.filter((quality) => quality !== normalizedPreferred)
  ]
}

function normalizeSelectablePlaybackQuality(value, track = state.currentTrack) {
  const requestedQuality = normalizeAudioQualityValue(value)
  const availableQualities = getAudioQualityValuesForTrack(track)

  if (requestedQuality && availableQualities.includes(requestedQuality)) {
    return requestedQuality
  }

  return availableQualities[0] || DEFAULT_AUDIO_QUALITY
}

async function resolvePlaybackUrl(track, quality = state.playbackQuality) {
  if (track.localUrl) {
    return track.localUrl
  }

  if (String(track.id).startsWith('local-')) {
    throw new Error('本地文件需要重新导入后播放')
  }

  const auth = useAuthStore()
  const playbackCookie = await ensurePlaybackCookie(auth)
  const playbackQuality = normalizeAudioQualityValue(quality) || DEFAULT_AUDIO_QUALITY

  const response = await getSongUrl({
    id: track.id,
    hash: track.hash,
    album_audio_id: track.album_audio_id ?? track.mixsongid ?? track.audio_id,
    mixsongid: track.mixsongid,
    album_id: track.album_id ?? track.albumId,
    quality: playbackQuality,
    cookie: playbackCookie
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

function normalizeTrack(track, url, quality = state.playbackQuality) {
  const playbackQuality = normalizeAudioQualityValue(quality) || DEFAULT_AUDIO_QUALITY
  const qualityDefinition = getAudioQualityDefinition(playbackQuality)

  return {
    ...track,
    url,
    playbackQuality,
    playbackQualityLabel: qualityDefinition.shortLabel,
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
    playbackQuality: initialPlaybackQuality,
    qualities: [],
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
    qualities: track.qualities,
    playbackQuality: track.playbackQuality,
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

function shouldReloadCurrentTrackForQuality(track) {
  return Boolean(
    isRestorableTrack(track) &&
      audio.src &&
      !track.localUrl &&
      !String(track.id).startsWith('local-')
  )
}

function readPlaybackQuality() {
  const storedQuality = readStorage(STORAGE_KEYS.playbackQuality, DEFAULT_AUDIO_QUALITY)

  return normalizeAudioQualityValue(storedQuality) || DEFAULT_AUDIO_QUALITY
}

function persistPlaybackQuality(value) {
  const quality = normalizeAudioQualityValue(value) || DEFAULT_AUDIO_QUALITY

  if (!writeStorage(STORAGE_KEYS.playbackQuality, quality)) {
    console.warn('Failed to persist playback quality')
  }
}
