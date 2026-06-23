import { getKugouRaw, getKnownSong, lyricRequestRegistry } from './client'
import { firstNonEmptyArray } from './base'
import { decodeBase64Utf8 } from './playback'

export async function toLyricResponse(params = {}) {
  const knownSong = getKnownSong(params.id)
  const searchParams = createLyricSearchParams(params, knownSong)
  const requestKey = getLyricRequestKey(searchParams)
  const pendingRequest = lyricRequestRegistry.get(requestKey)

  if (pendingRequest) {
    return pendingRequest
  }

  const request = loadLyricResponse(searchParams).finally(() => {
    lyricRequestRegistry.delete(requestKey)
  })
  lyricRequestRegistry.set(requestKey, request)

  return request
}

export async function loadLyricResponse(searchParams = {}) {
  if (!searchParams.hash && !searchParams.keywords) {
    return createEmptyLyricResponse()
  }

  const lyricSearch = await getKugouRaw('/search/lyric', searchParams).catch(() => ({}))
  const candidate = getLyricCandidate(lyricSearch)

  const lyricId = candidate?.id ?? candidate?.lyricid ?? candidate?.lyric_id ?? candidate?.download_id
  const accessKey = candidate?.accesskey ?? candidate?.access_key ?? candidate?.accessKey

  if (!lyricId || !accessKey) {
    return createEmptyLyricResponse(lyricSearch)
  }

  const lyricResponse = await getKugouRaw('/lyric', {
    id: lyricId,
    accesskey: accessKey,
    fmt: 'krc',
    decode: true
  }).catch(() => ({}))
  const lyricData = lyricResponse.data ?? lyricResponse
  const lyricContent =
    lyricData.decodeContent ||
    lyricData.decode_content ||
    lyricData.krc ||
    lyricData.lrc ||
    lyricData.lyric ||
    decodeBase64Utf8(lyricData.content) ||
    ''

  return {
    ...lyricResponse,
    krc: {
      lyric: lyricContent
    },
    lrc: {
      lyric: lyricContent
    },
    tlyric: {
      lyric: ''
    }
  }
}

export function createLyricSearchParams(params = {}, knownSong = {}) {
  const hash = String(params.hash ?? knownSong?.hash ?? '').trim()
  const keywords = String(params.keywords ?? params.keyword ?? knownSong?.songname ?? knownSong?.name ?? '').trim()
  const albumAudioId = params.album_audio_id ?? params.mixsongid ?? knownSong?.album_audio_id ?? knownSong?.mixsongid
  const duration = params.duration ?? knownSong?.duration
  const searchParams = {
    album_audio_id: albumAudioId,
    duration,
    man: params.man ?? 'no'
  }

  if (hash) {
    searchParams.hash = hash
  } else {
    searchParams.keywords = keywords
  }

  return searchParams
}

export function createEmptyLyricResponse(response = {}) {
  const base = response && typeof response === 'object' && !Array.isArray(response) ? response : {}

  return {
    ...base,
    lrc: {
      lyric: ''
    },
    tlyric: {
      lyric: ''
    }
  }
}

export function getLyricRequestKey(params = {}) {
  const hash = params.hash || ''
  const albumAudioId = params.album_audio_id || params.mixsongid || ''
  const id = hash || albumAudioId ? '' : params.id || ''
  const keywords = normalizeLyricKeyword(params.keywords || params.keyword || '')

  return [hash, albumAudioId, id, keywords, params.duration || '', params.man || 'no'].join('|')
}

export function normalizeLyricKeyword(value = '') {
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase()
}

export function getLyricCandidate(lyricSearch = {}) {
  return firstNonEmptyArray(
    lyricSearch.candidates,
    lyricSearch.data?.candidates,
    lyricSearch.data?.info,
    lyricSearch.data?.list,
    lyricSearch.data?.ugcandidates,
    lyricSearch.data?.ai_candidates,
    lyricSearch.info,
    lyricSearch.list,
    lyricSearch.ugcandidates,
    lyricSearch.ai_candidates
  )[0]
}

// Discovery and recommendations
