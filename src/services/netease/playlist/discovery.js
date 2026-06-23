import { getTopPlaylists } from '../../../api/modules/netease'
import { CACHE_TTL } from '../../../config/app'
import { cacheKey, getCachedData } from '../../cache'
import { getPlaylistCategoryMeta, normalizePlaylistCategoryOption, PLAYLIST_DEFAULT_CATEGORY, resolvePlaylistCategory } from './categories'
import { mapPlaylist } from './mappers'

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
