import { computed, reactive } from 'vue'
import {
  getLoginQrCheck,
  getLoginQrCreate,
  getLoginQrKey,
  getLoginStatus,
  getUserAccount,
  loginByCellphone,
  loginByEmail,
  logout as requestLogout,
  refreshLogin,
  registerAnonymous,
  sendCaptcha
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
    if (!state.cookie) {
      clearAccountState(false)
      return false
    }

    try {
      const response = await getLoginStatus({ timestamp: Date.now() })
      const data = response.data ?? response
      const profile = response.profile ?? data.profile ?? null
      const account = response.account ?? data.account ?? null

      if (profile || account) {
        setAccountState({ profile, account, loginType: 'account' })
        return true
      }

      return await loadUserAccount()
    } catch (error) {
      console.warn('Failed to refresh login status:', error)
      return await loadUserAccount()
    }
  }

  async function loadUserAccount() {
    if (!state.cookie) {
      clearAccountState(false)
      return false
    }

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
      const response = await refreshLogin({ timestamp: Date.now() })

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
  if (response.cookie) {
    saveCookie(response.cookie)
  }

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
