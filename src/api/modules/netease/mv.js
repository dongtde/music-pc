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

function normalizeMvDetailParams(params = {}) {
  const id = params.id ?? params.mvid ?? params.mvId ?? params.videoId ?? params.video_id
  const nextParams = { ...params, id }

  delete nextParams.mvid
  delete nextParams.mvId
  delete nextParams.videoId
  delete nextParams.video_id

  return nextParams
}

function normalizeMvHashParams(params = {}) {
  const idCandidate = params.id ?? params.mvid ?? params.mvId ?? params.videoId ?? params.video_id
  const hash =
    params.hash ??
    params.videoHash ??
    params.video_hash ??
    params.mvHash ??
    params.mvhash ??
    (/^\d+$/.test(String(idCandidate ?? '')) ? '' : idCandidate)
  const nextParams = { ...params, hash }

  delete nextParams.id
  delete nextParams.mvid
  delete nextParams.mvId
  delete nextParams.videoId
  delete nextParams.video_id
  delete nextParams.videoHash
  delete nextParams.video_hash
  delete nextParams.mvHash

  return nextParams
}

export const subscribeMv = (params = {}, config = {}) => getKugou('/youth/channel/sub', params, config)

export const getSubscribedMvs = (params = {}, config = {}) => getKugou('/user/video/collect', params, config)

export const getMvComments = (params = {}, config = {}) => getKugou('/comment/music', params, config).then(toCommentResponse)

export const likeResource = (params = {}, config = {}) => getKugou('/youth/channel/sub', params, config)

export const getSimilarMvs = (params = {}, config = {}) => getKugou('/ai/recommend', params, config).then(toSongListResponse)

export const getAllMvs = (params = {}, config = {}) => getKugou('/brush', params, config).then(toMvListResponse)

export const getFirstMvs = (params = {}, config = {}) => getKugou('/brush', params, config).then(toMvListResponse)

export const getExclusiveMvs = (params = {}, config = {}) => getKugou('/brush', params, config).then(toMvListResponse)

export const getTopMvs = (params = {}, config = {}) => getKugou('/brush', params, config).then(toMvListResponse)

export const getMvDetail = (params = {}, config = {}) => getKugou('/video/detail', normalizeMvDetailParams(params), config)

export const getMvDetailInfo = (params = {}, config = {}) => getKugou('/video/privilege', normalizeMvHashParams(params), config)

export const getMvUrl = (params = {}, config = {}) => getKugou('/video/url', normalizeMvHashParams(params), config)

export const getFollowArtistNewMvs = (params = {}, config = {}) => getKugou('/artist/follow/newsongs', params, config).then(toSongListResponse)

export const getUgcMv = (params = {}, config = {}) => getKugou('/video/detail', normalizeMvDetailParams(params), config)

// Podcasts, radio, channels, and scenes
