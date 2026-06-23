import { getPlaylistDetail, getPlaylistTracks, getSimilarPlaylists } from '../../../api/modules/netease'
import { CACHE_TTL } from '../../../config/app'
import { cacheKey, getCachedData } from '../../cache'
import { mapPlaylist, mapPlaylistDetail, mapPlaylistTrack } from './mappers'
import { canLoadRemotePlaylistDetail, isKugouCollectionId } from './shared'

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
