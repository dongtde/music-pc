import {
  getAllMvs,
  getExclusiveMvs,
  getFirstMvs,
  getFollowArtistNewMvs,
  getBroadcastCategoryRegion,
  getBroadcastChannelList,
  getBroadcastCollectList,
  getBroadcastCurrentInfo,
  getDifmPlayingTracks,
  getDifmStyleChannels,
  getDifmSubscribedChannels,
  getDjBanner,
  getDjCatelist,
  getDjCategoryExcludehot,
  getDjCategoryRecommend,
  getDjDetail,
  getDjHot,
  getDjPaygift,
  getDjPersonalizeRecommend,
  getDjProgramDetail,
  getDjProgramHoursToplist,
  getDjProgramToplist,
  getDjPrograms,
  getDjRadioHot,
  getDjRecommend,
  getDjRecommendType,
  getDjSublist,
  getDjTodayPreferred,
  getDjToplist,
  getDjToplistHours,
  getDjToplistNewcomer,
  getDjToplistPay,
  getDjToplistPopular,
  getMyCreatedVoiceList,
  getPersonalizedMvs,
  getPersonalizedDjPrograms,
  checkSongLike,
  getMvDetail,
  getMvDetailInfo,
  getMvUrl,
  getPersonalFm,
  getPersonalFmByMode,
  getPlaylistTracks,
  getSongDownloadList,
  getSatiMoreResources,
  getSatiResources,
  getSatiTags,
  getSatiTimeSceneResources,
  getSatiSubscribedResources,
  getSportRadio,
  getSimilarMvs,
  getSubscribedMvs,
  getRecentDj,
  getRadioClasses,
  getRadioImages,
  getRadioLibrary,
  getRadioRecommend,
  getRadioSongs,
  getVoiceLyric,
  sendFmTrash,
  searchVoiceLists,
  getTopMvs,
  getToplist,
  getUgcMv,
  likeResource,
  searchVoiceListPrograms,
  subscribeMv,
  updateBroadcastSubscribe,
  updateDjSubscribe,
  updateSatiSubscribe,
  updateSongLike
} from '../api/modules/netease'
import {
  getAllMvs as getNeteaseAllMvs,
  getArtistMvs as getNeteaseArtistMvs,
  getExclusiveMvs as getNeteaseExclusiveMvs,
  getFirstMvs as getNeteaseFirstMvs,
  getFollowArtistNewMvs as getNeteaseFollowArtistNewMvs,
  getMvComments as getNeteaseMvComments,
  getMvDetail as getNeteaseMvDetail,
  getMvDetailInfo as getNeteaseMvDetailInfo,
  getMvUrl as getNeteaseMvUrl,
  getPersonalizedMvs as getNeteasePersonalizedMvs,
  getSimilarMvs as getNeteaseSimilarMvs,
  getSubscribedMvs as getNeteaseSubscribedMvs,
  getTopMvs as getNeteaseTopMvs,
  getUgcMv as getNeteaseUgcMv,
  likeResource as likeNeteaseResource,
  subscribeMv as subscribeNeteaseMv
} from '../api/modules/neteaseLegacy'
import { CACHE_TTL, COVER_TYPES } from '../config/app'
import { cacheKey, getCachedData } from './cache'
import { mapMvCommentResult } from './netease/comments'
import { parseLyricLines } from './netease/lyrics'
import { normalizeAudioQualities } from '../utils/audioQuality'
import { isVipSong, normalizeSongAccess } from '../utils/songAccess'

export {
  getAlbumCommentsData,
  getMvCommentsData,
  getPlaylistCommentsData,
  getPodcastProgramCommentsData,
  getSongCommentsData,
  getSongInteractionStatsData
} from './netease/comments'
export { getTrackLyricData } from './netease/lyrics'
export {
  getSearchBootData,
  getSearchResultData,
  getSearchSuggestData
} from './netease/search'
export {
  getHomeDiscoverData,
  getMusicFeedData
} from './netease/home'
export {
  createUserPlaylistData,
  getPlaylistDetailData,
  getPlaylistDiscoveryData,
  getPlaylistOverviewData,
  getPlaylistSimilarData,
  getPlaylistTracksData,
  getUserPlaylistLibraryData,
  isRemotePlaylistId
} from './netease/playlist'
export {
  getAlbumDetailData,
  getAlbumsDiscoveryData
} from './netease/album'
export {
  getArtistAlbumsData,
  getArtistDetailData,
  getArtistIntroData,
  getArtistsDiscoveryData,
  getArtistSongsData,
  getArtistVideosData
} from './netease/artist'

export async function getPersonalFmData({ mode = 'DEFAULT', submode = '', timestamp = Date.now() } = {}) {
  const normalizedMode = String(mode || 'DEFAULT')
  const params = {
    timestamp
  }
  let response

  if (normalizedMode === 'DEFAULT' && !submode) {
    response = await getPersonalFm(params)
  } else {
    response = await getPersonalFmByMode({
      ...params,
      mode: normalizedMode,
      submode: submode || undefined
    })
  }

  return {
    tracks: extractPersonalFmSongs(response).map(mapFmTrack)
  }
}

export async function getSongLikeStateData(ids = []) {
  const songIds = ids
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id))

  if (!songIds.length) {
    return new Set()
  }

  const response = await checkSongLike({
    ids: JSON.stringify(songIds),
    timestamp: Date.now()
  })
  const likedIds = Array.isArray(response.data)
    ? response.data
    : Array.isArray(response.ids)
      ? response.ids
      : []

  return new Set(likedIds.map((id) => String(id)))
}

export async function updateSongLikeStateData({ id, uid, like }) {
  return updateSongLike({
    id,
    uid,
    like: Boolean(like),
    timestamp: Date.now()
  })
}

export async function movePersonalFmSongToTrash(id) {
  return sendFmTrash({
    id,
    timestamp: Date.now()
  })
}

export async function getPodcastHomeData() {
  return getCachedData('radio-home', CACHE_TTL.podcast, async () => {
    const catalog = await getRadioCatalogData()
    const categories = catalog.classGroups.map((group) => ({
      id: group.id,
      name: group.name,
      description: `${group.radios.length} 个电台`,
      radios: group.radios
    }))
    const firstCategory = categories[0]
    const featured = uniqueRadioCards([
      ...catalog.recommendRadios,
      ...catalog.libraryRadios,
      ...catalog.classRadios
    ]).slice(0, 12)
    const hot = uniqueRadioCards([
      ...catalog.recommendRadios,
      ...catalog.classRadios
    ]).slice(0, 18)
    const libraryGroups = catalog.libraryGroups.length
      ? catalog.libraryGroups
      : categories.slice(0, 4).map((category) => ({
        id: category.id,
        title: category.name,
        description: category.description,
        channels: category.radios.slice(0, 8)
      }))

    return {
      banners: featured.slice(0, 3).map((item) => ({
        id: item.id,
        title: item.title,
        coverUrl: item.bannerUrl || item.coverUrl,
        targetId: item.id,
        to: item.to
      })),
      featured,
      hot,
      categories,
      activeCategory: firstCategory ?? null,
      categoryRadios: firstCategory?.radios ?? hot,
      today: catalog.previewTracks,
      programToplist: catalog.previewTracks,
      paid: [],
      recent: [],
      subscribed: [],
      satiTags: categories.slice(0, 10).map((item) => ({
        id: item.id,
        tag: item.id,
        title: item.name,
        description: item.description
      })),
      satiResources: [],
      difm: libraryGroups,
      yuekuGroups: libraryGroups,
      broadcastMeta: {
        categories: categories.map(({ id, name }) => ({ id, name })),
        regions: []
      },
      broadcastChannels: uniqueRadioCards([
        ...catalog.libraryRadios,
        ...catalog.classRadios,
        ...catalog.recommendRadios
      ]).slice(0, 36),
      allRadios: catalog.allRadios
    }
  })
}

export async function searchPodcastsData({ keyword, limit = 18, offset = 0 } = {}) {
  const query = String(keyword ?? '').trim()

  if (!query) {
    return {
      items: [],
      total: 0,
      more: false
    }
  }

  const response = await searchVoiceLists({
    keyword: query,
    limit,
    offset
  })
  const result = response.data ?? response
  const resources = result.resources ?? result.list ?? result.items ?? []

  return {
    items: resources.map(mapVoiceListSearchResult).filter((item) => item.id),
    total: result.totalCount ?? result.total ?? resources.length,
    more: Boolean(result.hasMore || result.more)
  }
}

export async function getPodcastCategoryData({ cateId, limit = 18, offset = 0 } = {}) {
  const catalog = await getRadioCatalogData()
  const source = String(cateId) === 'recommend'
    ? catalog.recommendRadios
    : catalog.classGroups.find((group) => String(group.id) === String(cateId))?.radios ?? catalog.classRadios
  const radios = uniqueRadioCards(source)
  const items = radios.slice(offset, offset + limit)

  return {
    items,
    total: radios.length,
    more: offset + items.length < radios.length
  }
}

export async function getPodcastRankData({ type = 'hot', limit = 18, offset = 0 } = {}) {
  const catalog = await getRadioCatalogData()
  const sortByAddTime = (items) => [...items].sort((current, next) => {
    const currentTime = new Date(current.raw?.addtime || 0).getTime() || 0
    const nextTime = new Date(next.raw?.addtime || 0).getTime() || 0

    return nextTime - currentTime
  })
  const sortByHeat = (items) => [...items].sort((current, next) => {
    return Number(next.heat || 0) - Number(current.heat || 0)
  })
  const sources = {
    hot: catalog.recommendRadios,
    new: sortByAddTime(catalog.allRadios),
    library: catalog.libraryRadios,
    classic: catalog.classGroups.find((group) => /主题|经典|年代/.test(group.name))?.radios ?? catalog.classRadios,
    scene: catalog.classGroups.find((group) => /场景|心情|运动|生活/.test(group.name))?.radios ?? catalog.libraryRadios,
    heat: sortByHeat(catalog.allRadios)
  }
  const radios = uniqueRadioCards(sources[type] ?? sources.hot)
  const items = radios.slice(offset, offset + limit)

  return {
    items,
    total: radios.length,
    more: offset + items.length < radios.length
  }
}

export async function getPodcastDetailData({ id, fmtype = 2, limit = 40, offset = 0 } = {}) {
  const catalog = await getRadioCatalogData()
  const radio = catalog.radiosById.get(String(id)) ?? mapRadioCard({ fmid: id, fmtype })
  const songResponse = await getRadioSongs({
    fmid: id,
    fmtype: radio.fmtype ?? fmtype,
    fmoffset: offset,
    fmsize: limit
  })
  const songs = getRadioSongPayload(songResponse)
  const programs = songs.map((song, index) => mapRadioSongTrack(song, index + offset, radio))
  const total = getRadioSongTotal(songResponse, offset, programs.length, limit)

  return {
    podcast: mapRadioDetail(radio, total),
    programs,
    total,
    more: programs.length >= limit
  }
}

export async function getPodcastProgramsData({ id, fmtype = 2, limit = 40, offset = 0 } = {}) {
  const catalog = await getRadioCatalogData()
  const radio = catalog.radiosById.get(String(id)) ?? mapRadioCard({ fmid: id, fmtype })
  const response = await getRadioSongs({
    fmid: id,
    fmtype: radio.fmtype ?? fmtype,
    fmoffset: offset,
    fmsize: limit
  })
  const programs = getRadioSongPayload(response).map((song, index) => mapRadioSongTrack(song, index + offset, radio))
  const total = getRadioSongTotal(response, offset, programs.length, limit)

  return {
    programs,
    total,
    more: programs.length >= limit
  }
}

export async function getPodcastProgramDetailData(id) {
  const response = await getDjProgramDetail({ id })
  const program = response.program ?? response.data ?? response

  return mapPodcastProgramTrack(program)
}

export async function togglePodcastSubscribeData({ id, subscribe }) {
  return {
    id,
    subscribe,
    skipped: true
  }
}

export async function getPodcastCategoryRecommendationsData(type) {
  const data = await getPodcastCategoryData({ cateId: type, limit: 24, offset: 0 })

  return data.items
}

export async function getSatiResourcesData(tag = 'RCMD') {
  const response = await getSatiResources({ tag })

  return getSatiResourcePayload(response).map(mapSatiResourceTrack)
}

export async function getSatiMoreResourcesData(id) {
  const response = await getSatiMoreResources({ id })

  return getSatiResourcePayload(response).map(mapSatiResourceTrack)
}

export async function getSatiSubscribedResourcesData() {
  const response = await getSatiSubscribedResources()

  return getSatiResourcePayload(response).map(mapSatiResourceTrack)
}

export async function toggleSatiResourceSubscribeData({ id, cancel = false }) {
  return updateSatiSubscribe({
    id,
    cancel: cancel || undefined,
    timestamp: Date.now()
  })
}

export async function getDifmChannelTracksData({ source = 0, channelId, limit = 12 } = {}) {
  const response = await getDifmPlayingTracks({
    source,
    channelId,
    limit
  })

  return getDifmTrackPayload(response).map(mapDifmTrack)
}

export async function getBroadcastChannelsData({ categoryId = 0, regionId = 0 } = {}) {
  const response = await getBroadcastChannelList({
    categoryId,
    regionId
  })

  return getBroadcastChannelPayload(response).map(mapBroadcastChannel)
}

export async function getBroadcastChannelDetailData(id) {
  const response = await getBroadcastCurrentInfo({ id })

  return mapBroadcastChannel(response.data ?? response.channel ?? response)
}

export async function getBroadcastCollectedChannelsData(limit = 99999) {
  const response = await getBroadcastCollectList({ limit })

  return getBroadcastChannelPayload(response).map(mapBroadcastChannel)
}

export async function toggleBroadcastSubscribeData({ id, subscribe }) {
  return updateBroadcastSubscribe({
    id,
    t: subscribe ? 1 : 0,
    timestamp: Date.now()
  })
}

export async function getMyCreatedVoiceListData(limit = 20) {
  const response = await getMyCreatedVoiceList({ limit })

  return getProgramPayload(response).map(mapPodcastProgramTrack)
}

export async function searchVoiceListProgramsData(params = {}) {
  const response = await searchVoiceListPrograms(params)

  return getProgramPayload(response).map(mapPodcastProgramTrack)
}

export async function getVoiceLyricData(id) {
  const response = await getVoiceLyric({ id })

  return parseLyricLines(response.data?.lyric ?? response.lrc?.lyric ?? response.lyric ?? '')
}

export async function getSportRadioData(bpm = 120) {
  const response = await getSportRadio({ bpm })
  const songs = response.data?.songs ?? response.songs ?? response.data ?? []

  return Array.isArray(songs) ? songs.map(mapPlaylistTrack) : []
}

export async function getVideoCenterData({
  area = '全部',
  type = '全部',
  order = '上升最快',
  limit = 18,
  offset = 0
} = {}) {
  const [
    recommendedResponse,
    firstResponse,
    exclusiveResponse,
    topResponse,
    allResponse,
    subscribedResponse,
    followNewResponse
  ] = await Promise.all([
    getNeteasePersonalizedMvs().catch(() => ({})),
    getNeteaseFirstMvs({ area, limit: 12 }).catch(() => ({})),
    getNeteaseExclusiveMvs({ limit: 12, offset: 0 }).catch(() => ({})),
    getNeteaseTopMvs({ area: area === '全部' ? undefined : area, limit: 10, offset: 0 }).catch(() => ({})),
    getNeteaseAllMvs({ area, type, order, limit, offset }).catch(() => ({})),
    getNeteaseSubscribedMvs().catch(() => ({})),
    getNeteaseFollowArtistNewMvs({ limit: 10 }).catch(() => ({}))
  ])
  const recommended = (recommendedResponse.result ?? []).map(mapVideoMv)
  const first = getMvListPayload(firstResponse).map(mapVideoMv)
  const exclusive = getMvListPayload(exclusiveResponse).map(mapVideoMv)
  const top = await hydrateMissingMvCards(getMvListPayload(topResponse).map(mapVideoMv))
  const all = getMvListPayload(allResponse).map(mapVideoMv)
  const subscribed = getMvListPayload(subscribedResponse).map(mapVideoMv)
  const followArtistNew = getMvListPayload(followNewResponse).map(mapVideoMv)
  const hero = top[0] ?? recommended[0] ?? first[0] ?? exclusive[0] ?? all[0] ?? null
  const active = hero ? await getMvPlaybackData(hero.id).catch(() => ({ mv: hero })) : null

  return {
    recommended,
    first,
    exclusive,
    top,
    all,
    subscribed,
    followArtistNew,
    total: allResponse.count ?? allResponse.total ?? all.length,
    more: Boolean(allResponse.hasMore || allResponse.more),
    active
  }
}

export async function getFilteredMvsData({
  area = '全部',
  type = '全部',
  order = '上升最快',
  limit = 18,
  offset = 0
} = {}) {
  const response = await getNeteaseAllMvs({ area, type, order, limit, offset })
  const items = getMvListPayload(response).map(mapVideoMv)

  return {
    items,
    total: response.count ?? response.total ?? items.length,
    more: Boolean(response.hasMore || response.more)
  }
}

export async function getMvPlaybackData(id, quality = 1080) {
  const [detailResponse, infoResponse, urlResponse, simiResponse, commentResponse, ugcResponse] = await Promise.all([
    getNeteaseMvDetail({ mvid: id }).catch(() => ({})),
    getNeteaseMvDetailInfo({ mvid: id }).catch(() => ({})),
    getNeteaseMvUrl({ id, r: quality || 1080 }).catch(() => ({})),
    getNeteaseSimilarMvs({ mvid: id }).catch(() => ({})),
    getNeteaseMvComments({ id, limit: 12, offset: 0 }).catch(() => ({})),
    getNeteaseUgcMv({ id }).catch(() => ({}))
  ])
  const detail = detailResponse.data ?? detailResponse.mv ?? {}
  const mv = mapVideoMv(detail)
  const playbackUrl = getMvPlaybackUrl({
    urlResponse,
    brs: detail.brs,
    detail,
    ugcResponse,
    quality
  })
  const artistId = mv.artistId || detail.artistId || detail.artists?.[0]?.id
  const artistMvResponse = artistId
    ? await getNeteaseArtistMvs({ id: artistId, limit: 8 }).catch(() => ({}))
    : {}

  return {
    mv: {
      ...mv,
      id: mv.id ?? id,
      description: detail.desc || detail.description || detail.briefDesc || '',
      publishTime: formatPlainDate(detail.publishTime),
      brs: detail.brs ?? [],
      url: playbackUrl.url,
      urlQuality: playbackUrl.quality || quality || '',
      stats: mapMvStats(infoResponse),
      encyclopedia: mapMvEncyclopedia(ugcResponse)
    },
    similar: getMvListPayload(simiResponse).map(mapVideoMv),
    artistMvs: getMvListPayload(artistMvResponse).map(mapVideoMv),
    comments: mapMvCommentResult(commentResponse)
  }
}

export async function toggleMvSubscribeData({ id, subscribe }) {
  return subscribeNeteaseMv({
    mvid: id,
    t: subscribe ? 1 : 0,
    timestamp: Date.now()
  })
}

export async function toggleMvLikeData({ id, like }) {
  return likeNeteaseResource({
    id,
    type: 1,
    t: like ? 1 : 0,
    timestamp: Date.now()
  })
}

export async function getDownloadedSongsData({ limit = 50, offset = 0 } = {}) {
  const response = await getSongDownloadList({ limit, offset, timestamp: Date.now() })
  const songs = response.data?.list ?? response.list ?? response.songs ?? []

  return Array.isArray(songs)
    ? songs.map((item, index) => mapPlaylistTrack(item.song ?? item, offset + index))
    : []
}

export async function getChartsDiscoveryData() {
  const toplistResponse = await getToplist({ withsong: 1 })
  const toplists = (toplistResponse.list ?? []).map(mapToplist)
  const featured = toplists.slice(0, 6)
  const boards = await hydrateChartPreviewTracks(featured)

  return {
    boards,
    officialCharts: featured,
    globalCharts: toplists.slice(6),
    chartSections: groupToplists(toplists.slice(6))
  }
}

async function hydrateChartPreviewTracks(charts) {
  const previewResponses = await Promise.all(
    charts.map((chart) => {
      if (Array.isArray(chart.tracks) && chart.tracks.length >= 3) {
        return Promise.resolve(null)
      }

      return getPlaylistTracks({ id: chart.id, limit: 3, offset: 0 }).catch(() => null)
    })
  )

  return charts.map((chart, index) => {
    const previewSongs = previewResponses[index]?.songs ?? []
    const tracks = previewSongs.length
      ? previewSongs.slice(0, 3).map(mapChartTrack)
      : (chart.tracks ?? []).slice(0, 3)

    return {
      ...chart,
      tracks
    }
  })
}

function groupToplists(charts) {
  const sectionMap = new Map()

  charts.forEach((chart) => {
    const title = getToplistSectionTitle(chart.title)

    if (!sectionMap.has(title)) {
      sectionMap.set(title, [])
    }

    sectionMap.get(title).push(chart)
  })

  return [...sectionMap.entries()].map(([title, items]) => ({ title, items }))
}

function getToplistSectionTitle(name = '') {
  if (/合伙人/.test(name)) {
    return '音乐合伙人榜'
  }

  if (/黑胶|VIP/.test(name)) {
    return '会员榜'
  }

  if (/韩语|UK|美国|Billboard|Beatport|日本|Oricon|欧美|法国|日语|俄语|越南|俄罗斯|泰语/.test(name)) {
    return '地区/语种榜'
  }

  if (/说唱|古典|电音|ACG|动画|游戏|VOCALOID|摇滚|国风|民谣|DJ|R&B/.test(name)) {
    return '曲风榜'
  }

  if (/KTV|听歌识曲|网络热歌|LOOK|直播|车友|蛋仔|AI|乐夏|喜力|特斯拉|理想|比亚迪|蔚来|极氪|昊铂|埃安|吉利/.test(name)) {
    return '场景/活动榜'
  }

  return '特色榜'
}

function getPodcastPayload(response = {}) {
  const candidates = [
    response.data,
    response.result,
    response.djRadios,
    response.radios,
    response.toplist,
    response.data?.list,
    response.data?.toplist,
    response.data?.radios,
    response.data?.djRadios,
    response.data?.resources,
    response.data?.items,
    response.list,
    response.resources,
    response.items
  ]
  const items = candidates.find((item) => Array.isArray(item)) ?? []

  return items.flatMap((item) => {
    if (Array.isArray(item?.radios)) {
      return item.radios
    }

    return item?.baseInfo ?? item?.radio ?? item?.djRadio ?? item?.resource ?? item
  })
}

function getProgramPayload(response = {}) {
  const candidates = [
    response.programs,
    response.toplist,
    response.data?.programs,
    response.data?.list,
    response.data?.toplist,
    response.data?.resources,
    response.data,
    response.list,
    response.resources,
    response.records,
    response.program ? [response.program] : null
  ]
  const items = candidates.find((item) => Array.isArray(item)) ?? []

  return items
    .map((item) => item?.data ?? item?.resource ?? item?.program ?? item)
    .filter(Boolean)
}

function getSatiTagPayload(response = {}) {
  const candidates = [response.data, response.tags, response.data?.tags, response.list]

  return candidates.find((item) => Array.isArray(item)) ?? []
}

function getSatiResourcePayload(response = {}) {
  const candidates = [
    response.data,
    response.resources,
    response.resourceList,
    response.items,
    response.result,
    response.data?.resources,
    response.data?.resourceList,
    response.data?.list,
    response.data?.items,
    response.data?.result,
    response.list
  ]

  return candidates.find((item) => Array.isArray(item)) ?? []
}

function getDifmTrackPayload(response = {}) {
  const candidates = [response.data, response.tracks, response.data?.tracks, response.data?.list, response.list]

  return candidates.find((item) => Array.isArray(item)) ?? []
}

function getBroadcastChannelPayload(response = {}) {
  const candidates = [
    response.data,
    response.channels,
    response.data?.channels,
    response.data?.list,
    response.list,
    response.channelList
  ]

  return candidates.find((item) => Array.isArray(item)) ?? []
}

function mapPodcastBanners(response = {}) {
  const banners = Array.isArray(response.data)
    ? response.data
    : Array.isArray(response.banners)
      ? response.banners
      : []

  return banners.map((banner, index) => ({
    id: banner.targetId || banner.url || `podcast-banner-${index}`,
    title: banner.typeTitle || '电台精选',
    coverUrl: resizeNeteaseImage(banner.pic ?? banner.imageUrl, 1200),
    targetId: banner.targetId || '',
    externalUrl: banner.url?.startsWith('http') ? banner.url : ''
  }))
}

function mapPodcastCategories(categoryResponse = {}, hotCategoryResponse = {}) {
  const featured = Array.isArray(categoryResponse.data)
    ? categoryResponse.data
    : Array.isArray(categoryResponse.categories)
      ? categoryResponse.categories
      : []
  const hotCategories = Array.isArray(hotCategoryResponse.categories)
    ? hotCategoryResponse.categories
    : Array.isArray(hotCategoryResponse.data)
      ? hotCategoryResponse.data
      : []
  const categoryMap = new Map()

  featured.forEach((item) => {
    const id = item.categoryId ?? item.id

    if (!id) {
      return
    }

    categoryMap.set(String(id), {
      id,
      name: item.categoryName ?? item.name,
      radios: (item.radios ?? []).map(mapPodcastCard)
    })
  })

  hotCategories.forEach((item) => {
    const id = item.id ?? item.categoryId

    if (!id || categoryMap.has(String(id))) {
      return
    }

    categoryMap.set(String(id), {
      id,
      name: item.name ?? item.categoryName,
      radios: []
    })
  })

  return [...categoryMap.values()].filter((item) => item.name)
}

function uniquePodcasts(items = []) {
  const seenIds = new Set()

  return items
    .map(mapPodcastCard)
    .filter((item) => {
      const id = String(item?.id ?? '')

      if (!id || seenIds.has(id)) {
        return false
      }

      seenIds.add(id)
      return true
    })
}

function mapVoiceListSearchResult(resource, index) {
  return mapPodcastCard(
    {
      ...(resource?.baseInfo ?? {}),
      resourceId: resource?.resourceId,
      uiElement: resource?.uiElement,
      extInfo: resource?.extInfo
    },
    index
  )
}

function mapPodcastCard(raw = {}, index = 0) {
  return mapRadioCard(raw, index)
}

function mapPodcastDetail(raw = {}) {
  return mapRadioDetail(raw)
}

function mapPodcastProgramTrack(program = {}, index = 0) {
  return mapRadioSongTrack(program.mainSong ?? program.song ?? program.track ?? program, index, program.radio ?? program.djRadio ?? {})
}

function mapSatiTag(item = {}) {
  return {
    id: item.tag,
    tag: item.tag,
    title: item.tagDesc || item.tag,
    description: item.text || ''
  }
}

function mapSatiResourceTrack(item = {}, index = 0) {
  const id = item.trackId ?? item.djProgramId ?? item.id

  return {
    id,
    programId: item.djProgramId ?? '',
    name: item.name || '助眠声音',
    artist: '助眠解压',
    album: getSatiCategoryName(item.category),
    rank: String(index + 1).padStart(2, '0'),
    type: coverType(index || Number(id) || 0),
    time: '--:--',
    duration: '--:--',
    coverUrl: resizeNeteaseImage(item.pic, 240),
    source: '助眠解压',
    satiId: item.id,
    category: item.category
  }
}

function mapDifmGroups(response = {}) {
  const candidates = [response.data, response.channels, response.data?.channels, response.list]
  const items = candidates.find((item) => Array.isArray(item)) ?? []

  return items.flatMap((item, index) => {
    const styles = item.styles ?? item.styleList

    if (Array.isArray(styles)) {
      return styles.map((style, styleIndex) => ({
        id: style.id ?? style.styleId ?? `${item.source ?? index}-${styleIndex}`,
        title: style.chineseName || style.name || style.title || 'DIFM 频道',
        source: style.source ?? item.source ?? 0,
        description: style.description ?? '',
        channels: (style.channels ?? style.channelList ?? []).map((channel, channelIndex) => ({
          id: channel.id ?? channel.channelId ?? `${styleIndex}-${channelIndex}`,
          title: channel.chineseName || channel.name || channel.title || 'DIFM 频道',
          description: channel.description ?? channel.desc ?? style.description ?? '',
          source: channel.source ?? style.source ?? item.source ?? 0,
          coverUrl: resizeNeteaseImage(
            channel.cover ?? channel.coverUrl ?? channel.picUrl ?? channel.imgUrl,
            360
          )
        }))
      }))
    }

    return {
      id: item.id ?? item.channelId ?? `${item.name ?? item.title}-${index}`,
      title: item.chineseName || item.name || item.title || item.styleName || 'DIFM 频道',
      source: item.source ?? item.sourceType ?? item.type ?? 0,
      description: item.description ?? item.desc ?? '',
      channels: (item.channels ?? item.channelList ?? item.list ?? []).map((channel, channelIndex) => ({
        id: channel.id ?? channel.channelId ?? `${index}-${channelIndex}`,
        title: channel.chineseName || channel.name || channel.title || 'DIFM 频道',
        description: channel.desc ?? channel.description ?? '',
        source: channel.source ?? item.source ?? 0,
        coverUrl: resizeNeteaseImage(channel.cover ?? channel.coverUrl ?? channel.picUrl ?? channel.imgUrl, 360)
      }))
    }
  })
}

function mapDifmTrack(item = {}, index = 0) {
  const song = item.song ?? item.track ?? item
  const id = song.id ?? item.trackId ?? item.id

  return {
    id,
    name: song.name ?? item.name ?? 'DIFM 声音',
    artist: getArtistNames(song.ar ?? song.artists ?? []) || song.artist || item.artistName || item.artist || 'DIFM',
    album: item.channelName || item.styleName || 'DIFM 电台',
    rank: String(index + 1).padStart(2, '0'),
    type: coverType(index || Number(id) || 0),
    time: formatDifmDuration(song.dt ?? song.duration ?? item.duration),
    duration: formatDifmDuration(song.dt ?? song.duration ?? item.duration),
    coverUrl: resizeNeteaseImage(song.al?.picUrl ?? song.album?.picUrl ?? item.cover ?? item.coverUrl ?? item.picUrl, 360),
    source: 'DIFM'
  }
}

function mapBroadcastMeta(response = {}) {
  const data = response.data ?? response

  return {
    categories: (data.categories ?? data.categoryList ?? data.category ?? []).map((item) => ({
      id: item.id ?? item.categoryId,
      name: item.name ?? item.categoryName
    })),
    regions: (data.regions ?? data.regionList ?? data.region ?? []).map((item) => ({
      id: item.id ?? item.regionId,
      name: item.name ?? item.regionName
    }))
  }
}

function mapBroadcastChannel(item = {}, index = 0) {
  const id = item.id ?? item.channelId ?? item.radioId

  return {
    id,
    title: item.name ?? item.channelName ?? '广播电台',
    name: item.name ?? item.channelName ?? '广播电台',
    description: item.desc ?? item.description ?? item.programName ?? '',
    coverUrl: resizeNeteaseImage(item.picUrl ?? item.coverUrl ?? item.logoUrl, 360),
    category: item.categoryName ?? item.category ?? '',
    region: item.regionName ?? item.region ?? '',
    subed: Boolean(item.subed ?? item.collected),
    type: coverType(index || Number(id) || 0)
  }
}

async function getRadioCatalogData() {
  return getCachedData('radio-catalog', CACHE_TTL.podcast, async () => {
    const [classResponse, recommendResponse, libraryResponse] = await Promise.all([
      getRadioClasses().catch(() => ({})),
      getRadioRecommend().catch(() => ({})),
      getRadioLibrary().catch(() => ({}))
    ])
    const classGroups = getRadioClassGroups(classResponse)
    const classRadios = classGroups.flatMap((group) =>
      group.radios.map((radio) => ({
        ...radio,
        category: radio.category || group.name,
        primaryCategory: radio.primaryCategory || group.name
      }))
    )
    const recommendRadios = getRadioRecommendPayload(recommendResponse).map((item, index) => mapRadioCard(item, index))
    const libraryGroups = getRadioLibraryGroups(libraryResponse)
    const libraryRadios = libraryGroups.flatMap((group) =>
      group.channels.map((radio) => ({
        ...radio,
        sectionTitle: group.title
      }))
    )
    const allRadios = uniqueRadioCards([
      ...recommendRadios,
      ...libraryRadios,
      ...classRadios
    ])
    const imageMap = await getRadioImageMap(allRadios.slice(0, 80))
    const hydratedRadios = allRadios.map((radio) => hydrateRadioImage(radio, imageMap))
    const radiosById = new Map(hydratedRadios.map((radio) => [String(radio.id), radio]))
    const hydratedClassGroups = classGroups.map((group) => ({
      ...group,
      radios: group.radios.map((radio) => hydrateRadioImage(radiosById.get(String(radio.id)) ?? radio, imageMap))
    }))
    const hydratedLibraryGroups = libraryGroups.map((group) => ({
      ...group,
      channels: group.channels.map((radio) => hydrateRadioImage(radiosById.get(String(radio.id)) ?? radio, imageMap))
    }))
    const hydratedRecommendRadios = recommendRadios.map((radio) => hydrateRadioImage(radiosById.get(String(radio.id)) ?? radio, imageMap))
    const previewTracks = uniqueSongs(
      hydratedRecommendRadios
        .flatMap((radio) => radio.previewTracks ?? [])
        .map((track, index) => ({ ...track, rank: String(index + 1).padStart(2, '0') }))
    ).slice(0, 12)

    return {
      classGroups: hydratedClassGroups,
      classRadios: hydratedClassGroups.flatMap((group) => group.radios),
      recommendRadios: uniqueRadioCards(hydratedRecommendRadios),
      libraryGroups: hydratedLibraryGroups,
      libraryRadios: hydratedLibraryGroups.flatMap((group) => group.channels),
      allRadios: hydratedRadios,
      radiosById,
      previewTracks
    }
  })
}

function getRadioClassGroups(response = {}) {
  const data = response.data ?? response
  const groups = asArray(data.class_list ?? data.classList ?? data.classes ?? response.class_list)

  return groups.map((group, groupIndex) => {
    const radios = asArray(group.fmlist ?? group.fm_list ?? group.radios ?? group.list)
      .map((item, index) => mapRadioCard({
        ...item,
        classid: item.classid ?? group.classid,
        classname: item.classname ?? group.classname
      }, index))
      .filter((radio) => radio.id)

    return {
      id: group.classid ?? group.id ?? `class-${groupIndex + 1}`,
      name: group.classname ?? group.name ?? `电台分类 ${groupIndex + 1}`,
      count: group.class_count ?? radios.length,
      sort: Number(group.sort_app ?? group.sort ?? groupIndex),
      radios
    }
  }).filter((group) => group.radios.length)
}

function getRadioRecommendPayload(response = {}) {
  return asArray(response.data ?? response.radios ?? response.list ?? response.items)
}

function getRadioLibraryGroups(response = {}) {
  const groups = asArray(response.data ?? response.list ?? response.items)

  return groups.map((group, groupIndex) => {
    const title = group.time_fm_cn || group.title || group.name || `乐库电台 ${groupIndex + 1}`
    const description = group.rcm_text || group.description || ''
    const channels = asArray(group.fm_list ?? group.fmlist ?? group.radios ?? group.list)
      .map((item, index) => mapRadioCard({
        ...item,
        sectionTitle: title,
        sectionDescription: description
      }, index))
      .filter((radio) => radio.id)

    return {
      id: group.id ?? group.time_fm_cn ?? `library-${groupIndex + 1}`,
      title,
      description,
      source: 'yueku',
      channels
    }
  }).filter((group) => group.channels.length)
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
    source.fmname ?? source.fm_name ?? source.name ?? source.title ?? raw.uiElement?.mainTitle?.title ?? '未命名电台'
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
    creator: '酷狗电台',
    creatorAvatarUrl: coverUrl,
    category: category || '电台',
    primaryCategory: category || '电台',
    subCategory: source.parentName || '',
    coverUrl,
    bannerUrl,
    programCount: Number(source.rcmdsongsize ?? source.size ?? previewTracks.length) || previewTracks.length,
    subCount: 0,
    playCount: heat,
    heat,
    playCountLabel: heat ? `${formatPlayCount(heat)} 热度` : 'FM',
    subCountLabel: '',
    programCountLabel: '',
    lastProgramName: previewTracks[0]?.name || '',
    score: source.isnew === '1' || source.isnew === 1 ? '新' : '',
    tag: category || '电台',
    subed: false,
    type: coverType(index || Number(id) || 0),
    to: id ? `/podcast/${id}` : '',
    previewTracks,
    raw: source
  }
}

function mapRadioDetail(raw = {}, total = 0) {
  const card = mapRadioCard(raw, Number(raw.id) || 0)

  return {
    ...card,
    description: card.description || getRadioDescription(card.title, card.category),
    programCount: total,
    programCountLabel: total ? `${total}+ 首歌曲` : '',
    commentCount: 0,
    shareCount: 0,
    likedCount: 0,
    lastUpdated: formatPlainDate(raw.raw?.addtime ?? raw.addtime),
    comments: []
  }
}

function mapRadioSongTrack(song = {}, index = 0, radio = {}) {
  const file = splitKugouSongName(song.name || song.filename || song.songname || song.audio_name || '未命名歌曲')
  const album = song.al ?? song.album ?? {}
  const artists = song.ar ?? song.artists ?? []
  const artistName = getArtistNames(artists) || song.artist || song.singername || file.artist || '未知歌手'
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
    name: file.name || song.name || '未命名歌曲',
    artistId: artists[0]?.id ?? song.author_id ?? '',
    artistIds: getArtistIds(artists),
    artist: artistName,
    album: radio.title || radio.name || album.name || '酷狗电台',
    albumId: album.id ?? song.album_id ?? '',
    rank: String(index + 1).padStart(2, '0'),
    type: coverType(index || Number(id) || 0),
    time: formatRadioDuration(duration),
    duration: formatRadioDuration(duration),
    coverUrl,
    thumbnailUrl: normalizeKugouMediaUrl(coverUrl, 96),
    source: radio.title ? `电台 · ${radio.title}` : '酷狗电台',
    category: radio.category || '',
    vip: isVipSong(song),
    hasVideo: Boolean(song.mv || song.mvhash),
    mvId: song.mv || song.mvhash || '',
    radioId: radio.id || radio.fmid || '',
    radioTitle: radio.title || radio.name || ''
  }
}

function getRadioSongPayload(response = {}) {
  const data = response.data ?? response
  const candidates = [
    data?.songs,
    data?.list,
    data?.items,
    data?.data,
    response.songs,
    response.list,
    response.items
  ]
  const direct = candidates.find((item) => Array.isArray(item))

  if (direct) {
    return direct.map((item) => item.song ?? item.resource ?? item).filter(Boolean)
  }

  return asArray(data).flatMap((item) => asArray(item.songs ?? item.list ?? item.items))
}

function getRadioSongTotal(response = {}, offset = 0, count = 0, limit = 0) {
  const data = response.data ?? response
  const first = Array.isArray(data) ? data[0] : data
  const total = first?.total ?? first?.count ?? response.total ?? response.count

  return Number(total) || offset + count
}

function getRadioDescription(title = '', category = '') {
  const prefix = category ? `${category}里的` : ''

  return `${prefix}${title}，按酷狗电台实时歌单连续播放。`
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

function getRadioPreviewSongs(source = {}) {
  const candidates = [
    source.rcmdlist,
    source.songlist,
    source.songs,
    source.song_info ? [source.song_info] : null
  ]

  return candidates.find((item) => Array.isArray(item)) ?? []
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

function formatRadioDuration(duration = 0) {
  const value = Number(duration)

  if (!Number.isFinite(value) || value <= 0) {
    return '0:00'
  }

  return formatDuration(value > 0 && value < 10000 ? value * 1000 : value)
}

function getSatiCategoryName(tag) {
  const names = {
    RCMD: '热门',
    sleep: '助眠',
    meditation: '冥想',
    starGoodNight: '明星哄睡',
    lightmusic: '轻音乐',
    goodnightStory: '晚安故事',
    dokodemo: '任意门',
    cloudStudyRoom: '云上自习室',
    relax: '解压',
    naturalMusic: '空灵乐器'
  }

  return names[tag] || '声音资源'
}

function cleanRadioTitle(value) {
  return String(value ?? '').replace(/^(播客|电台|FM)[:：]\s*/i, '').trim()
}

function cleanPodcastTitle(value) {
  return String(value ?? '').replace(/^播客[:：]\s*/, '').trim()
}

function parseCountText(value) {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value !== 'string') {
    return 0
  }

  const match = value.match(/([\d.]+)\s*(亿|万)?/)

  if (!match) {
    return 0
  }

  const number = Number(match[1])

  if (!Number.isFinite(number)) {
    return 0
  }

  if (match[2] === '亿') {
    return Math.round(number * 100000000)
  }

  if (match[2] === '万') {
    return Math.round(number * 10000)
  }

  return number
}

function mapToplist(item, index) {
  return {
    id: item.id,
    title: item.name,
    desc: item.description || item.updateFrequency || '',
    label: item.updateFrequency || '云音乐榜单',
    coverUrl: item.coverImgUrl,
    listeners: formatPlayCount(item.playCount),
    trackCount: item.trackCount ?? item.tracks?.length ?? 0,
    type: coverType(index),
    tracks: (item.tracks ?? []).slice(0, 3).map(mapChartTrack)
  }
}

function mapChartTrack(song, index) {
  const artists = song.ar ?? song.artists ?? []
  const titleSource = [song.name, song.first, song.songname]
    .find((value) => String(value || '').includes(' - ')) ||
    song.name ||
    song.first ||
    song.songname
  const parsedTitle = splitChartTrackTitle(titleSource)
  const explicitArtist =
    artists.map((artist) => artist.name).filter(Boolean).join(' / ') ||
    song.second ||
    song.author ||
    ''
  const artist = explicitArtist && explicitArtist !== '未知歌手'
    ? explicitArtist
    : parsedTitle.artist || explicitArtist || '未知歌手'

  return {
    id: song.id ?? song.album_audio_id ?? song.mixsongid ?? song.hash ?? '',
    ...getKugouTrackMeta(song),
    rank: String(index + 1).padStart(2, '0'),
    name: parsedTitle.name || song.first || song.name || song.songname || '未知歌曲',
    artist,
    change: index === 0 ? 'HOT' : index < 3 ? 'UP' : ''
  }
}

function splitChartTrackTitle(value = '') {
  const text = String(value || '').trim()
  const [artist, ...nameParts] = text.split(' - ')

  if (!artist || !nameParts.length) {
    return {
      artist: '',
      name: text
    }
  }

  return {
    artist: artist.trim(),
    name: nameParts.join(' - ').trim()
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

function mapPlaylistTrack(song, index) {
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
    artist: artists.map((artist) => artist.name).filter(Boolean).join(' / ') || '未知歌手',
    album: album.name || '未知专辑',
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

function mapFmTrack(song, index) {
  const album = song.al ?? song.album ?? {}
  const artists = song.ar ?? song.artists ?? []
  const artistIds = getArtistIds(artists)
  const reason = song.reason || song.alg || song.extInfo?.reason || ''

  return {
    id: song.id,
    ...getKugouTrackMeta(song),
    name: song.name,
    artistId: artistIds[0] ?? '',
    artistIds,
    artist: artists.map((artist) => artist.name).filter(Boolean).join(' / ') || '未知歌手',
    album: album.name || '未知专辑',
    albumId: album.id ?? '',
    rank: String(index + 1).padStart(2, '0'),
    type: coverType(index),
    time: formatDuration(song.dt ?? song.duration),
    duration: formatDuration(song.dt ?? song.duration),
    coverUrl: resizeNeteaseImage(album.picUrl ?? song.picUrl, 520),
    vip: isVipSong(song),
    hasVideo: Boolean(song.mv),
    mvId: song.mv || '',
    reason,
    source: '私人 FM'
  }
}

function extractPersonalFmSongs(response = {}) {
  const candidates = [
    response.data,
    response.songs,
    response.recommend,
    response.resources,
    response.data?.songs,
    response.data?.list,
    response.data?.resources,
    response.data?.items,
    response.data?.tracks
  ]
  const songs = candidates.find((item) => Array.isArray(item)) ?? []

  return songs
    .map((item) => item.song ?? item.resource?.song ?? item.resourceInfo?.song ?? item)
    .filter((song) => song?.id)
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

function mapMv(mv, index) {
  return {
    id: mv.id,
    title: mv.name,
    artist: mv.artistName ?? mv.artists?.map((artist) => artist.name).join(' / ') ?? '',
    views: formatPlayCount(mv.playCount),
    duration: formatDuration(mv.duration),
    type: coverType(index),
    coverUrl: mv.picUrl
  }
}

function mapVideoMv(mv = {}, index = 0) {
  const artists = Array.isArray(mv.artists) ? mv.artists : []
  const artistName = mv.artistName || mv.creatorName || getArtistNames(artists) || mv.artist?.name || '未知艺人'
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
    title: mv.name || mv.title || '未命名 MV',
    name: mv.name || mv.title || '未命名 MV',
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

function mapMvStats(response = {}) {
  const data = response.data ?? response

  return {
    likedCount: toFiniteCount(data.likedCount),
    shareCount: toFiniteCount(data.shareCount),
    commentCount: toFiniteCount(data.commentCount),
    liked: Boolean(data.liked)
  }
}

function mapMvEncyclopedia(response = {}) {
  const data = response.data ?? response
  const candidates = [
    data.introduction,
    data.desc,
    data.description,
    data.briefDesc,
    data.mv?.desc,
    data.mv?.description
  ]
  const text = candidates.find((item) => typeof item === 'string' && item.trim()) || ''

  return {
    title: data.title || data.name || data.mv?.name || '',
    text,
    raw: data
  }
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

async function hydrateMissingMvCards(mvs = []) {
  const targets = mvs.filter((mv) => mv?.id && (!mv.coverUrl || !mv.playCountRaw))

  if (!targets.length) {
    return mvs
  }

  const detailResponses = await Promise.all(
    targets.map((mv) => getNeteaseMvDetail({ mvid: mv.id }).catch(() => null))
  )
  const detailsById = new Map()

  detailResponses.forEach((response, index) => {
    const detail = response?.data ?? response?.mv

    if (detail) {
      detailsById.set(String(targets[index].id), mapVideoMv(detail, index))
    }
  })

  return mvs.map((mv) => {
    const detail = detailsById.get(String(mv.id))

    if (!detail) {
      return mv
    }

    return {
      ...mv,
      title: mv.title && mv.title !== '未命名 MV' ? mv.title : detail.title,
      name: mv.name && mv.name !== '未命名 MV' ? mv.name : detail.name,
      artist: mv.artist && mv.artist !== '未知艺人' ? mv.artist : detail.artist,
      artistId: mv.artistId || detail.artistId,
      desc: mv.desc || detail.desc,
      coverUrl: mv.coverUrl || detail.coverUrl,
      playCount: mv.playCountRaw ? mv.playCount : detail.playCount,
      playCountRaw: mv.playCountRaw || detail.playCountRaw,
      duration: mv.duration && mv.duration !== '0:00' ? mv.duration : detail.duration,
      publishTime: mv.publishTime || detail.publishTime
    }
  })
}

function getMvPlaybackUrl({ urlResponse = {}, brs, detail = {}, ugcResponse = {}, quality = 1080 } = {}) {
  const apiUrl = selectNearestMvUrl(collectMvUrlCandidates(urlResponse, quality), quality)

  if (apiUrl.url) {
    return apiUrl
  }

  const fallbackUrl = getMvFallbackUrl(brs, quality)

  if (fallbackUrl.url) {
    return fallbackUrl
  }

  return selectNearestMvUrl([
    ...collectMvUrlCandidates(ugcResponse, quality),
    ...collectMvUrlCandidates(detail, quality)
  ], quality)
}

function getMvFallbackUrl(brs, quality = 1080) {
  if (!brs) {
    return { url: '', quality: '' }
  }

  const targetQuality = Number(quality) || 1080
  const candidates = Array.isArray(brs)
    ? brs.map((item) => ({
        quality: Number(item?.br ?? item?.r ?? item?.quality ?? 0),
        url: normalizeVideoUrl(
          typeof item === 'string' ? item : item?.url || item?.src || item?.playUrl || item?.videoUrl || ''
        )
      }))
    : Object.entries(brs).map(([key, value]) => ({
        quality: Number(key),
        url: normalizeVideoUrl(
          typeof value === 'string' ? value : value?.url || value?.src || value?.playUrl || value?.videoUrl || ''
        )
      }))

  return selectNearestMvUrl(candidates, targetQuality)
}

function collectMvUrlCandidates(payload, fallbackQuality = 1080, depth = 0) {
  if (!payload || depth > 4) {
    return []
  }

  if (typeof payload === 'string') {
    const url = normalizeVideoUrl(payload)
    return url ? [{ url, quality: fallbackQuality }] : []
  }

  if (Array.isArray(payload)) {
    return payload.flatMap((item) => collectMvUrlCandidates(item, fallbackQuality, depth + 1))
  }

  if (typeof payload !== 'object') {
    return []
  }

  const quality = getMvUrlQuality(payload, fallbackQuality)
  const directUrl = normalizeVideoUrl(
    payload.url || payload.src || payload.playUrl || payload.videoUrl || payload.mp4Url || payload.downloadUrl || ''
  )
  const candidates = directUrl ? [{ url: directUrl, quality }] : []
  const entries = Object.entries(payload)
  const looksLikeQualityMap = entries.length > 0 && entries.every(([key, value]) => /^\d+$/.test(key) && value)

  if (looksLikeQualityMap) {
    candidates.push(
      ...entries
        .map(([key, value]) => ({
          quality: Number(key),
          url: normalizeVideoUrl(
            typeof value === 'string' ? value : value?.url || value?.src || value?.playUrl || value?.videoUrl || ''
          )
        }))
        .filter((item) => item.url)
    )
  }

  for (const key of ['data', 'urls', 'urlInfo', 'videoUrlInfo', 'videoInfo', 'video', 'mv', 'mp', 'brs']) {
    candidates.push(...collectMvUrlCandidates(payload[key], quality, depth + 1))
  }

  return candidates
}

function selectNearestMvUrl(candidates = [], quality = 1080) {
  const targetQuality = Number(quality) || 1080

  return candidates
    .map((item) => ({
      quality: Number(item?.quality) || '',
      url: normalizeVideoUrl(item?.url)
    }))
    .filter((item) => item.url)
    .sort((current, next) => {
      const currentDistance = Math.abs((current.quality || targetQuality) - targetQuality)
      const nextDistance = Math.abs((next.quality || targetQuality) - targetQuality)

      return currentDistance - nextDistance
    })[0] ?? { url: '', quality: '' }
}

function getMvUrlQuality(source = {}, fallbackQuality = 1080) {
  const quality = Number(source.r ?? source.br ?? source.quality ?? source.resolution ?? fallbackQuality)

  return Number.isFinite(quality) && quality > 0 ? quality : fallbackQuality
}

function normalizeVideoUrl(url) {
  if (typeof url !== 'string') {
    return ''
  }

  const value = url.trim()

  if (!value) {
    return ''
  }

  return value.startsWith('//') ? `https:${value}` : value
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

function formatDifmDuration(duration = 0) {
  const value = Number(duration)

  if (!Number.isFinite(value)) {
    return '0:00'
  }

  return formatDuration(value > 0 && value < 10000 ? value * 1000 : value)
}

function formatPlayCount(count = 0) {
  if (count >= 100000000) {
    return `${trimNumber(count / 100000000)}亿`
  }

  if (count >= 10000) {
    return `${trimNumber(count / 10000)}万`
  }

  return String(count)
}

function toFiniteCount(value = 0) {
  const count = Number(value)

  return Number.isFinite(count) ? count : 0
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
    return '最近更新'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '最近更新'
  }

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${date.getFullYear()}-${month}-${day} 更新`
}

