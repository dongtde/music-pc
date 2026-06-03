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
