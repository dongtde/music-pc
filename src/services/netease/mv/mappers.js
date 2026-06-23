import {
  UNKNOWN_ARTIST,
  UNKNOWN_MV,
  coverType,
  formatDuration,
  formatPlainDate,
  formatPlayCount,
  getArtistNames,
  resizeNeteaseImage
} from './shared'

export function mapVideoMv(mv = {}, index = 0) {
  const artists = Array.isArray(mv.artists) ? mv.artists : []
  const artistName = mv.artistName || mv.creatorName || getArtistNames(artists) || mv.artist?.name || UNKNOWN_ARTIST
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
    title: mv.name || mv.title || UNKNOWN_MV,
    name: mv.name || mv.title || UNKNOWN_MV,
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

export function mapMvStats(response = {}) {
  const data = response.data ?? response

  return {
    likedCount: toFiniteCount(data.likedCount),
    shareCount: toFiniteCount(data.shareCount),
    commentCount: toFiniteCount(data.commentCount),
    liked: Boolean(data.liked)
  }
}

export function mapMvEncyclopedia(response = {}) {
  const data = response.data ?? response
  const candidates = [
    data.introduction,
    data.desc,
    data.description,
    data.briefDesc,
    data.mv?.desc,
    data.mv?.description
  ]
  const text = candidates.find((item) => typeof item === 'string' && item.trim()) || ''

  return {
    title: data.title || data.name || data.mv?.name || '',
    text,
    raw: data
  }
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

export function toFiniteCount(value = 0) {
  const count = Number(value)

  return Number.isFinite(count) ? count : 0
}
