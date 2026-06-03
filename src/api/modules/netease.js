import http from '../http'

export function getPersonalizedPlaylists(params = {}) {
  return http.get('/personalized', {
    params
  })
}

export function getBanners(params = {}) {
  return http.get('/banner', {
    params
  })
}

export function getPersonalizedMvs(params = {}) {
  return http.get('/personalized/mv', {
    params
  })
}

export function getPersonalizedNewSongs(params = {}) {
  return http.get('/personalized/newsong', {
    params
  })
}

export function getPlaylistDetail(params = {}) {
  return http.get('/playlist/detail', {
    params
  })
}

export function getPlaylistTracks(params = {}) {
  return http.get('/playlist/track/all', {
    params
  })
}

export function getPlaylistHotCategories(params = {}) {
  return http.get('/playlist/hot', {
    params
  })
}

export function getPlaylistCategories(params = {}) {
  return http.get('/playlist/catlist', {
    params
  })
}

export function getTopPlaylists(params = {}) {
  return http.get('/top/playlist', {
    params
  })
}

export function getHighQualityPlaylists(params = {}) {
  return http.get('/top/playlist/highquality', {
    params
  })
}

export function getToplist(params = {}) {
  return http.get('/toplist', {
    params
  })
}

export function getArtistList(params = {}) {
  return http.get('/artist/list', {
    params
  })
}

export function getArtistToplist(params = {}) {
  return http.get('/toplist/artist', {
    params
  })
}

export function getSongUrl(params = {}) {
  return http.get('/song/url/v1', {
    params
  })
}

export function getLyric(params = {}) {
  return http.get('/lyric', {
    params
  })
}

export function getSearchDefault(params = {}) {
  return http.get('/search/default', {
    params
  })
}

export function getSearchHotDetail(params = {}) {
  return http.get('/search/hot/detail', {
    params
  })
}

export function getSearchSuggestPc(params = {}) {
  return http.get('/search/suggest/pc', {
    params
  })
}

export function getSearchMultiMatch(params = {}) {
  return http.get('/search/multimatch', {
    params
  })
}

export function getCloudSearch(params = {}) {
  return http.get('/cloudsearch', {
    params
  })
}
