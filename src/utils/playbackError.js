import { isTrialSong, isVipSong } from './songAccess'

export const PLAYBACK_ERROR_CODES = {
  AUTOPLAY_BLOCKED: 'AUTOPLAY_BLOCKED',
  LOCAL_FILE_MISSING: 'LOCAL_FILE_MISSING',
  MEDIA_ERROR: 'MEDIA_ERROR',
  NETWORK: 'NETWORK',
  NO_PLAYBACK_URL: 'NO_PLAYBACK_URL',
  QUALITY_UNAVAILABLE: 'QUALITY_UNAVAILABLE',
  UNKNOWN: 'UNKNOWN'
}

const ERROR_DEFAULTS = {
  [PLAYBACK_ERROR_CODES.AUTOPLAY_BLOCKED]: {
    message: '浏览器阻止了自动播放',
    action: '请手动点击播放按钮',
    recoverable: true
  },
  [PLAYBACK_ERROR_CODES.LOCAL_FILE_MISSING]: {
    message: '本地文件需要重新导入后播放',
    action: '请重新导入这个音频文件',
    recoverable: true
  },
  [PLAYBACK_ERROR_CODES.MEDIA_ERROR]: {
    message: '音频解码或加载失败',
    action: '可以重试或切换下一首',
    recoverable: true
  },
  [PLAYBACK_ERROR_CODES.NETWORK]: {
    message: '播放链接请求失败',
    action: '请检查网络后重试',
    recoverable: true
  },
  [PLAYBACK_ERROR_CODES.NO_PLAYBACK_URL]: {
    message: '当前歌曲暂无可播放链接',
    action: '可以切换音质或播放下一首',
    recoverable: true
  },
  [PLAYBACK_ERROR_CODES.QUALITY_UNAVAILABLE]: {
    message: '当前音质暂无可播放链接',
    action: '请切换其他音质',
    recoverable: true
  },
  [PLAYBACK_ERROR_CODES.UNKNOWN]: {
    message: '播放失败',
    action: '请稍后重试',
    recoverable: true
  }
}

export function createPlaybackError(code, details = {}) {
  const normalizedCode = ERROR_DEFAULTS[code] ? code : PLAYBACK_ERROR_CODES.UNKNOWN
  const defaults = ERROR_DEFAULTS[normalizedCode]
  const accessMessage = getTrackAccessMessage(details.track)
  const error = new Error(details.message || accessMessage || defaults.message)

  error.name = 'PlaybackError'
  error.code = normalizedCode
  error.userMessage = error.message
  error.action = details.action || getTrackAccessAction(details.track) || defaults.action
  error.recoverable = details.recoverable ?? defaults.recoverable
  error.details = {
    ...details,
    code: normalizedCode
  }

  return error
}

export function normalizePlaybackError(error, details = {}) {
  if (error?.name === 'PlaybackError' && error.code) {
    return error
  }

  const inferredCode = inferPlaybackErrorCode(error, details)

  return createPlaybackError(inferredCode, {
    ...details,
    cause: error,
    message: getErrorMessage(error)
  })
}

export function getPlaybackErrorDisplay(error, fallback = ERROR_DEFAULTS[PLAYBACK_ERROR_CODES.UNKNOWN].message) {
  const message = error?.userMessage || error?.message || fallback
  const action = error?.action

  return action ? `${message}，${action}` : message
}

function inferPlaybackErrorCode(error, details = {}) {
  const message = getErrorMessage(error)
  const rawCode = String(error?.code || error?.name || '').toLowerCase()

  if (details.code && ERROR_DEFAULTS[details.code]) {
    return details.code
  }

  if (rawCode.includes('notallowed') || /autoplay|user gesture|用户手势|自动播放/i.test(message)) {
    return PLAYBACK_ERROR_CODES.AUTOPLAY_BLOCKED
  }

  if (
    rawCode.includes('network') ||
    rawCode.includes('timeout') ||
    rawCode.includes('econn') ||
    /network|timeout|timed out|请求失败|网络/i.test(message)
  ) {
    return PLAYBACK_ERROR_CODES.NETWORK
  }

  if (/本地文件|重新导入/.test(message)) {
    return PLAYBACK_ERROR_CODES.LOCAL_FILE_MISSING
  }

  if (/音质/.test(message)) {
    return PLAYBACK_ERROR_CODES.QUALITY_UNAVAILABLE
  }

  if (/暂无可播放|no playback|no playable|url/i.test(message)) {
    return PLAYBACK_ERROR_CODES.NO_PLAYBACK_URL
  }

  return PLAYBACK_ERROR_CODES.UNKNOWN
}

function getErrorMessage(error) {
  return String(error?.message || error || '').trim()
}

function getTrackAccessMessage(track) {
  if (!track || typeof track !== 'object') {
    return ''
  }

  if (isVipSong(track)) {
    return '当前歌曲可能需要 VIP 权限'
  }

  if (isTrialSong(track)) {
    return '当前歌曲可能仅支持试听片段'
  }

  return ''
}

function getTrackAccessAction(track) {
  if (!track || typeof track !== 'object') {
    return ''
  }

  if (isVipSong(track)) {
    return '请登录会员账号、切换音质或播放下一首'
  }

  if (isTrialSong(track)) {
    return '可切换完整版音源或播放下一首'
  }

  return ''
}
