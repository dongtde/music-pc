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
import { isAbortError } from '../../../utils/request'

export const getSearchDefault = (params = {}, config = {}) =>
  getKugou('/search/default', params, {
    ...config,
    noCookie: config.noCookie ?? true
  })

export const getSearchHotDetail = (params = {}, config = {}) =>
  getKugou('/search/hot', params, config).then(toHotSearchResponse)

export const getSearchSuggestPc = (params = {}, config = {}) =>
  getKugou('/search/suggest', params, config).then(toSuggestResponse)

export const getSearchMultiMatch = (params = {}, config = {}) =>
  getKugou('/search/complex', params, config)
    .then((response) => toSearchResponse(response, 1))
    .catch((error) => {
      if (isAbortError(error)) {
        throw error
      }

      return emptySearchResponse(1)
    })

export const getCloudSearch = (params = {}, config = {}) => {
  const searchType = normalizeSearchType(params.type)
  const path = searchType === 'talent' ? '/search/complex' : '/search'

  return getKugou(path, params, config)
    .then((response) => toSearchResponse(response, params.type))
    .catch((error) => {
      if (isAbortError(error)) {
        throw error
      }

      return emptySearchResponse(params.type)
    })
}
