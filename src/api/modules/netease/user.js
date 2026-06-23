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

export const checkSongLike = (params = {}) => getKugou('/favorite/count', { mixsongids: params.ids, ...params })

export const updateSongLike = (params = {}) => getKugou('/playlist/tracks/add', params)

export const getUserPlaylists = (params = {}) =>
  getKugou('/user/playlist', withStoredKugouAuthParams(params)).then(toPlaylistListResponse)

export const getUserCreatedPlaylists = getUserPlaylists

export const getUserCollectedPlaylists = getUserPlaylists

export const createUserPlaylist = (params = {}) =>
  getKugou('/playlist/add', withStoredKugouAuthParams({ type: 0, ...params }))

export const deleteUserPlaylist = (params = {}) =>
  getKugou('/playlist/del', withStoredKugouAuthParams(params))

export const addUserPlaylistTracks = (params = {}) =>
  getKugou('/playlist/tracks/add', withStoredKugouAuthParams(params))

export const deleteUserPlaylistTracks = (params = {}) =>
  getKugou('/playlist/tracks/del', withStoredKugouAuthParams(params))

export const getSongDownloadList = (params = {}) =>
  getKugou('/user/cloud', withStoredKugouAuthParams(params)).then(toSongListResponse)

// Playlists and charts
