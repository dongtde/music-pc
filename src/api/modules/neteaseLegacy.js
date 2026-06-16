import axios from 'axios'
import { API_CONFIG, STORAGE_KEYS } from '../../config/app'
import { readStorage } from '../../utils/storage'

const neteaseHttp = axios.create({
  baseURL: API_CONFIG.neteaseBaseURL,
  timeout: API_CONFIG.timeout,
  withCredentials: false
})

neteaseHttp.interceptors.request.use((config) => {
  const cookie = readStorage(STORAGE_KEYS.neteaseCookie, '')

  if (cookie && !config.params?.cookie) {
    config.params = {
      ...(config.params ?? {}),
      cookie
    }
  }

  return config
})

neteaseHttp.interceptors.response.use((response) => response.data, (error) => Promise.reject(error))

function getNetease(path, params = {}, config = {}) {
  return neteaseHttp.get(path, {
    ...config,
    params
  })
}

export function getPersonalizedMvs(params = {}) {
  return getNetease('/personalized/mv', params)
}

export function subscribeMv(params = {}) {
  return getNetease('/mv/sub', params)
}

export function getSubscribedMvs(params = {}) {
  return getNetease('/mv/sublist', params)
}

export function getMvComments(params = {}) {
  return getNetease('/comment/mv', params)
}

export function likeResource(params = {}) {
  return getNetease('/resource/like', params)
}

export function getSimilarMvs(params = {}) {
  return getNetease('/simi/mv', params)
}

export function getAllMvs(params = {}) {
  return getNetease('/mv/all', params)
}

export function getFirstMvs(params = {}) {
  return getNetease('/mv/first', params)
}

export function getExclusiveMvs(params = {}) {
  return getNetease('/mv/exclusive/rcmd', params)
}

export function getTopMvs(params = {}) {
  return getNetease('/top/mv', params)
}

export function getMvDetail(params = {}) {
  return getNetease('/mv/detail', params)
}

export function getMvDetailInfo(params = {}) {
  return getNetease('/mv/detail/info', params)
}

export function getMvUrl(params = {}) {
  return getNetease('/mv/url', params)
}

export function getFollowArtistNewMvs(params = {}) {
  return getNetease('/artist/new/mv', params)
}

export function getArtistMvs(params = {}) {
  return getNetease('/artist/mv', params)
}

export function getUgcMv(params = {}) {
  return getNetease('/ugc/mv/get', params)
}
