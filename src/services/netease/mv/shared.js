import { COVER_TYPES } from '../../../config/app'

export const MV_DEFAULT_AREA = '\u5168\u90e8'
export const MV_DEFAULT_TYPE = '\u5168\u90e8'
export const MV_DEFAULT_ORDER = '\u4e0a\u5347\u6700\u5feb'
export const UNKNOWN_ARTIST = '\u672a\u77e5\u827a\u4eba'
export const UNKNOWN_MV = '\u672a\u547d\u540d MV'

export function getArtistNames(artists = []) {
  return artists.map((artist) => artist.name).filter(Boolean).join(' / ')
}

export function coverType(index) {
  return COVER_TYPES[Math.abs(Number(index) || 0) % COVER_TYPES.length]
}

export function resizeNeteaseImage(url, size) {
  if (typeof url === 'string' && url.includes('{size}')) {
    return url.replace('{size}', String(size))
  }

  if (!url || !/music\.126\.net/.test(url)) {
    return url
  }

  const param = `param=${size}y${size}`

  if (/[?&]param=\d+y\d+/.test(url)) {
    return url.replace(/([?&])param=\d+y\d+/, `$1${param}`)
  }

  return `${url}${url.includes('?') ? '&' : '?'}${param}`
}

export function formatDuration(duration = 0) {
  const totalSeconds = Math.round(duration / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')

  return `${minutes}:${seconds}`
}

export function formatPlayCount(count = 0) {
  if (count >= 100000000) {
    return `${trimNumber(count / 100000000)}\u4ebf`
  }

  if (count >= 10000) {
    return `${trimNumber(count / 10000)}\u4e07`
  }

  return String(count)
}

export function trimNumber(number) {
  return Number(number.toFixed(1)).toString()
}

export function formatPlainDate(value) {
  if (!value) {
    return ''
  }

  if (typeof value === 'string' && /^\d{4}-\d{1,2}-\d{1,2}/.test(value)) {
    return value.slice(0, 10)
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${date.getFullYear()}-${month}-${day}`
}
