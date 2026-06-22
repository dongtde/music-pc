import { getLyric } from '../../api/modules/netease'
import { CACHE_TTL } from '../../config/app'
import { cacheKey, getCachedData } from '../cache'

export async function getTrackLyricData(track) {
  const params = typeof track === 'object' && track !== null
    ? {
        id: track.id,
        hash: track.hash,
        album_audio_id: track.album_audio_id ?? track.mixsongid ?? track.audio_id,
        duration: getTrackLyricDuration(track),
        keywords: getTrackLyricKeywords(track)
      }
    : { id: track }

  try {
    return await getCachedData(cacheKey('track-krc-lyric', getTrackLyricCachePayload(params)), CACHE_TTL.lyrics, async () => {
      const response = await getLyric(params)
      const lines = parseLyricLines(
        response.krc?.lyric ?? response.lrc?.lyric,
        response.tlyric?.lyric
      )

      if (!lines.length) {
        const error = new Error('NO_LYRIC_LINES')
        error.noLyrics = true
        throw error
      }

      return lines
    })
  } catch (error) {
    if (!error?.noLyrics) {
      throw error
    }

    return [{ time: '--:--', text: '暂无歌词', seconds: 0, placeholder: true }]
  }
}

export function parseLyricLines(lyric = '', translatedLyric = '') {
  const translatedLines = parseLrc(translatedLyric)
  const translatedByTime = new Map(
    translatedLines.map((line) => [line.seconds.toFixed(3), line.text])
  )
  const lines = isKrcLyric(lyric) ? parseKrc(lyric) : parseLrc(lyric)

  return lines.map((line) => {
    const translatedText = translatedByTime.get(line.seconds.toFixed(3))

    return {
      ...line,
      translation: translatedText && translatedText !== line.text ? translatedText : ''
    }
  })
}

function getTrackLyricKeywords(track = {}) {
  return track.name || track.songname || track.title || ''
}

function getTrackLyricDuration(track = {}) {
  const value =
    track.dt ??
    track.timelength ??
    track.timelen ??
    track.rawDuration ??
    track.duration ??
    track.time

  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0
      ? value > 10000 ? Math.round(value) : Math.round(value * 1000)
      : undefined
  }

  if (typeof value === 'string') {
    const parts = value.split(':').map((part) => Number(part))

    if (parts.length >= 2 && parts.every((part) => Number.isFinite(part))) {
      return Math.round(parts.reduce((total, part) => total * 60 + part, 0) * 1000)
    }
  }

  return undefined
}

function getTrackLyricCachePayload(params = {}) {
  const hash = params.hash || ''
  const albumAudioId = params.album_audio_id || params.mixsongid || ''
  const id = hash || albumAudioId ? '' : params.id || ''

  return {
    hash,
    album_audio_id: albumAudioId,
    id,
    duration: params.duration || '',
    keywords: params.keywords || params.keyword || ''
  }
}

function isKrcLyric(lyric = '') {
  return /\[\d+\s*,\s*\d+\]/.test(lyric) && /<\d+\s*,\s*\d+\s*,\s*\d+>/.test(lyric)
}

function parseKrc(lyric = '') {
  return lyric
    .split(/\r?\n/)
    .flatMap((line) => {
      const lineMatch = line.match(/^\[(\d+)\s*,\s*(\d+)\]/)

      if (!lineMatch) {
        return []
      }

      const startMs = Number(lineMatch[1])
      const durationMs = Number(lineMatch[2])
      const payload = line.slice(lineMatch[0].length).trim()

      if (!Number.isFinite(startMs) || !payload || isLyricMetadata(payload)) {
        return []
      }

      const words = parseKrcWords(payload, startMs)
      const text = words.map((word) => word.text).join('').trim()

      if (!text || isLyricMetadata(text)) {
        return []
      }

      return {
        time: formatLyricTime(startMs / 1000),
        text,
        seconds: startMs / 1000,
        duration: Number.isFinite(durationMs) ? durationMs / 1000 : 0,
        words
      }
    })
    .sort((current, next) => current.seconds - next.seconds)
}

function parseKrcWords(payload = '', lineStartMs = 0) {
  const words = []
  const pattern = /<(\d+)\s*,\s*(\d+)\s*,\s*(\d+)>([^<]*)/g
  let match

  while ((match = pattern.exec(payload)) !== null) {
    const offsetMs = Number(match[1])
    const durationMs = Number(match[2])
    const text = match[4] ?? ''

    if (!text) {
      continue
    }

    const absoluteStartMs = lineStartMs + (Number.isFinite(offsetMs) ? offsetMs : 0)

    words.push({
      text,
      seconds: absoluteStartMs / 1000,
      duration: Number.isFinite(durationMs) ? durationMs / 1000 : 0
    })
  }

  return words
}

function parseLrc(lyric = '') {
  return lyric
    .split(/\r?\n/)
    .flatMap((line) => {
      const timestamps = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)]
      const text = line.replace(/\[[^\]]+\]/g, '').trim()

      if (!timestamps.length || !text || isLyricMetadata(text)) {
        return []
      }

      return timestamps.map((match) => {
        const minutes = Number(match[1])
        const seconds = Number(match[2])
        const milliseconds = Number((match[3] ?? '0').padEnd(3, '0'))
        const totalSeconds = minutes * 60 + seconds + milliseconds / 1000

        return {
          time: formatLyricTime(totalSeconds),
          text,
          seconds: totalSeconds
        }
      })
    })
    .sort((current, next) => current.seconds - next.seconds)
}

function formatLyricTime(value) {
  const minutes = Math.floor(value / 60)
  const seconds = String(Math.floor(value % 60)).padStart(2, '0')

  return `${minutes}:${seconds}`
}

function isLyricMetadata(text) {
  return /^(作词|作曲|编曲|制作人|监制|录音|混音|母带|和声|发行|出品|版权)\s*[:：]/.test(text)
}
