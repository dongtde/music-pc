import http from '../../../http'
import { readStoredKugouAuth, toKugouAuthCookie } from '../../../../utils/kugouAuth'

export function getKugou(path, params = {}, config = {}) {
  const normalizedParams = normalizeParams(path, params)
  const requestParams = withStoredKugouSearchCookie(path, normalizedParams, {
    ...config,
    noCookie: config.noCookie ?? params.noCookie
  })

  return http.get(path, {
    ...config,
    noCookie: config.noCookie ?? params.noCookie,
    params: requestParams
  }).then((payload) => attachKugouParams(parseKugouPayload(payload), requestParams))
}

export function getKugouRaw(path, params = {}, config = {}) {
  const normalizedParams = normalizeParams(path, params)
  const requestParams = withStoredKugouSearchCookie(path, normalizedParams, {
    ...config,
    noCookie: config.noCookie ?? params.noCookie
  })

  return http.get(path, {
    ...config,
    noCookie: config.noCookie ?? params.noCookie,
    params: requestParams
  }).then((payload) => attachKugouParams(parseKugouPayload(payload), requestParams))
}

export function withStoredKugouSearchCookie(path, params = {}, config = {}) {
  if (config.noCookie || params.cookie || !isSearchPath(path)) {
    return params
  }

  const cookie = toKugouAuthCookie(readStoredKugouAuth())

  return cookie ? { ...params, cookie } : params
}

export const songRegistry = new Map()

export const lyricRequestRegistry = new Map()

export const pagesizeParamPaths = new Set([
  '/lastest/songs/listen',
  '/playlist/track/all',
  '/playlist/track/all/new',
  '/user/cloud',
  '/user/playlist',
  '/user/video/collect',
  '/user/video/love'
])

export function normalizeParams(path, params) {
  const normalized = { ...params }

  if (normalized.pagesize !== undefined && normalized.pageSize === undefined) {
    normalized.pageSize = normalized.pagesize
  }

  if (normalized.limit !== undefined && normalized.pageSize === undefined) {
    normalized.pageSize = normalized.limit
  }

  if (normalized.offset !== undefined && normalized.page === undefined) {
    const pageSize = Number(normalized.pageSize) || 30
    normalized.page = Math.floor(Number(normalized.offset) / pageSize) + 1
  }

  delete normalized.pagesize
  delete normalized.limit
  delete normalized.offset
  delete normalized.level
  delete normalized.noCookie

  if (normalized.keywords === undefined && normalized.keyword !== undefined) {
    normalized.keywords = normalized.keyword
  }

  if (normalized.id !== undefined) {
    if (path === '/playlist/detail' || path === '/playlist/similar') {
      normalized.ids ??= normalized.id
      delete normalized.id
    } else if (path === '/playlist/track/all/new') {
      normalized.listid ??= normalized.id
      delete normalized.id
    } else if (path === '/song/url' || path === '/song/url/new') {
      const knownSong = getKnownSong(normalized.id)
      normalized.hash = normalized.hash || knownSong?.hash || hashFromId(normalized.id)
      normalized.album_audio_id = normalized.album_audio_id || knownSong?.album_audio_id || knownSong?.mixsongid
      normalized.album_id = normalized.album_id || knownSong?.album_id
      delete normalized.id
    } else if (path === '/search/lyric') {
      const knownSong = getKnownSong(normalized.id)
      normalized.hash = normalized.hash || knownSong?.hash || hashFromId(normalized.id)
      normalized.album_audio_id = normalized.album_audio_id || knownSong?.album_audio_id
      normalized.keywords = normalized.keywords || knownSong?.name || knownSong?.songname
      delete normalized.id
    } else if (path === '/comment/music') {
      normalized.mixsongid ??= normalized.id
      delete normalized.id
    } else if (path === '/comment/count') {
      const knownSong = getKnownSong(normalized.id)
      normalized.hash = normalized.hash || knownSong?.hash || hashFromId(normalized.id)
      delete normalized.id
    } else if (path === '/rank/audio' || path === '/rank/info') {
      normalized.rankid ??= normalized.id
      delete normalized.id
    } else if (path === '/youth/channel/detail' || path === '/youth/channel/song') {
      normalized.global_collection_id ??= normalized.id
      delete normalized.id
    }
  }

  if (normalized.phone !== undefined) {
    normalized.mobile ??= normalized.phone
    delete normalized.phone
  }

  if (normalized.captcha !== undefined) {
    normalized.code ??= normalized.captcha
    delete normalized.captcha
  }

  if (path === '/login/cellphone' || path === '/captcha/sent' || path === '/login') {
    delete normalized.countrycode
  }

  if (path === '/search') {
    normalized.type = normalizeSearchType(normalized.type)
  }

  if (path === '/search/complex') {
    delete normalized.type
  }

  if (path === '/playlist/add') {
    normalized.type ??= 0

    if (normalized.isPrivate !== undefined && normalized.is_pri === undefined) {
      normalized.is_pri = normalized.isPrivate ? 1 : 0
    }

    if (normalized.private !== undefined && normalized.is_pri === undefined) {
      normalized.is_pri = normalized.private ? 1 : 0
    }

    delete normalized.isPrivate
    delete normalized.private
  }

  if (isSearchPath(path)) {
    if (normalized.pageSize !== undefined && normalized.pagesize === undefined) {
      normalized.pagesize = normalized.pageSize
    }

    delete normalized.pageSize
  }

  if (isCommentPath(path)) {
    if (normalized.pageSize !== undefined && normalized.pagesize === undefined) {
      normalized.pagesize = normalized.pageSize
    }

    delete normalized.pageSize
  }

  if (pagesizeParamPaths.has(path)) {
    if (normalized.pageSize !== undefined && normalized.pagesize === undefined) {
      normalized.pagesize = normalized.pageSize
    }

    delete normalized.pageSize
  }

  if (path === '/artist/audios' || path === '/artist/albums') {
    normalized.sort = normalized.order === 'time' ? 'new' : normalized.sort || 'hot'
    delete normalized.order
  }

  if (path === '/top/album') {
    normalized.type = normalizeAlbumAreaType(normalized.type ?? normalized.area)

    if (!normalized.type) {
      delete normalized.type
    }

    delete normalized.area
  }

  if (path === '/top/playlist') {
    if (normalized.category_id === undefined) {
      normalized.category_id = normalizePlaylistCategoryId(normalized.cat ?? normalized.category)
    }

    if (normalized.pageSize !== undefined && normalized.pagesize === undefined) {
      normalized.pagesize = normalized.pageSize
    }

    delete normalized.pageSize
    delete normalized.cat
    delete normalized.category
    delete normalized.order
  }

  if (path === '/album') {
    normalized.album_id ??= normalized.id
    delete normalized.id
  }

  if (path === '/artist/videos') {
    if (normalized.size !== undefined && normalized.pageSize === undefined) {
      normalized.pageSize = normalized.size
    }

    if (normalized.cursor !== undefined && normalized.page === undefined) {
      const pageSize = Number(normalized.pageSize) || 30
      normalized.page = Math.floor(Number(normalized.cursor) / pageSize) + 1
    }

    delete normalized.size
    delete normalized.cursor
    delete normalized.order
  }

  if (path === '/personal/fm' && normalized.action === undefined && normalized.mode === 'TRASH') {
    normalized.action = 'garbage'
  }

  return Object.fromEntries(
    Object.entries(normalized).filter(([, value]) => value !== undefined && value !== null && value !== '')
  )
}

export function normalizeSearchType(type) {
  const typeMap = {
    1: 'song',
    10: 'album',
    100: 'author',
    1000: 'special',
    1002: 'talent',
    1004: 'mv',
    2000: 'lyric'
  }

  return typeMap[type] || type || 'song'
}

export function isSearchPath(path = '') {
  return path === '/search' || path.startsWith('/search/')
}

export function withStoredKugouAuthParams(params = {}) {
  const auth = readStoredKugouAuth()
  const cookie = toKugouAuthCookie(auth)
  const authParams = {
    token: auth.token,
    userid: auth.userid,
    dfid: auth.dfid,
    vip_type: auth.vipType,
    vip_token: auth.vipToken,
    cookie
  }

  return {
    ...authParams,
    ...params
  }
}

export function isCommentPath(path = '') {
  return path === '/comment/playlist' || path === '/comment/album' || path === '/comment/music'
}

export function normalizeAlbumAreaType(type) {
  const typeMap = {
    ZH: 1,
    EA: 2,
    JP: 3,
    KR: 4,
    1: 1,
    2: 2,
    3: 3,
    4: 4
  }

  return typeMap[String(type ?? '').toUpperCase()] || ''
}

export function normalizePlaylistCategoryId(category) {
  const value = String(category ?? '').trim()

  if (!value || value === '全部' || value === '推荐') {
    return 0
  }

  if (value.toUpperCase() === 'HI-RES') {
    return 11292
  }

  return /^\d+$/.test(value) ? Number(value) : value
}

export function parseKugouPayload(payload) {
  if (typeof payload !== 'string') {
    return payload
  }

  const match = payload.match(/<!--KG_TAG_RES_START-->([\s\S]*?)<!--KG_TAG_RES_END-->/)
  const json = match?.[1] ?? payload

  try {
    return JSON.parse(json)
  } catch {
    return payload
  }
}

export function attachKugouParams(payload, params = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload
  }

  return {
    ...payload,
    params
  }
}

export function getKnownSong(id) {
  return songRegistry.get(String(id ?? ''))
}

export function hashFromId(id) {
  const value = String(id ?? '').trim()

  return value && !/^\d+$/.test(value) ? value : ''
}

export function rememberSong(song) {
  if (!song?.id) {
    return song
  }

  songRegistry.set(String(song.id), {
    id: song.id,
    name: song.name,
    songname: song.songname,
    hash: song.hash,
    album_audio_id: song.album_audio_id,
    mixsongid: song.mixsongid,
    album_id: song.album_id,
    audio_id: song.audio_id,
    qualities: song.qualities
  })

  return song
}
