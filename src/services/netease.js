import {
  getBanners,
  getAlbumComments,
  getAlbumDetail,
  getAlbumDynamic,
  getAllMvs,
  getArtistAlbums,
  getArtistDesc,
  getArtistDetail,
  getArtistDynamic,
  getArtistHotSongs,
  getArtistList,
  getArtistMvs,
  getArtistSongs,
  getArtistToplist,
  getArtistVideos,
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
  getDjComments,
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
  getPersonalizedNewSongs,
  getPersonalizedPlaylists,
  getLyric,
  getCloudSearch,
  getCommentInfoList,
  checkSongLike,
  getMvComments,
  getMvDetail,
  getMvDetailInfo,
  getMvUrl,
  getNewAlbums,
  getPersonalFm,
  getPersonalFmByMode,
  getPlaylistDetail,
  getPlaylistCategories,
  getPlaylistHotCategories,
  getPlaylistComments,
  getPlaylistTracks,
  getSongDownloadList,
  getSearchDefault,
  getSearchHotDetail,
  getSearchMultiMatch,
  getSearchSuggestPc,
  getSatiMoreResources,
  getSatiResources,
  getSatiTags,
  getSatiTimeSceneResources,
  getSatiSubscribedResources,
  getSongComments,
  getSongRedCount,
  getSportRadio,
  getSimilarMvs,
  getSubscribedMvs,
  getRecentDj,
  getVoiceLyric,
  sendFmTrash,
  searchVoiceLists,
  getTopMvs,
  getToplist,
  getTopPlaylists,
  getTopAlbums,
  getUserCollectedPlaylists,
  getUserCreatedPlaylists,
  getUgcMv,
  likeResource,
  searchVoiceListPrograms,
  subscribeMv,
  updateBroadcastSubscribe,
  updateDjSubscribe,
  updateSatiSubscribe,
  updateSongLike
} from '../api/modules/netease'
import { CACHE_TTL, COVER_TYPES } from '../config/app'
import { cacheKey, getCachedData } from './cache'

let playlistCategoryMetaPromise = null
let artistToplistPromise = null

export async function getHomeDiscoverData() {
  return getCachedData('home-discover', CACHE_TTL.discovery, async () => {
  const [bannerResponse, playlistResponse, newsongResponse, mvResponse] = await Promise.all([
    getBanners({ type: 0 }),
    getPersonalizedPlaylists({ limit: 18 }),
    getPersonalizedNewSongs({ limit: 100 }),
    getPersonalizedMvs()
  ])

  const banners = (bannerResponse.banners ?? []).map(mapBanner)
  const playlists = (playlistResponse.result ?? []).map(mapPlaylist)
  const songs = (newsongResponse.result ?? []).map(mapNewsong)
  const mvs = (mvResponse.result ?? []).map(mapMv)

  return {
    heroSlides: banners.slice(0, 6),
    recommendPlaylists: playlists.slice(0, 12),
    latestPlaylistCards: playlists.slice(12, 18),
    recommendedSingles: songs,
    recommendedMvs: mvs
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
  return getCachedData('podcast-home', CACHE_TTL.podcast, async () => {
    const [
      bannerResponse,
      personalizeResponse,
      recommendResponse,
      hotResponse,
      categoryResponse,
      categoryHotResponse,
      todayResponse,
      programTopResponse,
      payResponse,
      recentResponse,
      sublistResponse,
      satiTagsResponse,
      satiResourcesResponse,
      difmResponse,
      broadcastMetaResponse,
      broadcastListResponse
    ] = await Promise.all([
      getDjBanner().catch(() => ({})),
      getDjPersonalizeRecommend({ limit: 6 }).catch(() => ({})),
      getDjRecommend().catch(() => ({})),
      getDjHot({ limit: 12, offset: 0 }).catch(() => ({})),
      getDjCategoryRecommend().catch(() => ({})),
      getDjCatelist().catch(() => ({})),
      getDjTodayPreferred().catch(() => ({})),
      getDjProgramToplist({ limit: 8, offset: 0 }).catch(() => ({})),
      getDjToplistPay({ limit: 8 }).catch(() => ({})),
      getRecentDj({ limit: 8 }).catch(() => ({})),
      getDjSublist({ limit: 12, offset: 0 }).catch(() => ({})),
      getSatiTags().catch(() => ({})),
      getSatiResources({ tag: 'RCMD' }).catch(() => ({})),
      getDifmStyleChannels({ sources: JSON.stringify([0, 1, 2]) }).catch(() => ({})),
      getBroadcastCategoryRegion().catch(() => ({})),
      getBroadcastChannelList({ categoryId: 0, regionId: 0 }).catch(() => ({}))
    ])
    const categories = mapPodcastCategories(categoryResponse, categoryHotResponse)
    const firstCategory = categories[0]

    return {
      banners: mapPodcastBanners(bannerResponse),
      featured: uniquePodcasts([
        ...getPodcastPayload(personalizeResponse),
        ...getPodcastPayload(recommendResponse)
      ]).slice(0, 12),
      hot: getPodcastPayload(hotResponse).map(mapPodcastCard),
      categories,
      activeCategory: firstCategory ?? null,
      categoryRadios: firstCategory?.radios ?? [],
      today: getProgramPayload(todayResponse).slice(0, 8).map(mapPodcastProgramTrack),
      programToplist: getProgramPayload(programTopResponse).slice(0, 8).map(mapPodcastProgramTrack),
      paid: getPodcastPayload(payResponse).slice(0, 8).map(mapPodcastCard),
      recent: getProgramPayload(recentResponse).slice(0, 8).map(mapPodcastProgramTrack),
      subscribed: getPodcastPayload(sublistResponse).slice(0, 12).map(mapPodcastCard),
      satiTags: getSatiTagPayload(satiTagsResponse).slice(0, 10).map(mapSatiTag),
      satiResources: getSatiResourcePayload(satiResourcesResponse).slice(0, 24).map(mapSatiResourceTrack),
      difm: mapDifmGroups(difmResponse),
      broadcastMeta: mapBroadcastMeta(broadcastMetaResponse),
      broadcastChannels: getBroadcastChannelPayload(broadcastListResponse).slice(0, 18).map(mapBroadcastChannel)
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
  const response = await getDjRadioHot({
    cateId,
    limit,
    offset
  })
  const podcasts = getPodcastPayload(response).map(mapPodcastCard)
  const total = response.count ?? response.total ?? podcasts.length

  return {
    items: podcasts,
    total,
    more: Boolean(response.hasMore || response.more || (total && offset + podcasts.length < total))
  }
}

export async function getPodcastRankData({ type = 'hot', limit = 18, offset = 0 } = {}) {
  const loaders = {
    hot: () => getDjToplist({ type: 'hot', limit, offset }),
    new: () => getDjToplist({ type: 'new', limit, offset }),
    pay: () => getDjToplistPay({ limit }),
    hour: () => getDjToplistHours({ limit }),
    newcomer: () => getDjToplistNewcomer({ limit }),
    popular: () => getDjToplistPopular({ limit })
  }
  const response = await (loaders[type] ?? loaders.hot)()
  const podcasts = getPodcastPayload(response).map(mapPodcastCard)

  return {
    items: podcasts,
    total: response.count ?? response.total ?? podcasts.length,
    more: Boolean(response.hasMore || response.more)
  }
}

export async function getPodcastDetailData({ id, limit = 40, offset = 0 } = {}) {
  const [detailResponse, programResponse] = await Promise.all([
    getDjDetail({ rid: id }),
    getDjPrograms({ rid: id, limit, offset })
  ])
  const rawPodcast = detailResponse.data ?? detailResponse.djRadio ?? detailResponse.radio

  if (!rawPodcast) {
    throw new Error('Podcast detail is empty')
  }

  const programs = getProgramPayload(programResponse).map(mapPodcastProgramTrack)
  const total = programResponse.count ?? programResponse.total ?? rawPodcast.programCount ?? programs.length

  return {
    podcast: mapPodcastDetail(rawPodcast),
    programs,
    total,
    more: Boolean(programResponse.more || programResponse.hasMore || (total && offset + programs.length < total))
  }
}

export async function getPodcastProgramsData({ id, limit = 40, offset = 0 } = {}) {
  const response = await getDjPrograms({ rid: id, limit, offset })
  const programs = getProgramPayload(response).map(mapPodcastProgramTrack)
  const total = response.count ?? response.total ?? programs.length

  return {
    programs,
    total,
    more: Boolean(response.more || response.hasMore || (total && offset + programs.length < total))
  }
}

export async function getPodcastProgramDetailData(id) {
  const response = await getDjProgramDetail({ id })
  const program = response.program ?? response.data ?? response

  return mapPodcastProgramTrack(program)
}

export async function getPodcastProgramCommentsData({ id, limit = 20, offset = 0 } = {}) {
  const response = await getDjComments({ id, limit, offset })

  return {
    hotComments: (response.hotComments ?? []).map(mapComment),
    comments: (response.comments ?? []).map(mapComment),
    total: response.total ?? 0,
    more: Boolean(response.more),
    isFirstPage: offset <= 0
  }
}

export async function togglePodcastSubscribeData({ id, subscribe }) {
  return updateDjSubscribe({
    rid: id,
    t: subscribe ? 1 : 0,
    timestamp: Date.now()
  })
}

export async function getPodcastCategoryRecommendationsData(type) {
  const response = await getDjRecommendType({ type })

  return getPodcastPayload(response).map(mapPodcastCard)
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
    getPersonalizedMvs().catch(() => ({})),
    getFirstMvs({ area, limit: 12 }).catch(() => ({})),
    getExclusiveMvs({ limit: 12, offset: 0 }).catch(() => ({})),
    getTopMvs({ area: area === '全部' ? undefined : area, limit: 10, offset: 0 }).catch(() => ({})),
    getAllMvs({ area, type, order, limit, offset }).catch(() => ({})),
    getSubscribedMvs().catch(() => ({})),
    getFollowArtistNewMvs({ limit: 10 }).catch(() => ({}))
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
  const response = await getAllMvs({ area, type, order, limit, offset })
  const items = getMvListPayload(response).map(mapVideoMv)

  return {
    items,
    total: response.count ?? response.total ?? items.length,
    more: Boolean(response.hasMore || response.more)
  }
}

export async function getMvPlaybackData(id, quality = 1080) {
  const [detailResponse, infoResponse, urlResponse, simiResponse, commentResponse, ugcResponse] = await Promise.all([
    getMvDetail({ mvid: id }).catch(() => ({})),
    getMvDetailInfo({ mvid: id }).catch(() => ({})),
    getMvUrl({ id, r: quality || 1080 }).catch(() => ({})),
    getSimilarMvs({ mvid: id }).catch(() => ({})),
    getMvComments({ id, limit: 12, offset: 0 }).catch(() => ({})),
    getUgcMv({ id }).catch(() => ({}))
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
    ? await getArtistMvs({ id: artistId, limit: 8 }).catch(() => ({}))
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

export async function getMvCommentsData({ id, limit = 20, offset = 0 }) {
  const response = await getMvComments({ id, limit, offset })

  return mapMvCommentResult(response)
}

export async function toggleMvSubscribeData({ id, subscribe }) {
  return subscribeMv({
    mvid: id,
    t: subscribe ? 1 : 0,
    timestamp: Date.now()
  })
}

export async function toggleMvLikeData({ id, like }) {
  return likeResource({
    id,
    type: 1,
    t: like ? 1 : 0,
    timestamp: Date.now()
  })
}

export async function getPlaylistDetailData(id) {
  return getCachedData(cacheKey('playlist-detail', { id }), CACHE_TTL.playlistDetail, async () => {
    const detailResponse = await getPlaylistDetail({ id })
    const rawPlaylist = detailResponse.playlist

    if (!rawPlaylist) {
      throw new Error('Playlist detail is empty')
    }

    let tracks = rawPlaylist.tracks ?? []

    try {
      const trackResponse = await getPlaylistTracks({
        id,
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

export async function getPlaylistOverviewData(id, { trackLimit = 60 } = {}) {
  return getCachedData(
    cacheKey('playlist-overview', { id, trackLimit }),
    CACHE_TTL.playlistDetail,
    async () => {
      const detailResponse = await getPlaylistDetail({ id })
      const rawPlaylist = detailResponse.playlist

      if (!rawPlaylist) {
        throw new Error('Playlist detail is empty')
      }

      const tracks = Array.isArray(rawPlaylist.tracks)
        ? rawPlaylist.tracks.slice(0, trackLimit)
        : []

      return {
        playlist: mapPlaylistDetail(rawPlaylist),
        tracks: tracks.map(mapPlaylistTrack)
      }
    }
  )
}

export async function getPlaylistTracksData({ id, limit = 100, offset = 0 }) {
  return getCachedData(
    cacheKey('playlist-tracks', { id, limit, offset }),
    CACHE_TTL.playlistDetail,
    async () => {
      const response = await getPlaylistTracks({ id, limit, offset })
      const songs = Array.isArray(response.songs) ? response.songs : []

      return {
        tracks: songs.map((song, index) => mapPlaylistTrack(song, offset + index)),
        more: songs.length >= limit
      }
    }
  )
}

export async function getUserPlaylistLibraryData(uid, { limit = 100, offset = 0 } = {}) {
  const userId = String(uid ?? '')

  if (!userId) {
    return {
      createdPlaylists: [],
      collectedPlaylists: []
    }
  }

  const [createdResponse, collectedResponse] = await Promise.all([
    getUserCreatedPlaylists({ uid: userId, limit, offset, timestamp: Date.now() }).catch(() => ({})),
    getUserCollectedPlaylists({ uid: userId, limit, offset, timestamp: Date.now() }).catch(() => ({}))
  ])

  return {
    createdPlaylists: mapUserPlaylists(createdResponse.playlist ?? createdResponse.playlists),
    collectedPlaylists: mapUserPlaylists(collectedResponse.playlist ?? collectedResponse.playlists)
  }
}

export async function getDownloadedSongsData({ limit = 50, offset = 0 } = {}) {
  const response = await getSongDownloadList({ limit, offset, timestamp: Date.now() })
  const songs = response.data?.list ?? response.list ?? response.songs ?? []

  return Array.isArray(songs)
    ? songs.map((item, index) => mapPlaylistTrack(item.song ?? item, offset + index))
    : []
}

export async function getTrackLyricData(id) {
  return getCachedData(cacheKey('track-lyric', { id }), CACHE_TTL.lyrics, async () => {
  const response = await getLyric({ id })
  const lines = parseLyricLines(response.lrc?.lyric, response.tlyric?.lyric)

  return lines.length
    ? lines
    : [{ time: '--:--', text: '暂无歌词', seconds: 0, placeholder: true }]
  })
}

export async function getSongInteractionStatsData(id) {
  const trackId = String(id ?? '')

  if (!trackId) {
    return {
      likedCount: 0,
      likedCountLabel: '',
      commentCount: 0,
      commentCountLabel: ''
    }
  }

  const [redResponse, commentResponse] = await Promise.all([
    getSongRedCount({ id: trackId }).catch(() => ({})),
    getCommentInfoList({ type: 0, ids: trackId }).catch(() => ({}))
  ])
  const redData = redResponse.data ?? {}
  const commentInfo = Array.isArray(commentResponse.data)
    ? commentResponse.data.find((item) => String(item.resourceId) === trackId) ?? commentResponse.data[0] ?? {}
    : {}

  return {
    likedCount: toFiniteCount(redData.count),
    likedCountLabel: redData.countDesc || '',
    commentCount: toFiniteCount(commentInfo.commentCount),
    commentCountLabel: commentInfo.commentCountDesc || ''
  }
}

export async function getSearchBootData() {
  return getCachedData('search-boot', CACHE_TTL.searchBoot, async () => {
  const [defaultResponse, hotResponse] = await Promise.all([
    getSearchDefault().catch(() => ({})),
    getSearchHotDetail().catch(() => ({}))
  ])

  return {
    defaultKeyword: defaultResponse.data?.realkeyword || defaultResponse.data?.showKeyword || '',
    hotKeywords: (hotResponse.data ?? []).map(mapHotKeyword)
  }
  })
}

export async function getSearchSuggestData(keyword) {
  const query = String(keyword ?? '').trim()

  if (!query) {
    return {
      keywordSuggestions: [],
      matches: [],
      songs: [],
      artists: [],
      albums: [],
      playlists: []
    }
  }

  const [suggestResponse, matchResponse] = await Promise.all([
    getSearchSuggestPc({ keyword: query }).catch(() => ({})),
    getSearchMultiMatch({ keywords: query }).catch(() => ({}))
  ])
  const legacyResult = suggestResponse.result ?? {}
  const enhancedResult = suggestResponse.data ?? {}

  return {
    keywordSuggestions: (enhancedResult.suggests ?? []).slice(0, 10).map(mapKeywordSuggestion),
    matches: mapMultiMatches(matchResponse.result),
    songs: (legacyResult.songs ?? []).slice(0, 6).map(mapSearchSong),
    artists: (legacyResult.artists ?? []).slice(0, 4).map(mapSearchArtist),
    albums: (legacyResult.albums ?? []).slice(0, 4).map(mapSearchAlbum),
    playlists: (legacyResult.playlists ?? []).slice(0, 4).map(mapSearchPlaylist)
  }
}

export async function getSearchResultData({ keyword, type = 1, limit = 20, offset = 0 }) {
  const query = String(keyword ?? '').trim()

  if (!query) {
    return {
      items: [],
      total: 0,
      hasMore: false
    }
  }

  const response = await getCloudSearch({
    keywords: query,
    type,
    limit,
    offset
  })
  const result = response.result ?? {}

  return {
    items: mapSearchItemsByType(result, type),
    total: getSearchTotalByType(result, type),
    hasMore: Boolean(result.hasMore || result.more)
  }
}

export async function getPlaylistDiscoveryData(category = '全部', { limit = 50, offset = 0 } = {}) {
  const cat = category || '全部'
  return getCachedData(
    cacheKey('playlist-discovery', { cat, limit, offset }),
    CACHE_TTL.discovery,
    async () => {
  const [categoryMeta, playlistResponse] = await Promise.all([
    getPlaylistCategoryMeta(),
    getTopPlaylists({ cat, order: 'hot', limit, offset }).catch(() => ({}))
  ])
  const playlists = playlistResponse.playlists ?? []
  const total = playlistResponse.total ?? 0

  return {
    ...categoryMeta,
    playlists: playlists.map((playlist, index) => mapPlaylist(playlist, offset + index)),
    total,
    more: Boolean(playlistResponse.more || (total && offset + playlists.length < total)),
    activeCategory: playlistResponse.cat || cat
  }
    }
  )
}

function getPlaylistCategoryMeta() {
  if (!playlistCategoryMetaPromise) {
    playlistCategoryMetaPromise = Promise.all([
      getPlaylistHotCategories().catch(() => ({})),
      getPlaylistCategories().catch(() => ({}))
    ]).then(([hotResponse, catResponse]) => ({
      hotCategories: (hotResponse.tags ?? []).map((item) => item.name).filter(Boolean),
      categoryGroups: mapPlaylistCategoryGroups(catResponse)
    }))
  }

  return playlistCategoryMetaPromise
}

export async function getChartsDiscoveryData() {
  const toplistResponse = await getToplist()
  const toplists = (toplistResponse.list ?? []).map(mapToplist)
  const featured = toplists.slice(0, 6)
  const detailTargets = featured
  const detailResponses = await Promise.all(
    detailTargets.map((board) => getPlaylistDetail({ id: board.id }).catch(() => ({ playlist: null })))
  )
  const boards = detailTargets.map((board, index) => ({
    ...board,
    tracks: (detailResponses[index].playlist?.tracks ?? []).slice(0, 5).map(mapChartTrack)
  }))

  return {
    boards,
    officialCharts: featured,
    globalCharts: toplists.slice(6),
    chartSections: groupToplists(toplists.slice(6))
  }
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

export async function getArtistsDiscoveryData({
  area = -1,
  type = -1,
  initial = -1,
  limit = 32,
  offset = 0
} = {}) {
  const [artistResponse, toplistResponse] = await Promise.all([
    getArtistList({ area, type, initial, limit, offset }).catch(() => ({})),
    getArtistToplistCached().catch(() => ({}))
  ])

  return {
    artists: (artistResponse.artists ?? []).map((artist, index) => mapArtist(artist, offset + index)),
    topArtists: (toplistResponse.list?.artists ?? toplistResponse.artists ?? []).slice(0, 10).map(mapRankedArtist),
    more: Boolean(artistResponse.more)
  }
}

export async function getArtistDetailData(id) {
  const [detailResponse, songsResponse, dynamicResponse] = await Promise.all([
    getArtistDetail({ id }),
    getArtistHotSongs({ id }).catch(() => ({})),
    getArtistDynamic({ id }).catch(() => ({}))
  ])
  const detail = detailResponse.data ?? {}
  const artist = detail.artist ?? songsResponse.artist

  if (!artist) {
    throw new Error('Artist detail is empty')
  }

  const hotSongs = Array.isArray(songsResponse.hotSongs)
    ? songsResponse.hotSongs
    : Array.isArray(songsResponse.songs)
      ? songsResponse.songs
      : []

  return {
    artist: mapArtistDetail(artist, { ...detail, dynamic: dynamicResponse }, songsResponse.artist),
    tracks: hotSongs.map(mapPlaylistTrack)
  }
}

export async function getArtistSongsData({ id, limit = 30, offset = 0, order = 'hot' } = {}) {
  const response = await getArtistSongs({
    id,
    limit,
    offset,
    order
  })
  const songs = response.songs ?? []
  const total = response.total ?? songs.length

  return {
    tracks: songs.map((song, index) => mapPlaylistTrack(song, offset + index)),
    total,
    more: Boolean(response.more || (total && offset + songs.length < total))
  }
}

export async function getArtistAlbumsData({ id, limit = 30, offset = 0 } = {}) {
  const response = await getArtistAlbums({
    id,
    limit,
    offset
  })
  const albums = response.hotAlbums ?? []

  return {
    albums: albums.map((album, index) => mapAlbumCard(album, offset + index)),
    artist: response.artist ? mapArtist(response.artist, 0) : null,
    more: Boolean(response.more),
    total: response.artist?.albumSize ?? 0
  }
}

export async function getArtistVideosData({ id, size = 24, cursor = 0, order = 0 } = {}) {
  const response = await getArtistVideos({
    id,
    size,
    cursor,
    order
  })
  const page = response.data?.page ?? {}
  const records = response.data?.records ?? []

  return {
    videos: records.map(mapArtistVideo),
    cursor: page.cursor ?? '',
    more: Boolean(page.more)
  }
}

export async function getArtistIntroData(id) {
  const response = await getArtistDesc({ id })

  return {
    briefDesc: response.briefDesc || '',
    sections: (response.introduction ?? []).map((section, index) => ({
      id: `${section.ti || 'intro'}-${index}`,
      title: section.ti || '详情',
      text: section.txt || ''
    })).filter((section) => section.text)
  }
}

function getArtistToplistCached() {
  if (!artistToplistPromise) {
    artistToplistPromise = getArtistToplist({ type: 1 }).catch((error) => {
      artistToplistPromise = null
      throw error
    })
  }

  return artistToplistPromise
}

export async function getAlbumsDiscoveryData({ area = 'ALL', limit = 36, offset = 0 } = {}) {
  const shouldLoadFeatured = offset <= 0
  const [newAlbumResponse, topResponse] = await Promise.all([
    getNewAlbums({ area, limit, offset }).catch(() => ({})),
    shouldLoadFeatured
      ? getTopAlbums({ area, type: 'hot', limit: 16, offset: 0 }).catch(() => ({}))
      : Promise.resolve({})
  ])
  const albums = newAlbumResponse.albums ?? []
  const total = newAlbumResponse.total ?? albums.length

  return {
    albums: albums.map((album, index) => mapAlbumCard(album, offset + index)),
    topAlbums: getTopAlbumList(topResponse).map(mapAlbumCard).slice(0, 10),
    total,
    more: Boolean(
      newAlbumResponse.more ||
      newAlbumResponse.hasMore ||
      (total && offset + albums.length < total)
    )
  }
}

export async function getAlbumDetailData(id) {
  const [response, dynamicResponse] = await Promise.all([
    getAlbumDetail({ id }),
    getAlbumDynamic({ id }).catch(() => ({}))
  ])
  const album = response.album

  if (!album) {
    throw new Error('Album detail is empty')
  }

  const songs = Array.isArray(response.songs) && response.songs.length
    ? response.songs
    : album.songs ?? []

  return {
    album: mapAlbumDetail(album, dynamicResponse),
    tracks: songs.map(mapPlaylistTrack)
  }
}

export async function getAlbumCommentsData({ id, limit = 20, offset = 0 }) {
  const response = await getAlbumComments({ id, limit, offset })
  const result = response ?? {}

  return {
    hotComments: (result.hotComments ?? []).map(mapComment),
    comments: (result.comments ?? []).map(mapComment),
    total: result.total ?? 0,
    more: Boolean(result.more),
    isFirstPage: offset <= 0
  }
}

export async function getPlaylistCommentsData({ id, limit = 20, offset = 0 }) {
  const response = await getPlaylistComments({ id, limit, offset })
  const result = response ?? {}

  return {
    hotComments: (result.hotComments ?? []).map(mapComment),
    comments: (result.comments ?? []).map(mapComment),
    total: result.total ?? 0,
    more: Boolean(result.more),
    isFirstPage: offset <= 0
  }
}

export async function getSongCommentsData({ id, limit = 20, offset = 0 }) {
  return getCachedData(
    cacheKey('song-comments', { id, limit, offset }),
    CACHE_TTL.comments,
    async () => {
  const response = await getSongComments({ id, limit, offset })
  const result = response ?? {}

  return {
    hotComments: (result.hotComments ?? []).map(mapComment),
    comments: (result.comments ?? []).map(mapComment),
    total: result.total ?? 0,
    more: Boolean(result.more),
    isFirstPage: offset <= 0
  }
    }
  )
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
    title: banner.typeTitle || '播客精选',
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
  const source = raw.baseInfo ?? raw.radio ?? raw.djRadio ?? raw
  const extInfo = raw.extInfo ?? {}
  const title = cleanPodcastTitle(
    source.name ?? raw.uiElement?.mainTitle?.title ?? raw.name ?? raw.title ?? '未命名播客'
  )
  const id = source.id ?? source.radioId ?? source.rid ?? raw.resourceId ?? raw.id
  const coverUrl =
    source.picUrl ??
    source.intervenePicUrl ??
    raw.uiElement?.image?.imageUrl ??
    raw.picUrl ??
    raw.coverUrl
  const playCount = source.playCount || raw.playCount || parseCountText(extInfo.playCount)
  const subCount = source.subCount ?? raw.subCount ?? 0
  const programCount = source.programCount ?? source.programCnt ?? raw.programCount ?? 0
  const category = source.secondCategory || source.category || extInfo.officialTags?.[0] || raw.categoryName || ''

  return {
    id,
    title,
    name: title,
    description: source.rcmdText || source.rcmdtext || source.desc || raw.desc || source.lastProgramName || '',
    creator: source.dj?.nickname || raw.dj?.nickname || source.creatorName || raw.creatorName || '',
    creatorAvatarUrl: source.dj?.avatarUrl || raw.dj?.avatarUrl || '',
    category,
    primaryCategory: source.category || raw.categoryName || '',
    subCategory: source.secondCategory || '',
    coverUrl: resizeNeteaseImage(coverUrl, 520),
    programCount,
    subCount,
    playCount,
    playCountLabel: extInfo.playCount || formatPlayCount(playCount),
    subCountLabel: formatPlayCount(subCount),
    programCountLabel: programCount ? `${programCount} 期` : '',
    lastProgramName: source.lastProgramName || source.lastUpdateProgramName || '',
    score: extInfo.scoreDto?.score || extInfo.rightLabelText || '',
    tag: extInfo.labels?.[0]?.text || category,
    subed: Boolean(source.subed),
    type: coverType(index || Number(id) || 0),
    to: id ? `/podcast/${id}` : ''
  }
}

function mapPodcastDetail(raw = {}) {
  const card = mapPodcastCard(raw, Number(raw.id) || 0)

  return {
    ...card,
    description: raw.desc || card.description || '这个播客暂时没有简介。',
    shareCount: toFiniteCount(raw.shareCount),
    likedCount: toFiniteCount(raw.likedCount),
    commentCount: toFiniteCount(raw.commentCount),
    createdAt: formatPlainDate(raw.createTime),
    lastUpdated: formatPlainDate(raw.lastProgramCreateTime),
    comments: (raw.commentDatas ?? []).map((comment) => ({
      id: comment.commentId,
      content: comment.content,
      programName: comment.programName,
      user: {
        name: comment.userProfile?.nickname || '听友',
        avatarUrl: comment.userProfile?.avatarUrl || ''
      }
    }))
  }
}

function mapPodcastProgramTrack(program = {}, index = 0) {
  const song = program.mainSong ?? program.song ?? program.track ?? program
  const radio = program.radio ?? program.djRadio ?? {}
  const artists = song.artists ?? song.ar ?? []
  const coverUrl =
    program.coverUrl ??
    program.blurCoverUrl ??
    radio.picUrl ??
    radio.intervenePicUrl ??
    song.album?.picUrl ??
    song.al?.picUrl
  const id = song.id ?? program.mainTrackId ?? program.trackId ?? program.id
  const programId = program.id ?? program.programId ?? program.djProgramId ?? ''
  const duration = song.duration ?? song.dt ?? program.duration ?? 0
  const artist = program.dj?.brand || program.dj?.nickname || getArtistNames(artists) || radio.name || '播客节目'

  return {
    id,
    programId,
    voiceId: programId,
    name: program.name || song.name || '未命名声音',
    artist,
    album: radio.name || program.categoryName || program.radioName || '播客',
    rank: String(index + 1).padStart(2, '0'),
    type: coverType(index || Number(programId) || Number(id) || 0),
    time: formatDuration(duration),
    duration: formatDuration(duration),
    coverUrl: resizeNeteaseImage(coverUrl, 360),
    publishTime: formatPlainDate(program.scheduledPublishTime ?? program.createTime ?? song.publishTime),
    description: program.description || program.programDesc || '',
    source: '播客',
    category: radio.secondCategory || radio.category || program.categoryName || '',
    likedCount: toFiniteCount(program.likedCount),
    likedCountLabel: formatPlayCount(program.likedCount || 0),
    commentCount: toFiniteCount(program.commentCount),
    commentCountLabel: formatPlayCount(program.commentCount || 0),
    listenerCount: toFiniteCount(program.listenerCount),
    listenerCountLabel: formatPlayCount(program.listenerCount || 0),
    vip: Boolean(song.fee && song.fee !== 0),
    hasVideo: Boolean(song.mv),
    mvId: song.mv || '',
    podcastId: radio.id || program.radioId || '',
    podcastTitle: radio.name || ''
  }
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

function mapBanner(banner, index) {
  const targetType = Number(banner.targetType)
  const targetId = banner.targetId ?? ''
  const target = targetType === 1 && banner.song ? mapBannerSong(banner.song, index) : null

  return {
    id: `${targetType || 'banner'}-${targetId || index}`,
    targetType,
    targetId,
    targetKind: getBannerTargetKind(targetType),
    target,
    tag: banner.typeTitle || '推荐',
    title: target?.name || banner.typeTitle || '网易云音乐推荐',
    desc: getBannerDescription(banner, target, targetType),
    action: getBannerAction(targetType),
    link: getBannerLink(targetType, targetId),
    externalUrl: banner.url?.startsWith('http') ? banner.url : '',
    tone: coverType(index),
    imageUrl: banner.imageUrl ?? banner.bigImageUrl
  }
}

function mapBannerSong(song, index) {
  const album = song.al ?? song.album ?? {}
  const artists = song.ar ?? song.artists ?? []
  const artistIds = getArtistIds(artists)

  return {
    id: song.id,
    name: song.name,
    artistId: artistIds[0] ?? '',
    artistIds,
    artist: artists.map((artist) => artist.name).filter(Boolean).join(' / ') || '未知歌手',
    albumId: album.id ?? '',
    album: album.name || '未知专辑',
    rank: String(index + 1).padStart(2, '0'),
    type: coverType(index),
    time: formatDuration(song.dt ?? song.duration),
    duration: formatDuration(song.dt ?? song.duration),
    coverUrl: album.picUrl ?? album.blurPicUrl,
    vip: Boolean(song.fee && song.fee !== 0),
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

function getBannerDescription(banner, target, targetType) {
  if (target?.artist) {
    return target.artist
  }

  if (targetType === 1000) {
    return '点击进入歌单详情'
  }

  if (banner.url?.startsWith('http')) {
    return '点击查看活动详情'
  }

  return '来自网易云音乐的精选内容'
}

function getBannerAction(targetType) {
  const actions = {
    1: '立即播放',
    10: '查看专辑',
    100: '查看歌手',
    1000: '查看歌单',
    1004: '观看 MV'
  }

  return actions[targetType] ?? '立即查看'
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

function mapPlaylist(playlist, index) {
  return {
    id: playlist.id,
    title: playlist.name,
    desc: playlist.copywriter || playlist.description || '',
    listeners: formatPlayCount(playlist.playCount),
    type: coverType(index),
    coverUrl: playlist.picUrl ?? playlist.coverImgUrl,
    trackCount: playlist.trackCount ?? 0,
    creator: playlist.creator?.nickname || '',
    subscribedCount: playlist.subscribedCount ?? 0
  }
}

function mapPlaylistCategoryGroups(response = {}) {
  const categories = response.categories ?? {}
  const sub = response.sub ?? []

  return Object.entries(categories).map(([key, name]) => ({
    id: key,
    name,
    tags: sub.filter((item) => String(item.category) === String(key)).map((item) => item.name)
  }))
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
    tracks: (item.tracks ?? []).map((track, trackIndex) => ({
      rank: String(trackIndex + 1).padStart(2, '0'),
      name: track.first,
      artist: track.second,
      change: trackIndex === 0 ? 'HOT' : ''
    }))
  }
}

function mapChartTrack(song, index) {
  const artists = song.ar ?? song.artists ?? []

  return {
    id: song.id,
    rank: String(index + 1).padStart(2, '0'),
    name: song.name,
    artist: artists.map((artist) => artist.name).filter(Boolean).join(' / ') || '未知歌手',
    change: index === 0 ? 'HOT' : index < 3 ? 'UP' : ''
  }
}

function mapArtist(artist, index) {
  const details = [
    artist.alias?.length ? artist.alias.join(' / ') : '',
    artist.musicSize ? `${artist.musicSize} 首歌` : '',
    artist.albumSize ? `${artist.albumSize} 张专辑` : ''
  ].filter(Boolean)

  return {
    id: artist.id,
    name: artist.name,
    tag: details.join(' · '),
    details,
    coverUrl: resizeNeteaseImage(artist.img1v1Url ?? artist.picUrl, 240),
    followers: formatPlayCount(artist.fansCount ?? artist.followeds ?? artist.accountId ?? 0),
    score: artist.score ?? 0,
    type: coverType(index)
  }
}

function mapRankedArtist(item, index) {
  const artist = item.artist ?? item

  return {
    ...mapArtist(artist, index),
    rank: String(index + 1).padStart(2, '0'),
    score: item.score ?? artist.score ?? 0,
    trend: item.lastRank ? `${item.lastRank}` : index < 3 ? 'HOT' : ''
  }
}

function mapArtistDetail(artist, detail = {}, fallbackArtist = {}) {
  const dynamic = detail.dynamic ?? {}
  const dynamicVideoCount = getArtistDynamicVideoCount(dynamic.videoNum)
  const aliases = artist.alias ?? fallbackArtist.alias ?? []
  const identities = [
    ...(artist.identities ?? []),
    ...(detail.secondaryExpertIdentiy ?? [])
      .slice(0, 4)
      .map((item) => item.expertIdentiyName)
  ].filter(Boolean)
  const description = artist.briefDesc || fallbackArtist.briefDesc || '这位歌手暂时没有简介。'
  const rank = artist.rank?.rank ?? detail.rank?.rank ?? 0

  return {
    id: artist.id ?? fallbackArtist.id,
    name: artist.name ?? fallbackArtist.name ?? '歌手详情',
    aliases,
    identity: artist.identifyTag || detail.identify?.imageDesc || identities.join(' / '),
    identities: [...new Set(identities)].slice(0, 6),
    description,
    coverUrl: resizeNeteaseImage(artist.cover ?? artist.picUrl ?? fallbackArtist.picUrl, 520),
    avatarUrl: resizeNeteaseImage(artist.avatar ?? artist.img1v1Url ?? fallbackArtist.img1v1Url, 300),
    albumSize: artist.albumSize ?? fallbackArtist.albumSize ?? 0,
    musicSize: artist.musicSize ?? fallbackArtist.musicSize ?? 0,
    mvSize: artist.mvSize ?? fallbackArtist.mvSize ?? dynamicVideoCount ?? detail.videoCount ?? 0,
    videoCount: dynamicVideoCount ?? detail.videoCount ?? artist.mvSize ?? fallbackArtist.mvSize ?? 0,
    rank,
    followed: Boolean(dynamic.followed ?? artist.followed ?? fallbackArtist.followed),
    type: coverType(Number(artist.id ?? fallbackArtist.id) || 0)
  }
}

function getArtistDynamicVideoCount(videoNum = []) {
  const totalItem = videoNum.find((item) => Number(item.cat) === 0)
  const mvItem = videoNum.find((item) => Number(item.cat) === 1)
  const value = totalItem?.num ?? mvItem?.num

  return Number.isFinite(Number(value)) ? Number(value) : undefined
}

function getTopAlbumList(response = {}) {
  const candidates = [
    ...(response.albums ?? []),
    ...(response.weekData ?? []),
    ...(response.monthData ?? [])
  ]
  const seenIds = new Set()

  return candidates.filter((album) => {
    if (!album?.id || seenIds.has(album.id)) {
      return false
    }

    seenIds.add(album.id)
    return true
  })
}

function mapAlbumCard(album, index = 0) {
  const artist = getAlbumArtist(album)
  const songCount = album.size ?? album.songCount ?? 0
  const typeName = album.type || album.subType || '专辑'
  const publishTime = formatAlbumDate(album.publishTime)

  return {
    id: album.id,
    title: album.name,
    artist,
    artistId: album.artist?.id ?? album.artists?.[0]?.id ?? '',
    desc: [artist, publishTime, songCount ? `${songCount} 首歌` : '', typeName].filter(Boolean).join(' · '),
    listeners: album.playCount ? `${formatPlayCount(album.playCount)} 播放` : songCount ? `${songCount} 首歌` : typeName,
    type: coverType(index),
    typeName,
    coverUrl: resizeNeteaseImage(album.picUrl ?? album.blurPicUrl, 360),
    publishTime,
    company: album.company || '',
    songCount
  }
}

function getAlbumArtist(album = {}) {
  return getArtistNames(album.artists) || album.artist?.name || '未知歌手'
}

function getArtistNames(artists = []) {
  return artists.map((artist) => artist.name).filter(Boolean).join(' / ')
}

function getArtistIds(artists = []) {
  return artists
    .map((artist) => artist.id)
    .filter((id) => id !== undefined && id !== null && id !== '')
}

function mapAlbumDetail(album, dynamic = {}) {
  const artist = getArtistNames(album.artists) || album.artist?.name || '未知歌手'

  return {
    id: album.id,
    title: album.name,
    description: album.description || album.briefDesc || `${artist} 的专辑`,
    artist,
    artistId: album.artist?.id ?? '',
    publishTime: formatDate(album.publishTime),
    company: album.company || '',
    size: album.size ?? album.songCount ?? 0,
    type: coverType(Number(album.id) || 0),
    coverUrl: album.picUrl,
    subCount: dynamic.subCount ?? album.info?.likedCount ?? 0,
    commentCount: dynamic.commentCount ?? album.info?.commentCount ?? 0,
    shareCount: dynamic.shareCount ?? album.info?.shareCount ?? 0,
    isSubscribed: Boolean(dynamic.isSub)
  }
}

function mapComment(comment) {
  const user = comment.user ?? {}

  return {
    id: comment.commentId ?? comment.time ?? `${user.userId}-${comment.time}`,
    content: comment.content,
    time: formatCommentTime(comment.time),
    likedCount: comment.likedCount ?? 0,
    user: {
      name: user.nickname || '匿名用户',
      avatarUrl: user.avatarUrl || user.avatar || ''
    }
  }
}

function mapMvCommentResult(result = {}) {
  return {
    hotComments: (result.hotComments ?? []).map(mapComment),
    comments: (result.comments ?? []).map(mapComment),
    total: result.total ?? 0,
    more: Boolean(result.more),
    isFirstPage: true
  }
}

function formatCommentTime(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function mapPlaylistDetail(playlist) {
  const creator = playlist.creator ?? {}

  return {
    id: playlist.id,
    title: playlist.name,
    description: playlist.description || playlist.copywriter || '这个歌单暂时没有简介',
    creator: creator.nickname || '网易云音乐用户',
    creatorAvatarUrl: resizeNeteaseImage(creator.avatarUrl, 80),
    updated: formatDate(playlist.updateTime),
    trackCount: playlist.trackCount ?? playlist.tracks?.length ?? 0,
    listeners: formatPlayCount(playlist.playCount),
    commentCount: playlist.commentCount ?? 0,
    tags: playlist.tags ?? [],
    type: coverType(Number(playlist.id) || 0),
    coverUrl: resizeNeteaseImage(playlist.coverImgUrl, 480)
  }
}

function mapUserPlaylists(playlists = []) {
  return Array.isArray(playlists)
    ? playlists.map((playlist) => ({
      id: playlist.id,
      title: playlist.name || '未命名歌单',
      description: playlist.description || playlist.copywriter || '',
      trackIds: [],
      remote: true,
      coverUrl: resizeNeteaseImage(playlist.coverImgUrl || playlist.picUrl, 120),
      trackCount: playlist.trackCount ?? 0,
      updatedAt: playlist.updateTime || playlist.createTime || Date.now(),
      collectedAt: playlist.subscribed ? playlist.updateTime || Date.now() : 0
    }))
    : []
}

function mapPlaylistTrack(song, index) {
  const album = song.al ?? song.album ?? {}
  const artists = song.ar ?? song.artists ?? []
  const artistIds = getArtistIds(artists)

  return {
    id: song.id,
    name: song.name,
    artistId: artistIds[0] ?? '',
    artistIds,
    artist: artists.map((artist) => artist.name).filter(Boolean).join(' / ') || '未知歌手',
    album: album.name || '未知专辑',
    rank: String(index + 1).padStart(2, '0'),
    albumId: album.id ?? '',
    type: coverType(index),
    time: formatDuration(song.dt ?? song.duration),
    coverUrl: album.picUrl,
    thumbnailUrl: resizeNeteaseImage(album.picUrl, 96),
    to: `/playlist/song-${song.id}`,
    vip: Boolean(song.fee && song.fee !== 0),
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
    vip: Boolean(song.fee && song.fee !== 0),
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

function mapHotKeyword(item, index) {
  return {
    id: item.searchWord || `hot-${index}`,
    keyword: item.searchWord || item.keyword || '',
    score: item.score ?? 0,
    content: item.content || item.iconDesc || '',
    iconUrl: item.iconUrl,
    type: item.iconType
  }
}

function mapKeywordSuggestion(item, index) {
  return {
    id: item.keyword || `suggest-${index}`,
    type: 'keyword',
    title: item.keyword || item.showText || '',
    subtitle: item.resourceName || item.tag || '相关搜索',
    iconUrl: item.iconUrl,
    highLightInfo: item.highLightInfo
  }
}

function mapMultiMatches(result = {}) {
  return [
    ...(result.orders ?? []).map((item) => ({
      id: `order-${item.keyword}`,
      type: 'keyword',
      title: item.keyword,
      subtitle: '相关搜索'
    })),
    ...(result.artist ?? []).map((item) => ({
      id: `artist-${item.id}`,
      type: 'artist',
      title: item.name,
      subtitle: item.alias?.join(' / ') || '歌手',
      coverUrl: item.picUrl ?? item.img1v1Url,
      to: `/artist/${item.id}`
    })),
    ...(result.album ?? []).map((item) => ({
      id: `album-${item.id}`,
      type: 'album',
      title: item.name,
      subtitle: item.artist?.name || '专辑',
      coverUrl: item.picUrl
    }))
  ].filter((item) => item.title)
}

function mapSearchItemsByType(result, type) {
  const maps = {
    1: () => (result.songs ?? []).map(mapSearchSong),
    10: () => (result.albums ?? []).map(mapSearchAlbum),
    100: () => (result.artists ?? []).map(mapSearchArtist),
    1000: () => (result.playlists ?? []).map(mapSearchPlaylist),
    1002: () => (result.userprofiles ?? []).map(mapSearchUser),
    1004: () => (result.mvs ?? []).map(mapSearchMv)
  }

  return (maps[type] ?? maps[1])()
}

function getSearchTotalByType(result, type) {
  const totalKeys = {
    1: 'songCount',
    10: 'albumCount',
    100: 'artistCount',
    1000: 'playlistCount',
    1002: 'userprofileCount',
    1004: 'mvCount'
  }

  return result[totalKeys[type]] ?? 0
}

function mapSearchSong(song, index = 0) {
  const album = song.al ?? song.album ?? {}
  const artists = song.ar ?? song.artists ?? []
  const artistIds = getArtistIds(artists)

  return {
    id: song.id,
    type: 'song',
    name: song.name,
    title: song.name,
    artistId: artistIds[0] ?? '',
    artistIds,
    artist: artists.map((artist) => artist.name).filter(Boolean).join(' / ') || '未知歌手',
    albumId: album.id ?? '',
    album: album.name || '未知专辑',
    rank: String(index + 1).padStart(2, '0'),
    time: formatDuration(song.dt ?? song.duration),
    duration: formatDuration(song.dt ?? song.duration),
    coverUrl: album.picUrl,
    to: `/playlist/song-${song.id}`,
    vip: Boolean(song.fee && song.fee !== 0),
    hasVideo: Boolean(song.mv),
    mvId: song.mv || ''
  }
}

function mapSearchArtist(artist) {
  return {
    id: artist.id,
    type: 'artist',
    title: artist.name,
    name: artist.name,
    subtitle: [
      artist.alias?.length ? artist.alias.join(' / ') : '',
      artist.musicSize ? `${artist.musicSize} 首歌` : '',
      artist.albumSize ? `${artist.albumSize} 张专辑` : ''
    ].filter(Boolean).join(' · '),
    coverUrl: artist.picUrl ?? artist.img1v1Url,
    to: `/artist/${artist.id}`
  }
}

function mapSearchAlbum(album) {
  return {
    id: album.id,
    type: 'album',
    title: album.name,
    name: album.name,
    subtitle: [
      album.artist?.name,
      album.size ? `${album.size} 首歌` : '',
      formatDate(album.publishTime)
    ].filter(Boolean).join(' · '),
    coverUrl: album.picUrl
  }
}

function mapSearchPlaylist(playlist) {
  return {
    id: playlist.id,
    type: 'playlist',
    title: playlist.name,
    name: playlist.name,
    subtitle: [
      playlist.creator?.nickname,
      playlist.trackCount ? `${playlist.trackCount} 首歌` : '',
      playlist.playCount ? `${formatPlayCount(playlist.playCount)}播放` : ''
    ].filter(Boolean).join(' · '),
    coverUrl: playlist.coverImgUrl,
    to: `/playlist/${playlist.id}`
  }
}

function mapSearchUser(user) {
  return {
    id: user.userId,
    type: 'user',
    title: user.nickname,
    name: user.nickname,
    subtitle: user.signature || `${formatPlayCount(user.followeds)} 粉丝`,
    coverUrl: user.avatarUrl
  }
}

function mapSearchMv(mv) {
  return {
    id: mv.id,
    type: 'mv',
    title: mv.name,
    name: mv.name,
    subtitle: [
      mv.artistName ?? mv.artists?.map((artist) => artist.name).join(' / '),
      mv.playCount ? `${formatPlayCount(mv.playCount)}播放` : '',
      formatDuration(mv.duration)
    ].filter(Boolean).join(' · '),
    coverUrl: mv.cover ?? mv.imgurl ?? mv.picUrl
  }
}

function mapNewsong(item, index) {
  const song = item.song ?? item
  const album = song.album ?? song.al ?? {}
  const artists = song.artists ?? song.ar ?? []
  const artistIds = getArtistIds(artists)

  return {
    id: song.id ?? item.id,
    name: song.name ?? item.name,
    artistId: artistIds[0] ?? '',
    artistIds,
    artist: artists.map((artist) => artist.name).filter(Boolean).join(' / ') || '未知歌手',
    albumId: album.id ?? '',
    album: album.name ?? '未知专辑',
    rank: String(index + 1).padStart(2, '0'),
    type: coverType(index),
    time: formatDuration(song.duration ?? song.dt),
    coverUrl: item.picUrl ?? album.picUrl,
    vip: Boolean(song.fee && song.fee !== 0),
    hasVideo: Boolean(song.mv),
    mvId: song.mv || ''
  }
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
    targets.map((mv) => getMvDetail({ mvid: mv.id }).catch(() => null))
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

function mapArtistVideo(record, index) {
  const resource = record.resource ?? {}
  const base = resource.mlogBaseData ?? record.mlogBaseData ?? {}
  const ext = resource.mlogExtVO ?? record.mlogExtVO ?? {}
  const id = base.id ?? record.id
  const artists = Array.isArray(ext.artists) ? ext.artists : []

  return {
    id,
    title: base.text || base.originalTitle || ext.song?.name || '视频',
    description: base.desc || '',
    artist: ext.artistName || getArtistNames(artists),
    coverUrl: resizeNeteaseImage(base.coverUrl, 480),
    duration: formatDuration(base.duration),
    playCount: formatPlayCount(ext.playCount ?? 0),
    likedCount: formatPlayCount(ext.likedCount ?? 0),
    publishTime: formatDate(base.pubTime),
    songName: ext.song?.name || '',
    shareUrl: resource.shareUrl || '',
    type: coverType(index),
    to: id ? { name: 'video', query: { mvId: id } } : { name: 'video' }
  }
}

function coverType(index) {
  return COVER_TYPES[index % COVER_TYPES.length]
}

function resizeNeteaseImage(url, size) {
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

function formatAlbumDate(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${date.getFullYear()}-${month}-${day}`
}

function parseLyricLines(lyric = '', translatedLyric = '') {
  const translatedLines = parseLrc(translatedLyric)
  const translatedByTime = new Map(
    translatedLines.map((line) => [line.seconds.toFixed(3), line.text])
  )

  return parseLrc(lyric).map((line) => {
    const translatedText = translatedByTime.get(line.seconds.toFixed(3))

    return {
      ...line,
      translation: translatedText && translatedText !== line.text ? translatedText : ''
    }
  })
}

function parseLrc(lyric = '') {
  return lyric
    .split(/\r?\n/)
    .flatMap((line) => {
      const timestamps = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)]
      const text = line.replace(/\[[^\]]+\]/g, '').trim()

      if (!timestamps.length || !text || isLyricMetadata(text)) {
        return []
      }

      return timestamps.map((match) => {
        const minutes = Number(match[1])
        const seconds = Number(match[2])
        const milliseconds = Number((match[3] ?? '0').padEnd(3, '0'))
        const totalSeconds = minutes * 60 + seconds + milliseconds / 1000

        return {
          time: formatLyricTime(totalSeconds),
          text,
          seconds: totalSeconds
        }
      })
    })
    .sort((current, next) => current.seconds - next.seconds)
}

function formatLyricTime(value) {
  const minutes = Math.floor(value / 60)
  const seconds = String(Math.floor(value % 60)).padStart(2, '0')

  return `${minutes}:${seconds}`
}

function isLyricMetadata(text) {
  return /^(作词|作曲|编曲|制作人|监制|录音|混音|母带|和声|发行|出品|版权)\s*[:：]/.test(text)
}
