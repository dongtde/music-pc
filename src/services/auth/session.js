import { STORAGE_KEYS } from '../../config/app'
import {
  mergeKugouAuth,
  parseCookieString,
  readStoredKugouAuth,
  toKugouAuthCookie,
  writeStoredKugouAuth
} from '../../utils/kugouAuth'
import { readJsonStorage, writeJsonStorage } from '../../utils/storage'

const FALLBACK_ACCOUNT_NAME = '酷狗账号'
const FALLBACK_ACCOUNT_NAMES = new Set([
  FALLBACK_ACCOUNT_NAME,
  '酷狗用户',
  '閰风嫍鐢ㄦ埛'
])

export function readInitialAuthSession() {
  const auth = readStoredKugouAuth()
  const cookie = toKugouAuthCookie(auth)
  const storedSession = readStoredSession(cookie)
  const session = storedSession.profile || storedSession.account
    ? storedSession
    : createSessionFromCookie(cookie)

  return {
    auth,
    cookie,
    session,
    hasSession: Boolean(session.profile || session.account)
  }
}

export function writeAuthCookie(currentAuth, cookie) {
  if (!cookie) {
    return {
      auth: writeStoredKugouAuth({}),
      cookie: ''
    }
  }

  const auth = writeStoredKugouAuth(mergeKugouAuth(currentAuth, cookie))

  return {
    auth,
    cookie: toKugouAuthCookie(auth)
  }
}

export function mergeAuthCookieString(currentCookie = '', nextCookie = '') {
  return toKugouAuthCookie(mergeKugouAuth(currentCookie, nextCookie))
}

export function saveStoredSession({ cookie, auth, account, profile, loginType }) {
  const nextSession = {
    cookie,
    auth,
    account,
    profile,
    loginType: loginType || 'account',
    savedAt: Date.now()
  }

  if (isFallbackStoredSession(nextSession)) {
    const currentSession = readJsonStorage(STORAGE_KEYS.neteaseSession, {})

    if (
      currentSession &&
      typeof currentSession === 'object' &&
      !isFallbackStoredSession(currentSession) &&
      isSameStoredAccount(currentSession, cookie)
    ) {
      return
    }

    return
  }

  writeJsonStorage(STORAGE_KEYS.neteaseSession, {
    ...nextSession
  })
}

export function clearStoredSession() {
  writeJsonStorage(STORAGE_KEYS.neteaseSession, null)
}

export function buildAuthRequestParams(source = {}, params = {}) {
  const cookieValues = mergeKugouAuth(source.auth, source.cookie)
  const fallbackUserId = source.profile?.userId || source.account?.id || ''
  const cookie = toKugouAuthCookie(cookieValues)
  const requestParams = {
    ...params,
    token: params.token ?? cookieValues.token,
    userid: params.userid ?? cookieValues.userid ?? fallbackUserId,
    dfid: params.dfid ?? cookieValues.dfid,
    vip_type: params.vip_type ?? cookieValues.vipType,
    vip_token: params.vip_token ?? cookieValues.vipToken,
    cookie: params.cookie ?? cookie
  }

  Object.keys(requestParams).forEach((key) => {
    if (requestParams[key] === undefined || requestParams[key] === null || requestParams[key] === '') {
      delete requestParams[key]
    }
  })

  return requestParams
}

export function getAuthIdentity(source = {}) {
  const cookieValues = mergeKugouAuth(source.auth, source.cookie)

  return String(
    source.profile?.userId ||
      source.account?.id ||
      cookieValues.userid ||
      cookieValues.token ||
      ''
  )
}

export function readDailyVipClaim() {
  return readJsonStorage(STORAGE_KEYS.dailyVipClaim, {})
}

export function readDailyVipAutoStatusCheck() {
  return readJsonStorage(STORAGE_KEYS.dailyVipAutoStatusCheck, {})
}

export function writeDailyVipClaim({ date, identity, claimedAt = Date.now() }) {
  writeJsonStorage(STORAGE_KEYS.dailyVipClaim, {
    date,
    identity,
    claimedAt
  })
}

export function writeDailyVipAutoStatusCheck({ date, identity, checkedAt = Date.now() }) {
  writeJsonStorage(STORAGE_KEYS.dailyVipAutoStatusCheck, {
    date,
    identity,
    checkedAt
  })
}

export function parseAuthCookie(cookie = '') {
  return parseCookieString(cookie)
}

function readStoredSession(cookie) {
  const session = readJsonStorage(STORAGE_KEYS.neteaseSession, {})

  if (!session || typeof session !== 'object') {
    return {}
  }

  if (session.loginType === 'guest') {
    clearStoredSession()
    return {}
  }

  if (isFallbackStoredSession(session)) {
    clearStoredSession()
    return {}
  }

  if (!isSameStoredAccount(session, cookie)) {
    return {}
  }

  return {
    account: session.account ?? null,
    profile: session.profile ?? null,
    loginType: session.loginType || 'account'
  }
}

function isSameStoredAccount(session = {}, cookie = '') {
  const sessionIdentity = getSessionIdentity(session)
  const currentIdentity = getSessionIdentity({ cookie })

  if (sessionIdentity && currentIdentity) {
    return sessionIdentity === currentIdentity
  }

  return Boolean(session.cookie && session.cookie === cookie)
}

function isFallbackStoredSession(session = {}) {
  const profileName = String(session.profile?.nickname || '').trim()
  const accountName = String(session.account?.userName || '').trim()

  return Boolean(
    session.profile?.isFallback ||
      session.account?.isFallback ||
      FALLBACK_ACCOUNT_NAMES.has(profileName) ||
      FALLBACK_ACCOUNT_NAMES.has(accountName)
  )
}

function getSessionIdentity(source = {}) {
  const cookieValues = mergeKugouAuth(source.auth, source.cookie)

  return String(
    source.profile?.userId ||
      source.account?.id ||
      cookieValues.userid ||
      cookieValues.token ||
      ''
  )
}

function createSessionFromCookie(cookie) {
  if (!cookie) {
    return {}
  }

  const cookieValues = parseAuthCookie(cookie)

  if (cookieValues.userid) {
    return {
      account: {
        id: cookieValues.userid,
        userName: FALLBACK_ACCOUNT_NAME,
        isFallback: true
      },
      profile: {
        userId: cookieValues.userid,
        nickname: FALLBACK_ACCOUNT_NAME,
        avatarUrl: '',
        isFallback: true
      },
      loginType: 'account'
    }
  }

  return {}
}
