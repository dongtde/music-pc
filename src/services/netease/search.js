import {
  getCloudSearch,
  getSearchHotDetail,
  getSearchMultiMatch,
  getSearchSuggestPc
} from '../../api/modules/netease'
import { CACHE_TTL } from '../../config/app'
import { normalizeAudioQualities } from '../../utils/audioQuality'
import { isVipSong, normalizeSongAccess } from '../../utils/songAccess'
import { cacheKey, getCachedData } from '../cache'

export async function getSearchBootData() {
  return getCachedData('search-boot', CACHE_TTL.searchBoot, async () => {
    const hotResponse = await getSearchHotDetail().catch(() => ({}))
    const hotKeywords = (hotResponse.data ?? []).map(mapHotKeyword)

    return {
      defaultKeyword: hotKeywords[0]?.keyword || '',
      hotKeywords
    }
  })
}

export async function getSearchSuggestData(keyword) {
  const query = String(keyword ?? '').trim()

  if (!query) {
    return {
      keywordSuggestions: [],
      matches: [],
      songs: [],
      artists: [],
      albums: [],
      playlists: []
    }
  }

  const [suggestResponse, matchResponse] = await Promise.all([
    getSearchSuggestPc({ keyword: query }).catch(() => ({})),
    getSearchMultiMatch({ keywords: query }).catch(() => ({}))
  ])
  const legacyResult = suggestResponse.result ?? {}
  const enhancedResult = suggestResponse.data ?? {}

  return {
    keywordSuggestions: (enhancedResult.suggests ?? []).slice(0, 10).map(mapKeywordSuggestion),
    matches: mapMultiMatches(matchResponse.result),
    songs: (legacyResult.songs ?? []).slice(0, 6).map(mapSearchSong),
    artists: (legacyResult.artists ?? []).slice(0, 4).map(mapSearchArtist),
    albums: (legacyResult.albums ?? []).slice(0, 4).map(mapSearchAlbum),
    playlists: (legacyResult.playlists ?? []).slice(0, 4).map(mapSearchPlaylist)
  }
}

export async function getSearchResultData({ keyword, type = 1, limit = 20, offset = 0 }) {
  const query = String(keyword ?? '').trim()

  if (!query) {
    return {
      items: [],
      total: 0,
      hasMore: false
    }
  }

  const response = await getCloudSearch({
    keywords: query,
    type,
    limit,
    offset
  })
  const result = response.result ?? {}

  return {
    items: mapSearchItemsByType(result, type),
    total: getSearchTotalByType(result, type),
    hasMore: Boolean(result.hasMore || result.more)
  }
}

function mapHotKeyword(item, index) {
  return {
    id: item.searchWord || `hot-${index}`,
    keyword: item.searchWord || item.keyword || '',
    score: item.score ?? 0,
    content: item.content || item.iconDesc || '',
    iconUrl: item.iconUrl,
    type: item.iconType
  }
}

function mapKeywordSuggestion(item, index) {
  return {
    id: item.keyword || `suggest-${index}`,
    type: 'keyword',
    title: item.keyword || item.showText || '',
    subtitle: item.resourceName || item.tag || '相关搜索',
    iconUrl: item.iconUrl,
    highLightInfo: item.highLightInfo
  }
}

function mapMultiMatches(result = {}) {
  return [
    ...(result.orders ?? []).map((item) => ({
      id: `order-${item.keyword}`,
      type: 'keyword',
      title: item.keyword,
      subtitle: '相关搜索'
    })),
    ...(result.artist ?? []).map((item) => ({
      id: `artist-${item.id}`,
      type: 'artist',
      title: item.name,
      subtitle: item.alias?.join(' / ') || '歌手',
      coverUrl: item.picUrl ?? item.img1v1Url,
      to: `/artist/${item.id}`
    })),
    ...(result.album ?? []).map((item) => ({
      id: `album-${item.id}`,
      type: 'album',
      title: item.name,
      subtitle: item.artist?.name || '专辑',
      coverUrl: item.picUrl
    }))
  ].filter((item) => item.title)
}

function mapSearchItemsByType(result, type) {
  const maps = {
    1: () => (result.songs ?? []).map(mapSearchSong),
    10: () => (result.albums ?? []).map(mapSearchAlbum),
    100: () => (result.artists ?? []).map(mapSearchArtist),
    1000: () => (result.playlists ?? []).map(mapSearchPlaylist),
    1002: () => (result.userprofiles ?? []).map(mapSearchUser),
    1004: () => (result.mvs ?? []).map(mapSearchMv)
  }

  return (maps[type] ?? maps[1])()
}

function getSearchTotalByType(result, type) {
  const totalKeys = {
    1: 'songCount',
    10: 'albumCount',
    100: 'artistCount',
    1000: 'playlistCount',
    1002: 'userprofileCount',
    1004: 'mvCount'
  }

  return result[totalKeys[type]] ?? 0
}

function mapSearchSong(song, index = 0) {
  const album = song.al ?? song.album ?? {}
  const artists = song.ar ?? song.artists ?? []
  const artistIds = getArtistIds(artists)

  return {
    id: song.id,
    ...getKugouTrackMeta(song),
    type: 'song',
    name: song.name,
    title: song.name,
    artistId: artistIds[0] ?? '',
    artistIds,
    artist: artists.map((artist) => artist.name).filter(Boolean).join(' / ') || '未知歌手',
    albumId: album.id ?? '',
    album: album.name || '未知专辑',
    rank: String(index + 1).padStart(2, '0'),
    time: formatDuration(song.dt ?? song.duration),
    duration: formatDuration(song.dt ?? song.duration),
    coverUrl: album.picUrl,
    to: `/playlist/song-${song.id}`,
    vip: isVipSong(song),
    hasVideo: Boolean(song.mv),
    mvId: song.mv || ''
  }
}

function mapSearchArtist(artist) {
  return {
    id: artist.id,
    type: 'artist',
    title: artist.name,
    name: artist.name,
    subtitle: [
      artist.alias?.length ? artist.alias.join(' / ') : '',
      artist.musicSize ? `${artist.musicSize} 首歌` : '',
      artist.albumSize ? `${artist.albumSize} 张专辑` : ''
    ].filter(Boolean).join(' · '),
    coverUrl: artist.picUrl ?? artist.img1v1Url,
    to: `/artist/${artist.id}`
  }
}

function mapSearchAlbum(album) {
  return {
    id: album.id,
    type: 'album',
    title: album.name,
    name: album.name,
    subtitle: [
      album.artist?.name,
      album.size ? `${album.size} 首歌` : '',
      formatDate(album.publishTime)
    ].filter(Boolean).join(' · '),
    coverUrl: album.picUrl,
    to: `/album/${album.id}`
  }
}

function mapSearchPlaylist(playlist) {
  return {
    id: playlist.id,
    type: 'playlist',
    title: playlist.name,
    name: playlist.name,
    subtitle: [
      playlist.creator?.nickname,
      playlist.trackCount ? `${playlist.trackCount} 首歌` : '',
      playlist.playCount ? `${formatPlayCount(playlist.playCount)}播放` : ''
    ].filter(Boolean).join(' · '),
    coverUrl: playlist.coverImgUrl,
    to: `/playlist/${playlist.id}`
  }
}

function mapSearchUser(user) {
  return {
    id: user.userId,
    type: 'user',
    title: user.nickname,
    name: user.nickname,
    subtitle: user.signature || `${formatPlayCount(user.followeds)} 粉丝`,
    coverUrl: user.avatarUrl
  }
}

function mapSearchMv(mv) {
  return {
    id: mv.id,
    type: 'mv',
    title: mv.name,
    name: mv.name,
    subtitle: [
      mv.artistName ?? mv.artists?.map((artist) => artist.name).join(' / '),
      mv.playCount ? `${formatPlayCount(mv.playCount)}播放` : '',
      formatDuration(mv.duration)
    ].filter(Boolean).join(' · '),
    coverUrl: mv.cover ?? mv.imgurl ?? mv.picUrl,
    to: mv.id ? { name: 'video', query: { mvId: mv.id } } : { name: 'video' }
  }
}

function getArtistIds(artists = []) {
  return artists
    .map((artist) => artist.id)
    .filter((id) => id !== undefined && id !== null && id !== '')
}

function getKugouTrackMeta(song = {}) {
  const access = normalizeSongAccess(song)

  return {
    hash: song.hash || song.file_hash || song.audio_hash || song.hash_128 || song['128hash'] || '',
    album_audio_id: song.album_audio_id ?? song.mixsongid ?? song.add_mixsongid ?? song.audio_id ?? '',
    mixsongid: song.mixsongid ?? song.add_mixsongid ?? song.album_audio_id ?? '',
    album_id: song.album_id ?? song.album?.id ?? song.al?.id ?? '',
    audio_id: song.audio_id ?? song.rp_id ?? '',
    qualities: normalizeAudioQualities(song),
    fee: access.fee,
    vip: access.vip,
    accessType: access.accessType,
    accessBadges: access.badges,
    songAccess: access
  }
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
