import { computed, reactive } from 'vue'
import {
  loginByCellphone,
  loginByEmail,
  getLoginQrCheck,
  getLoginQrCreate,
  getLoginQrKey,
  getLoginStatus,
  getUserAccount,
  refreshLogin,
  registerAnonymous,
  sendCaptcha,
  verifyCaptcha,
  logout as requestLogout
} from '../api/modules/netease'
import { DEFAULT_COUNTRY_CODE, STORAGE_KEYS } from '../config/app'
import { readStorage, writeStorage } from '../utils/storage'

const state = reactive({
  initialized: false,
  loading: false,
  formLoading: false,
  captchaLoading: false,
  loginModalVisible: false,
  isLoggedIn: false,
  loginType: '',
  account: null,
  profile: null,
  cookie: readStoredCookie(),
  error: '',
  notice: '',
  qr: {
    loading: false,
    key: '',
    image: '',
    status: 0,
    message: ''
  }
})

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
      await refreshLoginStatus()
    } finally {
      state.initialized = true
      state.loading = false
    }
  }

  async function refreshLoginStatus() {
    try {
      const response = await getLoginStatus({
        timestamp: Date.now()
      })
      const data = response.data ?? response
      const profile = data.profile ?? null
      const account = data.account ?? null

      if (profile || account) {
        setAccountState({ profile, account, loginType: 'account' })
        return true
      }

      if (state.cookie) {
        return await loadUserAccount()
      }

      clearAccountState(false)
      return false
    } catch (error) {
      console.warn('Failed to refresh login status:', error)
      if (state.cookie) {
        return await loadUserAccount()
      }

      clearAccountState(false)
      return false
    }
  }

  async function loadUserAccount() {
    try {
      const response = await getUserAccount({ timestamp: Date.now() })

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

    clearAccountState(false)
    return false
  }

  async function createQrLogin() {
    state.qr.loading = true
    state.error = ''

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
      state.qr.image = qrResponse.data?.qrimg || ''
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
        await completeLogin(response, 'account')
        state.loginModalVisible = false
      }

      return response.code
    } catch (error) {
      console.warn('Failed to check QR login:', error)
      state.error = '二维码状态检查失败'
      return 0
    }
  }

  async function loginWithCellphone({ phone, countrycode = DEFAULT_COUNTRY_CODE, password = '', captcha = '' }) {
    const normalizedPhone = String(phone ?? '').trim()
    const normalizedPassword = String(password ?? '')
    const normalizedCaptcha = String(captcha ?? '').trim()

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
        timestamp: Date.now(),
        noCookie: true
      })
      await completeLogin(response, 'account')
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
      setError('请输入邮箱和密码')
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
      await completeLogin(response, 'account')
      state.loginModalVisible = false
      return true
    } catch (error) {
      console.warn('Failed to login with email:', error)
      setError(error?.message || '邮箱登录失败')
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
        ctcode: normalizeCountryCode(countrycode),
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

    try {
      await verifyCaptcha({
        phone: normalizedPhone,
        captcha: normalizedCaptcha,
        ctcode: normalizeCountryCode(countrycode),
        timestamp: Date.now(),
        noCookie: true
      })
      return true
    } catch (error) {
      console.warn('Failed to verify captcha:', error)
      setError(error?.message || '验证码校验失败')
      return false
    }
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
          userId: response.userId || response.data?.userId || '',
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
        saveCookie('')
        setError('Cookie 无法获取账号信息')
        return false
      }

      state.loginModalVisible = false
      return true
    } catch (error) {
      console.warn('Failed to login with cookie:', error)
      saveCookie('')
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
      const response = await refreshLogin({
        timestamp: Date.now()
      })

      if (response.cookie) {
        saveCookie(response.cookie)
      }

      const refreshed = await refreshLoginStatus()
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
      await requestLogout({ timestamp: Date.now() })
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
}

function clearAccountState(clearCookie) {
  state.profile = null
  state.account = null
  state.isLoggedIn = false
  state.loginType = ''
  state.notice = ''
  resetQr()

  if (clearCookie) {
    saveCookie('')
  }
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
  saveCookie(response.cookie || state.cookie)

  if (response.profile || response.account) {
    setAccountState({
      profile: response.profile ?? null,
      account: response.account ?? null,
      loginType
    })
    return true
  }

  return await refreshLoginStatus()
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

function getQrStatusText(code) {
  const statusText = {
    800: '二维码已过期',
    801: '等待扫码',
    802: '请在手机上确认登录',
    803: '登录成功'
  }

  return statusText[code] || '等待登录'
}
