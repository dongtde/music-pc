import { computed, shallowRef } from 'vue'
import { getTrackLyricData } from '../../services/netease'
import {
  createLyricPlaceholder,
  findCurrentLyricIndex,
  isNeteaseTrackId
} from './homeUtils'
import {
  LYRICS_LOAD_TIMEOUT_MS as lyricsLoadTimeoutMs
} from './homeConstants'

export function useHomeLyrics({ player }) {
  const lyricLines = shallowRef(createLyricPlaceholder('点击播放后显示歌词'))
  const isLyricLoading = shallowRef(false)
  const lyricCache = new Map()
  let lyricRequestId = 0

  const activeLyricIndex = computed(() =>
    findCurrentLyricIndex(lyricLines.value, player.state.currentTime)
  )
  const displayLyricLines = computed(() =>
    (lyricLines.value.length ? lyricLines.value : createLyricPlaceholder('暂无歌词'))
      .map((line, index) => ({
        ...line,
        index
      }))
  )

  async function loadActiveLyrics(trackId) {
    lyricRequestId += 1
    const requestId = lyricRequestId
    isLyricLoading.value = false
    lyricLines.value = createLyricPlaceholder(trackId ? '歌词加载中...' : '暂无歌词')

    if (!isNeteaseTrackId(trackId)) {
      lyricLines.value = createLyricPlaceholder('在线歌曲播放后显示歌词')
      return
    }

    isLyricLoading.value = true

    try {
      const lines = await getCachedTrackLyrics(trackId)

      if (requestId === lyricRequestId) {
        lyricLines.value = lines
      }
    } catch (error) {
      if (requestId === lyricRequestId) {
        console.warn('Failed to load feed lyrics:', error)
        lyricLines.value = createLyricPlaceholder('歌词加载失败')
      }
    } finally {
      if (requestId === lyricRequestId) {
        isLyricLoading.value = false
      }
    }
  }

  async function getCachedTrackLyrics(trackId) {
    const cacheKey = String(trackId)
    const cachedLyrics = lyricCache.get(cacheKey)

    if (cachedLyrics) {
      return cachedLyrics
    }

    const lyricsRequest = loadTrackLyricsWithTimeout(trackId)
      .then((lines) => {
        lyricCache.set(cacheKey, lines)
        return lines
      })
      .catch((error) => {
        lyricCache.delete(cacheKey)
        throw error
      })

    lyricCache.set(cacheKey, lyricsRequest)
    return lyricsRequest
  }

  function loadTrackLyricsWithTimeout(trackId) {
    let timeoutId = 0

    const timeout = new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => {
        reject(new Error('歌词加载超时'))
      }, lyricsLoadTimeoutMs)
    })

    return Promise.race([
      getTrackLyricData(trackId),
      timeout
    ]).finally(() => {
      window.clearTimeout(timeoutId)
    })
  }

  function seekToLyric({ seconds }) {
    player.seekTo(seconds)
  }

  function cleanupLyrics() {
    lyricRequestId += 1
  }

  return {
    lyricLines,
    isLyricLoading,
    displayLyricLines,
    activeLyricIndex,
    loadActiveLyrics,
    seekToLyric,
    cleanupLyrics
  }
}
