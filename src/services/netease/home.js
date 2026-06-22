import {
  getBanners,
  getPersonalizedNewSongs,
  getPersonalizedPlaylists,
  getPlaylistTracks,
  getRadioImages,
  getRadioRecommend,
  getToplist
} from '../../api/modules/netease'
import { getTopMvs as getNeteaseTopMvs } from '../../api/modules/neteaseLegacy'
import { CACHE_TTL, COVER_TYPES } from '../../config/app'
import { normalizeAudioQualities } from '../../utils/audioQuality'
import { isVipSong, normalizeSongAccess } from '../../utils/songAccess'
import { cacheKey, getCachedData } from '../cache'

const UNKNOWN_SONG = '\u672a\u547d\u540d\u6b4c\u66f2'
const UNKNOWN_ALBUM = '\u672a\u77e5\u4e13\u8f91'
const UNKNOWN_ARTIST = '\u672a\u77e5\u6b4c\u624b'
const UNKNOWN_CREATOR = '\u672a\u77e5\u827a\u4eba'

export async function getHomeDiscoverData() {
  return getCachedData('home-discover', CACHE_TTL.discovery, async () => {
    const [bannerResponse, playlistResponse, newsongResponse, mvResponse, radioResponse] = await Promise.all([
      getBanners({ type: 0 }).catch(() => ({})),
      getPersonalizedPlaylists({ limit: 18 }).catch(() => ({})),
      getPersonalizedNewSongs({ limit: 100 }).catch(() => ({})),
      getNeteaseTopMvs({ limit: 5, offset: 0 }).catch(() => ({})),
      getRadioRecommend().catch(() => ({}))
    ])

    const banners = (bannerResponse.banners ?? []).map(mapBanner)
    const playlists = (playlistResponse.result ?? []).map(mapPlaylist)
    const songs = (newsongResponse.result ?? []).map(mapNewsong)
    const mvs = getHomeTopMvPayload(mvResponse).map(mapHomeTopMv).slice(0, 5)
    const radioCards = uniqueRadioCards(
      getRadioRecommendPayload(radioResponse).map((item, index) => mapRadioCard(item, index))
    ).slice(0, 6)
    const radioImageMap = await getRadioImageMap(radioCards)
    const radios = radioCards.map((radio) => hydrateRadioImage(radio, radioImageMap))

    return {
      heroSlides: banners.slice(0, 6),
      recommendPlaylists: playlists.slice(0, 12),
      latestPlaylistCards: playlists.slice(12, 18),
      recommendedSingles: songs,
      recommendedMvs: mvs,
      recommendedRadios: radios
    }
  })
}

export async function getMusicFeedData({ limit = 80 } = {}) {
  return getCachedData(cacheKey('music-feed', { limit }), CACHE_TTL.discovery, async () => {
    const [newsongResponse, toplistResponse] = await Promise.all([
      getPersonalizedNewSongs({ limit }).catch(() => ({})),
      getToplist().catch(() => ({}))
    ])
    const personalizedSongs = (newsongResponse.result ?? [])
      .map(mapNewsong)
      .map((song) => ({ ...song, feedSource: 'new' }))
    const toplists = toplistResponse.list ?? []
    const feedToplists = [
      ...toplists.filter((item) => /\u70ed\u6b4c|\u65b0\u6b4c|\u539f\u521b|\u98d9\u5347/.test(item.name || '')),
      ...toplists
    ].filter(Boolean)
    const seenToplistIds = new Set()
    const toplistTargets = feedToplists.filter((item) => {
      if (!item.id || seenToplistIds.has(item.id)) {
        return false
      }

      seenToplistIds.add(item.id)
      return true
    }).slice(0, 4)
    const trackResponses = await Promise.all(
      toplistTargets.map((item) =>
        getPlaylistTracks({ id: item.id, limit, offset: 0 }).catch(() => ({ songs: [] }))
      )
    )
    const chartSongs = trackResponses
      .flatMap((response) => response.songs ?? [])
      .map(mapPlaylistTrack)
      .map((song) => ({ ...song, feedSource: 'chart' }))

    return {
      songs: uniqueSongs([...personalizedSongs, ...chartSongs])
    }
  })
}

function mapBanner(banner = {}, index = 0) {
  const targetType = Number(banner.targetType)
  const targetId = banner.targetId ?? ''
  const target = targetType === 1 && banner.song ? mapBannerSong(banner.song, index) : null

  return {
    id: `${targetType || 'banner'}-${targetId || index}`,
    targetType,
    targetId,
    targetKind: getBannerTargetKind(targetType),
    target,
    tag: banner.typeTitle || '\u63a8\u8350',
    title: target?.name || banner.typeTitle || '\u9177\u72d7\u97f3\u4e50\u63a8\u8350',
    desc: getBannerDescription(banner, target, targetType),
    action: getBannerAction(targetType),
    link: getBannerLink(targetType, targetId),
    externalUrl: banner.url?.startsWith('http') ? banner.url : '',
    tone: coverType(index),
    imageUrl: banner.imageUrl ?? banner.bigImageUrl
  }
}

function mapBannerSong(song = {}, index = 0) {
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

function getBannerTargetKind(targetType) {
  const targetKinds = {
    1: 'song',
    10: 'album',
    100: 'artist',
    1000: 'playlist',
    1004: 'mv'
  }

  return targetKinds[targetType] ?? 'other'
}

function getBannerDescription(banner = {}, target = null, targetType = 0) {
  if (target?.artist) {
    return target.artist
  }

  if (targetType === 1000) {
    return '\u70b9\u51fb\u8fdb\u5165\u6b4c\u5355\u8be6\u60c5'
  }

  if (banner.url?.startsWith('http')) {
    return '\u70b9\u51fb\u67e5\u770b\u6d3b\u52a8\u8be6\u60c5'
  }

  return '\u6765\u81ea\u9177\u72d7\u97f3\u4e50\u7684\u7cbe\u9009\u5185\u5bb9'
}

function getBannerAction(targetType) {
  const actions = {
    1: '\u7acb\u5373\u64ad\u653e',
    10: '\u67e5\u770b\u4e13\u8f91',
    100: '\u67e5\u770b\u6b4c\u624b',
    1000: '\u67e5\u770b\u6b4c\u5355',
    1004: '\u89c2\u770b MV'
  }

  return actions[targetType] ?? '\u7acb\u5373\u67e5\u770b'
}

function getBannerLink(targetType, targetId) {
  if (!targetId) {
    return ''
  }

  const links = {
    10: `/album/${targetId}`,
    100: `/artist/${targetId}`,
    1000: `/playlist/${targetId}`,
    1004: `/mv?mvId=${targetId}`
  }

  return links[targetType] ?? ''
}

function mapPlaylist(playlist = {}, index = 0) {
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

function mapNewsong(item = {}, index = 0) {
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

function mapHomeTopMv(item = {}, index = 0) {
  const nestedMv = item.mv ?? {}
  const duration = item.duration || getTopMvVideoDuration(nestedMv)
  const mv = {
    ...nestedMv,
    ...item,
    duration,
    artists: item.artists ?? nestedMv.artists,
    cover: item.cover ?? nestedMv.cover,
    coverUrl: item.coverUrl ?? item.cover ?? nestedMv.coverUrl,
    picUrl: item.picUrl ?? item.cover ?? nestedMv.picUrl,
    playCount: item.playCount ?? nestedMv.playCount ?? nestedMv.plays,
    publishTime: item.publishTime ?? nestedMv.publishTime,
    name: item.name ?? nestedMv.name ?? nestedMv.title,
    title: item.name ?? nestedMv.title ?? nestedMv.name
  }

  return mapVideoMv(mv, index)
}

function getTopMvVideoDuration(mv = {}) {
  const videos = Array.isArray(mv.videos) ? mv.videos : []
  const video = videos.find((item) => Number(item?.duration) > 0)

  return video?.duration ?? mv.duration ?? 0
}

function mapVideoMv(mv = {}, index = 0) {
  const artists = Array.isArray(mv.artists) ? mv.artists : []
  const artistName = mv.artistName || mv.creatorName || getArtistNames(artists) || mv.artist?.name || UNKNOWN_CREATOR
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
    title: mv.name || mv.title || '\u672a\u547d\u540d MV',
    name: mv.name || mv.title || '\u672a\u547d\u540d MV',
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

function getHomeTopMvPayload(response = {}) {
  const data = response.data ?? response
  const items = Array.isArray(data) ? data : []

  return items.length ? items : getMvListPayload(response)
}

function getMvListPayload(response = {}) {
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

function getRadioRecommendPayload(response = {}) {
  return asArray(response.data ?? response.radios ?? response.list ?? response.items)
}

async function getRadioImageMap(radios = []) {
  const ids = uniqueValues(radios.map((radio) => radio.id)).slice(0, 80)

  if (!ids.length) {
    return new Map()
  }

  const response = await getRadioImages({ fmid: ids.join(',') }).catch(() => ({}))
  const items = asArray(response.data ?? response.list ?? response.items)

  return new Map(items.map((item) => [
    String(item.fmid ?? item.fmId ?? item.id),
    {
      coverUrl: normalizeKugouMediaUrl(item.imgUrl480 || item.imgUrl100 || item.imgurl || item.picUrl, 520),
      fmtype: item.fmtype
    }
  ]))
}

function hydrateRadioImage(radio = {}, imageMap = new Map()) {
  const image = imageMap.get(String(radio.id))

  if (!image) {
    return radio
  }

  return {
    ...radio,
    fmtype: radio.fmtype ?? image.fmtype,
    coverUrl: radio.coverUrl || image.coverUrl
  }
}

function mapRadioCard(raw = {}, index = 0) {
  const source = raw.baseInfo ?? raw.radio ?? raw.djRadio ?? raw
  const id = source.fmid ?? source.fm_id ?? source.fmId ?? source.id ?? source.radioId ?? source.rid ?? raw.resourceId
  const title = cleanRadioTitle(
    source.fmname ?? source.fm_name ?? source.name ?? source.title ?? raw.uiElement?.mainTitle?.title ?? '\u672a\u547d\u540d\u7535\u53f0'
  )
  const fmtype = Number(source.fmtype ?? source.fm_type ?? raw.fmtype ?? 2) || 2
  const category = source.classname ?? source.categoryName ?? source.category ?? source.sectionTitle ?? raw.categoryName ?? ''
  const description =
    source.description ||
    source.rcm_text ||
    source.rcmdText ||
    source.rcmdtext ||
    source.sectionDescription ||
    source.desc ||
    ''
  const heat = Number(source.heat ?? source.playCount ?? parseCountText(source.playCountLabel) ?? 0) || 0
  const previewTracks = getRadioPreviewSongs(source)
    .map((song, songIndex) => mapRadioSongTrack(song, songIndex, {
      id,
      title,
      fmtype,
      coverUrl: normalizeKugouMediaUrl(source.imgUrl480 || source.imgurl || source.imgUrl100 || source.picUrl, 520),
      category
    }))
    .filter((track) => track.id)
  const coverUrl = normalizeKugouMediaUrl(
    source.imgUrl480 ||
      source.imgurl ||
      source.imgUrl100 ||
      source.picUrl ||
      source.coverUrl ||
      source.cover ||
      raw.uiElement?.image?.imageUrl,
    520
  )
  const bannerUrl = normalizeKugouMediaUrl(source.banner || source.bannerUrl || source.imageUrl, 900)

  return {
    id,
    fmid: id,
    fmtype,
    title,
    name: title,
    description: description || getRadioDescription(title, category),
    creator: '\u9177\u72d7\u7535\u53f0',
    creatorAvatarUrl: coverUrl,
    category: category || '\u7535\u53f0',
    primaryCategory: category || '\u7535\u53f0',
    subCategory: source.parentName || '',
    coverUrl,
    bannerUrl,
    programCount: Number(source.rcmdsongsize ?? source.size ?? previewTracks.length) || previewTracks.length,
    subCount: 0,
    playCount: heat,
    heat,
    playCountLabel: heat ? `${formatPlayCount(heat)} \u70ed\u5ea6` : 'FM',
    subCountLabel: '',
    programCountLabel: '',
    lastProgramName: previewTracks[0]?.name || '',
    score: source.isnew === '1' || source.isnew === 1 ? '\u65b0' : '',
    tag: category || '\u7535\u53f0',
    subed: false,
    type: coverType(index || Number(id) || 0),
    to: id ? `/podcast/${id}` : '',
    previewTracks,
    raw: source
  }
}

function mapRadioSongTrack(song = {}, index = 0, radio = {}) {
  const file = splitKugouSongName(song.name || song.filename || song.songname || song.audio_name || UNKNOWN_SONG)
  const album = song.al ?? song.album ?? {}
  const artists = song.ar ?? song.artists ?? []
  const artistName = getArtistNames(artists) || song.artist || song.singername || file.artist || UNKNOWN_ARTIST
  const id = song.id ?? song.album_audio_id ?? song.mixsongid ?? song.audio_id ?? song.hash ?? `radio-song-${radio.id}-${index}`
  const duration = song.dt ?? song.duration ?? song.time ?? song['320time'] ?? song.timelength ?? 0
  const coverUrl = normalizeKugouMediaUrl(
    album.picUrl ||
      album.coverUrl ||
      song.picUrl ||
      song.coverUrl ||
      song.imgurl ||
      song.trans_param?.union_cover ||
      radio.coverUrl,
    360
  )

  return {
    id,
    ...getKugouTrackMeta(song),
    name: file.name || song.name || UNKNOWN_SONG,
    artistId: artists[0]?.id ?? song.author_id ?? '',
    artistIds: getArtistIds(artists),
    artist: artistName,
    album: radio.title || radio.name || album.name || '\u9177\u72d7\u7535\u53f0',
    albumId: album.id ?? song.album_id ?? '',
    rank: String(index + 1).padStart(2, '0'),
    type: coverType(index || Number(id) || 0),
    time: formatRadioDuration(duration),
    duration: formatRadioDuration(duration),
    coverUrl,
    thumbnailUrl: normalizeKugouMediaUrl(coverUrl, 96),
    source: radio.title ? `\u7535\u53f0 \u00b7 ${radio.title}` : '\u9177\u72d7\u7535\u53f0',
    category: radio.category || '',
    vip: isVipSong(song),
    hasVideo: Boolean(song.mv || song.mvhash),
    mvId: song.mv || song.mvhash || '',
    radioId: radio.id || radio.fmid || '',
    radioTitle: radio.title || radio.name || ''
  }
}

function getRadioDescription(title = '', category = '') {
  const prefix = category ? `${category}\u91cc\u7684` : ''

  return `${prefix}${title}\uff0c\u6309\u9177\u72d7\u7535\u53f0\u5b9e\u65f6\u6b4c\u5355\u8fde\u7eed\u64ad\u653e\u3002`
}

function getRadioPreviewSongs(source = {}) {
  const candidates = [
    source.rcmdlist,
    source.songlist,
    source.songs,
    source.song_info ? [source.song_info] : null
  ]

  return candidates.find((item) => Array.isArray(item)) ?? []
}

function uniqueRadioCards(items = []) {
  const seenIds = new Set()

  return items
    .map((item, index) => (item?.id && item?.title ? item : mapRadioCard(item, index)))
    .filter((item) => {
      const id = String(item?.id ?? '')

      if (!id || seenIds.has(id)) {
        return false
      }

      seenIds.add(id)
      return true
    })
}

function uniqueSongs(songs = []) {
  const seenIds = new Set()

  return songs.filter((song) => {
    const id = String(song?.id ?? '')

    if (!id || seenIds.has(id)) {
      return false
    }

    seenIds.add(id)
    return true
  })
}

function uniqueValues(items = []) {
  return [...new Set(items.filter((item) => item !== undefined && item !== null && item !== '').map(String))]
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function splitKugouSongName(value = '') {
  const text = String(value ?? '').trim()
  const separator = text.indexOf(' - ')

  if (separator < 0) {
    return {
      artist: '',
      name: text
    }
  }

  return {
    artist: text.slice(0, separator).trim(),
    name: text.slice(separator + 3).trim()
  }
}

function normalizeKugouMediaUrl(url, size = 480) {
  if (typeof url !== 'string') {
    return ''
  }

  const value = url.trim()

  if (!value) {
    return ''
  }

  if (value.startsWith('//')) {
    return `https:${value}`.replace('{size}', String(size))
  }

  if (/^https?:\/\//i.test(value)) {
    return value.replace('{size}', String(size))
  }

  if (/^[\w.-]+\.(?:jpe?g|png|webp|gif)$/i.test(value)) {
    return `https://imge.kugou.com/fmlogo/${size}/${value}`
  }

  return value.replace('{size}', String(size))
}

function cleanRadioTitle(value) {
  return String(value ?? '').replace(/^(\u64ad\u5ba2|\u7535\u53f0|FM)[:\uff1a]\s*/i, '').trim()
}

function parseCountText(value) {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value !== 'string') {
    return 0
  }

  const match = value.match(/([\d.]+)\s*(\u4ebf|\u4e07)?/)

  if (!match) {
    return 0
  }

  const number = Number(match[1])

  if (!Number.isFinite(number)) {
    return 0
  }

  if (match[2] === '\u4ebf') {
    return Math.round(number * 100000000)
  }

  if (match[2] === '\u4e07') {
    return Math.round(number * 10000)
  }

  return number
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

function stableCoverIndex(value = 0) {
  const numericValue = Number(value)

  if (Number.isFinite(numericValue) && numericValue > 0) {
    return numericValue
  }

  return String(value ?? '')
    .split('')
    .reduce((total, char) => total + char.charCodeAt(0), 0)
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

function formatRadioDuration(duration = 0) {
  const value = Number(duration)

  if (!Number.isFinite(value) || value <= 0) {
    return '0:00'
  }

  return formatDuration(value > 0 && value < 10000 ? value * 1000 : value)
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
