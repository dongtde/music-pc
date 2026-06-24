import axios from 'axios'
import { API_CONFIG } from '../../config/app'

const neteaseHttp = axios.create({
  baseURL: API_CONFIG.neteaseBaseURL,
  timeout: API_CONFIG.timeout,
  withCredentials: false
})

neteaseHttp.interceptors.response.use((response) => response.data, (error) => Promise.reject(error))

function getNetease(path, params = {}, config = {}) {
  return neteaseHttp.get(path, {
    ...config,
    params: withoutCookieParam(params)
  })
}

function withoutCookieParam(params = {}) {
  const { cookie, ...rest } = params ?? {}
  return rest
}

export function getPersonalizedMvs(params = {}, config = {}) {
  return getNetease('/personalized/mv', params, config)
}

export function subscribeMv(params = {}, config = {}) {
  return getNetease('/mv/sub', params, config)
}

export function getSubscribedMvs(params = {}, config = {}) {
  return getNetease('/mv/sublist', params, config)
}

export function getMvComments(params = {}, config = {}) {
  return getNetease('/comment/mv', params, config)
}

export function likeResource(params = {}, config = {}) {
  return getNetease('/resource/like', params, config)
}

export function getSimilarMvs(params = {}, config = {}) {
  return getNetease('/simi/mv', params, config)
}

export function getAllMvs(params = {}, config = {}) {
  return getNetease('/mv/all', params, config)
}

export function getFirstMvs(params = {}, config = {}) {
  return getNetease('/mv/first', params, config)
}

export function getExclusiveMvs(params = {}, config = {}) {
  return getNetease('/mv/exclusive/rcmd', params, config)
}

export function getTopMvs(params = {}, config = {}) {
  return getNetease('/top/mv', params, config)
}

export function getMvDetail(params = {}, config = {}) {
  return getNetease('/mv/detail', params, config)
}

export function getMvDetailInfo(params = {}, config = {}) {
  return getNetease('/mv/detail/info', params, config)
}

export function getMvUrl(params = {}, config = {}) {
  return getNetease('/mv/url', params, config)
}

export function getFollowArtistNewMvs(params = {}, config = {}) {
  return getNetease('/artist/new/mv', params, config)
}

export function getArtistMvs(params = {}, config = {}) {
  return getNetease('/artist/mv', params, config)
}

export function getUgcMv(params = {}, config = {}) {
  return getNetease('/ugc/mv/get', params, config)
}
