import { COVER_TYPES } from '../../../config/app'
import { normalizeAudioQualities } from '../../../utils/audioQuality'
import { getMvRouteMeta } from '../../../utils/mv'
import { normalizeSongAccess } from '../../../utils/songAccess'

export function firstPresentValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '')
}

export function firstArrayValue(...values) {
  return values.find((value) => Array.isArray(value)) ?? []
}

export function normalizePlaylistUserId(value = '') {
  return String(value ?? '').trim()
}

export function normalizePlaylistTimestamp(value, fallback = Date.now()) {
  const number = Number(value)

  if (Number.isFinite(number) && number > 0) {
    return number < 10000000000 ? number * 1000 : number
  }

  const parsed = Date.parse(value)

  return Number.isFinite(parsed) ? parsed : fallback
}

export function isKugouCollectionId(id) {
  return /^collection_/i.test(String(id ?? ''))
}

export function canLoadRemotePlaylistDetail(id, listid = '') {
  const playlistId = String(id ?? '')

  return isKugouCollectionId(playlistId) || (!listid && /^\d+$/.test(playlistId))
}

export function getArtistIds(artists = []) {
  return artists
    .map((artist) => artist.id)
    .filter((id) => id !== undefined && id !== null && id !== '')
}

export function getKugouTrackMeta(song = {}) {
  const access = normalizeSongAccess(song)
  const mvMeta = getMvRouteMeta(song)

  return {
    ...mvMeta,
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

export function stableCoverIndex(value = 0) {
  const numericValue = Number(value)

  if (Number.isFinite(numericValue) && numericValue > 0) {
    return numericValue
  }

  return String(value ?? '')
    .split('')
    .reduce((total, char) => total + char.charCodeAt(0), 0)
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
    return `${trimNumber(count / 100000000)}亿`
  }

  if (count >= 10000) {
    return `${trimNumber(count / 10000)}万`
  }

  return String(count)
}

export function trimNumber(number) {
  return Number(number.toFixed(1)).toString()
}

export function formatDate(value) {
  if (!value) {
    return '最近更新'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '最近更新'
  }

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${date.getFullYear()}-${month}-${day} 更新`
}
