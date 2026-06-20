import {
  getBanners,
  getAlbumComments,
  getAlbumDetail,
  getAlbumDynamic,
  getAlbumInfo,
  getAlbumSongs,
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
  checkSongLike,
  createUserPlaylist,
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
  getSimilarPlaylists,
  getSongDownloadList,
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
  getTopPlaylists,
  getTopAlbums,
  getUserPlaylists,
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
import { normalizeAudioQualities } from '../utils/audioQuality'
import { isVipSong, normalizeSongAccess } from '../utils/songAccess'

let playlistCategoryMetaPromise = null
let artistToplistPromise = null

const PLAYLIST_DEFAULT_CATEGORY = {
  id: 0,
  name: '全部'
}

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

export async function getMvCommentsData({ id, limit = 20, offset = 0 }) {
  const response = await getNeteaseMvComments({ id, limit, offset })

  return mapMvCommentResult(response)
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

export async function getDownloadedSongsData({ limit = 50, offset = 0 } = {}) {
  const response = await getSongDownloadList({ limit, offset, timestamp: Date.now() })
  const songs = response.data?.list ?? response.list ?? response.songs ?? []

  return Array.isArray(songs)
    ? songs.map((item, index) => mapPlaylistTrack(item.song ?? item, offset + index))
    : []
}

export async function getTrackLyricData(track) {
  const params = typeof track === 'object' && track !== null
    ? {
        id: track.id,
        hash: track.hash,
        album_audio_id: track.album_audio_id ?? track.mixsongid ?? track.audio_id,
        duration: getTrackLyricDuration(track),
        keywords: getTrackLyricKeywords(track)
      }
    : { id: track }

  try {
    return await getCachedData(cacheKey('track-krc-lyric', getTrackLyricCachePayload(params)), CACHE_TTL.lyrics, async () => {
      const response = await getLyric(params)
      const lines = parseLyricLines(
        response.krc?.lyric ?? response.lrc?.lyric,
        response.tlyric?.lyric
      )

      if (!lines.length) {
        const error = new Error('NO_LYRIC_LINES')
        error.noLyrics = true
        throw error
      }

      return lines
    })
  } catch (error) {
    if (!error?.noLyrics) {
      throw error
    }

    return [{ time: '--:--', text: '暂无歌词', seconds: 0, placeholder: true }]
  }
}

function getTrackLyricKeywords(track = {}) {
  return track.name || track.songname || track.title || ''
}

function getTrackLyricDuration(track = {}) {
  const value =
    track.dt ??
    track.timelength ??
    track.timelen ??
    track.rawDuration ??
    track.duration ??
    track.time

  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0
      ? value > 10000 ? Math.round(value) : Math.round(value * 1000)
      : undefined
  }

  if (typeof value === 'string') {
    const parts = value.split(':').map((part) => Number(part))

    if (parts.length >= 2 && parts.every((part) => Number.isFinite(part))) {
      return Math.round(parts.reduce((total, part) => total * 60 + part, 0) * 1000)
    }
  }

  return undefined
}

function getTrackLyricCachePayload(params = {}) {
  const hash = params.hash || ''
  const albumAudioId = params.album_audio_id || params.mixsongid || ''
  const id = hash || albumAudioId ? '' : params.id || ''

  return {
    hash,
    album_audio_id: albumAudioId,
    id,
    duration: params.duration || '',
    keywords: params.keywords || params.keyword || ''
  }
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

  const redResponse = await getSongRedCount({ id: trackId }).catch(() => ({}))
  const redData = redResponse.data ?? {}

  return {
    likedCount: 0,
    likedCountLabel: '',
    commentCount: toFiniteCount(redData.count),
    commentCountLabel: redData.countDesc || ''
  }
}

export async function getSearchBootData() {
  return getCachedData('search-boot', CACHE_TTL.searchBoot, async () => {
  const hotResponse = await getSearchHotDetail().catch(() => ({}))
  const hotKeywords = (hotResponse.data ?? []).map(mapHotKeyword)

  return {
    defaultKeyword: hotKeywords[0]?.keyword || '',
    hotKeywords
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

export async function getArtistsDiscoveryData({
  area = -1,
  type = -1,
  initial = -1,
  limit = 32,
  offset = 0
} = {}) {
  const artistListParams = getKugouArtistListParams({
    area,
    type,
    initial,
    limit,
    offset
  })
  const [artistResponse, toplistResponse] = await Promise.all([
    getArtistList(artistListParams).catch(() => ({})),
    getArtistToplistCached().catch(() => ({}))
  ])
  const artistPage = getKugouArtistPage(artistResponse, {
    initial,
    limit,
    offset
  })

  return {
    artists: artistPage.items.map((artist, index) => mapArtist(artist, offset + index)),
    topArtists: getKugouHotArtists(toplistResponse).slice(0, 10).map(mapRankedArtist),
    more: artistPage.more
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
    total: response.total ?? response.artist?.albumSize ?? albums.length
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
  const detail = response.data ?? response
  const artist = response.artist ?? detail.artist ?? {}
  const sections = Array.isArray(detail.long_intro)
    ? detail.long_intro
    : Array.isArray(artist.longIntro)
      ? artist.longIntro
      : []

  return {
    briefDesc: artist.briefDesc || detail.intro || response.briefDesc || '',
    sections: sections.map((section, index) => ({
      id: `${section.title || section.ti || 'intro'}-${index}`,
      title: section.ti || '详情',
      title: section.title || section.ti || '详情',
      text: section.content || section.txt || ''
    })).filter((section) => section.text)
  }
}

function getArtistToplistCached() {
  if (!artistToplistPromise) {
    artistToplistPromise = getArtistToplist({ type: 0, sextypes: 0, hotsize: 10 }).catch((error) => {
      artistToplistPromise = null
      throw error
    })
  }

  return artistToplistPromise
}

function getKugouArtistListParams({ area = -1, type = -1, initial = -1, limit = 32, offset = 0 } = {}) {
  const isHot = String(initial) === '-1'

  return {
    type: mapKugouArtistArea(area),
    sextypes: mapKugouArtistSex(type),
    musician: 0,
    hotsize: isHot ? offset + limit + 1 : Math.max(limit, 30)
  }
}

function mapKugouArtistArea(area) {
  const areaMap = {
    '-1': 0,
    7: 1,
    96: 2,
    8: 5,
    16: 6,
    0: 4
  }

  return areaMap[String(area)] ?? 0
}

function mapKugouArtistSex(type) {
  const sexMap = {
    '-1': 0,
    1: 1,
    2: 2,
    3: 3
  }

  return sexMap[String(type)] ?? 0
}

function getKugouArtistPage(response = {}, { initial = -1, limit = 32, offset = 0 } = {}) {
  const source = getKugouArtistGroup(response, initial)
  const items = source.slice(offset, offset + limit)

  return {
    items,
    more: source.length > offset + limit
  }
}

function getKugouHotArtists(response = {}) {
  return getKugouArtistGroup(response, -1)
}

function getKugouArtistGroup(response = {}, initial = -1) {
  const groups = Array.isArray(response.groups) ? response.groups : []
  const target = String(initial).toUpperCase()
  const group = String(initial) === '-1'
    ? groups.find((item) => item.title === '热门') || groups[0]
    : groups.find((item) => String(item.title).toUpperCase() === target)

  return group?.artists ?? response.artists ?? []
}

export async function getAlbumsDiscoveryData({ area = 'ALL', limit = 36, offset = 0 } = {}) {
  const shouldLoadFeatured = offset <= 0
  const [newAlbumResponse, topResponse] = await Promise.all([
    getNewAlbums({ type: getAlbumAreaType(area), limit, offset }).catch(() => ({})),
    shouldLoadFeatured
      ? getTopAlbums({ limit: 16, offset: 0 }).catch(() => ({}))
      : Promise.resolve({})
  ])
  const albums = newAlbumResponse.albums ?? []
  const total = newAlbumResponse.total ?? albums.length

  return {
    albums: albums.map((album, index) => mapAlbumCard(album, offset + index)),
    topAlbums: getTopAlbumList(topResponse).map(mapAlbumCard).slice(0, 10),
    total,
    more: Boolean(newAlbumResponse.more || newAlbumResponse.hasMore)
  }
}

export async function getAlbumDetailData(id) {
  const [infoResponse, response, dynamicResponse, songsResponse] = await Promise.all([
    getAlbumInfo({
      album_id: id,
      fields: 'trans_param,special_tag,authors,album_name,publish_date,cover,intro,publish_company,type,album_id,language,category,author_name,sizable_cover'
    }).catch(() => ({})),
    getAlbumDetail({ id }),
    getAlbumDynamic({ id }).catch(() => ({})),
    getAlbumSongs({ id, limit: 100, offset: 0 }).catch(() => ({}))
  ])
  const album = mergeAlbumSources(response.album, infoResponse.album)

  if (!album?.id) {
    throw new Error('Album detail is empty')
  }

  const songs = Array.isArray(response.songs) && response.songs.length
    ? response.songs
    : Array.isArray(songsResponse.songs) && songsResponse.songs.length
      ? songsResponse.songs
      : album.songs ?? []
  const normalizedAlbum = {
    ...album,
    size: album.size || songs.length
  }

  return {
    album: mapAlbumDetail(normalizedAlbum, dynamicResponse),
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
    title: target?.name || banner.typeTitle || '酷狗音乐推荐',
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
    ...getKugouTrackMeta(song),
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
    vip: isVipSong(song),
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

  return '来自酷狗音乐的精选内容'
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

function mapPlaylistCategoryMeta(hotResponse = {}, catResponse = {}) {
  const fallbackTags = getPlaylistTagItems(catResponse)
  const mappedCategoryGroups = mapPlaylistCategoryGroups(catResponse)
  const categoryGroups = mappedCategoryGroups.length
    ? mappedCategoryGroups
    : fallbackTags.length
      ? [{
          id: 'playlist-tags',
          name: '全部分类',
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

  if (!value || value === '全部' || value === '推荐') {
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
          `分类 ${groupIndex + 1}`,
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

function firstArrayValue(...values) {
  return values.find((value) => Array.isArray(value)) ?? []
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

function getAlbumAreaType(area) {
  const areaMap = {
    ZH: 1,
    EA: 2,
    JP: 3,
    KR: 4
  }

  return areaMap[String(area ?? '').toUpperCase()] || undefined
}

function mergeAlbumSources(...sources) {
  return sources
    .filter((source) => source && typeof source === 'object')
    .reduce((merged, source) => ({
      ...merged,
      ...Object.fromEntries(
        Object.entries(source).filter(([, value]) => value !== undefined && value !== null && value !== '')
      ),
      artist: mergePlainObject(merged.artist, source.artist),
      artists: source.artists?.length ? source.artists : merged.artists,
      info: mergePlainObject(merged.info, source.info)
    }), {})
}

function mergePlainObject(current, next) {
  return {
    ...(current && typeof current === 'object' ? current : {}),
    ...(next && typeof next === 'object' ? next : {})
  }
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
    description: playlist.description || playlist.copywriter || '这个歌单暂时没有简介',
    creator: creator.nickname || '酷狗音乐用户',
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

function normalizePlaylistTimestamp(value, fallback = Date.now()) {
  const number = Number(value)

  if (Number.isFinite(number) && number > 0) {
    return number < 10000000000 ? number * 1000 : number
  }

  const parsed = Date.parse(value)

  return Number.isFinite(parsed) ? parsed : fallback
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
    ...getKugouTrackMeta(song),
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
    vip: isVipSong(song),
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
    coverUrl: album.picUrl,
    to: `/album/${album.id}`
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
    coverUrl: mv.cover ?? mv.imgurl ?? mv.picUrl,
    to: mv.id ? { name: 'video', query: { mvId: mv.id } } : { name: 'video' }
  }
}

function mapNewsong(item, index) {
  const song = item.song ?? item
  const album = song.album ?? song.al ?? {}
  const artists = song.artists ?? song.ar ?? []
  const artistIds = getArtistIds(artists)

  return {
    id: song.id ?? item.id,
    ...getKugouTrackMeta(song),
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
    vip: isVipSong(song),
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

function mapHomeTopMv(item = {}, index = 0) {
  const nestedMv = item.mv ?? {}
  const duration = item.duration || getTopMvVideoDuration(nestedMv)
  const mv = {
    ...nestedMv,
    ...item,
    duration,
    artists: item.artists ?? nestedMv.artists,
    cover: item.cover ?? nestedMv.cover,
    coverUrl: item.coverUrl ?? item.cover ?? nestedMv.coverUrl,
    picUrl: item.picUrl ?? item.cover ?? nestedMv.picUrl,
    playCount: item.playCount ?? nestedMv.playCount ?? nestedMv.plays,
    publishTime: item.publishTime ?? nestedMv.publishTime,
    name: item.name ?? nestedMv.name ?? nestedMv.title,
    title: item.name ?? nestedMv.title ?? nestedMv.name
  }

  return mapVideoMv(mv, index)
}

function getTopMvVideoDuration(mv = {}) {
  const videos = Array.isArray(mv.videos) ? mv.videos : []
  const video = videos.find((item) => Number(item?.duration) > 0)

  return video?.duration ?? mv.duration ?? 0
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

function getHomeTopMvPayload(response = {}) {
  const data = response.data ?? response
  const items = Array.isArray(data) ? data : []

  return items.length ? items : getMvListPayload(response)
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

function mapArtistVideo(record, index) {
  const resource = record.resource ?? {}
  const base = resource.mlogBaseData ?? record.mlogBaseData ?? {}
  const ext = resource.mlogExtVO ?? record.mlogExtVO ?? {}
  const id = base.id ?? record.id
  const artists = Array.isArray(ext.artists) ? ext.artists : []

  return {
    id,
    title: base.text || base.originalTitle || ext.song?.name || '视频',
    title: record.name || record.title || base.text || base.originalTitle || ext.song?.name || '视频',
    description: record.desc || base.desc || '',
    artist: record.artistName || ext.artistName || getArtistNames(artists),
    coverUrl: resizeNeteaseImage(record.cover || record.coverUrl || base.coverUrl, 480),
    duration: formatDuration(record.duration ?? base.duration),
    playCount: formatPlayCount(record.playCount ?? ext.playCount ?? 0),
    likedCount: formatPlayCount(ext.likedCount ?? 0),
    publishTime: formatPlainDate(record.publishTime) || formatDate(base.pubTime),
    songName: ext.song?.name || '',
    shareUrl: resource.shareUrl || '',
    type: coverType(index),
    to: id ? { name: 'video', query: { mvId: id } } : { name: 'video' }
  }
}

function isKugouCollectionId(id) {
  return /^collection_/i.test(String(id ?? ''))
}

function canLoadRemotePlaylistDetail(id, listid = '') {
  const playlistId = String(id ?? '')

  return isKugouCollectionId(playlistId) || (!listid && /^\d+$/.test(playlistId))
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
  const lines = isKrcLyric(lyric) ? parseKrc(lyric) : parseLrc(lyric)

  return lines.map((line) => {
    const translatedText = translatedByTime.get(line.seconds.toFixed(3))

    return {
      ...line,
      translation: translatedText && translatedText !== line.text ? translatedText : ''
    }
  })
}

function isKrcLyric(lyric = '') {
  return /\[\d+\s*,\s*\d+\]/.test(lyric) && /<\d+\s*,\s*\d+\s*,\s*\d+>/.test(lyric)
}

function parseKrc(lyric = '') {
  return lyric
    .split(/\r?\n/)
    .flatMap((line) => {
      const lineMatch = line.match(/^\[(\d+)\s*,\s*(\d+)\]/)

      if (!lineMatch) {
        return []
      }

      const startMs = Number(lineMatch[1])
      const durationMs = Number(lineMatch[2])
      const payload = line.slice(lineMatch[0].length).trim()

      if (!Number.isFinite(startMs) || !payload || isLyricMetadata(payload)) {
        return []
      }

      const words = parseKrcWords(payload, startMs)
      const text = words.map((word) => word.text).join('').trim()

      if (!text || isLyricMetadata(text)) {
        return []
      }

      return {
        time: formatLyricTime(startMs / 1000),
        text,
        seconds: startMs / 1000,
        duration: Number.isFinite(durationMs) ? durationMs / 1000 : 0,
        words
      }
    })
    .sort((current, next) => current.seconds - next.seconds)
}

function parseKrcWords(payload = '', lineStartMs = 0) {
  const words = []
  const pattern = /<(\d+)\s*,\s*(\d+)\s*,\s*(\d+)>([^<]*)/g
  let match

  while ((match = pattern.exec(payload)) !== null) {
    const offsetMs = Number(match[1])
    const durationMs = Number(match[2])
    const text = match[4] ?? ''

    if (!text) {
      continue
    }

    const absoluteStartMs = lineStartMs + (Number.isFinite(offsetMs) ? offsetMs : 0)

    words.push({
      text,
      seconds: absoluteStartMs / 1000,
      duration: Number.isFinite(durationMs) ? durationMs / 1000 : 0
    })
  }

  return words
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
