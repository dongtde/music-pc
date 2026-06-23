import {
  getPersonalizedNewSongs,
  getPlaylistTracks,
  getToplist
} from '../../../api/modules/netease'
import { CACHE_TTL } from '../../../config/app'
import { cacheKey, getCachedData } from '../../cache'
import { mapNewsong, mapPlaylistTrack, uniqueSongs } from './shared'

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
      ...toplists.filter((item) => /热歌|新歌|原创|飙升/.test(item.name || '')),
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
