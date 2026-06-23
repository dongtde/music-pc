import { isVipSong } from '../../../utils/songAccess'
import {
  coverType,
  formatDate,
  formatDuration,
  formatPlayCount,
  getArtistIds,
  getKugouTrackMeta,
  isKugouCollectionId,
  resizeNeteaseImage,
  stableCoverIndex
} from './shared'

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

export function mapPlaylistDetail(playlist = {}) {
  const creator = playlist.creator ?? {}
  const playlistId = playlist.id ?? playlist.globalCollectionId ?? playlist.listid ?? playlist.listId ?? ''
  const trackCount = Number(playlist.trackCount ?? playlist.tracks?.length ?? 0) || 0
  const playCount = Number(playlist.playCount ?? 0) || 0
  const subscribedCount = Number(playlist.subscribedCount ?? 0) || 0
  const commentCount = Number(playlist.commentCount ?? 0) || 0
  const shareCount = Number(playlist.shareCount ?? 0) || 0

  return {
    id: playlistId,
    globalCollectionId: playlist.globalCollectionId || (isKugouCollectionId(playlistId) ? playlistId : ''),
    listid: playlist.listid ?? playlist.listId ?? '',
    title: playlist.name,
    description: playlist.description || playlist.copywriter || '这个歌单暂时没有简介',
    creator: creator.nickname || '酷狗音乐用户',
    creatorAvatarUrl: resizeNeteaseImage(creator.avatarUrl, 80),
    updated: formatDate(playlist.updateTime),
    trackCount,
    listeners: formatPlayCount(playCount),
    playCount,
    subscribedCount,
    commentCount,
    shareCount,
    tags: playlist.tags ?? [],
    type: coverType(stableCoverIndex(playlistId)),
    coverUrl: resizeNeteaseImage(playlist.coverImgUrl, 480)
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
