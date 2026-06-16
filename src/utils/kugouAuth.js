import { STORAGE_KEYS } from '../config/app'
import { readJsonStorage, readStorage, writeJsonStorage, writeStorage } from './storage'

const AUTH_COOKIE_KEYS = ['token', 'userid', 'dfid']
const BROWSER_COOKIE_NAME_PATTERNS = [
  /^KUGOU_API/i,
  /^Hm_l?p?vt_/i,
  /^kg_/i,
  /^dfid$/i,
  /^NMTID$/i,
  /^t1$/i,
  /^token$/i,
  /^userid$/i,
  /^vip_token$/i,
  /^vip_type$/i
]

export function parseCookieString(cookie = '') {
  return String(cookie)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((values, part) => {
      const separatorIndex = part.indexOf('=')

      if (separatorIndex === -1) {
        return values
      }

      const key = part.slice(0, separatorIndex).trim()
      const value = part.slice(separatorIndex + 1).trim()

      if (key && value) {
        values[key] = value
      }

      return values
    }, {})
}

export function normalizeKugouAuth(source = {}) {
  const values = typeof source === 'string' ? parseCookieString(source) : source || {}
  const vipType = normalizeInteger(values.vipType ?? values.vip_type)

  return {
    token: cleanString(values.token),
    userid: cleanString(values.userid ?? values.userId ?? values.uid),
    dfid: cleanString(values.dfid ?? values.kg_dfid),
    vipType,
    vipToken: cleanString(values.vipToken ?? values.vip_token),
    kgMid: cleanString(values.kgMid ?? values.kg_mid),
    kgDfid: cleanString(values.kgDfid ?? values.kg_dfid)
  }
}

export function mergeKugouAuth(...sources) {
  return sources.reduce((merged, source) => {
    const auth = normalizeKugouAuth(source)

    Object.entries(auth).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        merged[key] = value
      }
    })

    return merged
  }, {})
}

export function hasKugouAuth(auth = {}) {
  const normalized = normalizeKugouAuth(auth)
  return Boolean(normalized.token || normalized.userid || normalized.dfid)
}

export function toKugouAuthCookie(auth = {}) {
  const normalized = normalizeKugouAuth(auth)

  return AUTH_COOKIE_KEYS
    .map((key) => [key, normalized[key]])
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join(';')
}

export function readStoredKugouAuth() {
  const legacyCookie = readStorage(STORAGE_KEYS.neteaseCookie, '')
  const storedAuth = readJsonStorage(STORAGE_KEYS.kugouAuth, {})

  return mergeKugouAuth(legacyCookie, storedAuth)
}

export function writeStoredKugouAuth(auth = {}) {
  const normalized = normalizeKugouAuth(auth)

  if (!hasKugouAuth(normalized)) {
    writeJsonStorage(STORAGE_KEYS.kugouAuth, null)
    writeStorage(STORAGE_KEYS.neteaseCookie, '')
    return normalized
  }

  const storedAuth = {
    ...normalized,
    savedAt: Date.now()
  }

  writeJsonStorage(STORAGE_KEYS.kugouAuth, storedAuth)
  writeStorage(STORAGE_KEYS.neteaseCookie, toKugouAuthCookie(normalized))
  return normalized
}

export function clearKugouBrowserCookies() {
  if (typeof document === 'undefined' || !document.cookie) {
    return
  }

  document.cookie
    .split(';')
    .map((part) => part.split('=')[0]?.trim())
    .filter((name) => name && BROWSER_COOKIE_NAME_PATTERNS.some((pattern) => pattern.test(name)))
    .forEach(expireBrowserCookie)
}

function cleanString(value) {
  return String(value ?? '').trim()
}

function normalizeInteger(value) {
  if (value === undefined || value === null || value === '') {
    return ''
  }

  const number = Number(value)
  return Number.isFinite(number) ? number : ''
}

function expireBrowserCookie(name) {
  const encodedName = encodeURIComponent(name)
  const paths = ['/', '/api', '/netease-api']

  paths.forEach((path) => {
    document.cookie = `${encodedName}=; Max-Age=0; path=${path}`
  })
}
