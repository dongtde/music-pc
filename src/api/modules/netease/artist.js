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

export const getArtistList = (params = {}, config = {}) => getKugou('/artist/lists', params, config).then(toArtistListResponse)

export const getArtistToplist = (params = {}, config = {}) => getKugou('/artist/lists', params, config).then(toArtistListResponse)

export const getArtistDetail = (params = {}, config = {}) => getKugou('/artist/detail', params, config).then(toArtistDetailResponse)

export const getArtistHotSongs = (params = {}, config = {}) => getKugou('/artist/audios', params, config).then(toArtistSongsResponse)

export const getArtistTopSongs = (params = {}, config = {}) =>
  getKugou('/artist/audios', { ...params, sort: 'hot' }, config).then(toArtistSongsResponse)

export const getArtistSongs = (params = {}, config = {}) => getKugou('/artist/audios', params, config).then(toArtistSongsResponse)

export const getArtistAlbums = (params = {}, config = {}) => getKugou('/artist/albums', params, config).then(toArtistAlbumsResponse)

export const getArtistMvs = (params = {}, config = {}) => getKugou('/artist/videos', params, config)

export const getArtistVideos = (params = {}, config = {}) => getKugou('/artist/videos', params, config).then(toArtistVideosResponse)

export const getArtistDesc = (params = {}, config = {}) => getKugou('/artist/detail', params, config).then(toArtistDetailResponse)

export const getArtistDynamic = (params = {}, config = {}) => getKugou('/artist/detail', params, config).then(toArtistDetailResponse)

// Albums
