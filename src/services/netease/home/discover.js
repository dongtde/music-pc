import {
  getBanners,
  getPersonalizedNewSongs,
  getPersonalizedPlaylists,
  getRadioRecommend
} from '../../../api/modules/netease'
import { getTopMvs as getNeteaseTopMvs } from '../../../api/modules/neteaseLegacy'
import { CACHE_TTL } from '../../../config/app'
import { cacheKey, getCachedData } from '../../cache'
import {
  getHomeTopMvPayload,
  getRadioImageMap,
  getRadioRecommendPayload,
  hydrateRadioImage,
  mapBanner,
  mapHomeTopMv,
  mapNewsong,
  mapPlaylist,
  mapRadioCard,
  uniqueRadioCards
} from './shared'

const HOME_DISCOVER_SECTION_TIMEOUT_MS = 3500
const HOME_DISCOVER_RADIO_IMAGE_TIMEOUT_MS = 1500

export async function getHomeDiscoverData() {
  const [bannerResponse, playlistResponse, newsongResponse, mvResponse, radioResponse] = await Promise.all([
    getHomeDiscoverSection('banners', { type: 0 }, () => getBanners({ type: 0 })),
    getHomeDiscoverSection('playlists', { limit: 18 }, () => getPersonalizedPlaylists({ limit: 18 })),
    getHomeDiscoverSection('newsongs', { limit: 100 }, () => getPersonalizedNewSongs({ limit: 100 })),
    getHomeDiscoverSection('top-mvs', { limit: 5, offset: 0 }, () => getNeteaseTopMvs({ limit: 5, offset: 0 })),
    getHomeDiscoverSection('radios', {}, () => getRadioRecommend())
  ])

  const banners = (bannerResponse.banners ?? []).map(mapBanner)
  const playlists = (playlistResponse.result ?? []).map(mapPlaylist)
  const songs = (newsongResponse.result ?? []).map(mapNewsong)
  const mvs = getHomeTopMvPayload(mvResponse).map(mapHomeTopMv).slice(0, 5)
  const radioCards = uniqueRadioCards(
    getRadioRecommendPayload(radioResponse).map((item, index) => mapRadioCard(item, index))
  ).slice(0, 6)
  const radioImageMap = await withHomeDiscoverFallback(
    getRadioImageMap(radioCards),
    {
      fallback: new Map(),
      label: 'radio-images',
      timeoutMs: HOME_DISCOVER_RADIO_IMAGE_TIMEOUT_MS
    }
  )
  const radios = radioCards.map((radio) => hydrateRadioImage(radio, radioImageMap))

  return {
    heroSlides: banners.slice(0, 6),
    recommendPlaylists: playlists.slice(0, 12),
    latestPlaylistCards: playlists.slice(12, 18),
    recommendedSingles: songs,
    recommendedMvs: mvs,
    recommendedRadios: radios
  }
}

function getHomeDiscoverSection(section, payload, loader) {
  const request = getCachedData(
    cacheKey('home-discover-section', { section, ...payload }),
    CACHE_TTL.discovery,
    loader
  )

  return withHomeDiscoverFallback(request, {
    fallback: {},
    label: section,
    timeoutMs: HOME_DISCOVER_SECTION_TIMEOUT_MS
  })
}

function withHomeDiscoverFallback(promise, { fallback, label, timeoutMs }) {
  let timeoutId = 0
  let timedOut = false
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      timedOut = true
      resolve(fallback)
    }, timeoutMs)
  })

  return Promise.race([promise, timeout])
    .catch((error) => {
      if (!timedOut) {
        console.warn(`Failed to load home discover ${label}:`, error)
      }

      return fallback
    })
    .finally(() => {
      clearTimeout(timeoutId)
    })
}
