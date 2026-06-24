import { computed, onMounted, onUnmounted, ref, unref, watch } from 'vue'
import { getCachedTrackLyrics } from '../services/lyrics'
import {
  createLyricPlaceholder,
  getLyricFrame,
  isNeteaseTrackId
} from '../utils/lyrics'
import { getMonotonicTimestamp } from '../utils/time'

const DEFAULT_COVER_PALETTE = {
  primary: '#213245',
  secondary: '#8bbad5',
  tertiary: '#e7a976'
}

const DESKTOP_LYRICS_CLOCK_INTERVAL_MS = 200
const DESKTOP_LYRICS_SEEK_PUBLISH_THRESHOLD = 0.45

export function useDesktopLyricsBridge(options = {}) {
  const {
    player,
    currentTrack,
    fallbackCoverPalette = DEFAULT_COVER_PALETTE,
    playPreviousTrack,
    playNextTrack,
    onPlaybackError,
    onToggleError
  } = options

  const available = computed(() =>
    Boolean(
      typeof window !== 'undefined' &&
        window.mappicDesktop?.desktopLyrics
    )
  )
  const windowOpen = ref(false)
  const locked = ref(false)
  const lyricLines = ref(createLyricPlaceholder('播放歌曲后显示歌词'))
  const loading = ref(false)
  const buttonLabel = computed(() => {
    if (windowOpen.value && locked.value) {
      return '解锁桌面歌词'
    }

    return windowOpen.value ? '关闭桌面歌词' : '桌面歌词'
  })

  let lyricRequestId = 0
  let publishTimer = 0
  let clockTimer = 0
  let removeWindowStateListener = null
  let removeCommandListener = null

  watch(
    () => getCurrentTrack().id,
    () => {
      loadLyrics(getCurrentTrack())
    },
    { immediate: true }
  )

  watch(
    () => [
      getCurrentTrack().id,
      getCurrentTrack().name,
      getCurrentTrack().artist,
      getCurrentTrack().coverUrl,
      getCurrentTrack().coverPalette?.primary,
      getCurrentTrack().coverPalette?.secondary,
      getCurrentTrack().coverPalette?.tertiary,
      player?.state?.duration,
      player?.state?.isPlaying,
      lyricLines.value,
      loading.value,
    ],
    () => schedulePublish({ immediate: true }),
    { immediate: true }
  )

  watch(
    () => player?.state?.currentTime,
    handlePlaybackTimeChange
  )

  watch(
    () => [
      windowOpen.value,
      player?.state?.isPlaying,
      getCurrentTrack().id,
    ],
    syncClock,
    { immediate: true }
  )

  async function toggle() {
    if (!available.value) {
      return
    }

    try {
      if (windowOpen.value && locked.value) {
        window.mappicDesktop.desktopLyrics.setLocked(false)
        updateWindowState({ open: true, locked: false })
        publishState()
        return
      }

      const state = await window.mappicDesktop.desktopLyrics.toggle()
      updateWindowState(state)
      publishState()
    } catch (error) {
      console.warn('Failed to toggle desktop lyrics:', error)
      onToggleError?.(error)
    }
  }

  async function loadLyrics(track) {
    const trackId = String(track?.id ?? track ?? '')
    lyricRequestId += 1
    const requestId = lyricRequestId
    loading.value = Boolean(trackId)
    lyricLines.value = createLyricPlaceholder(
      trackId ? '歌词加载中...' : '播放歌曲后显示歌词'
    )

    if (!isNeteaseTrackId(trackId)) {
      loading.value = false
      lyricLines.value = createLyricPlaceholder(
        trackId ? '暂无歌词' : '播放歌曲后显示歌词'
      )
      return
    }

    try {
      const lines = await getCachedTrackLyrics(track && typeof track === 'object' ? track : trackId)

      if (requestId !== lyricRequestId) {
        return
      }

      lyricLines.value = lines?.length
        ? lines
        : createLyricPlaceholder('暂无歌词')
    } catch (error) {
      if (requestId !== lyricRequestId) {
        return
      }

      console.warn('Failed to load desktop lyrics:', error)
      lyricLines.value = createLyricPlaceholder('歌词加载失败')
    } finally {
      if (requestId === lyricRequestId) {
        loading.value = false
      }
    }
  }

  function schedulePublish(scheduleOptions = {}) {
    if (!available.value) {
      return
    }

    if (scheduleOptions.immediate) {
      clearPublishTimer()
      publishState()
      return
    }

    if (publishTimer) {
      return
    }

    publishTimer = window.setTimeout(() => {
      publishTimer = 0
      publishState()
    }, 0)
  }

  function clearPublishTimer() {
    if (!publishTimer) {
      return
    }

    window.clearTimeout(publishTimer)
    publishTimer = 0
  }

  function publishState() {
    if (!available.value) {
      return
    }

    window.mappicDesktop.desktopLyrics.publishState(createPayload())
  }

  function createPayload() {
    const track = getCurrentTrack()
    const lines = normalizeLyricLines(lyricLines.value)
    const currentTime = getCurrentTime()
    const frame = getLyricFrame(lines, currentTime)

    return {
      track: {
        id: track.id,
        name: track.name,
        artist: track.artist,
        coverUrl: track.coverUrl,
        coverPalette: normalizePalette(track.coverPalette),
      },
      playback: {
        currentTime,
        duration: player?.state?.duration,
        isPlaying: player?.state?.isPlaying,
        updatedAt: getMonotonicTimestamp(),
      },
      lyrics: {
        lines,
        activeIndex: frame.activeIndex,
        activeLine: frame.activeLine,
        nextLine: frame.nextLine,
        progress: frame.progress,
        loading: loading.value,
      },
    }
  }

  function normalizeLyricLines(lines = []) {
    const normalizedLines = (Array.isArray(lines) && lines.length
      ? lines
      : createLyricPlaceholder('暂无歌词')
    ).map((line, index) => ({
      index,
      time: line.time || '--:--',
      text: line.text || '...',
      translation: line.translation || '',
      seconds: Number(line.seconds) || 0,
      duration: Number(line.duration) || 0,
      placeholder: Boolean(line.placeholder),
      words: Array.isArray(line.words)
        ? line.words.map((word) => ({
            text: word.text || '',
            seconds: Number(word.seconds) || 0,
            duration: Number(word.duration) || 0,
          }))
        : [],
    }))

    return normalizedLines.length
      ? normalizedLines
      : createLyricPlaceholder('暂无歌词')
  }

  function normalizePalette(palette = {}) {
    return {
      primary: palette.primary || fallbackCoverPalette.primary,
      secondary: palette.secondary || fallbackCoverPalette.secondary,
      tertiary: palette.tertiary || fallbackCoverPalette.tertiary,
    }
  }

  function handlePlaybackTimeChange(currentTime, previousTime) {
    if (!available.value || !windowOpen.value) {
      return
    }

    const current = Math.max(0, Number(currentTime) || 0)
    const previous = Math.max(0, Number(previousTime) || 0)
    const jumped = Math.abs(current - previous) >= DESKTOP_LYRICS_SEEK_PUBLISH_THRESHOLD

    if (!player?.state?.isPlaying || jumped) {
      schedulePublish({ immediate: true })
    }
  }

  function syncClock() {
    if (windowOpen.value && player?.state?.isPlaying) {
      startClock()
      return
    }

    stopClock()
  }

  function startClock() {
    if (!available.value || clockTimer) {
      return
    }

    clockTimer = window.setInterval(() => {
      if (!windowOpen.value || !player?.state?.isPlaying) {
        stopClock()
        return
      }

      publishState()
    }, DESKTOP_LYRICS_CLOCK_INTERVAL_MS)
    publishState()
  }

  function stopClock() {
    if (!clockTimer) {
      return
    }

    window.clearInterval(clockTimer)
    clockTimer = 0
  }

  function getCurrentTime() {
    const currentTime = typeof player?.getCurrentTime === 'function'
      ? player.getCurrentTime()
      : player?.state?.currentTime

    return Math.max(0, Number(currentTime) || 0)
  }

  function getCurrentTrack() {
    return unref(currentTrack) ?? {}
  }

  function updateWindowState(state = {}) {
    windowOpen.value = Boolean(state.open)
    locked.value = Boolean(state.locked)
  }

  async function handleCommand(command) {
    const action = typeof command === 'string' ? command : command?.action

    if (action === 'toggle-play') {
      const toggled = await player.togglePlay()
      onPlaybackError?.(toggled)
      publishState()
      syncClock()
      return
    }

    if (action === 'previous') {
      await playPreviousTrack?.()
      publishState()
      return
    }

    if (action === 'next') {
      await playNextTrack?.()
      publishState()
      return
    }

    if (action === 'hide') {
      windowOpen.value = false
      stopClock()
    }
  }

  onMounted(() => {
    if (!available.value) {
      return
    }

    removeWindowStateListener =
      window.mappicDesktop.desktopLyrics.onWindowState(updateWindowState)
    removeCommandListener =
      window.mappicDesktop.desktopLyrics.onCommand(handleCommand)

    window.mappicDesktop.desktopLyrics
      .getWindowState()
      .then(updateWindowState)
      .catch((error) => {
        console.warn('Failed to read desktop lyrics window state:', error)
      })
    publishState()
  })

  onUnmounted(() => {
    clearPublishTimer()
    stopClock()
    removeWindowStateListener?.()
    removeWindowStateListener = null
    removeCommandListener?.()
    removeCommandListener = null
  })

  return {
    available,
    windowOpen,
    locked,
    loading,
    buttonLabel,
    toggle,
    loadLyrics,
    publishState,
  }
}
