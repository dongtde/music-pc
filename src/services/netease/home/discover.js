import {
  getBanners,
  getPersonalizedNewSongs,
  getPersonalizedPlaylists,
  getRadioRecommend
} from '../../../api/modules/netease'
import { getTopMvs as getNeteaseTopMvs } from '../../../api/modules/neteaseLegacy'
import { CACHE_TTL } from '../../../config/app'
import { getCachedData } from '../../cache'
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
