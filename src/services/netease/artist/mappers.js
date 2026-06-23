import { isVipSong } from '../../../utils/songAccess'
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

export function mapArtist(artist = {}, index = 0) {
  const details = [
    artist.alias?.length ? artist.alias.join(' / ') : '',
    artist.musicSize ? `${artist.musicSize} \u9996\u6b4c` : '',
    artist.albumSize ? `${artist.albumSize} \u5f20\u4e13\u8f91` : ''
  ].filter(Boolean)

  return {
    id: artist.id,
    name: artist.name,
    tag: details.join(' \u00b7 '),
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
  const identities = [
    ...(artist.identities ?? []),
    ...(detail.secondaryExpertIdentiy ?? [])
      .slice(0, 4)
      .map((item) => item.expertIdentiyName)
  ].filter(Boolean)
  const description = artist.briefDesc || fallbackArtist.briefDesc || '\u8fd9\u4f4d\u6b4c\u624b\u6682\u65f6\u6ca1\u6709\u7b80\u4ecb\u3002'
  const rank = artist.rank?.rank ?? detail.rank?.rank ?? 0

  return {
    id: artist.id ?? fallbackArtist.id,
    name: artist.name ?? fallbackArtist.name ?? '\u6b4c\u624b\u8be6\u60c5',
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
    rank,
    followed: Boolean(dynamic.followed ?? artist.followed ?? fallbackArtist.followed),
    type: coverType(Number(artist.id ?? fallbackArtist.id) || 0)
  }
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
  const typeName = album.type || album.subType || '\u4e13\u8f91'
  const publishTime = formatAlbumDate(album.publishTime)

  return {
    id: album.id,
    title: album.name,
    artist,
    artistId: album.artist?.id ?? album.artists?.[0]?.id ?? '',
    desc: [artist, publishTime, songCount ? `${songCount} \u9996\u6b4c` : '', typeName].filter(Boolean).join(' \u00b7 '),
    listeners: album.playCount ? `${formatPlayCount(album.playCount)} \u64ad\u653e` : songCount ? `${songCount} \u9996\u6b4c` : typeName,
    type: coverType(index),
    typeName,
    coverUrl: resizeNeteaseImage(album.picUrl ?? album.blurPicUrl, 360),
    publishTime,
    company: album.company || '',
    songCount
  }
}

export function getAlbumArtist(album = {}) {
  return getArtistNames(album.artists) || album.artist?.name || '\u672a\u77e5\u6b4c\u624b'
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
    artist: artists.map((artist) => artist.name).filter(Boolean).join(' / ') || '\u672a\u77e5\u6b4c\u624b',
    album: album.name || '\u672a\u77e5\u4e13\u8f91',
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
  const artists = Array.isArray(ext.artists) ? ext.artists : []

  return {
    id,
    title: record.name || record.title || base.text || base.originalTitle || ext.song?.name || '\u89c6\u9891',
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
    to: id ? { name: 'video', query: { mvId: id } } : { name: 'video' }
  }
}
