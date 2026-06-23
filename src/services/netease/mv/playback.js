import {
  getArtistMvs as getNeteaseArtistMvs,
  getMvComments as getNeteaseMvComments,
  getMvDetail as getNeteaseMvDetail,
  getMvDetailInfo as getNeteaseMvDetailInfo,
  getMvUrl as getNeteaseMvUrl,
  getSimilarMvs as getNeteaseSimilarMvs,
  getUgcMv as getNeteaseUgcMv
} from '../../../api/modules/neteaseLegacy'
import { isAbortError } from '../../../utils/request'
import { mapMvCommentResult } from '../comments'
import { getMvListPayload, mapMvEncyclopedia, mapMvStats, mapVideoMv } from './mappers'
import { getMvPlaybackUrl } from './playbackUrl'
import { formatPlainDate } from './shared'

export async function getMvPlaybackData(id, quality = 1080, options = {}, prefetchedPlaybackUrl = null) {
  const [detailResponse, infoResponse, urlResponse, simiResponse, commentResponse, ugcResponse] = await Promise.all([
    getNeteaseMvDetail({ mvid: id }, options).catch(toOptionalMvResponse),
    getNeteaseMvDetailInfo({ mvid: id }, options).catch(toOptionalMvResponse),
    prefetchedPlaybackUrl
      ? Promise.resolve({})
      : getNeteaseMvUrl({ id, r: quality || 1080 }, options).catch(toOptionalMvResponse),
    getNeteaseSimilarMvs({ mvid: id }, options).catch(toOptionalMvResponse),
    getNeteaseMvComments({ id, limit: 12, offset: 0 }, options).catch(toOptionalMvResponse),
    getNeteaseUgcMv({ id }, options).catch(toOptionalMvResponse)
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
    ? await getNeteaseArtistMvs({ id: artistId, limit: 8 }, options).catch(toOptionalMvResponse)
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

export async function getMvPlaybackUrlData(id, quality = 1080, fallbackMv = {}, options = {}) {
  const urlResponse = await getNeteaseMvUrl({ id, r: quality || 1080 }, options).catch(toOptionalMvResponse)
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

function toOptionalMvResponse(error) {
  if (isAbortError(error)) {
    throw error
  }

  return {}
}
