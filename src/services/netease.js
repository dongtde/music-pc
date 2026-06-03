import {
  getBanners,
  getPersonalizedMvs,
  getPersonalizedNewSongs,
  getPersonalizedPlaylists,
  getPlaylistDetail,
  getPlaylistTracks
} from '../api/modules/netease'

const COVER_TYPES = ['sunset', 'neon', 'lofi', 'stage', 'piano']

export async function getHomeDiscoverData() {
  const [bannerResponse, playlistResponse, newsongResponse, mvResponse] = await Promise.all([
    getBanners({ type: 0 }),
    getPersonalizedPlaylists({ limit: 18 }),
    getPersonalizedNewSongs({ limit: 9 }),
    getPersonalizedMvs()
  ])

  const banners = (bannerResponse.banners ?? []).map(mapBanner)
  const playlists = (playlistResponse.result ?? []).map(mapPlaylist)
  const songs = (newsongResponse.result ?? []).map(mapNewsong)
  const mvs = (mvResponse.result ?? []).map(mapMv)

  return {
    heroSlides: banners.slice(0, 6),
    recommendPlaylists: playlists.slice(0, 12),
    latestPlaylistCards: playlists.slice(12, 18),
    recommendedSingles: songs,
    recommendedMvs: mvs
  }
}

export async function getPlaylistDetailData(id) {
  const detailResponse = await getPlaylistDetail({ id })
  const rawPlaylist = detailResponse.playlist

  if (!rawPlaylist) {
    throw new Error('Playlist detail is empty')
  }

  let tracks = rawPlaylist.tracks ?? []

  try {
    const trackResponse = await getPlaylistTracks({
      id,
      limit: rawPlaylist.trackCount || 1000,
      offset: 0
    })

    if (Array.isArray(trackResponse.songs) && trackResponse.songs.length) {
      tracks = trackResponse.songs
    }
  } catch (error) {
    console.warn('Failed to load full playlist tracks:', error)
  }

  return {
    playlist: mapPlaylistDetail(rawPlaylist),
    tracks: tracks.map(mapPlaylistTrack)
  }
}

function mapBanner(banner, index) {
  return {
    id: `${banner.targetType}-${banner.targetId || index}`,
    tag: banner.typeTitle || '推荐',
    title: banner.typeTitle || '网易云音乐推荐',
    desc: banner.url?.startsWith('http') ? '点击查看活动详情' : '来自网易云音乐的精选内容',
    action: '立即查看',
    link: `/playlist/banner-${banner.targetType}-${banner.targetId || index}`,
    tone: coverType(index),
    imageUrl: banner.imageUrl ?? banner.bigImageUrl
  }
}

function mapPlaylist(playlist, index) {
  return {
    id: playlist.id,
    title: playlist.name,
    desc: playlist.copywriter,
    listeners: formatPlayCount(playlist.playCount),
    type: coverType(index),
    coverUrl: playlist.picUrl
  }
}

function mapPlaylistDetail(playlist) {
  const creator = playlist.creator ?? {}

  return {
    id: playlist.id,
    title: playlist.name,
    description: playlist.description || playlist.copywriter || '这个歌单暂时没有简介',
    creator: creator.nickname || '网易云音乐用户',
    creatorAvatarUrl: creator.avatarUrl,
    updated: formatDate(playlist.updateTime),
    trackCount: playlist.trackCount ?? playlist.tracks?.length ?? 0,
    listeners: formatPlayCount(playlist.playCount),
    tags: playlist.tags ?? [],
    type: coverType(Number(playlist.id) || 0),
    coverUrl: playlist.coverImgUrl
  }
}

function mapPlaylistTrack(song, index) {
  const album = song.al ?? song.album ?? {}
  const artists = song.ar ?? song.artists ?? []

  return {
    id: song.id,
    name: song.name,
    artist: artists.map((artist) => artist.name).filter(Boolean).join(' / ') || '未知歌手',
    album: album.name || '未知专辑',
    rank: String(index + 1).padStart(2, '0'),
    type: coverType(index),
    time: formatDuration(song.dt ?? song.duration),
    coverUrl: album.picUrl,
    to: `/playlist/song-${song.id}`,
    vip: Boolean(song.fee && song.fee !== 0),
    hasVideo: Boolean(song.mv)
  }
}

function mapNewsong(item, index) {
  const song = item.song ?? item
  const album = song.album ?? song.al ?? {}
  const artists = song.artists ?? song.ar ?? []

  return {
    id: song.id ?? item.id,
    name: song.name ?? item.name,
    artist: artists.map((artist) => artist.name).filter(Boolean).join(' / ') || '未知歌手',
    album: album.name ?? '未知专辑',
    rank: String(index + 1).padStart(2, '0'),
    type: coverType(index),
    time: formatDuration(song.duration ?? song.dt),
    coverUrl: item.picUrl ?? album.picUrl
  }
}

function mapMv(mv, index) {
  return {
    id: mv.id,
    title: mv.name,
    artist: mv.artistName ?? mv.artists?.map((artist) => artist.name).join(' / ') ?? '',
    views: formatPlayCount(mv.playCount),
    duration: formatDuration(mv.duration),
    type: coverType(index),
    coverUrl: mv.picUrl
  }
}

function coverType(index) {
  return COVER_TYPES[index % COVER_TYPES.length]
}

function formatDuration(duration = 0) {
  const totalSeconds = Math.round(duration / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')

  return `${minutes}:${seconds}`
}

function formatPlayCount(count = 0) {
  if (count >= 100000000) {
    return `${trimNumber(count / 100000000)}亿`
  }

  if (count >= 10000) {
    return `${trimNumber(count / 10000)}万`
  }

  return String(count)
}

function trimNumber(number) {
  return Number(number.toFixed(1)).toString()
}

function formatDate(value) {
  if (!value) {
    return '最近更新'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '最近更新'
  }

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${date.getFullYear()}-${month}-${day} 更新`
}
