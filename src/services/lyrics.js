import { getTrackLyricData } from './netease'
import { createLruCache } from '../utils/lruCache'
import { createLyricPlaceholder } from '../utils/lyrics'

const lyricCache = createLruCache(96)

export function getTrackLyricCacheKey(track) {
  return [
    'track-lyrics',
    track?.id ?? track ?? '',
    track?.hash ?? '',
    track?.album_audio_id ?? track?.mixsongid ?? track?.audio_id ?? ''
  ].join(':')
}

export async function getCachedTrackLyrics(track, options = {}) {
  const {
    timeoutMs = 0,
    fallbackText = '暂无歌词'
  } = options
  const cacheKey = getTrackLyricCacheKey(track)
  const cachedLyrics = lyricCache.get(cacheKey)

  if (cachedLyrics) {
    return cachedLyrics
  }

  const lyricsRequest = loadTrackLyrics(track, { timeoutMs, fallbackText })
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

export function clearTrackLyricsCache() {
  lyricCache.clear()
}

async function loadTrackLyrics(track, options = {}) {
  const { timeoutMs, fallbackText } = options
  const lyrics = timeoutMs > 0
    ? await withTimeout(getTrackLyricData(track), timeoutMs)
    : await getTrackLyricData(track)

  return Array.isArray(lyrics) && lyrics.length
    ? lyrics
    : createLyricPlaceholder(fallbackText)
}

function withTimeout(promise, timeoutMs) {
  if (typeof window === 'undefined') {
    return promise
  }

  let timeoutId = 0
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error('歌词加载超时'))
    }, timeoutMs)
  })

  return Promise.race([promise, timeout]).finally(() => {
    window.clearTimeout(timeoutId)
  })
}
