import http from '../../http'

function getKugouAuth(path, params = {}, config = {}) {
  const requestParams = normalizeAuthParams(path, params)

  return http.get(path, {
    ...config,
    noCookie: config.noCookie ?? params.noCookie,
    params: requestParams
  }).then((payload) => attachKugouParams(parseKugouPayload(payload), requestParams))
}

function normalizeAuthParams(path, params = {}) {
  const normalized = { ...params }

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

  delete normalized.noCookie

  return normalized
}

function parseKugouPayload(payload) {
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

function attachKugouParams(payload, params = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload
  }

  return {
    ...payload,
    params
  }
}

function firstObject(...values) {
  return values.find((value) => value && typeof value === 'object' && !Array.isArray(value)) ?? {}
}

function normalizeKugouImage(url, size = 480) {
  if (typeof url !== 'string') {
    return ''
  }

  const value = url.trim()

  if (!value) {
    return ''
  }

  if (value.startsWith('//')) {
    return `https:${value}`.replace('{size}', String(size))
  }

  if (/^https?:\/\//i.test(value)) {
    return value.replace('{size}', String(size))
  }

  if (/^[\w.-]+\.(?:jpe?g|png|webp|gif)$/i.test(value)) {
    return `https://imge.kugou.com/stdmusic/${size}/${value}`
  }

  return value.replace('{size}', String(size))
}

function toLoginProfileResponse(response = {}) {
  const data = response.data ?? response
  const user = firstObject(data.user, data.profile, data)
  const userId = user.userid ?? user.user_id ?? user.id ?? data.userid ?? data.user_id ?? response.userid ?? ''
  const nickname = user.nickname ?? user.username ?? user.user_name ?? data.nickname ?? '酷狗用户'
  const avatarUrl = normalizeKugouImage(
    user.pic || user.avatar || user.avatarUrl || user.user_pic || data.pic,
    240
  )
  const token = data.token ?? user.token ?? response.token ?? ''
  const dfid = data.dfid ?? user.dfid ?? response.dfid ?? ''
  const cookie = response.cookie || [
    token ? `token=${token}` : '',
    userId ? `userid=${userId}` : '',
    dfid ? `dfid=${dfid}` : ''
  ].filter(Boolean).join(';')

  return {
    ...response,
    cookie,
    account: userId ? {
      id: userId,
      userName: nickname
    } : null,
    profile: userId ? {
      userId,
      nickname,
      avatarUrl
    } : null,
    data: {
      ...data,
      account: userId ? {
        id: userId,
        userName: nickname
      } : null,
      profile: userId ? {
        userId,
        nickname,
        avatarUrl
      } : null
    }
  }
}

function toQrKeyResponse(response = {}) {
  const data = response.data ?? response

  return {
    ...response,
    data: {
      ...data,
      unikey: data.key || data.qrcode || data.uuid || data.unikey || ''
    }
  }
}

function toQrCreateResponse(response = {}) {
  const data = response.data ?? response

  return {
    ...response,
    data: {
      ...data,
      qrimg: data.qrcode_img || data.qrimg || data.base64 || ''
    }
  }
}

function toQrCheckResponse(response = {}) {
  const data = response.data ?? {}
  const rawCode = Number(
    data.status ??
      data.code ??
      response.status ??
      (data.token || response.token ? 4 : response.code) ??
      0
  )
  const codeMap = {
    0: 800,
    1: 801,
    2: 802,
    4: 803
  }

  return {
    ...toLoginProfileResponse(response),
    code: codeMap[rawCode] ?? rawCode,
    message: response.message || response.msg || response.errmsg || ''
  }
}

export const getLoginStatus = (params = {}) => getKugouAuth('/user/detail', params).then(toLoginProfileResponse)

export const loginByCellphone = (params = {}) => {
  if (params.password && !params.captcha && !params.code) {
    return getKugouAuth('/login', {
      username: params.phone ?? params.mobile,
      password: params.password,
      ...params
    }).then(toLoginProfileResponse)
  }

  return getKugouAuth('/login/cellphone', params).then(toLoginProfileResponse)
}

export const loginByEmail = (params = {}) =>
  getKugouAuth('/login', { username: params.email, ...params }).then(toLoginProfileResponse)

export const registerAnonymous = (params = {}) =>
  getKugouAuth('/register/dev', params).then((response) => {
    const data = response.data ?? response
    const dfid = data.dfid ?? response.dfid ?? ''

    return {
      ...response,
      userId: '',
      cookie: dfid ? `dfid=${dfid}` : '',
      data: {
        ...data,
        userId: ''
      }
    }
  })

export const refreshLogin = (params = {}) => getKugouAuth('/login/token', params).then(toLoginProfileResponse)
export const sendCaptcha = (params = {}) => getKugouAuth('/captcha/sent', params)
export const verifyCaptcha = (params = {}) => getKugouAuth('/login/cellphone', params)
export const getLoginQrKey = (params = {}) => getKugouAuth('/login/qr/key', params).then(toQrKeyResponse)
export const getLoginQrCreate = (params = {}) => getKugouAuth('/login/qr/create', params).then(toQrCreateResponse)
export const getLoginQrCheck = (params = {}) =>
  getKugouAuth('/login/qr/check', params, { acceptCodes: [0, 1, 2, 4, 200] }).then(toQrCheckResponse)
export const getUserAccount = (params = {}) => getKugouAuth('/user/detail', params).then(toLoginProfileResponse)
export const claimYouthDayVip = (params = {}) => getKugouAuth('/youth/day/vip', params)
export const upgradeYouthDayVip = (params = {}) => getKugouAuth('/youth/day/vip/upgrade', params)
export const getYouthVipStatus = (params = {}) => getKugouAuth('/youth/union/vip', params)
export const logout = (params = {}) => getKugouAuth('/login/token', params)
