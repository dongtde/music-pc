import { reactive } from 'vue'
import { getSongUrl } from '../api/modules/netease'
import { currentTrack as fallbackTrack, newSongs } from '../data/music'

const audio = new Audio()

const state = reactive({
  currentTrack: {
    ...fallbackTrack,
    id: 'fallback-current',
    elapsed: fallbackTrack.elapsed ?? '0:00',
    duration: fallbackTrack.duration ?? '0:00'
  },
  queue: newSongs.slice(0, 8).map((song, index) => ({
    ...song,
    id: song.id ?? `queue-${song.rank}`,
    rank: String(index + 1).padStart(2, '0')
  })),
  isPlaying: false,
  isLoading: false,
  currentTime: 84,
  duration: parseDuration(fallbackTrack.duration ?? '0:00'),
  error: null,
  volume: 1
})

audio.volume = state.volume

audio.addEventListener('timeupdate', () => {
  state.currentTime = audio.currentTime
  state.currentTrack.elapsed = formatTime(audio.currentTime)
})

audio.addEventListener('loadedmetadata', () => {
  state.duration = Number.isFinite(audio.duration) ? audio.duration : state.duration
  state.currentTrack.duration = formatTime(state.duration)
})

audio.addEventListener('play', () => {
  state.isPlaying = true
})

audio.addEventListener('pause', () => {
  state.isPlaying = false
})

audio.addEventListener('ended', () => {
  state.isPlaying = false
})

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
      audio.src = songUrl
      audio.currentTime = 0
      await audio.play()
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

  function setQueue(tracks) {
    state.queue = tracks
  }

  function setVolume(value) {
    const nextVolume = Math.min(1, Math.max(0, Number(value)))
    state.volume = nextVolume
    audio.volume = nextVolume
  }

  return {
    state,
    playTrack,
    togglePlay,
    setQueue,
    setVolume
  }
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
