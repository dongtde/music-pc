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

export const subscribeMv = (params = {}) => getKugou('/youth/channel/sub', params)

export const getSubscribedMvs = (params = {}) => getKugou('/user/video/collect', params)

export const getMvComments = (params = {}) => getKugou('/comment/music', params).then(toCommentResponse)

export const likeResource = (params = {}) => getKugou('/youth/channel/sub', params)

export const getSimilarMvs = (params = {}) => getKugou('/ai/recommend', params).then(toSongListResponse)

export const getAllMvs = (params = {}) => getKugou('/brush', params).then(toMvListResponse)

export const getFirstMvs = (params = {}) => getKugou('/brush', params).then(toMvListResponse)

export const getExclusiveMvs = (params = {}) => getKugou('/brush', params).then(toMvListResponse)

export const getTopMvs = (params = {}) => getKugou('/brush', params).then(toMvListResponse)

export const getMvDetail = (params = {}) => getKugou('/video/detail', params)

export const getMvDetailInfo = (params = {}) => getKugou('/video/privilege', params)

export const getMvUrl = (params = {}) => getKugou('/video/url', params)

export const getFollowArtistNewMvs = (params = {}) => getKugou('/artist/follow/newsongs', params).then(toSongListResponse)

export const getUgcMv = (params = {}) => getKugou('/video/detail', params)

// Podcasts, radio, channels, and scenes
