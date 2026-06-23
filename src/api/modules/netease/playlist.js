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

export const getPlaylistDetail = (params = {}, config = {}) => {
  if (/^\d+$/.test(String(params.id ?? ''))) {
    return Promise.all([
      getKugou('/rank/info', { ...params, rankid: params.id }, config).catch((error) => {
        if (isAbortError(error)) {
          throw error
        }

        return {}
      }),
      getKugou('/rank/list', {}, config).catch((error) => {
        if (isAbortError(error)) {
          throw error
        }

        return {}
      }),
      getKugou('/rank/audio', { ...params, rankid: params.id }, config)
    ]).then(([infoResponse, listResponse, audioResponse]) => {
      const infoData = infoResponse.data ?? infoResponse
      const listRank = firstArray(listResponse.data?.info, listResponse.info, listResponse.data)
        .find((rank) => String(rank?.rankid ?? rank?.id ?? '') === String(params.id)) ?? {}

      return toRankTracksResponse(audioResponse, params.id, {
        data: {
          ...listRank,
          ...infoData
        }
      })
    })
  }

  return getKugou('/playlist/detail', params, config).then(toPlaylistDetailResponse)
}

export const getPlaylistTracks = (params = {}, config = {}) => {
  if (params.listid || params.listId) {
    const listid = params.listid ?? params.listId

    return getKugou('/playlist/track/all/new', { ...params, listid }, config).then((response) =>
      toPlaylistTracksResponse(response, listid)
    )
  }

  if (/^\d+$/.test(String(params.id ?? ''))) {
    return getKugou('/rank/audio', { ...params, rankid: params.id }, config).then((response) =>
      toRankTracksResponse(response, params.id)
    )
  }

  return getKugou('/playlist/track/all', params, config).then((response) =>
    toPlaylistTracksResponse(response, params.id)
  )
}

export const getPlaylistHotCategories = (params = {}, config = {}) => getKugou('/playlist/tags', params, config)

export const getPlaylistCategories = (params = {}, config = {}) => getKugou('/playlist/tags', params, config)

export const getSimilarPlaylists = (params = {}, config = {}) =>
  getKugou('/playlist/similar', params, config).then(toPlaylistListResponse)

export const getTopPlaylists = (params = {}, config = {}) =>
  getKugou('/top/playlist', { category_id: 0, ...params }, { noCookie: true, ...config }).then(toPlaylistListResponse)

export const getHighQualityPlaylists = (params = {}, config = {}) =>
  getKugou('/top/playlist', { category_id: 11292, ...params }, { noCookie: true, ...config }).then(toPlaylistListResponse)
