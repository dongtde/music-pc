import { isVipSong } from '../../../utils/songAccess'
import { createKugouMvRouteTarget } from '../../../utils/mv'
import {
  coverType,
  formatAlbumDate,
  formatDate,
  formatDuration,
  formatPlainDate,
  formatPlayCount,
  getArtistIds,
  getArtistNames,
  getKugouTrackMeta,
  resizeNeteaseImage
} from './shared'

const ARTIST_AREA_NAMES = {
  1: '华语',
  2: '欧美',
  3: '日韩',
  4: '其他',
  5: '日本',
  6: '韩国'
}

export function mapArtist(artist = {}, index = 0) {
  const details = [
    artist.alias?.length ? artist.alias.join(' / ') : '',
    artist.musicSize ? `${artist.musicSize} 首歌` : '',
    artist.albumSize ? `${artist.albumSize} 张专辑` : ''
  ].filter(Boolean)

  return {
    id: artist.id,
    name: artist.name,
    tag: details.join(' · '),
    details,
    coverUrl: resizeNeteaseImage(artist.img1v1Url ?? artist.picUrl, 240),
    followers: formatPlayCount(artist.fansCount ?? artist.followeds ?? artist.accountId ?? 0),
    score: artist.score ?? 0,
    type: coverType(index)
  }
}

export function mapRankedArtist(item = {}, index = 0) {
  const artist = item.artist ?? item

  return {
    ...mapArtist(artist, index),
    rank: String(index + 1).padStart(2, '0'),
    score: item.score ?? artist.score ?? 0,
    trend: item.lastRank ? `${item.lastRank}` : index < 3 ? 'HOT' : ''
  }
}

export function mapArtistDetail(artist = {}, detail = {}, fallbackArtist = {}) {
  const dynamic = detail.dynamic ?? {}
  const dynamicVideoCount = getArtistDynamicVideoCount(dynamic.videoNum)
  const aliases = artist.alias ?? fallbackArtist.alias ?? []
  const longIntro = Array.isArray(artist.longIntro)
    ? artist.longIntro
    : Array.isArray(detail.long_intro)
      ? detail.long_intro
      : []
  const basicProfile = getArtistBasicProfile(longIntro)
  const identities = [
    ...(artist.identities ?? []),
    ...(detail.secondaryExpertIdentiy ?? [])
      .slice(0, 4)
      .map((item) => item.expertIdentiyName)
  ].filter(Boolean)
  const description = artist.briefDesc || fallbackArtist.briefDesc || '这位歌手暂时没有简介。'
  const rank = artist.rank?.rank ?? detail.rank?.rank ?? 0
  const birthday = artist.birthday || fallbackArtist.birthday || detail.birthday || ''
  const areaName = getArtistAreaName(
    artist.area_id ?? artist.areaId ?? fallbackArtist.area_id ?? detail.area_id
  )

  return {
    id: artist.id ?? fallbackArtist.id,
    name: artist.name ?? fallbackArtist.name ?? '歌手详情',
    aliases,
    identity: artist.identifyTag || detail.identify?.imageDesc || identities.join(' / '),
    identities: [...new Set(identities)].slice(0, 6),
    description,
    coverUrl: resizeNeteaseImage(artist.cover ?? artist.picUrl ?? fallbackArtist.picUrl, 520),
    avatarUrl: resizeNeteaseImage(artist.avatar ?? artist.img1v1Url ?? fallbackArtist.img1v1Url, 300),
    albumSize: artist.albumSize ?? fallbackArtist.albumSize ?? 0,
    musicSize: artist.musicSize ?? fallbackArtist.musicSize ?? 0,
    mvSize: artist.mvSize ?? fallbackArtist.mvSize ?? dynamicVideoCount ?? detail.videoCount ?? 0,
    videoCount: dynamicVideoCount ?? detail.videoCount ?? artist.mvSize ?? fallbackArtist.mvSize ?? 0,
    fansCount: artist.fansCount ?? fallbackArtist.fansCount ?? artist.followeds ?? 0,
    birthday,
    areaName,
    occupation: getProfileValue(basicProfile, ['职业']),
    origin: getProfileValue(basicProfile, ['出生地', '地区']),
    score: artist.score ?? fallbackArtist.score ?? 0,
    pinyinInitial: artist.pinyin_initial ?? artist.pinyinInitial ?? detail.pinyin_initial ?? '',
    rank,
    followed: Boolean(dynamic.followed ?? artist.followed ?? fallbackArtist.followed),
    type: coverType(Number(artist.id ?? fallbackArtist.id) || 0)
  }
}

function getArtistAreaName(value) {
  const key = String(value ?? '').trim()

  return ARTIST_AREA_NAMES[key] || ''
}

function getArtistBasicProfile(longIntro = []) {
  const section = longIntro.find((item) => /基本资料/.test(item?.title || item?.ti || ''))
  const content = section?.content || section?.txt || ''

  return content.split(/\r?\n/).reduce((profile, line) => {
    const [key, ...valueParts] = line.split(/[：:]/)
    const value = valueParts.join(':').trim()

    if (key && value) {
      profile[key.trim()] = value
    }

    return profile
  }, {})
}

function getProfileValue(profile = {}, keys = []) {
  for (const key of keys) {
    const value = profile[key]

    if (value) {
      return value
    }
  }

  return ''
}

export function getArtistDynamicVideoCount(videoNum = []) {
  const totalItem = videoNum.find((item) => Number(item.cat) === 0)
  const mvItem = videoNum.find((item) => Number(item.cat) === 1)
  const value = totalItem?.num ?? mvItem?.num

  return Number.isFinite(Number(value)) ? Number(value) : undefined
}

export function mapAlbumCard(album = {}, index = 0) {
  const artist = getAlbumArtist(album)
  const songCount = album.size ?? album.songCount ?? 0
  const typeName = album.type || album.subType || '专辑'
  const publishTime = formatAlbumDate(album.publishTime)

  return {
    id: album.id,
    title: album.name,
    artist,
    artistId: album.artist?.id ?? album.artists?.[0]?.id ?? '',
    desc: [artist, publishTime, songCount ? `${songCount} 首歌` : '', typeName].filter(Boolean).join(' · '),
    listeners: album.playCount ? `${formatPlayCount(album.playCount)} 播放` : songCount ? `${songCount} 首歌` : typeName,
    type: coverType(index),
    typeName,
    coverUrl: resizeNeteaseImage(album.picUrl ?? album.blurPicUrl, 360),
    publishTime,
    company: album.company || '',
    songCount
  }
}

export function getAlbumArtist(album = {}) {
  return getArtistNames(album.artists) || album.artist?.name || '未知歌手'
}

export function mapPlaylistTrack(song = {}, index = 0) {
  const album = song.al ?? song.album ?? {}
  const artists = song.ar ?? song.artists ?? []
  const artistIds = getArtistIds(artists)
  const trackId = song.id ?? song.album_audio_id ?? song.mixsongid ?? song.hash ?? `track-${index + 1}`

  return {
    id: trackId,
    ...getKugouTrackMeta(song),
    name: song.name,
    artistId: artistIds[0] ?? '',
    artistIds,
    artist: artists.map((artist) => artist.name).filter(Boolean).join(' / ') || '未知歌手',
    album: album.name || '未知专辑',
    rank: String(index + 1).padStart(2, '0'),
    albumId: album.id ?? '',
    type: coverType(index),
    time: formatDuration(song.dt ?? song.duration),
    coverUrl: album.picUrl || album.blurPicUrl,
    thumbnailUrl: resizeNeteaseImage(album.picUrl, 96),
    to: `/playlist/song-${trackId}`,
    vip: isVipSong(song),
    hasVideo: Boolean(song.mv),
    mvId: song.mv || ''
  }
}

export function mapArtistVideo(record = {}, index = 0) {
  const resource = record.resource ?? {}
  const base = resource.mlogBaseData ?? record.mlogBaseData ?? {}
  const ext = resource.mlogExtVO ?? record.mlogExtVO ?? {}
  const id = base.id ?? record.id
  const hash = getMvHash(record, base, ext)
  const artists = Array.isArray(ext.artists) ? ext.artists : []
  const to = id
    ? createKugouMvRouteTarget({ mvId: id, mvHash: hash }, record, base, ext)
    : { name: 'kugou-video' }

  return {
    id,
    hash,
    title: record.name || record.title || base.text || base.originalTitle || ext.song?.name || '视频',
    description: record.desc || base.desc || '',
    artist: record.artistName || ext.artistName || getArtistNames(artists),
    coverUrl: resizeNeteaseImage(record.cover || record.coverUrl || base.coverUrl, 480),
    duration: formatDuration(record.duration ?? base.duration),
    playCount: formatPlayCount(record.playCount ?? ext.playCount ?? 0),
    likedCount: formatPlayCount(ext.likedCount ?? 0),
    publishTime: formatPlainDate(record.publishTime) || formatDate(base.pubTime),
    songName: ext.song?.name || '',
    shareUrl: resource.shareUrl || '',
    type: coverType(index),
    to
  }
}

function getMvHash(...sources) {
  for (const source of sources) {
    if (!source || typeof source !== 'object') {
      continue
    }

    const hash =
      source.hash ||
      source.Hash ||
      source.video_hash ||
      source.VideoHash ||
      source.mvhash ||
      source.MVHash ||
      source.mv_hash ||
      source.mkv_hash ||
      source.mkv_sd_hash ||
      source.mkv_hd_hash ||
      source.mkv_sq_hash ||
      source.fhd_hash ||
      source.fhd_hash_265 ||
      source.qhd_hash ||
      source.qhd_hash_265 ||
      source.hd_hash ||
      source.hd_hash_265 ||
      source.sd_hash ||
      source.sd_hash_265 ||
      source.ld_hash ||
      source.ld_hash_265

    if (hash) {
      return hash
    }
  }

  return ''
}
