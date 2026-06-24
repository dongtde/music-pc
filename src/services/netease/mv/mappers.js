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
  const authors = Array.isArray(mv.authors) ? mv.authors : []
  const artistName =
    mv.artistName ||
    mv.creatorName ||
    mv.author_name ||
    mv.singername ||
    mv.artist_name ||
    getArtistNames(artists) ||
    getAuthorNames(authors) ||
    mv.artist?.name ||
    UNKNOWN_ARTIST
  const id =
    mv.id ??
    mv.mvid ??
    mv.mvId ??
    mv.vid ??
    mv.videoId ??
    mv.video_id ??
    mv.videoid ??
    mv.hash ??
    mv.video_hash ??
    mv.mvhash
  const hash =
    mv.hash ||
    mv.Hash ||
    mv.video_hash ||
    mv.VideoHash ||
    mv.mvhash ||
    mv.MVHash ||
    mv.mv_hash ||
    mv.mkv_hash ||
    mv.mkv_sd_hash ||
    mv.mkv_hd_hash ||
    mv.mkv_sq_hash ||
    mv.fhd_hash ||
    mv.fhd_hash_265 ||
    mv.qhd_hash ||
    mv.qhd_hash_265 ||
    mv.hd_hash ||
    mv.hd_hash_265 ||
    mv.sd_hash ||
    mv.sd_hash_265 ||
    mv.ld_hash ||
    mv.ld_hash_265 ||
    mv.file_hash ||
    mv.FileHash ||
    (/^\d+$/.test(String(id ?? '')) ? '' : id)
  const coverUrl =
    mv.cover ||
    mv.coverUrl ||
    mv.picUrl ||
    mv.imgurl ||
    mv.imgurl16v9 ||
    mv.coverImgUrl ||
    mv.imgUrl ||
    mv.imageUrl ||
    mv.picurl ||
    mv.hdpic ||
    mv.sizable_cover ||
    mv.video_cover
  const playCount =
    mv.playCount ??
    mv.playTime ??
    mv.plays ??
    mv.playcount ??
    mv.play_count ??
    mv.playCnt ??
    mv.play_times ??
    mv.history_heat ??
    mv.heat ??
    mv.views ??
    0
  const duration =
    mv.duration ??
    mv.durationms ??
    mv.durationMs ??
    mv.durationMillis ??
    mv.timelength ??
    mv.video_timelength ??
    0

  return {
    id,
    hash,
    videoId: mv.videoId ?? mv.video_id ?? mv.videoid ?? mv.vid ?? mv.mvid ?? mv.mvId ?? '',
    title: mv.name || mv.video_name || mv.title || mv.filename || UNKNOWN_MV,
    name: mv.name || mv.video_name || mv.title || mv.filename || UNKNOWN_MV,
    artist: artistName,
    artistId: mv.artistId ?? mv.artist?.id ?? mv.author_id ?? mv.singerid ?? authors[0]?.author_id ?? authors[0]?.id ?? artists[0]?.id ?? '',
    desc: mv.copywriter || mv.briefDesc || mv.desc || mv.description || mv.remark || mv.intro || mv.other_description || mv.topic || '',
    coverUrl: resizeNeteaseImage(coverUrl, 640),
    playCount: formatPlayCount(playCount),
    playCountRaw: Number(playCount) || 0,
    duration: formatDuration(duration),
    publishTime: formatPlainDate(mv.publishTime ?? mv.publishTimeStr ?? mv.publish_time ?? mv.publish_date),
    type: coverType(index || Number(id) || 0),
    score: mv.score ?? mv.lastRank ?? '',
    rank: mv.rank ?? '',
    subed: Boolean(mv.subed),
    liked: Boolean(mv.liked),
    videoType: 'mv'
  }
}

function getAuthorNames(authors = []) {
  return authors.map((artist) => artist.author_name || artist.name).filter(Boolean).join(' / ')
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
    data.intro,
    data.remark,
    data.other_description,
    data.topic,
    data.mv?.desc,
    data.mv?.description
  ]
  const text = candidates.find((item) => typeof item === 'string' && item.trim()) || ''

  return {
    title: data.title || data.name || data.video_name || data.mv?.name || '',
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
    .filter((item) =>
      item?.id ||
      item?.mvid ||
      item?.mvId ||
      item?.vid ||
      item?.videoId ||
      item?.video_id ||
      item?.hash ||
      item?.video_hash ||
      item?.mvhash
    )
}

export function toFiniteCount(value = 0) {
  const count = Number(value)

  return Number.isFinite(count) ? count : 0
}
