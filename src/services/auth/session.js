import { STORAGE_KEYS } from '../../config/app'
import {
  mergeKugouAuth,
  parseCookieString,
  readStoredKugouAuth,
  toKugouAuthCookie,
  writeStoredKugouAuth
} from '../../utils/kugouAuth'
import { readJsonStorage, writeJsonStorage } from '../../utils/storage'

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
  writeJsonStorage(STORAGE_KEYS.neteaseSession, {
    cookie,
    auth,
    account,
    profile,
    loginType: loginType || 'account',
    savedAt: Date.now()
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

export function writeDailyVipClaim({ date, identity, claimedAt = Date.now() }) {
  writeJsonStorage(STORAGE_KEYS.dailyVipClaim, {
    date,
    identity,
    claimedAt
  })
}

export function parseAuthCookie(cookie = '') {
  return parseCookieString(cookie)
}

function readStoredSession(cookie) {
  const session = readJsonStorage(STORAGE_KEYS.neteaseSession, {})

  if (!session || typeof session !== 'object' || session.cookie !== cookie) {
    return {}
  }

  if (session.loginType === 'guest') {
    clearStoredSession()
    return {}
  }

  return {
    account: session.account ?? null,
    profile: session.profile ?? null,
    loginType: session.loginType || 'account'
  }
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
        userName: '酷狗账号'
      },
      profile: {
        userId: cookieValues.userid,
        nickname: '酷狗账号',
        avatarUrl: ''
      },
      loginType: 'account'
    }
  }

  return {}
}
