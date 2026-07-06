import { computed, reactive } from 'vue'
import {
  checkQrLoginData,
  createQrLoginData,
  getLoginStatusData,
  getUserAccountData,
  loginWithCellphoneData,
  loginWithEmailData,
  logoutData,
  refreshLoginData,
  sendLoginCaptchaData
} from '../services/auth/login'
import { DEFAULT_COUNTRY_CODE } from '../config/app'
import {
  buildAuthRequestParams,
  clearStoredSession,
  getAuthIdentity,
  mergeAuthCookieString,
  readDailyVipAutoStatusCheck,
  parseAuthCookie,
  readDailyVipClaim,
  readInitialAuthSession,
  saveStoredSession,
  writeAuthCookie,
  writeDailyVipAutoStatusCheck,
  writeDailyVipClaim
} from '../services/auth/session'
import {
  claimAndUpgradeYouthVipData,
  getLocalDateString,
  getYouthVipStatusData,
  isYouthVipActive,
  shouldClaimYouthVipForDate
} from '../services/auth/vip'

const initialAuth = readInitialAuthSession()
const storedAuth = initialAuth.auth
const storedCookie = initialAuth.cookie
const initialSession = initialAuth.session
const hasInitialSession = initialAuth.hasSession

const state = reactive({
  initialized: false,
  loading: false,
  formLoading: false,
  captchaLoading: false,
  loginModalVisible: false,
  isLoggedIn: hasInitialSession,
  loginType: hasInitialSession ? initialSession.loginType || 'account' : '',
  account: hasInitialSession ? initialSession.account : null,
  profile: hasInitialSession ? initialSession.profile : null,
  auth: storedAuth,
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
  if (state.loginType === 'guest') {
    clearAccountState(false)
  }

  const displayName = computed(() =>
    state.profile?.nickname || state.account?.userName || '点击登录'
  )
  const avatarUrl = computed(() => state.profile?.avatarUrl || '')
  const userId = computed(() => state.profile?.userId || state.account?.id || '')
  const isGuest = computed(() => state.loginType === 'guest')

  async function initAuth() {
    if (state.loginType === 'guest') {
      clearAccountState(false)
    }

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
      const response = await getLoginStatusData(createAuthRequestParams({ timestamp: Date.now() }))
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
      const response = await getUserAccountData(createAuthRequestParams({ timestamp: Date.now() }))

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
      const qr = await createQrLoginData()

      state.qr.key = qr.key
      state.qr.image = qr.image
      state.qr.status = qr.status
      state.qr.message = qr.message
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
      const response = await checkQrLoginData(state.qr.key)
      state.qr.status = response.status
      state.qr.message = response.statusText

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
      const response = await loginWithCellphoneData({
        phone: normalizedPhone,
        countrycode: normalizeCountryCode(countrycode),
        password: normalizedCaptcha ? undefined : normalizedPassword,
        captcha: normalizedCaptcha || undefined,
        userid: normalizedUserId || undefined
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
      const response = await loginWithEmailData({
        email: normalizedEmail,
        password: normalizedPassword
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
      await sendLoginCaptchaData({
        phone: normalizedPhone,
        countrycode: normalizeCountryCode(countrycode)
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
      const response = await refreshLoginData(createAuthRequestParams({ timestamp: Date.now() }))

      if (response.cookie) {
        saveCookie(mergeAuthCookieString(state.cookie, response.cookie))
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
      await logoutData(createAuthRequestParams({ timestamp: Date.now() }))
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
    mergeAuthCookie,
    sendLoginCaptcha,
    verifyLoginCaptcha,
    logout,
    openLoginModal,
    closeLoginModal
  }
}

function setAccountState({ profile, account, loginType }) {
  const isGuestLogin = loginType === 'guest'

  state.profile = isGuestLogin ? null : profile
  state.account = isGuestLogin ? null : account
  state.isLoggedIn = !isGuestLogin && Boolean(state.profile || state.account)
  state.loginType = state.isLoggedIn ? loginType || 'account' : ''
  state.error = ''

  if (!state.isLoggedIn || state.loginType === 'guest') {
    resetVipState()
  }

  saveSession()
}

function syncVipAfterLogin() {
  return refreshVipStatus({ automatic: true })
    .catch(() => false)
    .then(() => ensureDailyVipClaim())
    .catch(() => {
      ensureDailyVipClaim()
    })
}

async function refreshVipStatus({ force = false, automatic = false } = {}) {
  if (!state.isLoggedIn || state.loginType === 'guest') {
    resetVipState()
    return false
  }

  const receiveDay = getLocalDateString()
  const identity = getVipClaimIdentity()

  if (vipStatusRequest && (automatic || !force)) {
    return vipStatusRequest
  }

  const autoStatusRecord = automatic ? getDailyVipAutoStatusCheck(receiveDay, identity) : null

  if (automatic && !force && autoStatusRecord) {
    if (restoreVipStatusFromAutoCheck(autoStatusRecord)) {
      return state.vip.active
    }

    if (Number(autoStatusRecord.version) >= 2) {
      return state.vip.active
    }
  }

  if (automatic) {
    markDailyVipAutoStatusCheck(receiveDay, identity)
  }

  state.vip.loading = true
  state.vip.error = ''

  const request = getYouthVipStatusData(createAuthRequestParams({ timestamp: Date.now() }))
    .then((response) => {
      if (!state.isLoggedIn || state.loginType === 'guest' || getVipClaimIdentity() !== identity) {
        return false
      }

      const active = isYouthVipActive(response)

      state.vip.raw = response
      state.vip.active = active
      state.vip.loaded = true
      state.vip.error = ''

      if (automatic) {
        markDailyVipAutoStatusCheck(receiveDay, identity, {
          active,
          raw: response,
          loaded: true
        })
      }

      return active
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
  if (!state.isLoggedIn || state.loginType === 'guest') {
    return null
  }

  const receiveDay = getLocalDateString()
  const identity = getVipClaimIdentity()
  const claimRecord = readDailyVipClaim()

  if (claimRecord?.date === receiveDay && claimRecord?.identity === identity) {
    return null
  }

  if (!shouldClaimYouthVipForDate(state.vip.raw, receiveDay)) {
    markDailyVipClaim(receiveDay, identity)
    return null
  }

  if (dailyVipClaimRequest) {
    return dailyVipClaimRequest
  }

  dailyVipClaimRequest = claimAndUpgradeYouthVipData({
    receiveDay,
    params: createAuthRequestParams({ timestamp: Date.now() })
  })
    .then((response) => {
      markDailyVipClaim(receiveDay, identity)
      refreshVipStatus({ force: true, automatic: true })
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

async function claimDailyVip({ skipIfActive = true } = {}) {
  if (!state.isLoggedIn || state.loginType === 'guest') {
    openLoginModalFromStore()
    return { ok: false, reason: 'login-required' }
  }

  if (skipIfActive && state.vip.active) {
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
    const response = await claimAndUpgradeYouthVipData({
      receiveDay,
      params: createAuthRequestParams({ timestamp: Date.now() })
    })

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
  const nextAuth = writeAuthCookie(state.auth, cookie)

  state.auth = nextAuth.auth
  state.cookie = nextAuth.cookie
}

function mergeAuthCookie(cookie) {
  if (!cookie) {
    return state.cookie
  }

  saveCookie(mergeAuthCookieString(state.cookie, cookie))
  saveSession()
  return state.cookie
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

function saveSession() {
  if (!state.cookie || state.loginType === 'guest' || (!state.profile && !state.account)) {
    clearSession()
    return
  }

  saveStoredSession({
    cookie: state.cookie,
    auth: state.auth,
    account: state.account,
    profile: state.profile,
    loginType: state.loginType || 'account'
  })
}

function clearSession() {
  clearStoredSession()
}

function createAuthRequestParams(params = {}) {
  return buildAuthRequestParams(state, params)
}

function getVipClaimIdentity() {
  return getAuthIdentity(state)
}

function markDailyVipClaim(receiveDay = getLocalDateString(), identity = getVipClaimIdentity()) {
  writeDailyVipClaim({
    date: receiveDay,
    identity
  })
}

function getDailyVipAutoStatusCheck(
  receiveDay = getLocalDateString(),
  identity = getVipClaimIdentity()
) {
  const statusRecord = readDailyVipAutoStatusCheck()

  if (statusRecord?.date === receiveDay && statusRecord?.identity === identity) {
    return statusRecord
  }

  return null
}

function markDailyVipAutoStatusCheck(
  receiveDay = getLocalDateString(),
  identity = getVipClaimIdentity(),
  status = {}
) {
  writeDailyVipAutoStatusCheck({
    date: receiveDay,
    identity,
    ...status
  })
}

function restoreVipStatusFromAutoCheck(statusRecord = {}) {
  if (statusRecord.loaded !== true) {
    return false
  }

  state.vip.raw = statusRecord.raw ?? null
  state.vip.active = Boolean(statusRecord.active)
  state.vip.loaded = true
  state.vip.error = ''
  return true
}

function resetVipState() {
  state.vip.loading = false
  state.vip.claiming = false
  state.vip.loaded = false
  state.vip.active = false
  state.vip.raw = null
  state.vip.error = ''
}

function parseCookie(cookie = '') {
  return parseAuthCookie(cookie)
}
