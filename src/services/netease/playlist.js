import {
  createUserPlaylist,
  getPlaylistCategories,
  getPlaylistDetail,
  getPlaylistHotCategories,
  getPlaylistTracks,
  getSimilarPlaylists,
  getTopPlaylists,
  getUserPlaylists
} from '../../api/modules/netease'
import { CACHE_TTL, COVER_TYPES } from '../../config/app'
import { normalizeAudioQualities } from '../../utils/audioQuality'
import { isVipSong, normalizeSongAccess } from '../../utils/songAccess'
import { cacheKey, getCachedData } from '../cache'

const PLAYLIST_DEFAULT_CATEGORY = {
  id: 0,
  name: '\u5168\u90e8'
}

let playlistCategoryMetaPromise = null

export async function getPlaylistDetailData(id, { listid = '', fallbackPlaylist = null } = {}) {
  return getCachedData(cacheKey('playlist-detail', { id, listid }), CACHE_TTL.playlistDetail, async () => {
    const detailResponse = canLoadRemotePlaylistDetail(id, listid)
      ? await getPlaylistDetail({ id })
      : { playlist: fallbackPlaylist }
    const rawPlaylist = detailResponse.playlist ?? fallbackPlaylist

    if (!rawPlaylist) {
      throw new Error('Playlist detail is empty')
    }

    let tracks = rawPlaylist.tracks ?? []

    try {
      const trackResponse = await getPlaylistTracks({
        id,
        listid,
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
  })
}

export async function getPlaylistOverviewData(id, { trackLimit = 60, listid = '', fallbackPlaylist = null } = {}) {
  return getCachedData(
    cacheKey('playlist-overview', { id, listid, trackLimit }),
    CACHE_TTL.playlistDetail,
    async () => {
      const [detailResponse, trackResponse] = await Promise.all([
        canLoadRemotePlaylistDetail(id, listid)
          ? getPlaylistDetail({ id })
          : Promise.resolve({ playlist: fallbackPlaylist }),
        getPlaylistTracks({
          id,
          listid,
          limit: trackLimit,
          offset: 0
        }).catch(() => ({}))
      ])
      const rawPlaylist = detailResponse.playlist ?? fallbackPlaylist

      if (!rawPlaylist) {
        throw new Error('Playlist detail is empty')
      }

      const responseTracks = Array.isArray(trackResponse.songs) ? trackResponse.songs : []
      const detailTracks = Array.isArray(rawPlaylist.tracks) ? rawPlaylist.tracks.slice(0, trackLimit) : []
      const tracks = responseTracks.length ? responseTracks : detailTracks
      const total = Number(trackResponse.total ?? rawPlaylist.trackCount ?? tracks.length) || tracks.length

      return {
        playlist: mapPlaylistDetail({
          ...rawPlaylist,
          trackCount: total || rawPlaylist.trackCount
        }),
        tracks: tracks.map(mapPlaylistTrack),
        total,
        more: Boolean(trackResponse.more || (total && tracks.length < total))
      }
    }
  )
}

export async function getPlaylistTracksData({ id, listid = '', limit = 100, offset = 0 }) {
  return getCachedData(
    cacheKey('playlist-tracks', { id, listid, limit, offset }),
    CACHE_TTL.playlistDetail,
    async () => {
      const response = await getPlaylistTracks({ id, listid, limit, offset })
      const songs = Array.isArray(response.songs) ? response.songs : []
      const total = Number(response.total) || 0

      return {
        tracks: songs.map((song, index) => mapPlaylistTrack(song, offset + index)),
        total,
        more: Boolean(response.more || (total && offset + songs.length < total) || songs.length >= limit)
      }
    }
  )
}

export function isRemotePlaylistId(id) {
  const playlistId = String(id ?? '')

  return isKugouCollectionId(playlistId) || /^\d+$/.test(playlistId)
}

export async function getPlaylistSimilarData(id, { limit = 6 } = {}) {
  if (!isKugouCollectionId(id)) {
    return []
  }

  const response = await getSimilarPlaylists({ id, limit })
  const playlists = response.playlists ?? response.result ?? []

  return playlists
    .filter((playlist) => String(playlist.id) !== String(id))
    .map(mapPlaylist)
    .slice(0, limit)
}

export async function getUserPlaylistLibraryData(uid, { limit = 100, offset = 0 } = {}) {
  const userId = String(uid ?? '')

  if (!userId) {
    return {
      createdPlaylists: [],
      collectedPlaylists: []
    }
  }

  const response = await getUserPlaylists({
    userid: userId,
    limit,
    offset,
    timestamp: Date.now()
  }).catch(() => ({}))
  const { createdPlaylists, collectedPlaylists } = splitUserPlaylistItems(
    getUserPlaylistItems(response),
    userId
  )

  return {
    createdPlaylists: mapRemoteUserPlaylists(createdPlaylists),
    collectedPlaylists: mapRemoteUserPlaylists(collectedPlaylists, { collected: true })
  }
}

export async function createUserPlaylistData({ name, isPrivate = false } = {}) {
  const title = String(name ?? '').trim()

  if (!title) {
    throw new Error('Playlist name is required')
  }

  const response = await createUserPlaylist({
    name: title,
    type: 0,
    is_pri: isPrivate ? 1 : 0,
    timestamp: Date.now()
  })
  const playlist = getPlaylistFromMutationResponse(response, title)

  return {
    response,
    playlist: playlist ? mapRemoteUserPlaylist(playlist) : null
  }
}

export async function getPlaylistDiscoveryData(category = PLAYLIST_DEFAULT_CATEGORY.name, { limit = 50, offset = 0 } = {}) {
  const requestedCategory = normalizePlaylistCategoryOption(category)
  const requestedCategoryCacheKey =
    requestedCategory.id !== '' ? requestedCategory.id : requestedCategory.name

  return getCachedData(
    cacheKey('playlist-discovery', { category: requestedCategoryCacheKey, limit, offset }),
    CACHE_TTL.discovery,
    async () => {
      const categoryMeta = await getPlaylistCategoryMeta()
      const activeCategory = resolvePlaylistCategory(requestedCategory, categoryMeta)
      const activeCategoryId =
        activeCategory.id !== '' ? activeCategory.id : normalizePlaylistCategoryId(activeCategory.name) || 0
      const playlistResponse = await getTopPlaylists({
        category_id: activeCategoryId,
        withtag: 1,
        limit,
        offset
      }).catch(() => ({}))
      const playlists = playlistResponse.playlists ?? []
      const total = playlistResponse.total ?? 0

      return {
        ...categoryMeta,
        playlists: playlists.map((playlist, index) => mapPlaylist(playlist, offset + index)),
        total,
        more: Boolean(playlistResponse.more || (total && offset + playlists.length < total)),
        activeCategory: activeCategory.name,
        activeCategoryId
      }
    }
  )
}

function getPlaylistCategoryMeta() {
  if (!playlistCategoryMetaPromise) {
    playlistCategoryMetaPromise = Promise.all([
      getPlaylistHotCategories().catch(() => ({})),
      getPlaylistCategories().catch(() => ({}))
    ]).then(([hotResponse, catResponse]) => mapPlaylistCategoryMeta(hotResponse, catResponse))
  }

  return playlistCategoryMetaPromise
}

function getUserPlaylistItems(response = {}) {
  const data = response.data ?? response

  return firstArrayValue(
    response.playlist,
    response.playlists,
    response.result,
    Array.isArray(data) ? data : undefined,
    data.playlist,
    data.playlists,
    data.list,
    data.lists,
    data.special_list,
    data.info
  ).filter(Boolean)
}

function getPlaylistFromMutationResponse(response = {}, fallbackName = '') {
  const data = response.data ?? response
  const playlist = firstArrayValue(
    response.playlist,
    response.playlists,
    response.result,
    data.playlist,
    data.playlists,
    data.list,
    data.lists,
    data.info,
    Array.isArray(data) ? data : undefined
  )[0] ?? [
    response.playlist,
    data.playlist,
    data.info,
    data.list,
    data
  ].find((item) => item && typeof item === 'object' && !Array.isArray(item))

  if (!playlist || typeof playlist !== 'object') {
    return null
  }

  const identity = firstPresentValue(
    playlist.globalCollectionId,
    playlist.global_collection_id,
    playlist.id,
    playlist.listid,
    playlist.listId,
    playlist.list_id,
    playlist.list_create_listid
  )

  if (!identity) {
    return null
  }

  return {
    ...playlist,
    name: playlist.name || playlist.title || playlist.listname || fallbackName
  }
}

function splitUserPlaylistItems(playlists = [], userId = '') {
  return playlists.reduce((groups, playlist) => {
    if (isCollectedUserPlaylist(playlist, userId)) {
      groups.collectedPlaylists.push(playlist)
    } else {
      groups.createdPlaylists.push(playlist)
    }

    return groups
  }, {
    createdPlaylists: [],
    collectedPlaylists: []
  })
}

function isCollectedUserPlaylist(playlist = {}, userId = '') {
  const kind = getUserPlaylistKind(playlist)

  if (kind === 'collected') {
    return true
  }

  if (kind === 'created') {
    return false
  }

  const collectedFlag = toBooleanFlag(firstPresentValue(
    playlist.subscribed,
    playlist.is_subscribed,
    playlist.isSubscribed,
    playlist.collected,
    playlist.is_collected,
    playlist.isCollected,
    playlist.is_collect,
    playlist.isCollect,
    playlist.favorite,
    playlist.is_favorite,
    playlist.isFavorite
  ))

  if (collectedFlag === true) {
    return true
  }

  const ownerId = getPlaylistSourceOwnerId(playlist)
  const currentUserId = normalizePlaylistUserId(userId)

  return Boolean(ownerId && currentUserId && ownerId !== currentUserId)
}

function getUserPlaylistKind(playlist = {}) {
  const value = firstPresentValue(
    playlist.list_type,
    playlist.listType,
    playlist.playlist_type,
    playlist.playlistType,
    playlist.type
  )

  if (value === undefined || value === null || value === '') {
    return ''
  }

  const normalizedValue = String(value).trim().toLowerCase()

  if (normalizedValue === '1' || /collect|collected|subscribe|subscribed|favorite/.test(normalizedValue)) {
    return 'collected'
  }

  if (normalizedValue === '0' || /create|created|owner|self/.test(normalizedValue)) {
    return 'created'
  }

  return ''
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

function mapPlaylistDetail(playlist = {}) {
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
    description: playlist.description || playlist.copywriter || '\u8fd9\u4e2a\u6b4c\u5355\u6682\u65f6\u6ca1\u6709\u7b80\u4ecb',
    creator: creator.nickname || '\u9177\u72d7\u97f3\u4e50\u7528\u6237',
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

function mapRemoteUserPlaylists(playlists = [], { collected = false } = {}) {
  return Array.isArray(playlists)
    ? playlists.map((playlist) => mapRemoteUserPlaylist(playlist, { collected })).filter(Boolean)
    : []
}

function mapRemoteUserPlaylist(playlist = {}, { collected = false } = {}) {
  const globalCollectionId = firstPresentValue(
    playlist.globalCollectionId,
    playlist.global_collection_id,
    playlist.global_collectionid,
    playlist.collection_id,
    playlist.collectionid,
    playlist.gid,
    playlist.list_create_gid,
    playlist.list_create_gid_v2
  )
  const listid = firstPresentValue(
    playlist.listid,
    playlist.listId,
    playlist.list_id,
    playlist.list_create_listid
  )
  const id = firstPresentValue(globalCollectionId, playlist.id, playlist.specialId, playlist.specialid, listid)

  if (!id) {
    return null
  }

  const updatedAt = normalizePlaylistTimestamp(
    firstPresentValue(playlist.updateTime, playlist.update_time, playlist.updatedAt, playlist.createTime, playlist.create_time),
    Date.now()
  )
  const createdAt = normalizePlaylistTimestamp(
    firstPresentValue(playlist.createTime, playlist.create_time, playlist.createdAt),
    updatedAt
  )

  return {
    id,
    globalCollectionId: globalCollectionId || '',
    listid: listid || '',
    title: playlist.name || playlist.title || playlist.specialname || playlist.listname || '\u672a\u547d\u540d\u6b4c\u5355',
    description: playlist.description || playlist.copywriter || playlist.desc || playlist.intro || '',
    trackIds: [],
    remote: true,
    coverUrl: resizeNeteaseImage(playlist.coverImgUrl || playlist.picUrl || playlist.pic || playlist.imgurl, 120),
    trackCount: playlist.trackCount ?? playlist.track_count ?? playlist.songcount ?? playlist.song_count ?? 0,
    creatorUserId: getPlaylistSourceOwnerId(playlist),
    createdAt,
    updatedAt,
    collectedAt: collected ? updatedAt : 0
  }
}

function mapPlaylistCategoryMeta(hotResponse = {}, catResponse = {}) {
  const fallbackTags = getPlaylistTagItems(catResponse)
  const mappedCategoryGroups = mapPlaylistCategoryGroups(catResponse)
  const categoryGroups = mappedCategoryGroups.length
    ? mappedCategoryGroups
    : fallbackTags.length
      ? [{
          id: 'playlist-tags',
          name: '\u5168\u90e8\u5206\u7c7b',
          tags: fallbackTags
        }]
      : []
  const allTags = uniquePlaylistCategories([
    ...categoryGroups.flatMap((group) => group.tags),
    ...fallbackTags,
    ...getPlaylistTagItems(hotResponse)
  ])
  const visibleTags = uniquePlaylistCategories([
    PLAYLIST_DEFAULT_CATEGORY,
    ...allTags
  ])
  const flattenedCategories = uniquePlaylistCategories([
    ...visibleTags,
    ...categoryGroups.flatMap((group) => group.tags)
  ])
  const categoryByName = Object.fromEntries(
    flattenedCategories.map((category) => [normalizePlaylistCategoryKey(category.name), category])
  )
  const categoryById = Object.fromEntries(
    flattenedCategories.map((category) => [String(category.id), category])
  )

  return {
    hotCategories: visibleTags,
    categoryGroups,
    categories: flattenedCategories,
    categoryByName,
    categoryById
  }
}

function resolvePlaylistCategory(category, categoryMeta = {}) {
  const normalized = normalizePlaylistCategoryOption(category)
  const categoryByName = categoryMeta.categoryByName ?? {}
  const categoryById = categoryMeta.categoryById ?? {}

  if (normalized.id !== '' && normalized.id !== undefined && normalized.id !== null) {
    return categoryById[String(normalized.id)] ?? normalized
  }

  return categoryByName[normalizePlaylistCategoryKey(normalized.name)] ?? normalized
}

function normalizePlaylistCategoryOption(category) {
  if (category && typeof category === 'object') {
    const name = getPlaylistCategoryName(category) || PLAYLIST_DEFAULT_CATEGORY.name
    const id = getPlaylistCategoryId(category)

    return {
      id: id === '' ? normalizePlaylistCategoryId(name) : id,
      name
    }
  }

  const name = String(category || PLAYLIST_DEFAULT_CATEGORY.name).trim() || PLAYLIST_DEFAULT_CATEGORY.name

  return {
    id: normalizePlaylistCategoryId(name),
    name
  }
}

function normalizePlaylistCategoryId(category) {
  const value = String(category ?? '').trim()

  if (!value || value === '\u5168\u90e8' || value === '\u63a8\u8350') {
    return 0
  }

  if (value.toUpperCase() === 'HI-RES') {
    return 11292
  }

  return /^\d+$/.test(value) ? Number(value) : ''
}

function mapPlaylistCategoryGroups(response = {}) {
  const data = response.data ?? response
  const legacyGroups = mapLegacyPlaylistCategoryGroups(data)

  if (legacyGroups.length) {
    return legacyGroups
  }

  return getPlaylistGroupItems(data)
    .map((group, groupIndex) => {
      const tags = uniquePlaylistCategories(getPlaylistGroupTags(group))

      if (!tags.length) {
        return null
      }

      return {
        id: getPlaylistCategoryId(group) || `group-${groupIndex}`,
        name:
          group.category_name ||
          group.categoryName ||
          group.classname ||
          group.class_name ||
          group.name ||
          group.title ||
          `\u5206\u7c7b ${groupIndex + 1}`,
        tags
      }
    })
    .filter(Boolean)
}

function mapLegacyPlaylistCategoryGroups(data = {}) {
  const categories = data.categories ?? {}
  const sub = Array.isArray(data.sub) ? data.sub : []

  if (!categories || Array.isArray(categories) || !Object.keys(categories).length || !sub.length) {
    return []
  }

  return Object.entries(categories)
    .map(([key, name]) => ({
      id: key,
      name,
      tags: uniquePlaylistCategories(
        sub
          .filter((item) => String(item.category) === String(key))
          .map(mapPlaylistCategoryItem)
      )
    }))
    .filter((group) => group.tags.length)
}

function getPlaylistGroupItems(data = {}) {
  const groups = firstArrayValue(
    Array.isArray(data) ? data : null,
    data.category,
    data.categories,
    data.category_list,
    data.categoryList,
    data.info,
    data.list,
    data.tags
  )

  return groups.filter((item) => getPlaylistGroupTags(item).length)
}

function getPlaylistTagItems(response = {}) {
  const data = response.data ?? response
  const directTags = firstArrayValue(
    Array.isArray(data) ? data : null,
    data.tags,
    data.hot,
    data.hot_tags,
    data.hotTags,
    data.list,
    data.info,
    data.data
  )

  return uniquePlaylistCategories([
    ...directTags.filter((item) => !getPlaylistGroupTags(item).length).map(mapPlaylistCategoryItem),
    ...getPlaylistGroupItems(data).flatMap((group) => getPlaylistGroupTags(group).map(mapPlaylistCategoryItem))
  ])
}

function getPlaylistGroupTags(group = {}) {
  return firstArrayValue(
    group.son,
    group.sons,
    group.tags,
    group.tag_list,
    group.tagList,
    group.children,
    group.child,
    group.list,
    group.info,
    group.items,
    group.sub,
    group.subs
  )
}

function mapPlaylistCategoryItem(item = {}) {
  if (typeof item === 'string' || typeof item === 'number') {
    const name = String(item).trim()

    return {
      id: normalizePlaylistCategoryId(name),
      name
    }
  }

  const name = getPlaylistCategoryName(item)
  const id = getPlaylistCategoryId(item)

  return {
    id: id === '' ? normalizePlaylistCategoryId(name) : id,
    name
  }
}

function getPlaylistCategoryId(item = {}) {
  return (
    item.tag_id ??
    item.tagId ??
    item.id ??
    item.category_id ??
    item.categoryId ??
    item.classid ??
    item.class_id ??
    ''
  )
}

function getPlaylistCategoryName(item = {}) {
  return String(
    item.tag_name ??
      item.tagName ??
      item.name ??
      item.title ??
      item.category_name ??
      item.categoryName ??
      item.classname ??
      item.class_name ??
      item.label ??
      ''
  ).trim()
}

function normalizePlaylistCategoryKey(name = '') {
  return String(name).trim().toLowerCase()
}

function uniquePlaylistCategories(categories = []) {
  const seen = new Set()

  return categories
    .map(mapPlaylistCategoryItem)
    .filter((category) => category.name)
    .filter((category) => {
      const key = category.id !== '' ? `id:${category.id}` : `name:${normalizePlaylistCategoryKey(category.name)}`

      if (seen.has(key)) {
        return false
      }

      seen.add(key)
      return true
    })
}

function getPlaylistSourceOwnerId(playlist = {}) {
  return normalizePlaylistUserId(firstPresentValue(
    playlist.list_create_userid,
    playlist.listCreateUserid,
    playlist.list_create_user_id,
    playlist.create_userid,
    playlist.create_user_id,
    playlist.creator_userid,
    playlist.creatorUserId,
    getCollectionOwnerId(playlist.globalCollectionId || playlist.global_collection_id || playlist.id),
    playlist.creator?.userId,
    playlist.creator?.userid,
    playlist.userid,
    playlist.user_id,
    playlist.userId
  ))
}

function getCollectionOwnerId(id = '') {
  return String(id ?? '').match(/^collection_[^_]+_([^_]+)_/i)?.[1] || ''
}

function normalizePlaylistUserId(value = '') {
  return String(value ?? '').trim()
}

function firstPresentValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '')
}

function firstArrayValue(...values) {
  return values.find((value) => Array.isArray(value)) ?? []
}

function toBooleanFlag(value) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value > 0
  }

  const normalizedValue = String(value).trim().toLowerCase()

  if (/^(1|true|yes|y|collected|collect|subscribed|subscribe|favorite|fav)$/i.test(normalizedValue)) {
    return true
  }

  if (/^(0|false|no|n|none)$/i.test(normalizedValue)) {
    return false
  }

  return null
}

function normalizePlaylistTimestamp(value, fallback = Date.now()) {
  const number = Number(value)

  if (Number.isFinite(number) && number > 0) {
    return number < 10000000000 ? number * 1000 : number
  }

  const parsed = Date.parse(value)

  return Number.isFinite(parsed) ? parsed : fallback
}

function isKugouCollectionId(id) {
  return /^collection_/i.test(String(id ?? ''))
}

function canLoadRemotePlaylistDetail(id, listid = '') {
  const playlistId = String(id ?? '')

  return isKugouCollectionId(playlistId) || (!listid && /^\d+$/.test(playlistId))
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
