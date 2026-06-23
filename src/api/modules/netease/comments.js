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

export const getAlbumComments = (params = {}) => getKugou('/comment/album', params).then(toCommentResponse)

export const getPlaylistComments = (params = {}) => getKugou('/comment/playlist', params).then(toCommentResponse)

export const getCommentInfoList = (params = {}) => {
  const ids = String(params.ids ?? params.id ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  const resourceId = ids[0] ?? ''

  if (!resourceId) {
    return Promise.resolve({ data: [] })
  }

  return getKugou('/comment/count', {
    id: resourceId,
    hash: params.hash,
    special_id: params.special_id
  }).then((response) => {
    const data = response.data ?? response
    const count = data.count ?? data.comment_count ?? response.count ?? 0

    return {
      ...response,
      data: resourceId
        ? [{
          resourceId,
          commentCount: count,
          commentCountDesc: data.countDesc ?? ''
        }]
        : []
    }
  })
}

// Authentication

export const getSongComments = (params = {}) => getKugou('/comment/music', params).then(toCommentResponse)

export const getSongRedCount = (params = {}) => {
  const knownSong = getKnownSong(params.id)

  return getKugou('/comment/count', {
    ...params,
    hash: params.hash ?? knownSong?.hash
  }).then(toCommentCountResponse)
}
