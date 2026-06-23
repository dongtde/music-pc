import {
  getKugou,
  getKugouRaw,
  withStoredKugouSearchCookie,
  songRegistry,
  lyricRequestRegistry,
  pagesizeParamPaths,
  normalizeParams,
  normalizeSearchType,
  isSearchPath,
  withStoredKugouAuthParams,
  isCommentPath,
  normalizeAlbumAreaType,
  normalizePlaylistCategoryId,
  parseKugouPayload,
  attachKugouParams,
  getKnownSong,
  hashFromId,
  rememberSong,
  firstArray,
  firstObject,
  firstNonEmptyArray,
  toMilliseconds,
  normalizeKugouImage,
  splitFilename,
  mergeSongFields,
  fillMissingSongFields,
  isPresentValue,
  pickField,
  cleanKugouText,
  normalizeArtistName,
  normalizeSongName,
  normalizeSong,
  normalizePlaylist,
  normalizeTimestamp,
  normalizeRank,
  normalizeArtist,
  normalizeAlbum,
  normalizeComment,
  extractSongItems,
  toSongListResponse,
  toPlaylistListResponse,
  toBannerResponse,
  toToplistResponse,
  toPlaylistDetailResponse,
  toPlaylistTracksResponse,
  toRankTracksResponse,
  toArtistListResponse,
  toArtistDetailResponse,
  toArtistSongsResponse,
  toArtistAlbumsResponse,
  toArtistVideosResponse,
  toMvListResponse,
  toAlbumListResponse,
  getAlbumListItems,
  getTopAlbumGroupedItems,
  toAlbumDetailResponse,
  toAlbumInfoResponse,
  toCommentResponse,
  toCommentCountResponse,
  toHotSearchResponse,
  getHotSearchItems,
  toSuggestResponse,
  toSearchResponse,
  emptySearchResponse,
  isSearchGroup,
  getSearchResultTotal,
  normalizeSearchSong,
  normalizeSearchArtist,
  normalizeSearchUser,
  normalizeSearchMv,
  toSongUrlResponse,
  collectAudioUrlCandidates,
  normalizeAudioUrl,
  decodeBase64Utf8,
  createLyricSearchParams,
  createEmptyLyricResponse,
  getLyricRequestKey,
  normalizeLyricKeyword,
  getLyricCandidate
} from './shared'

export const getPersonalizedDjPrograms = (params = {}) => getKugou('/longaudio/daily/recommend', params).then(toSongListResponse)

export const getDjBanner = (params = {}) => getKugou('/yueku/banner', params).then(toBannerResponse)

export const getDjPersonalizeRecommend = (params = {}) => getKugou('/longaudio/daily/recommend', params)

export const getDjHot = (params = {}) => getKugou('/longaudio/week/recommend', params)

export const getDjProgramToplist = (params = {}) => getKugou('/longaudio/rank/recommend', params)

export const getDjProgramHoursToplist = (params = {}) => getKugou('/longaudio/rank/recommend', params)

export const getDjToplist = (params = {}) => getKugou('/longaudio/rank/recommend', params)

export const getDjToplistPay = (params = {}) => getKugou('/longaudio/vip/recommend', params)

export const getDjToplistHours = (params = {}) => getKugou('/longaudio/rank/recommend', params)

export const getDjToplistNewcomer = (params = {}) => getKugou('/longaudio/daily/recommend', params)

export const getDjToplistPopular = (params = {}) => getKugou('/longaudio/week/recommend', params)

export const getDjRadioHot = (params = {}) => getKugou('/fm/recommend', params)

export const getDjRecommend = (params = {}) => getKugou('/fm/recommend', params)

export const getDjCatelist = (params = {}) => getKugou('/fm/class', params)

export const getDjRecommendType = (params = {}) => getKugou('/fm/recommend', params)

export const getRadioLibrary = (params = {}) => getKugou('/yueku/fm', params)

export const getRadioClasses = (params = {}) => getKugou('/fm/class', params)

export const getRadioRecommend = (params = {}) => getKugou('/fm/recommend', params)

export const getRadioImages = (params = {}) => getKugou('/fm/image', params)

export const getRadioSongs = (params = {}) => getKugou('/fm/songs', params)

export const updateDjSubscribe = (params = {}) => getKugou('/youth/channel/sub', params)

export const getDjSublist = (params = {}) => getKugou('/youth/channel/all', params)

export const getDjPaygift = (params = {}) => getKugou('/longaudio/vip/recommend', params)

export const getDjCategoryExcludehot = (params = {}) => getKugou('/fm/class', params)

export const getDjCategoryRecommend = (params = {}) => getKugou('/fm/recommend', params)

export const getDjTodayPreferred = (params = {}) => getKugou('/longaudio/daily/recommend', params)

export const getDjDetail = (params = {}) => getKugou('/longaudio/album/detail', { album_id: params.rid ?? params.id, ...params })

export const getDjPrograms = (params = {}) => getKugou('/longaudio/album/audios', { album_id: params.rid ?? params.id, ...params })

export const getDjProgramDetail = (params = {}) => getKugou('/longaudio/album/detail', { album_id: params.id, ...params })

export const getDjComments = (params = {}) => getKugou('/comment/album', params).then(toCommentResponse)

export const getRecentDj = (params = {}) => getKugou('/lastest/songs/listen', params).then(toSongListResponse)

export const searchVoiceLists = (params = {}) =>
  getKugou('/search', { ...params, type: 'album' }).then((response) => toSearchResponse(response, 10))

export const searchVoiceListPrograms = (params = {}) =>
  getKugou('/search', { ...params, type: 'song' }).then((response) => toSearchResponse(response, 1))

export const getVoiceListDetail = (params = {}) => getKugou('/longaudio/album/detail', { album_id: params.id, ...params })

export const getVoiceListPrograms = (params = {}) => getKugou('/longaudio/album/audios', { album_id: params.id, ...params })

export const getVoiceDetail = (params = {}) => getKugou('/krm/audio', { album_audio_id: params.id, ...params })

export const getVoiceLyric = (params = {}) => {
  const hash = params.hash ?? hashFromId(params.id)

  return toLyricResponse({
    ...params,
    ...(hash ? { hash } : {})
  })
}

export const getMyCreatedVoiceList = (params = {}) => getKugou('/youth/channel/all', params)

export const getBroadcastCategoryRegion = (params = {}) => getKugou('/fm/class', params)

export const getBroadcastCollectList = (params = {}) => getKugou('/youth/channel/all', params)

export const getBroadcastCurrentInfo = (params = {}) => getKugou('/youth/channel/detail', params)

export const getBroadcastChannelList = (params = {}) => getKugou('/fm/recommend', params)

export const updateBroadcastSubscribe = (params = {}) => getKugou('/youth/channel/sub', params)

export const getDifmStyleChannels = (params = {}) => getKugou('/scene/lists', params)

export const getDifmSubscribedChannels = (params = {}) => getKugou('/youth/channel/all', params)

export const subscribeDifmChannel = (params = {}) => getKugou('/youth/channel/sub', { ...params, t: 1 })

export const unsubscribeDifmChannel = (params = {}) => getKugou('/youth/channel/sub', { ...params, t: 0 })

export const getDifmPlayingTracks = (params = {}) => getKugou('/fm/songs', params).then(toSongListResponse)

export const getSatiTimeSceneResources = (params = {}) => getKugou('/scene/lists', params)

export const getSatiTags = (params = {}) => getKugou('/scene/module/info', params)

export const getSatiResources = (params = {}) => getKugou('/scene/audio/list', params)

export const getSatiMoreResources = (params = {}) => getKugou('/scene/module', params)

export const getSatiSubscribedResources = (params = {}) => getKugou('/youth/channel/all', params)

export const updateSatiSubscribe = (params = {}) => getKugou('/youth/channel/sub', params)

export const getSportRadio = (params = {}) => getKugou('/fm/recommend', params)

// User library
