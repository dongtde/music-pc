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

export const getArtistList = (params = {}) => getKugou('/artist/lists', params).then(toArtistListResponse)

export const getArtistToplist = (params = {}) => getKugou('/artist/lists', params).then(toArtistListResponse)

export const getArtistDetail = (params = {}) => getKugou('/artist/detail', params).then(toArtistDetailResponse)

export const getArtistHotSongs = (params = {}) => getKugou('/artist/audios', params).then(toArtistSongsResponse)

export const getArtistTopSongs = (params = {}) =>
  getKugou('/artist/audios', { ...params, sort: 'hot' }).then(toArtistSongsResponse)

export const getArtistSongs = (params = {}) => getKugou('/artist/audios', params).then(toArtistSongsResponse)

export const getArtistAlbums = (params = {}) => getKugou('/artist/albums', params).then(toArtistAlbumsResponse)

export const getArtistMvs = (params = {}) => getKugou('/artist/videos', params)

export const getArtistVideos = (params = {}) => getKugou('/artist/videos', params).then(toArtistVideosResponse)

export const getArtistDesc = (params = {}) => getKugou('/artist/detail', params).then(toArtistDetailResponse)

export const getArtistDynamic = (params = {}) => getKugou('/artist/detail', params).then(toArtistDetailResponse)

// Albums
