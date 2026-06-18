const VIP_BADGE = {
  value: 'vip',
  label: 'VIP歌曲',
  badgeLabel: 'VIP'
}

const TRIAL_BADGE = {
  value: 'trial',
  label: '试听片段',
  badgeLabel: '试听'
}

const FEE_FIELD_PATHS = [
  'fee',
  'Fee',
  'feetype',
  'feeType',
  'FeeType',
  'fee_type',
  'pay_type',
  'payType',
  'PayType',
  'paytype',
  'price',
  'pkg_price',
  'pkgPrice',
  'rebuy_pay_type',
  'rebuyPayType',
  'trans_param.pay_type',
  'trans_param.payType',
  'trans_param.pay_block_tpl',
  'trans_param.payBlockTpl',
  'trans_param.musicpack_advance',
  'audio_info.pay_type',
  'audioInfo.payType',
  'info.pay_type',
  'privilege.fee',
  'privilege.pay_type',
  'privilege.payType',
  'privilege.feetype',
  'privilege.need_pay',
  'privilege.needPay'
]

const VIP_FIELD_PATHS = [
  'vip',
  'is_vip',
  'isVip',
  'vip_type',
  'vipType',
  'is_vip_audio',
  'isVipAudio',
  'is_vip_song',
  'isVipSong',
  'vip_audio',
  'vipAudio',
  'musicpack',
  'musicpack_advance',
  'trans_param.vip_type',
  'trans_param.vipType',
  'trans_param.musicpack_advance',
  'privilege.vip',
  'privilege.is_vip',
  'privilege.isVip'
]

const TRIAL_FIELD_PATHS = [
  'free_part',
  'freePart',
  'is_free_part',
  'isFreePart',
  'trial',
  'is_trial',
  'isTrial',
  'audition',
  'listen_part',
  'listenPart',
  'trans_param.free_part',
  'trans_param.freePart',
  'trans_param.hash_offset',
  'trans_param.hashOffset'
]

const FALSE_TEXT = new Set(['0', 'false', 'no', 'n', 'off', 'free', 'none', 'null', 'undefined'])

export function normalizeSongAccess(source = {}) {
  const fee = getSongFeeValue(source)
  const paid = hasPaidSignal(source)
  const vip = isVipSong(source)
  const trial = !vip && isTrialSong(source)
  const accessType = vip ? 'vip' : trial ? 'trial' : paid ? 'paid' : 'free'

  return {
    fee,
    paid,
    vip,
    trial,
    accessType,
    badges: getSongAccessBadges({ ...source, vip, accessType })
  }
}

export function getSongAccessBadges(source = {}) {
  if (!source || typeof source !== 'object') {
    return []
  }

  const explicitBadges = normalizeAccessBadges(source.accessBadges ?? source.songAccess?.badges)

  if (explicitBadges.length) {
    return explicitBadges
  }

  if (isVipSong(source)) {
    return [VIP_BADGE]
  }

  if (isTrialSong(source)) {
    return [TRIAL_BADGE]
  }

  return []
}

function normalizeAccessBadges(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((badge) => {
      const badgeValue = typeof badge === 'string' ? badge : badge?.value

      if (badgeValue === 'vip') {
        return VIP_BADGE
      }

      if (badgeValue === 'trial') {
        return TRIAL_BADGE
      }

      return null
    })
    .filter(Boolean)
}

export function isVipSong(source = {}) {
  if (!source || typeof source !== 'object') {
    return false
  }

  if (hasTruthySignal(source, VIP_FIELD_PATHS)) {
    return true
  }

  return hasPaidSignal(source)
}

export function isTrialSong(source = {}) {
  return hasTruthySignal(source, TRIAL_FIELD_PATHS)
}

export function getSongFeeValue(source = {}) {
  const value = firstPresentPathValue(source, FEE_FIELD_PATHS)

  return value === undefined ? 0 : value
}

function hasPaidSignal(source = {}) {
  if (hasPositiveSignal(source, FEE_FIELD_PATHS)) {
    return true
  }

  const privilege = readPath(source, 'privilege') ?? readPath(source, 'Privilege')

  if (typeof privilege === 'string') {
    return /vip|pay|paid|fee|charge|member|会员|付费|收费/i.test(privilege)
  }

  return false
}

function hasPositiveSignal(source, paths) {
  return paths.some((path) => isPositiveAccessValue(readPath(source, path)))
}

function hasTruthySignal(source, paths) {
  return paths.some((path) => isTruthyAccessValue(readPath(source, path)))
}

function firstPresentPathValue(source, paths) {
  for (const path of paths) {
    const value = readPath(source, path)

    if (isPresentValue(value)) {
      return value
    }
  }

  return undefined
}

function isPositiveAccessValue(value) {
  if (!isPresentValue(value)) {
    return false
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0
  }

  if (typeof value === 'string') {
    const text = value.trim()
    const normalized = text.toLowerCase()
    const number = Number(text)

    if (FALSE_TEXT.has(normalized)) {
      return false
    }

    if (Number.isFinite(number)) {
      return number > 0
    }

    return /vip|pay|paid|fee|charge|member|会员|付费|收费/i.test(text)
  }

  if (typeof value === 'object') {
    return Object.values(value).some(isPositiveAccessValue)
  }

  return false
}

function isTruthyAccessValue(value) {
  if (!isPresentValue(value)) {
    return false
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0
  }

  if (typeof value === 'string') {
    const text = value.trim()
    const normalized = text.toLowerCase()
    const number = Number(text)

    if (FALSE_TEXT.has(normalized)) {
      return false
    }

    return Number.isFinite(number) ? number > 0 : Boolean(text)
  }

  if (typeof value === 'object') {
    return Object.values(value).some(isTruthyAccessValue)
  }

  return Boolean(value)
}

function readPath(source, path) {
  return String(path)
    .split('.')
    .reduce((value, key) => (value && typeof value === 'object' ? value[key] : undefined), source)
}

function isPresentValue(value) {
  return value !== undefined && value !== null && value !== ''
}
