import { createUserPlaylist, getUserPlaylists } from '../../../api/modules/netease'
import {
  firstArrayValue,
  firstPresentValue,
  normalizePlaylistTimestamp,
  normalizePlaylistUserId,
  resizeNeteaseImage
} from './shared'

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
    title: playlist.name || playlist.title || playlist.specialname || playlist.listname || '未命名歌单',
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
