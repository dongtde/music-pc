import {
  getArtistMvs as getKugouArtistMvs,
  getMvComments as getKugouMvComments,
  getMvDetail as getKugouMvDetail,
  getMvDetailInfo as getKugouMvDetailInfo,
  getMvUrl as getKugouMvUrl,
  getSimilarMvs as getKugouSimilarMvs
} from '../../../api/modules/netease'
import {
  getArtistMvs as getLegacyArtistMvs,
  getMvComments as getLegacyMvComments,
  getMvDetail as getLegacyMvDetail,
  getMvDetailInfo as getLegacyMvDetailInfo,
  getMvUrl as getLegacyMvUrl,
  getSimilarMvs as getLegacySimilarMvs,
  getUgcMv as getLegacyUgcMv
} from '../../../api/modules/neteaseLegacy'
import { isAbortError } from '../../../utils/request'
import { mapMvCommentResult } from '../comments'
import { getMvListPayload, mapMvEncyclopedia, mapMvStats, mapVideoMv } from './mappers'
import { getMvPlaybackUrl } from './playbackUrl'
import { formatPlainDate } from './shared'

export async function getMvPlaybackData(id, quality = 1080, options = {}, prefetchedPlaybackUrl = null, fallbackMv = {}) {
  const fallback = createFallbackMv(id, fallbackMv)
  const { onDetail, ...requestOptions } = options ?? {}

  if (!shouldUseKugouMvPlayback(id, fallback)) {
    return getLegacyMvPlaybackData(id, quality, requestOptions, prefetchedPlaybackUrl)
  }

  return getKugouMvPlaybackData(id, quality, requestOptions, prefetchedPlaybackUrl, fallback, onDetail)
}

async function getKugouMvPlaybackData(id, quality = 1080, options = {}, prefetchedPlaybackUrl = null, fallbackMv = {}, onDetail) {
  const fallback = createFallbackMv(id, fallbackMv)
  const detailResponse = await getKugouMvDetail(createMvDetailParams(id, fallback), options).catch(toOptionalMvResponse)
  const detail = getMvDetailPayload(detailResponse, fallback)
  const playbackHash = getMvPlaybackHashForQuality(quality, detail, fallback, { id })
  const playbackId = getMvPlaybackId(detail, fallback, { id })
  const brs = detail.brs ?? detail.urls ?? detail.urlInfo ?? getMvHashQualityOptions(detail, fallback)
  const requestParams = {
    id: playbackId,
    hash: playbackHash
  }
  const mvSource = mergePresentMvSources(fallback, detail, {
    id: playbackId,
    hash: playbackHash
  })
  const mv = mapVideoMv(mvSource)
  const baseMv = {
    ...mv,
    id: mv.id ?? playbackId ?? id,
    hash: mv.hash || playbackHash || '',
    platform: 'kugou',
    sourcePlatform: 'kugou',
    description: detail.desc || detail.description || detail.briefDesc || detail.intro || detail.remark || detail.other_description || '',
    publishTime: formatPlainDate(detail.publishTime ?? detail.publish_time ?? detail.publish_date),
    brs,
    stats: {},
    encyclopedia: mapMvEncyclopedia(detail)
  }

  emitDetailPayload(onDetail, {
    mv: baseMv,
    similar: [],
    artistMvs: [],
    comments: mapMvCommentResult({})
  })

  const [infoResponse, urlResponse, simiResponse, commentResponse] = await Promise.all([
    playbackHash
      ? getKugouMvDetailInfo({ hash: playbackHash }, options).catch(toOptionalMvResponse)
      : Promise.resolve({}),
    prefetchedPlaybackUrl
      ? Promise.resolve({})
      : playbackHash
        ? getKugouMvUrl({ hash: playbackHash, r: quality || 1080 }, options).catch(toOptionalMvResponse)
        : Promise.resolve({}),
    getKugouSimilarMvs(requestParams, options).catch(toOptionalMvResponse),
    getKugouMvComments({ ...requestParams, limit: 12, offset: 0 }, options).catch(toOptionalMvResponse)
  ])
  const ugcResponse = detail
  const playbackUrl = prefetchedPlaybackUrl ?? getMvPlaybackUrl({
    urlResponse,
    brs,
    detail: mvSource,
    ugcResponse,
    quality
  })
  const artistId = mv.artistId || detail.artistId || detail.author_id || detail.singerid || detail.artists?.[0]?.id
  const artistMvResponse = artistId
    ? await getKugouArtistMvs({ id: artistId, limit: 8 }, options).catch(toOptionalMvResponse)
    : {}

  return {
    mv: {
      ...baseMv,
      url: playbackUrl.url,
      urlQuality: playbackUrl.quality || quality || '',
      stats: mapMvStats(infoResponse),
      encyclopedia: mapMvEncyclopedia(ugcResponse)
    },
    similar: getMvListPayload(simiResponse).map(mapVideoMv),
    artistMvs: getMvListPayload(artistMvResponse).map(mapVideoMv),
    comments: mapMvCommentResult(commentResponse)
  }
}

function emitDetailPayload(onDetail, payload) {
  if (typeof onDetail !== 'function') {
    return
  }

  try {
    onDetail(payload)
  } catch (error) {
    console.warn('Failed to apply MV detail payload:', error)
  }
}

export async function getMvPlaybackUrlData(id, quality = 1080, fallbackMv = {}, options = {}) {
  if (!shouldUseKugouMvPlayback(id, fallbackMv)) {
    return getLegacyMvPlaybackUrlData(id, quality, fallbackMv, options)
  }

  return getKugouMvPlaybackUrlData(id, quality, fallbackMv, options)
}

async function getKugouMvPlaybackUrlData(id, quality = 1080, fallbackMv = {}, options = {}) {
  const playbackHash = getMvPlaybackHashForQuality(quality, fallbackMv, { id })

  if (!playbackHash) {
    throw new Error('MV hash is empty')
  }

  const urlResponse = await getKugouMvUrl({ hash: playbackHash, r: quality || 1080 }, options).catch(toOptionalMvResponse)
  const playbackUrl = getMvPlaybackUrl({
    urlResponse,
    brs: fallbackMv?.brs,
    detail: fallbackMv,
    ugcResponse: fallbackMv?.encyclopedia,
    quality
  })

  if (!playbackUrl.url) {
    throw new Error('MV playback url is empty')
  }

  return {
    url: playbackUrl.url,
    quality: playbackUrl.quality || quality || ''
  }
}

async function getLegacyMvPlaybackData(id, quality = 1080, options = {}, prefetchedPlaybackUrl = null) {
  const [detailResponse, infoResponse, urlResponse, simiResponse, commentResponse, ugcResponse] = await Promise.all([
    getLegacyMvDetail({ mvid: id }, options).catch(toOptionalMvResponse),
    getLegacyMvDetailInfo({ mvid: id }, options).catch(toOptionalMvResponse),
    prefetchedPlaybackUrl
      ? Promise.resolve({})
      : getLegacyMvUrl({ id, r: quality || 1080 }, options).catch(toOptionalMvResponse),
    getLegacySimilarMvs({ mvid: id }, options).catch(toOptionalMvResponse),
    getLegacyMvComments({ id, limit: 12, offset: 0 }, options).catch(toOptionalMvResponse),
    getLegacyUgcMv({ id }, options).catch(toOptionalMvResponse)
  ])
  const detail = detailResponse.data ?? detailResponse.mv ?? {}
  const mv = mapVideoMv(detail)
  const playbackUrl = prefetchedPlaybackUrl ?? getMvPlaybackUrl({
    urlResponse,
    brs: detail.brs,
    detail,
    ugcResponse,
    quality
  })
  const artistId = mv.artistId || detail.artistId || detail.artists?.[0]?.id
  const artistMvResponse = artistId
    ? await getLegacyArtistMvs({ id: artistId, limit: 8 }, options).catch(toOptionalMvResponse)
    : {}

  return {
    mv: {
      ...mv,
      id: mv.id ?? id,
      description: detail.desc || detail.description || detail.briefDesc || '',
      publishTime: formatPlainDate(detail.publishTime),
      brs: detail.brs ?? [],
      url: playbackUrl.url,
      urlQuality: playbackUrl.quality || quality || '',
      stats: mapMvStats(infoResponse),
      encyclopedia: mapMvEncyclopedia(ugcResponse)
    },
    similar: getMvListPayload(simiResponse).map(mapVideoMv),
    artistMvs: getMvListPayload(artistMvResponse).map(mapVideoMv),
    comments: mapMvCommentResult(commentResponse)
  }
}

async function getLegacyMvPlaybackUrlData(id, quality = 1080, fallbackMv = {}, options = {}) {
  const urlResponse = await getLegacyMvUrl({ id, r: quality || 1080 }, options).catch(toOptionalMvResponse)
  const playbackUrl = getMvPlaybackUrl({
    urlResponse,
    brs: fallbackMv?.brs,
    detail: fallbackMv,
    ugcResponse: fallbackMv?.encyclopedia,
    quality
  })

  if (!playbackUrl.url) {
    throw new Error('MV playback url is empty')
  }

  return {
    url: playbackUrl.url,
    quality: playbackUrl.quality || quality || ''
  }
}

function shouldUseKugouMvPlayback(id, fallbackMv = {}) {
  return Boolean(
    getMvPlaybackHash(fallbackMv, { id }) ||
      fallbackMv?.mvHash ||
      fallbackMv?.sourcePlatform === 'kugou' ||
      fallbackMv?.platform === 'kugou'
  )
}

function createFallbackMv(id, fallbackMv = {}) {
  return {
    ...(fallbackMv && typeof fallbackMv === 'object' ? fallbackMv : {}),
    id: fallbackMv?.id ?? id
  }
}

function createMvDetailParams(id, fallbackMv = {}) {
  return {
    id: getMvPlaybackId(fallbackMv, { id })
  }
}

function getMvDetailPayload(response = {}, fallbackMv = {}) {
  const data = response?.data ?? response
  const candidates = [
    response?.mv,
    response?.video,
    response?.detail,
    response?.info,
    data?.mv,
    data?.video,
    data?.detail,
    data?.info,
    Array.isArray(data) ? data[0] : data,
    fallbackMv
  ]

  return candidates.find(isPlainObject) ?? {}
}

function mergePresentMvSources(...sources) {
  const output = {}

  sources.forEach((source) => {
    if (!isPlainObject(source)) {
      return
    }

    Object.entries(source).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        output[key] = value
      }
    })
  })

  return output
}

function getMvPlaybackId(...sources) {
  const id = getFirstPresentValue([
    'id',
    'mvid',
    'mvId',
    'vid',
    'videoId',
    'video_id',
    'videoid'
  ], sources)

  if (id !== undefined && id !== null && id !== '') {
    return id
  }

  return getMvPlaybackHash(...sources)
}

function getMvPlaybackHashForQuality(quality = 1080, ...sources) {
  const candidates = getMvHashQualityOptions(...sources)

  if (!candidates.length) {
    return getMvPlaybackHash(...sources)
  }

  const targetQuality = Number(quality) || 1080

  return candidates
    .slice()
    .sort((current, next) => {
      const currentDistance = Math.abs((current.quality || targetQuality) - targetQuality)
      const nextDistance = Math.abs((next.quality || targetQuality) - targetQuality)

      if (currentDistance !== nextDistance) {
        return currentDistance - nextDistance
      }

      return (next.quality || 0) - (current.quality || 0)
    })[0]?.hash || getMvPlaybackHash(...sources)
}

function getMvHashQualityOptions(...sources) {
  const candidates = sources.flatMap((source) => collectMvHashQualityOptions(source))
  const seen = new Set()

  return candidates.filter((candidate) => {
    const key = `${candidate.quality}:${candidate.hash}`

    if (!candidate.hash || seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function collectMvHashQualityOptions(source, depth = 0) {
  if (!isPlainObject(source) || depth > 4) {
    return []
  }

  const candidates = [
    ...(source.hash && source.quality ? [{ hash: source.hash, quality: Number(source.quality) || 0 }] : []),
    ...collectHashFields(source, ['fhd_hash', 'fhd_hash_265'], 1080),
    ...collectHashFields(source, ['qhd_hash', 'qhd_hash_265', 'mkv_qhd_hash'], 960),
    ...collectHashFields(source, ['hd_hash', 'hd_hash_265', 'mkv_hd_hash'], 720),
    ...collectHashFields(source, ['sd_hash', 'sd_hash_265', 'mkv_sd_hash'], 480),
    ...collectHashFields(source, ['ld_hash', 'ld_hash_265', 'mkv_ld_hash'], 360)
  ]

  for (const key of ['data', 'info', 'detail', 'video', 'mv']) {
    candidates.push(...collectMvHashQualityOptions(source[key], depth + 1))
  }

  for (const key of ['videos', 'mvs', 'list', 'records', 'brs', 'urls', 'urlInfo']) {
    const nestedItems = Array.isArray(source[key]) ? source[key] : []
    candidates.push(...nestedItems.flatMap((item) => collectMvHashQualityOptions(item, depth + 1)))
  }

  return candidates
}

function collectHashFields(source, keys, fallbackQuality) {
  return keys
    .map((key) => ({
      hash: source[key],
      quality: getHashFieldQuality(source, key, fallbackQuality)
    }))
    .filter((item) => item.hash)
}

function getHashFieldQuality(source, key, fallbackQuality) {
  const prefix = key.replace(/_?hash(?:_265)?$/, '')
  const width = Number(source[`${prefix}_width`])
  const height = Number(source[`${prefix}_height`])
  const quality = [width, height].filter((value) => Number.isFinite(value) && value > 0)

  if (quality.length) {
    return Math.min(...quality)
  }

  return fallbackQuality
}

function getMvPlaybackHash(...sources) {
  const hash = getFirstPresentValue([
    'hash',
    'Hash',
    'videoHash',
    'VideoHash',
    'video_hash',
    'mvHash',
    'MVHash',
    'mvhash',
    'mv_hash',
    'mkv_hash',
    'mkv_sd_hash',
    'mkv_hd_hash',
    'mkv_sq_hash',
    'fhd_hash',
    'fhd_hash_265',
    'qhd_hash',
    'qhd_hash_265',
    'hd_hash',
    'hd_hash_265',
    'sd_hash',
    'sd_hash_265',
    'ld_hash',
    'ld_hash_265',
    'sd_hash',
    'hd_hash',
    'sq_hash',
    'h264_hash',
    'h265_hash',
    'file_hash',
    'FileHash'
  ], sources)

  if (hash !== undefined && hash !== null && hash !== '') {
    return hash
  }

  const id = getFirstPresentValue(['id'], sources)
  return id && !/^\d+$/.test(String(id)) ? id : ''
}

function getFirstPresentValue(keys, sources) {
  for (const source of sources) {
    if (!isPlainObject(source)) {
      continue
    }

    for (const key of keys) {
      const value = source[key]

      if (value !== undefined && value !== null && value !== '') {
        return value
      }
    }

    for (const key of ['data', 'info', 'detail', 'video', 'mv']) {
      const nestedValue = getFirstPresentValue(keys, [source[key]])

      if (nestedValue !== undefined && nestedValue !== null && nestedValue !== '') {
        return nestedValue
      }
    }

    for (const key of ['videos', 'mvs', 'list', 'records', 'brs', 'urls', 'urlInfo']) {
      const nestedItems = Array.isArray(source[key]) ? source[key] : []
      const nestedValue = getFirstPresentValue(keys, nestedItems)

      if (nestedValue !== undefined && nestedValue !== null && nestedValue !== '') {
        return nestedValue
      }
    }
  }

  return ''
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function toOptionalMvResponse(error) {
  if (isAbortError(error)) {
    throw error
  }

  return {}
}
