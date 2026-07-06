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
const HOME_DISCOVER_FALLBACK_MARKER = Symbol('home-discover-section-fallback')
const HOME_DISCOVER_DATA_KEYS = [
  'heroSlides',
  'recommendPlaylists',
  'latestPlaylistCards',
  'recommendedSingles',
  'recommendedMvs',
  'recommendedRadios'
]

let lastHomeDiscoverData = null

export async function getHomeDiscoverData(options = {}) {
  const sectionTimeoutMs = normalizeTimeoutMs(
    options.timeoutMs,
    HOME_DISCOVER_SECTION_TIMEOUT_MS
  )
  const [bannerResponse, playlistResponse, newsongResponse, mvResponse, radioResponse] = await Promise.all([
    getHomeDiscoverSection('banners', { type: 0 }, () => getBanners({ type: 0 }), { timeoutMs: sectionTimeoutMs }),
    getHomeDiscoverSection('playlists', { limit: 18 }, () => getPersonalizedPlaylists({ limit: 18 }), { timeoutMs: sectionTimeoutMs }),
    getHomeDiscoverSection('newsongs', { limit: 100 }, () => getPersonalizedNewSongs({ limit: 100 }), { timeoutMs: sectionTimeoutMs }),
    getHomeDiscoverSection('top-mvs', { limit: 5, offset: 0 }, () => getNeteaseTopMvs({ limit: 5, offset: 0 }), { timeoutMs: sectionTimeoutMs }),
    getHomeDiscoverSection('radios', {}, () => getRadioRecommend(), { timeoutMs: sectionTimeoutMs })
  ])
  const hasPartialSections = [
    bannerResponse,
    playlistResponse,
    newsongResponse,
    mvResponse,
    radioResponse
  ].some(isHomeDiscoverSectionFallback)

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

  const nextData = {
    heroSlides: banners.slice(0, 6),
    recommendPlaylists: playlists.slice(0, 12),
    latestPlaylistCards: playlists.slice(12, 18),
    recommendedSingles: songs,
    recommendedMvs: mvs,
    recommendedRadios: radios
  }
  const mergedData = mergeHomeDiscoverData(lastHomeDiscoverData, nextData)

  if (hasHomeDiscoverData(nextData)) {
    lastHomeDiscoverData = mergeHomeDiscoverData(lastHomeDiscoverData, nextData)
  }

  return {
    ...mergedData,
    partial: hasPartialSections
  }
}

function getHomeDiscoverSection(section, payload, loader, options = {}) {
  const request = getCachedData(
    cacheKey('home-discover-section', { section, ...payload }),
    CACHE_TTL.discovery,
    loader
  )

  return withHomeDiscoverFallback(request, {
    fallback: createHomeDiscoverSectionFallback(section),
    label: section,
    timeoutMs: options.timeoutMs
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

function createHomeDiscoverSectionFallback(section) {
  return {
    [HOME_DISCOVER_FALLBACK_MARKER]: true,
    section
  }
}

function isHomeDiscoverSectionFallback(response) {
  return Boolean(response?.[HOME_DISCOVER_FALLBACK_MARKER])
}

function mergeHomeDiscoverData(previous = null, next = {}) {
  return HOME_DISCOVER_DATA_KEYS.reduce((merged, key) => {
    const nextItems = Array.isArray(next[key]) ? next[key] : []
    const previousItems = Array.isArray(previous?.[key]) ? previous[key] : []

    merged[key] = nextItems.length ? nextItems : previousItems
    return merged
  }, {})
}

function hasHomeDiscoverData(data = {}) {
  return HOME_DISCOVER_DATA_KEYS.some(
    (key) => Array.isArray(data[key]) && data[key].length
  )
}

function normalizeTimeoutMs(value, fallback) {
  const parsed = Number(value)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
