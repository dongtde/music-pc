import {
  getArtistAlbums,
  getArtistDesc,
  getArtistDetail,
  getArtistDynamic,
  getArtistHotSongs,
  getArtistList,
  getArtistSongs,
  getArtistToplist,
  getArtistVideos
} from '../../api/modules/netease'
import { COVER_TYPES } from '../../config/app'
import { normalizeAudioQualities } from '../../utils/audioQuality'
import { isVipSong, normalizeSongAccess } from '../../utils/songAccess'

let artistToplistPromise = null

export async function getArtistsDiscoveryData({
  area = -1,
  type = -1,
  initial = -1,
  limit = 32,
  offset = 0
} = {}) {
  const artistListParams = getKugouArtistListParams({
    area,
    type,
    initial,
    limit,
    offset
  })
  const [artistResponse, toplistResponse] = await Promise.all([
    getArtistList(artistListParams).catch(() => ({})),
    getArtistToplistCached().catch(() => ({}))
  ])
  const artistPage = getKugouArtistPage(artistResponse, {
    initial,
    limit,
    offset
  })

  return {
    artists: artistPage.items.map((artist, index) => mapArtist(artist, offset + index)),
    topArtists: getKugouHotArtists(toplistResponse).slice(0, 10).map(mapRankedArtist),
    more: artistPage.more
  }
}

export async function getArtistDetailData(id) {
  const [detailResponse, songsResponse, dynamicResponse] = await Promise.all([
    getArtistDetail({ id }),
    getArtistHotSongs({ id }).catch(() => ({})),
    getArtistDynamic({ id }).catch(() => ({}))
  ])
  const detail = detailResponse.data ?? {}
  const artist = detail.artist ?? songsResponse.artist

  if (!artist) {
    throw new Error('Artist detail is empty')
  }

  const hotSongs = Array.isArray(songsResponse.hotSongs)
    ? songsResponse.hotSongs
    : Array.isArray(songsResponse.songs)
      ? songsResponse.songs
      : []

  return {
    artist: mapArtistDetail(artist, { ...detail, dynamic: dynamicResponse }, songsResponse.artist),
    tracks: hotSongs.map(mapPlaylistTrack)
  }
}

export async function getArtistSongsData({ id, limit = 30, offset = 0, order = 'hot' } = {}) {
  const response = await getArtistSongs({
    id,
    limit,
    offset,
    order
  })
  const songs = response.songs ?? []
  const total = response.total ?? songs.length

  return {
    tracks: songs.map((song, index) => mapPlaylistTrack(song, offset + index)),
    total,
    more: Boolean(response.more || (total && offset + songs.length < total))
  }
}

export async function getArtistAlbumsData({ id, limit = 30, offset = 0 } = {}) {
  const response = await getArtistAlbums({
    id,
    limit,
    offset
  })
  const albums = response.hotAlbums ?? []

  return {
    albums: albums.map((album, index) => mapAlbumCard(album, offset + index)),
    artist: response.artist ? mapArtist(response.artist, 0) : null,
    more: Boolean(response.more),
    total: response.total ?? response.artist?.albumSize ?? albums.length
  }
}

export async function getArtistVideosData({ id, size = 24, cursor = 0, order = 0 } = {}) {
  const response = await getArtistVideos({
    id,
    size,
    cursor,
    order
  })
  const page = response.data?.page ?? {}
  const records = response.data?.records ?? []

  return {
    videos: records.map(mapArtistVideo),
    cursor: page.cursor ?? '',
    more: Boolean(page.more)
  }
}

export async function getArtistIntroData(id) {
  const response = await getArtistDesc({ id })
  const detail = response.data ?? response
  const artist = response.artist ?? detail.artist ?? {}
  const sections = Array.isArray(detail.long_intro)
    ? detail.long_intro
    : Array.isArray(artist.longIntro)
      ? artist.longIntro
      : []

  return {
    briefDesc: artist.briefDesc || detail.intro || response.briefDesc || '',
    sections: sections.map((section, index) => ({
      id: `${section.title || section.ti || 'intro'}-${index}`,
      title: section.title || section.ti || '\u8be6\u60c5',
      text: section.content || section.txt || ''
    })).filter((section) => section.text)
  }
}

function getArtistToplistCached() {
  if (!artistToplistPromise) {
    artistToplistPromise = getArtistToplist({ type: 0, sextypes: 0, hotsize: 10 }).catch((error) => {
      artistToplistPromise = null
      throw error
    })
  }

  return artistToplistPromise
}

function getKugouArtistListParams({ area = -1, type = -1, initial = -1, limit = 32, offset = 0 } = {}) {
  const isHot = String(initial) === '-1'

  return {
    type: mapKugouArtistArea(area),
    sextypes: mapKugouArtistSex(type),
    musician: 0,
    hotsize: isHot ? offset + limit + 1 : Math.max(limit, 30)
  }
}

function mapKugouArtistArea(area) {
  const areaMap = {
    '-1': 0,
    7: 1,
    96: 2,
    8: 5,
    16: 6,
    0: 4
  }

  return areaMap[String(area)] ?? 0
}

function mapKugouArtistSex(type) {
  const sexMap = {
    '-1': 0,
    1: 1,
    2: 2,
    3: 3
  }

  return sexMap[String(type)] ?? 0
}

function getKugouArtistPage(response = {}, { initial = -1, limit = 32, offset = 0 } = {}) {
  const source = getKugouArtistGroup(response, initial)
  const items = source.slice(offset, offset + limit)

  return {
    items,
    more: source.length > offset + limit
  }
}

function getKugouHotArtists(response = {}) {
  return getKugouArtistGroup(response, -1)
}

function getKugouArtistGroup(response = {}, initial = -1) {
  const groups = Array.isArray(response.groups) ? response.groups : []
  const target = String(initial).toUpperCase()
  const group = String(initial) === '-1'
    ? groups.find((item) => item.title === '\u70ed\u95e8') || groups[0]
    : groups.find((item) => String(item.title).toUpperCase() === target)

  return group?.artists ?? response.artists ?? []
}

function mapArtist(artist = {}, index = 0) {
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

function mapRankedArtist(item = {}, index = 0) {
  const artist = item.artist ?? item

  return {
    ...mapArtist(artist, index),
    rank: String(index + 1).padStart(2, '0'),
    score: item.score ?? artist.score ?? 0,
    trend: item.lastRank ? `${item.lastRank}` : index < 3 ? 'HOT' : ''
  }
}

function mapArtistDetail(artist = {}, detail = {}, fallbackArtist = {}) {
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

function getArtistDynamicVideoCount(videoNum = []) {
  const totalItem = videoNum.find((item) => Number(item.cat) === 0)
  const mvItem = videoNum.find((item) => Number(item.cat) === 1)
  const value = totalItem?.num ?? mvItem?.num

  return Number.isFinite(Number(value)) ? Number(value) : undefined
}

function mapAlbumCard(album = {}, index = 0) {
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

function getAlbumArtist(album = {}) {
  return getArtistNames(album.artists) || album.artist?.name || '\u672a\u77e5\u6b4c\u624b'
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

function mapArtistVideo(record = {}, index = 0) {
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
    return `${trimNumber(count / 100000000)}\u4ebf`
  }

  if (count >= 10000) {
    return `${trimNumber(count / 10000)}\u4e07`
  }

  return String(count)
}

function trimNumber(number) {
  return Number(number.toFixed(1)).toString()
}

function formatPlainDate(value) {
  if (!value) {
    return ''
  }

  if (typeof value === 'string' && /^\d{4}-\d{1,2}-\d{1,2}/.test(value)) {
    return value.slice(0, 10)
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${date.getFullYear()}-${month}-${day}`
}

function formatDate(value) {
  if (!value) {
    return '\u6700\u8fd1\u66f4\u65b0'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '\u6700\u8fd1\u66f4\u65b0'
  }

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${date.getFullYear()}-${month}-${day} \u66f4\u65b0`
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
