import {
  getAlbumDetail,
  getAlbumDynamic,
  getAlbumInfo,
  getAlbumSongs,
  getNewAlbums,
  getTopAlbums
} from '../../api/modules/netease'
import { COVER_TYPES } from '../../config/app'
import { normalizeAudioQualities } from '../../utils/audioQuality'
import { isAbortError } from '../../utils/request'
import { isVipSong, normalizeSongAccess } from '../../utils/songAccess'

export async function getAlbumsDiscoveryData({ area = 'ALL', limit = 36, offset = 0 } = {}, options = {}) {
  const shouldLoadFeatured = offset <= 0
  const [newAlbumResponse, topResponse] = await Promise.all([
    getNewAlbums({ type: getAlbumAreaType(area), limit, offset }, options).catch(toOptionalAlbumResponse),
    shouldLoadFeatured
      ? getTopAlbums({ limit: 16, offset: 0 }, options).catch(toOptionalAlbumResponse)
      : Promise.resolve({})
  ])
  const albums = newAlbumResponse.albums ?? []
  const total = newAlbumResponse.total ?? albums.length

  return {
    albums: albums.map((album, index) => mapAlbumCard(album, offset + index)),
    topAlbums: getTopAlbumList(topResponse).map(mapAlbumCard).slice(0, 10),
    total,
    more: getExplicitMore(newAlbumResponse) ?? false
  }
}

function getExplicitMore(source = {}) {
  if (!source || typeof source !== 'object') {
    return null
  }

  if ('hasMore' in source) {
    return Boolean(source.hasMore)
  }

  if ('has_more' in source) {
    return Boolean(source.has_more)
  }

  if ('has_next' in source) {
    return Boolean(source.has_next)
  }

  if ('more' in source) {
    return Boolean(source.more)
  }

  return null
}

export async function getAlbumDetailData(id, options = {}) {
  const [infoResponse, response, dynamicResponse, songsResponse] = await Promise.all([
    getAlbumInfo({
      album_id: id,
      fields: 'trans_param,special_tag,authors,album_name,publish_date,cover,intro,publish_company,type,album_id,language,category,author_name,sizable_cover'
    }, options).catch(toOptionalAlbumResponse),
    getAlbumDetail({ id }, options),
    getAlbumDynamic({ id }, options).catch(toOptionalAlbumResponse),
    getAlbumSongs({ id, limit: 100, offset: 0 }, options).catch(toOptionalAlbumResponse)
  ])
  const album = mergeAlbumSources(response.album, infoResponse.album)

  if (!album?.id) {
    throw new Error('Album detail is empty')
  }

  const songs = Array.isArray(response.songs) && response.songs.length
    ? response.songs
    : Array.isArray(songsResponse.songs) && songsResponse.songs.length
      ? songsResponse.songs
      : album.songs ?? []
  const normalizedAlbum = {
    ...album,
    size: album.size || songs.length
  }

  return {
    album: mapAlbumDetail(normalizedAlbum, dynamicResponse),
    tracks: songs.map(mapPlaylistTrack)
  }
}

function toOptionalAlbumResponse(error) {
  if (isAbortError(error)) {
    throw error
  }

  return {}
}

function getTopAlbumList(response = {}) {
  const candidates = [
    ...(response.albums ?? []),
    ...(response.weekData ?? []),
    ...(response.monthData ?? [])
  ]
  const seenIds = new Set()

  return candidates.filter((album) => {
    if (!album?.id || seenIds.has(album.id)) {
      return false
    }

    seenIds.add(album.id)
    return true
  })
}

function getAlbumAreaType(area) {
  const areaMap = {
    ZH: 1,
    EA: 2,
    JP: 3,
    KR: 4
  }

  return areaMap[String(area ?? '').toUpperCase()] || undefined
}

function mergeAlbumSources(...sources) {
  return sources
    .filter((source) => source && typeof source === 'object')
    .reduce((merged, source) => ({
      ...merged,
      ...Object.fromEntries(
        Object.entries(source).filter(([, value]) => value !== undefined && value !== null && value !== '')
      ),
      artist: mergePlainObject(merged.artist, source.artist),
      artists: source.artists?.length ? source.artists : merged.artists,
      info: mergePlainObject(merged.info, source.info)
    }), {})
}

function mergePlainObject(current, next) {
  return {
    ...(current && typeof current === 'object' ? current : {}),
    ...(next && typeof next === 'object' ? next : {})
  }
}

function mapAlbumCard(album = {}, index = 0) {
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

function getAlbumArtist(album = {}) {
  return getArtistNames(album.artists) || album.artist?.name || '未知歌手'
}

function mapAlbumDetail(album = {}, dynamic = {}) {
  const artist = getArtistNames(album.artists) || album.artist?.name || '未知歌手'

  return {
    id: album.id,
    title: album.name,
    description: album.description || album.briefDesc || `${artist} 的专辑`,
    artist,
    artistId: album.artist?.id ?? '',
    publishTime: formatDate(album.publishTime),
    company: album.company || '',
    size: album.size ?? album.songCount ?? 0,
    type: coverType(Number(album.id) || 0),
    coverUrl: album.picUrl,
    subCount: dynamic.subCount ?? album.info?.likedCount ?? 0,
    commentCount: dynamic.commentCount ?? album.info?.commentCount ?? 0,
    shareCount: dynamic.shareCount ?? album.info?.shareCount ?? 0,
    isSubscribed: Boolean(dynamic.isSub)
  }
}

function mapPlaylistTrack(song = {}, index = 0) {
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

function getArtistNames(artists = []) {
  return artists.map((artist) => artist.name).filter(Boolean).join(' / ')
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

function coverType(index) {
  return COVER_TYPES[Math.abs(Number(index) || 0) % COVER_TYPES.length]
}

function resizeNeteaseImage(url, size) {
  if (typeof url === 'string' && url.includes('{size}')) {
    return url.replace('{size}', String(size))
  }

  if (!url || !/music\.126\.net/.test(url)) {
    return url
  }

  const param = `param=${size}y${size}`

  if (/[?&]param=\d+y\d+/.test(url)) {
    return url.replace(/([?&])param=\d+y\d+/, `$1${param}`)
  }

  return `${url}${url.includes('?') ? '&' : '?'}${param}`
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

function formatAlbumDate(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${date.getFullYear()}-${month}-${day}`
}
