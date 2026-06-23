import {
  getArtistMvs as getNeteaseArtistMvs,
  getMvComments as getNeteaseMvComments,
  getMvDetail as getNeteaseMvDetail,
  getMvDetailInfo as getNeteaseMvDetailInfo,
  getMvUrl as getNeteaseMvUrl,
  getSimilarMvs as getNeteaseSimilarMvs,
  getUgcMv as getNeteaseUgcMv
} from '../../../api/modules/neteaseLegacy'
import { mapMvCommentResult } from '../comments'
import { getMvListPayload, mapMvEncyclopedia, mapMvStats, mapVideoMv } from './mappers'
import { getMvPlaybackUrl } from './playbackUrl'
import { formatPlainDate } from './shared'

export async function getMvPlaybackData(id, quality = 1080) {
  const [detailResponse, infoResponse, urlResponse, simiResponse, commentResponse, ugcResponse] = await Promise.all([
    getNeteaseMvDetail({ mvid: id }).catch(() => ({})),
    getNeteaseMvDetailInfo({ mvid: id }).catch(() => ({})),
    getNeteaseMvUrl({ id, r: quality || 1080 }).catch(() => ({})),
    getNeteaseSimilarMvs({ mvid: id }).catch(() => ({})),
    getNeteaseMvComments({ id, limit: 12, offset: 0 }).catch(() => ({})),
    getNeteaseUgcMv({ id }).catch(() => ({}))
  ])
  const detail = detailResponse.data ?? detailResponse.mv ?? {}
  const mv = mapVideoMv(detail)
  const playbackUrl = getMvPlaybackUrl({
    urlResponse,
    brs: detail.brs,
    detail,
    ugcResponse,
    quality
  })
  const artistId = mv.artistId || detail.artistId || detail.artists?.[0]?.id
  const artistMvResponse = artistId
    ? await getNeteaseArtistMvs({ id: artistId, limit: 8 }).catch(() => ({}))
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
