import { COVER_TYPES } from '../../../config/app'
import { normalizeAudioQualities } from '../../../utils/audioQuality'
import { normalizeSongAccess } from '../../../utils/songAccess'

export const UNKNOWN_SONG = '\u672a\u547d\u540d\u6b4c\u66f2'
export const UNKNOWN_ARTIST = '\u672a\u77e5\u6b4c\u624b'
export const UNKNOWN_ALBUM = '\u672a\u77e5\u4e13\u8f91'
export const RADIO_CREATOR = '\u9177\u72d7\u7535\u53f0'
export const RADIO_CATEGORY = '\u7535\u53f0'

export function uniqueSongs(songs = []) {
  const seenIds = new Set()

  return songs.filter((song) => {
    const id = String(song?.id ?? '')

    if (!id || seenIds.has(id)) {
      return false
    }

    seenIds.add(id)
    return true
  })
}

export function uniqueValues(items = []) {
  return [...new Set(items.filter((item) => item !== undefined && item !== null && item !== '').map(String))]
}

export function asArray(value) {
  return Array.isArray(value) ? value : []
}

export function splitKugouSongName(value = '') {
  const text = String(value ?? '').trim()
  const separator = text.indexOf(' - ')

  if (separator < 0) {
    return {
      artist: '',
      name: text
    }
  }

  return {
    artist: text.slice(0, separator).trim(),
    name: text.slice(separator + 3).trim()
  }
}

export function normalizeKugouMediaUrl(url, size = 480) {
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
    return `https://imge.kugou.com/fmlogo/${size}/${value}`
  }

  return value.replace('{size}', String(size))
}

export function cleanRadioTitle(value) {
  return String(value ?? '').replace(/^(\u64ad\u5ba2|\u7535\u53f0|FM)[:\uff1a]\s*/i, '').trim()
}

export function parseCountText(value) {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value !== 'string') {
    return 0
  }

  const match = value.match(/([\d.]+)\s*(\u4ebf|\u4e07)?/)

  if (!match) {
    return 0
  }

  const number = Number(match[1])

  if (!Number.isFinite(number)) {
    return 0
  }

  if (match[2] === '\u4ebf') {
    return Math.round(number * 100000000)
  }

  if (match[2] === '\u4e07') {
    return Math.round(number * 10000)
  }

  return number
}

export function getSatiCategoryName(tag) {
  const names = {
    RCMD: '\u70ed\u95e8',
    sleep: '\u52a9\u7720',
    meditation: '\u51a5\u60f3',
    starGoodNight: '\u660e\u661f\u54c4\u7761',
    lightmusic: '\u8f7b\u97f3\u4e50',
    goodnightStory: '\u665a\u5b89\u6545\u4e8b',
    dokodemo: '\u4efb\u610f\u95e8',
    cloudStudyRoom: '\u4e91\u4e0a\u81ea\u4e60\u5ba4',
    relax: '\u89e3\u538b',
    naturalMusic: '\u7a7a\u7075\u4e50\u5668'
  }

  return names[tag] || '\u58f0\u97f3\u8d44\u6e90'
}

export function getRadioDescription(title = '', category = '') {
  const prefix = category ? `${category}\u91cc\u7684` : ''

  return `${prefix}${title}\uff0c\u6309\u9177\u72d7\u7535\u53f0\u5b9e\u65f6\u6b4c\u5355\u8fde\u7eed\u64ad\u653e\u3002`
}

export function getRadioPreviewSongs(source = {}) {
  const candidates = [
    source.rcmdlist,
    source.songlist,
    source.songs,
    source.song_info ? [source.song_info] : null
  ]

  return candidates.find((item) => Array.isArray(item)) ?? []
}

export function getArtistNames(artists = []) {
  return artists.map((artist) => artist.name).filter(Boolean).join(' / ')
}

export function getArtistIds(artists = []) {
  return artists
    .map((artist) => artist.id)
    .filter((id) => id !== undefined && id !== null && id !== '')
}

export function getKugouTrackMeta(song = {}) {
  const access = normalizeSongAccess(song)

  return {
    hash: song.hash || song.file_hash || song.audio_hash || song.hash_128 || song['128hash'] || '',
    album_audio_id: song.album_audio_id ?? song.mixsongid ?? song.add_mixsongid ?? song.audio_id ?? '',
    mixsongid: song.mixsongid ?? song.add_mixsongid ?? song.album_audio_id ?? '',
    album_id: song.album_id ?? song.album?.id ?? song.al?.id ?? '',
    audio_id: song.audio_id ?? song.rp_id ?? '',
    qualities: normalizeAudioQualities(song),
    fee: access.fee,
    vip: access.vip,
    accessType: access.accessType,
    accessBadges: access.badges,
    songAccess: access
  }
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

export function formatRadioDuration(duration = 0) {
  const value = Number(duration)

  if (!Number.isFinite(value) || value <= 0) {
    return '0:00'
  }

  return formatDuration(value > 0 && value < 10000 ? value * 1000 : value)
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
