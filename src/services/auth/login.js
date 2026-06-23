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
  sendCaptcha
} from '../../api/modules/netease'

export function getLoginStatusData(params = {}) {
  return getLoginStatus(params)
}

export function getUserAccountData(params = {}) {
  return getUserAccount(params)
}

export async function createQrLoginData() {
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

  return {
    key,
    image: normalizeQrImage(qrResponse.data?.qrimg || ''),
    status: 801,
    message: getQrStatusText(801)
  }
}

export async function checkQrLoginData(key) {
  const response = await getLoginQrCheck({
    key,
    timestamp: Date.now(),
    noCookie: true
  })

  return {
    ...response,
    status: response.code,
    statusText: response.message || getQrStatusText(response.code)
  }
}

export function loginWithCellphoneData(params = {}) {
  return loginByCellphone({
    ...params,
    timestamp: Date.now(),
    noCookie: true
  })
}

export function loginWithEmailData(params = {}) {
  return loginByEmail({
    ...params,
    timestamp: Date.now(),
    noCookie: true
  })
}

export function sendLoginCaptchaData(params = {}) {
  return sendCaptcha({
    ...params,
    timestamp: Date.now(),
    noCookie: true
  })
}

export function refreshLoginData(params = {}) {
  return refreshLogin(params)
}

export function logoutData(params = {}) {
  return requestLogout(params)
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
