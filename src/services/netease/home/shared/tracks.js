import { isVipSong } from '../../../../utils/songAccess'
import {
  UNKNOWN_ALBUM,
  UNKNOWN_ARTIST,
  coverType,
  formatDuration,
  formatPlayCount,
  getArtistIds,
  getArtistNames,
  getKugouTrackMeta,
  resizeNeteaseImage,
  stableCoverIndex
} from './common'

export function mapBannerSong(song = {}, index = 0) {
  const album = song.al ?? song.album ?? {}
  const artists = song.ar ?? song.artists ?? []
  const artistIds = getArtistIds(artists)

  return {
    id: song.id,
    ...getKugouTrackMeta(song),
    name: song.name,
    artistId: artistIds[0] ?? '',
    artistIds,
    artist: getArtistNames(artists) || UNKNOWN_ARTIST,
    albumId: album.id ?? '',
    album: album.name || UNKNOWN_ALBUM,
    rank: String(index + 1).padStart(2, '0'),
    type: coverType(index),
    time: formatDuration(song.dt ?? song.duration),
    duration: formatDuration(song.dt ?? song.duration),
    coverUrl: album.picUrl ?? album.blurPicUrl,
    vip: isVipSong(song),
    hasVideo: Boolean(song.mv),
    mvId: song.mv || ''
  }
}

export function mapPlaylist(playlist = {}, index = 0) {
  return {
    id: playlist.id,
    globalCollectionId: playlist.globalCollectionId,
    listid: playlist.listid ?? playlist.listId,
    title: playlist.name,
    desc: playlist.copywriter || playlist.description || '',
    listeners: formatPlayCount(playlist.playCount),
    type: coverType(stableCoverIndex(playlist.id ?? index)),
    coverUrl: playlist.picUrl ?? playlist.coverImgUrl,
    trackCount: playlist.trackCount ?? 0,
    creator: playlist.creator?.nickname || '',
    subscribedCount: playlist.subscribedCount ?? 0,
    commentCount: playlist.commentCount ?? 0
  }
}

export function mapNewsong(item = {}, index = 0) {
  const song = item.song ?? item
  const album = song.album ?? song.al ?? {}
  const artists = song.artists ?? song.ar ?? []
  const artistIds = getArtistIds(artists)

  return {
    id: song.id ?? item.id,
    ...getKugouTrackMeta(song),
    name: song.name ?? item.name,
    artistId: artistIds[0] ?? '',
    artistIds,
    artist: getArtistNames(artists) || UNKNOWN_ARTIST,
    albumId: album.id ?? '',
    album: album.name ?? UNKNOWN_ALBUM,
    rank: String(index + 1).padStart(2, '0'),
    type: coverType(index),
    time: formatDuration(song.duration ?? song.dt),
    coverUrl: item.picUrl ?? album.picUrl,
    vip: isVipSong(song),
    hasVideo: Boolean(song.mv),
    mvId: song.mv || ''
  }
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
    artist: getArtistNames(artists) || UNKNOWN_ARTIST,
    album: album.name || UNKNOWN_ALBUM,
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
