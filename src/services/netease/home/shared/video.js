import {
  UNKNOWN_CREATOR,
  coverType,
  formatDuration,
  formatPlainDate,
  formatPlayCount,
  getArtistNames,
  resizeNeteaseImage
} from './common'

export function mapHomeTopMv(item = {}, index = 0) {
  const nestedMv = item.mv ?? {}
  const duration = item.duration || getTopMvVideoDuration(nestedMv)
  const mv = {
    ...nestedMv,
    ...item,
    duration,
    artists: item.artists ?? nestedMv.artists,
    cover: item.cover ?? nestedMv.cover,
    coverUrl: item.coverUrl ?? item.cover ?? nestedMv.coverUrl,
    picUrl: item.picUrl ?? item.cover ?? nestedMv.picUrl,
    playCount: item.playCount ?? nestedMv.playCount ?? nestedMv.plays,
    publishTime: item.publishTime ?? nestedMv.publishTime,
    name: item.name ?? nestedMv.name ?? nestedMv.title,
    title: item.name ?? nestedMv.title ?? nestedMv.name
  }

  return mapVideoMv(mv, index)
}

export function getTopMvVideoDuration(mv = {}) {
  const videos = Array.isArray(mv.videos) ? mv.videos : []
  const video = videos.find((item) => Number(item?.duration) > 0)

  return video?.duration ?? mv.duration ?? 0
}

export function mapVideoMv(mv = {}, index = 0) {
  const artists = Array.isArray(mv.artists) ? mv.artists : []
  const artistName = mv.artistName || mv.creatorName || getArtistNames(artists) || mv.artist?.name || UNKNOWN_CREATOR
  const id = mv.id ?? mv.mvid ?? mv.mvId ?? mv.vid ?? mv.videoId
  const coverUrl =
    mv.cover ||
    mv.coverUrl ||
    mv.picUrl ||
    mv.imgurl ||
    mv.imgurl16v9 ||
    mv.coverImgUrl ||
    mv.imgUrl ||
    mv.imageUrl ||
    mv.picurl
  const playCount = mv.playCount ?? mv.playTime ?? mv.plays ?? mv.playcount ?? mv.play_count ?? mv.playCnt ?? mv.views ?? 0
  const duration = mv.duration ?? mv.durationms ?? mv.durationMs ?? mv.durationMillis ?? 0

  return {
    id,
    title: mv.name || mv.title || '\u672a\u547d\u540d MV',
    name: mv.name || mv.title || '\u672a\u547d\u540d MV',
    artist: artistName,
    artistId: mv.artistId ?? mv.artist?.id ?? artists[0]?.id ?? '',
    desc: mv.copywriter || mv.briefDesc || mv.desc || mv.description || '',
    coverUrl: resizeNeteaseImage(coverUrl, 640),
    playCount: formatPlayCount(playCount),
    playCountRaw: Number(playCount) || 0,
    duration: formatDuration(duration),
    publishTime: formatPlainDate(mv.publishTime ?? mv.publishTimeStr),
    type: coverType(index || Number(id) || 0),
    score: mv.score ?? mv.lastRank ?? '',
    rank: mv.rank ?? '',
    subed: Boolean(mv.subed),
    liked: Boolean(mv.liked),
    videoType: 'mv'
  }
}

export function getHomeTopMvPayload(response = {}) {
  const data = response.data ?? response
  const items = Array.isArray(data) ? data : []

  return items.length ? items : getMvListPayload(response)
}

export function getMvListPayload(response = {}) {
  const candidates = [
    response.data,
    response.result,
    response.mvs,
    response.list,
    response.data?.list,
    response.data?.mvs,
    response.data?.mvList,
    response.data?.records,
    response.mvList,
    response.newWorks,
    response.works
  ]
  const items = candidates.find((item) => Array.isArray(item)) ?? []

  return items
    .map((item) => item.mv ?? item.resource?.mv ?? item.resource ?? item)
    .filter((item) => item?.id || item?.mvid || item?.mvId || item?.vid || item?.videoId)
}
