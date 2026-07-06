import {
  claimYouthDayVip,
  getYouthVipStatus,
  upgradeYouthDayVip
} from '../../api/modules/netease'

export function getYouthVipStatusData(params = {}) {
  return getYouthVipStatus(params)
}

export async function claimAndUpgradeYouthVipData({ receiveDay = getLocalDateString(), params = {} } = {}) {
  const dayResponse = await claimYouthDayVip({
    receive_day: receiveDay,
    ...params
  })
  assertVipStepSucceeded(dayResponse, '领取一天 VIP 失败')

  const upgradeResponse = await upgradeYouthDayVip(params)
  assertVipStepSucceeded(upgradeResponse, '升级 VIP 失败')

  return {
    day: dayResponse,
    upgrade: upgradeResponse
  }
}

export function isYouthVipActive(response = {}) {
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

export function shouldClaimYouthVipForDate(response = {}, receiveDay = getLocalDateString()) {
  const expireDate = getYouthVipExpireDate(response)

  if (!expireDate) {
    return true
  }

  return expireDate <= receiveDay
}

export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getYouthVipExpireDate(response = {}) {
  return collectVipStatusObjects(response)
    .map(({ object }) =>
      normalizeVipDate(
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
    )
    .filter(Boolean)
    .sort()
    .at(-1) || ''
}

function normalizeVipDate(value) {
  const time = normalizeVipTime(value)
  return time ? getLocalDateString(new Date(time)) : ''
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
