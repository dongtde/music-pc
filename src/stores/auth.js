import { computed, reactive } from 'vue'
import {
  claimYouthDayVip,
  getLoginQrCheck,
  getLoginQrCreate,
  getLoginQrKey,
  getLoginStatus,
  getUserAccount,
  getYouthVipStatus,
  loginByCellphone,
  loginByEmail,
  logout as requestLogout,
  refreshLogin,
  registerAnonymous,
  sendCaptcha,
  upgradeYouthDayVip
} from '../api/modules/netease'
import { DEFAULT_COUNTRY_CODE, STORAGE_KEYS } from '../config/app'
import { readJsonStorage, readStorage, writeJsonStorage, writeStorage } from '../utils/storage'

const storedCookie = readStoredCookie()
const storedSession = readStoredSession(storedCookie)
const initialSession = storedSession.profile || storedSession.account
  ? storedSession
  : createSessionFromCookie(storedCookie)

const state = reactive({
  initialized: false,
  loading: false,
  formLoading: false,
  captchaLoading: false,
  loginModalVisible: false,
  isLoggedIn: Boolean(storedCookie && (initialSession.profile || initialSession.account)),
  loginType: storedCookie ? initialSession.loginType : '',
  account: storedCookie ? initialSession.account : null,
  profile: storedCookie ? initialSession.profile : null,
  cookie: storedCookie,
  error: '',
  notice: '',
  vip: {
    loading: false,
    claiming: false,
    loaded: false,
    active: false,
    raw: null,
    error: ''
  },
  qr: {
    loading: false,
    key: '',
    image: '',
    status: 0,
    message: ''
  }
})
let dailyVipClaimRequest = null
let vipStatusRequest = null

export function useAuthStore() {
  const displayName = computed(() =>
    state.profile?.nickname || state.account?.userName || '点击登录'
  )
  const avatarUrl = computed(() => state.profile?.avatarUrl || '')
  const userId = computed(() => state.profile?.userId || state.account?.id || '')
  const isGuest = computed(() => state.loginType === 'guest')

  async function initAuth() {
    if (state.initialized || state.loading) {
      return
    }

    state.loading = true
    state.error = ''

    try {
      const loggedIn = await refreshLoginStatus({ preserveCurrent: state.isLoggedIn })
      if (loggedIn || (state.isLoggedIn && state.loginType !== 'guest')) {
        syncVipAfterLogin()
      }
    } finally {
      state.initialized = true
      state.loading = false
    }
  }

  async function refreshLoginStatus({ preserveCurrent = false } = {}) {
    if (!state.cookie) {
      clearAccountState(false)
      return false
    }

    try {
      const response = await getLoginStatus(createAuthRequestParams({ timestamp: Date.now() }))
      const data = response.data ?? response
      const profile = response.profile ?? data.profile ?? null
      const account = response.account ?? data.account ?? null

      if (profile || account) {
        setAccountState({ profile, account, loginType: 'account' })
        return true
      }

      return await loadUserAccount({ preserveCurrent })
    } catch (error) {
      console.warn('Failed to refresh login status:', error)
      return await loadUserAccount({ preserveCurrent })
    }
  }

  async function loadUserAccount({ preserveCurrent = false } = {}) {
    if (!state.cookie) {
      clearAccountState(false)
      return false
    }

    try {
      const response = await getUserAccount(createAuthRequestParams({ timestamp: Date.now() }))

      if (response.profile || response.account) {
        setAccountState({
          profile: response.profile ?? null,
          account: response.account ?? null,
          loginType: 'account'
        })
        return true
      }
    } catch (error) {
      console.warn('Failed to load user account:', error)
    }

    if (!preserveCurrent) {
      clearAccountState(false)
    }

    return false
  }

  async function createQrLogin() {
    state.qr.loading = true
    state.error = ''
    state.notice = ''

    try {
      const keyResponse = await getLoginQrKey({ timestamp: Date.now(), noCookie: true })
      const key = keyResponse.data?.unikey

      if (!key) {
        throw new Error('二维码 key 获取失败')
      }

      const qrResponse = await getLoginQrCreate({
        key,
        qrimg: true,
        timestamp: Date.now(),
        noCookie: true
      })

      state.qr.key = key
      state.qr.image = normalizeQrImage(qrResponse.data?.qrimg || '')
      state.qr.status = 801
      state.qr.message = '等待扫码'
    } catch (error) {
      console.warn('Failed to create QR login:', error)
      state.error = error?.message || '二维码生成失败'
      resetQr()
    } finally {
      state.qr.loading = false
    }
  }

  async function checkQrLogin() {
    if (!state.qr.key) {
      return state.qr.status
    }

    try {
      const response = await getLoginQrCheck({
        key: state.qr.key,
        timestamp: Date.now(),
        noCookie: true
      })
      state.qr.status = response.code
      state.qr.message = response.message || getQrStatusText(response.code)

      if (response.code === 803) {
        const loggedIn = await completeLogin(response, 'account')
        if (loggedIn) {
          state.loginModalVisible = false
        } else {
          setError('登录成功但无法获取账号信息')
        }
      }

      return response.code
    } catch (error) {
      console.warn('Failed to check QR login:', error)
      state.error = '二维码状态检查失败'
      return 0
    }
  }

  async function loginWithCellphone({
    phone,
    countrycode = DEFAULT_COUNTRY_CODE,
    password = '',
    captcha = '',
    userid = ''
  }) {
    const normalizedPhone = String(phone ?? '').trim()
    const normalizedPassword = String(password ?? '')
    const normalizedCaptcha = String(captcha ?? '').trim()
    const normalizedUserId = String(userid ?? '').trim()

    if (!normalizedPhone) {
      setError('请输入手机号')
      return false
    }

    if (!normalizedPassword && !normalizedCaptcha) {
      setError('请输入密码或验证码')
      return false
    }

    state.formLoading = true
    state.error = ''
    state.notice = ''

    try {
      const response = await loginByCellphone({
        phone: normalizedPhone,
        countrycode: normalizeCountryCode(countrycode),
        password: normalizedCaptcha ? undefined : normalizedPassword,
        captcha: normalizedCaptcha || undefined,
        userid: normalizedUserId || undefined,
        timestamp: Date.now(),
        noCookie: true
      })
      const loggedIn = await completeLogin(response, 'account')
      if (!loggedIn) {
        throw new Error('登录失败，未获取到账号信息')
      }
      state.loginModalVisible = false
      return true
    } catch (error) {
      console.warn('Failed to login with cellphone:', error)
      setError(error?.message || '手机号登录失败')
      return false
    } finally {
      state.formLoading = false
    }
  }

  async function loginWithEmail({ email, password }) {
    const normalizedEmail = String(email ?? '').trim()
    const normalizedPassword = String(password ?? '')

    if (!normalizedEmail || !normalizedPassword) {
      setError('请输入账号和密码')
      return false
    }

    state.formLoading = true
    state.error = ''
    state.notice = ''

    try {
      const response = await loginByEmail({
        email: normalizedEmail,
        password: normalizedPassword,
        timestamp: Date.now(),
        noCookie: true
      })
      const loggedIn = await completeLogin(response, 'account')
      if (!loggedIn) {
        throw new Error('登录失败，未获取到账号信息')
      }
      state.loginModalVisible = false
      return true
    } catch (error) {
      console.warn('Failed to login with account:', error)
      setError(error?.message || '账号登录失败')
      return false
    } finally {
      state.formLoading = false
    }
  }

  async function sendLoginCaptcha({ phone, countrycode = DEFAULT_COUNTRY_CODE }) {
    const normalizedPhone = String(phone ?? '').trim()

    if (!normalizedPhone) {
      setError('请输入手机号')
      return false
    }

    state.captchaLoading = true
    state.error = ''
    state.notice = ''

    try {
      await sendCaptcha({
        phone: normalizedPhone,
        countrycode: normalizeCountryCode(countrycode),
        timestamp: Date.now(),
        noCookie: true
      })
      state.notice = '验证码已发送'
      return true
    } catch (error) {
      console.warn('Failed to send captcha:', error)
      setError(error?.message || '验证码发送失败')
      return false
    } finally {
      state.captchaLoading = false
    }
  }

  async function verifyLoginCaptcha({ phone, captcha, countrycode = DEFAULT_COUNTRY_CODE }) {
    const normalizedPhone = String(phone ?? '').trim()
    const normalizedCaptcha = String(captcha ?? '').trim()

    if (!normalizedPhone || !normalizedCaptcha) {
      setError('请输入手机号和验证码')
      return false
    }

    return true
  }

  async function loginAsGuest() {
    state.formLoading = true
    state.error = ''
    state.notice = ''

    try {
      const response = await registerAnonymous({
        timestamp: Date.now(),
        noCookie: true
      })
      saveCookie(response.cookie || state.cookie)
      setAccountState({
        profile: {
          userId: response.userId || response.data?.userId || 'guest',
          nickname: '游客账号',
          avatarUrl: ''
        },
        account: null,
        loginType: 'guest'
      })
      state.loginModalVisible = false
      return true
    } catch (error) {
      console.warn('Failed to login as guest:', error)
      setError(error?.message || '游客登录失败')
      return false
    } finally {
      state.formLoading = false
    }
  }

  async function loginWithCookie(cookie) {
    const normalizedCookie = String(cookie ?? '').trim()

    if (!normalizedCookie) {
      setError('请输入 Cookie')
      return false
    }

    state.formLoading = true
    state.error = ''
    state.notice = ''

    try {
      saveCookie(normalizedCookie)
      const loggedIn = await refreshLoginStatus()

      if (!loggedIn) {
        clearAccountState(true)
        setError('Cookie 无法获取账号信息')
        return false
      }

      syncVipAfterLogin()
      state.loginModalVisible = false
      return true
    } catch (error) {
      console.warn('Failed to login with cookie:', error)
      clearAccountState(true)
      setError(error?.message || 'Cookie 登录失败')
      return false
    } finally {
      state.formLoading = false
    }
  }

  async function refreshCurrentLogin() {
    state.loading = true
    state.error = ''
    state.notice = ''

    try {
      const response = await refreshLogin(createAuthRequestParams({ timestamp: Date.now() }))

      if (response.cookie) {
        saveCookie(mergeCookie(state.cookie, response.cookie))
        saveSession()
      }

      const refreshed = await refreshLoginStatus({ preserveCurrent: true })
      if (refreshed || (state.isLoggedIn && state.loginType !== 'guest')) {
        syncVipAfterLogin()
      }
      state.notice = refreshed ? '登录状态已刷新' : '当前登录已失效'
      return refreshed
    } catch (error) {
      console.warn('Failed to refresh login cookie:', error)
      setError(error?.message || '刷新登录失败')
      return false
    } finally {
      state.loading = false
    }
  }

  async function logout() {
    state.loading = true

    try {
      await requestLogout(createAuthRequestParams({ timestamp: Date.now() }))
    } catch (error) {
      console.warn('Failed to logout:', error)
    } finally {
      clearAccountState(true)
      state.loading = false
    }
  }

  function openLoginModal() {
    state.loginModalVisible = true
    state.error = ''
    state.notice = ''
  }

  function closeLoginModal() {
    state.loginModalVisible = false
    state.error = ''
    state.notice = ''
  }

  return {
    state,
    displayName,
    avatarUrl,
    userId,
    isGuest,
    initAuth,
    refreshLoginStatus,
    refreshCurrentLogin,
    refreshVipStatus,
    claimDailyVip,
    createQrLogin,
    checkQrLogin,
    loginWithCellphone,
    loginWithEmail,
    loginWithCookie,
    sendLoginCaptcha,
    verifyLoginCaptcha,
    loginAsGuest,
    logout,
    openLoginModal,
    closeLoginModal
  }
}

function setAccountState({ profile, account, loginType }) {
  state.profile = profile
  state.account = account
  state.isLoggedIn = Boolean(profile || account)
  state.loginType = state.isLoggedIn ? loginType || 'account' : ''
  state.error = ''

  if (!state.isLoggedIn || state.loginType === 'guest') {
    resetVipState()
  }

  saveSession()
}

function syncVipAfterLogin() {
  return refreshVipStatus()
    .then((active) => {
      if (!active) {
        ensureDailyVipClaim()
      }
    })
    .catch(() => {
      ensureDailyVipClaim()
    })
}

async function refreshVipStatus({ force = false } = {}) {
  if (!state.isLoggedIn || state.loginType === 'guest') {
    resetVipState()
    return false
  }

  if (vipStatusRequest && !force) {
    return vipStatusRequest
  }

  const identity = getVipClaimIdentity()
  state.vip.loading = true
  state.vip.error = ''

  const request = getYouthVipStatus({ timestamp: Date.now() })
    .then((response) => {
      if (!state.isLoggedIn || state.loginType === 'guest' || getVipClaimIdentity() !== identity) {
        return false
      }

      state.vip.raw = response
      state.vip.active = isYouthVipActive(response)
      state.vip.loaded = true
      state.vip.error = ''
      return state.vip.active
    })
    .catch((error) => {
      if (getVipClaimIdentity() === identity) {
        state.vip.error = error?.message || 'VIP 状态获取失败'
        state.vip.loaded = false
      }

      console.warn('Failed to load youth VIP status:', error)
      return false
    })
    .finally(() => {
      if (vipStatusRequest === request) {
        vipStatusRequest = null
        if (getVipClaimIdentity() === identity) {
          state.vip.loading = false
        }
      }
    })

  vipStatusRequest = request
  return request
}

function ensureDailyVipClaim() {
  if (!state.isLoggedIn || state.loginType === 'guest' || state.vip.active) {
    return null
  }

  const receiveDay = getLocalDateString()
  const identity = getVipClaimIdentity()
  const claimRecord = readJsonStorage(STORAGE_KEYS.dailyVipClaim, {})

  if (claimRecord?.date === receiveDay && claimRecord?.identity === identity) {
    return null
  }

  if (dailyVipClaimRequest) {
    return dailyVipClaimRequest
  }

  dailyVipClaimRequest = claimAndUpgradeYouthVip(receiveDay)
    .then((response) => {
      markDailyVipClaim(receiveDay, identity)
      refreshVipStatus({ force: true })
      return response
    })
    .catch((error) => {
      console.warn('Failed to claim daily youth VIP:', error)
      return null
    })
    .finally(() => {
      dailyVipClaimRequest = null
    })

  return dailyVipClaimRequest
}

async function claimDailyVip() {
  if (!state.isLoggedIn || state.loginType === 'guest') {
    openLoginModalFromStore()
    return { ok: false, reason: 'login-required' }
  }

  if (state.vip.active) {
    return { ok: true, active: true, skipped: true }
  }

  if (dailyVipClaimRequest) {
    state.vip.claiming = true
    try {
      const response = await dailyVipClaimRequest
      await refreshVipStatus({ force: true })
      return { ok: true, active: state.vip.active, response }
    } finally {
      state.vip.claiming = false
    }
  }

  const receiveDay = getLocalDateString()
  const identity = getVipClaimIdentity()

  state.vip.claiming = true
  state.vip.error = ''

  try {
    const response = await claimAndUpgradeYouthVip(receiveDay)

    markDailyVipClaim(receiveDay, identity)
    await refreshVipStatus({ force: true })

    return { ok: true, active: state.vip.active, response }
  } catch (error) {
    state.vip.error = error?.message || 'VIP 领取失败'
    console.warn('Failed to claim youth VIP manually:', error)
    return { ok: false, error }
  } finally {
    state.vip.claiming = false
  }
}

async function claimAndUpgradeYouthVip(receiveDay = getLocalDateString()) {
  const dayResponse = await claimYouthDayVip({
    receive_day: receiveDay,
    timestamp: Date.now()
  })
  assertVipStepSucceeded(dayResponse, '领取一天 VIP 失败')

  const upgradeResponse = await upgradeYouthDayVip({
    timestamp: Date.now()
  })
  assertVipStepSucceeded(upgradeResponse, '升级 VIP 失败')

  return {
    day: dayResponse,
    upgrade: upgradeResponse
  }
}

function assertVipStepSucceeded(response, fallbackMessage) {
  const code = firstDefined(response?.code, response?.errcode, response?.err_code, response?.error_code)
  const numericCode = Number(code)

  if (code !== undefined && Number.isFinite(numericCode) && ![0, 1, 200].includes(numericCode)) {
    throw new Error(getApiErrorMessage(response) || fallbackMessage)
  }

  const success = firstDefined(response?.success, response?.succeed)
  if (success === false || String(success).toLowerCase() === 'false') {
    throw new Error(getApiErrorMessage(response) || fallbackMessage)
  }
}

function getApiErrorMessage(response = {}) {
  return firstDefined(response.message, response.msg, response.errmsg, response.error_msg)
}

function clearAccountState(clearCookie) {
  state.profile = null
  state.account = null
  state.isLoggedIn = false
  state.loginType = ''
  state.notice = ''
  resetVipState()
  resetQr()

  if (clearCookie) {
    saveCookie('')
  }

  clearSession()
}

function resetQr() {
  state.qr.key = ''
  state.qr.image = ''
  state.qr.status = 0
  state.qr.message = ''
  state.qr.loading = false
}

function saveCookie(cookie) {
  state.cookie = cookie || ''
  writeStorage(STORAGE_KEYS.neteaseCookie, state.cookie)
}

async function completeLogin(response, loginType) {
  if (response.cookie) {
    saveCookie(response.cookie)
  }

  if (response.profile || response.account) {
    setAccountState({
      profile: response.profile ?? null,
      account: response.account ?? null,
      loginType
    })
    syncVipAfterLogin()
    return true
  }

  const loggedIn = await refreshLoginStatus({ preserveCurrent: state.isLoggedIn })
  if (loggedIn) {
    syncVipAfterLogin()
  }
  return loggedIn
}

function openLoginModalFromStore() {
  state.loginModalVisible = true
  state.error = ''
  state.notice = ''
}

function setError(message) {
  state.error = message
  state.notice = ''
}

function normalizeCountryCode(value) {
  return String(value || DEFAULT_COUNTRY_CODE).replace(/^\+/, '').trim() || DEFAULT_COUNTRY_CODE
}

function readStoredCookie() {
  return readStorage(STORAGE_KEYS.neteaseCookie, '')
}

function readStoredSession(cookie) {
  const session = readJsonStorage(STORAGE_KEYS.neteaseSession, {})

  if (!session || typeof session !== 'object' || session.cookie !== cookie) {
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

  const cookieValues = parseCookie(cookie)

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

  if (cookieValues.dfid) {
    return {
      account: null,
      profile: {
        userId: 'guest',
        nickname: '游客账号',
        avatarUrl: ''
      },
      loginType: 'guest'
    }
  }

  return {}
}

function saveSession() {
  if (!state.cookie || (!state.profile && !state.account)) {
    clearSession()
    return
  }

  writeJsonStorage(STORAGE_KEYS.neteaseSession, {
    cookie: state.cookie,
    account: state.account,
    profile: state.profile,
    loginType: state.loginType || 'account',
    savedAt: Date.now()
  })
}

function clearSession() {
  writeJsonStorage(STORAGE_KEYS.neteaseSession, null)
}

function createAuthRequestParams(params = {}) {
  const cookieValues = parseCookie(state.cookie)
  const fallbackUserId = state.profile?.userId || state.account?.id || ''

  return {
    ...params,
    token: params.token ?? cookieValues.token,
    userid: params.userid ?? cookieValues.userid ?? fallbackUserId,
    dfid: params.dfid ?? cookieValues.dfid
  }
}

function getVipClaimIdentity() {
  const cookieValues = parseCookie(state.cookie)
  return String(
    state.profile?.userId ||
      state.account?.id ||
      cookieValues.userid ||
      cookieValues.token ||
      ''
  )
}

function markDailyVipClaim(receiveDay = getLocalDateString(), identity = getVipClaimIdentity()) {
  writeJsonStorage(STORAGE_KEYS.dailyVipClaim, {
    date: receiveDay,
    identity,
    claimedAt: Date.now()
  })
}

function resetVipState() {
  state.vip.loading = false
  state.vip.claiming = false
  state.vip.loaded = false
  state.vip.active = false
  state.vip.raw = null
  state.vip.error = ''
}

function isYouthVipActive(response = {}) {
  return collectVipStatusObjects(response).some(({ object, nested }) => {
    const explicitValue = firstDefined(
      object.is_vip,
      object.isVip,
      object.is_union_vip,
      object.isUnionVip,
      object.is_youth_vip,
      object.isYouthVip,
      object.vip_status,
      object.vipStatus,
      object.union_vip_status,
      object.unionVipStatus,
      object.youth_vip_status,
      object.youthVipStatus,
      object.vip,
      object.union_vip,
      object.unionVip,
      object.youth_vip,
      object.youthVip
    )

    if (isPositiveVipValue(explicitValue)) {
      return true
    }

    if (nested && isPositiveVipValue(object.status)) {
      return true
    }

    return isFutureVipTime(
      firstDefined(
        object.expire_time,
        object.expireTime,
        object.end_time,
        object.endTime,
        object.vip_end_time,
        object.vipEndTime,
        object.deadline
      )
    )
  })
}

function collectVipStatusObjects(value, nested = false, depth = 0, results = []) {
  if (!value || typeof value !== 'object' || depth > 4) {
    return results
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectVipStatusObjects(item, true, depth + 1, results))
    return results
  }

  results.push({ object: value, nested })

  Object.entries(value).forEach(([key, child]) => {
    if (!child || typeof child !== 'object') {
      return
    }

    if (depth < 2 || /vip|data|info|result|status/i.test(key)) {
      collectVipStatusObjects(child, true, depth + 1, results)
    }
  })

  return results
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '')
}

function isPositiveVipValue(value) {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value > 0
  }

  if (typeof value === 'string') {
    return /^(1|true|yes|y|active|valid|open|opened|vip|已开通|已领取)$/i.test(value.trim())
  }

  return false
}

function isFutureVipTime(value) {
  const time = normalizeVipTime(value)
  return Boolean(time && time > Date.now())
}

function normalizeVipTime(value) {
  if (value === undefined || value === null || value === '') {
    return 0
  }

  if (typeof value === 'string' && /[-/]/.test(value)) {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const number = Number(value)

  if (!Number.isFinite(number) || number <= 0) {
    return 0
  }

  return number < 10000000000 ? number * 1000 : number
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function parseCookie(cookie = '') {
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

function mergeCookie(currentCookie = '', nextCookie = '') {
  const values = {
    ...parseCookie(currentCookie),
    ...parseCookie(nextCookie)
  }

  return Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join(';')
}

function normalizeQrImage(value) {
  if (!value || value.startsWith('data:image')) {
    return value
  }

  return `data:image/png;base64,${value}`
}

function getQrStatusText(code) {
  const statusText = {
    800: '二维码已过期',
    801: '等待扫码',
    802: '请在手机上确认登录',
    803: '登录成功'
  }

  return statusText[code] || '等待登录'
}
