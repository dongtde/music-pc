// The backend owns validation; no frontend source or parent package is required.
export const ROOM_SOCKET_PATH = '/listening-room/socket.io'
export const ROOM_DIRECTORY_PATH = '/listening-room/rooms'
export const ROOM_CAPACITY = 10
export const ROOM_MAX_CAPACITY = 50
export const ROOM_QUEUE_LIMIT = 200
export const ROOM_MODES = ['list', 'order', 'single', 'shuffle']

export function trackKey(track) {
  return track?.id ? [track.source || 'kugou', track.id, track.hash || '', track.album_audio_id || track.mixsongid || ''].join(':') : ''
}

export function trackDuration(track) {
  const value = track?.time ?? track?.duration
  const seconds = typeof value === 'number' ? value : String(value || '').split(':').reduce((total, part) => total * 60 + Number(part), 0)
  return Number.isFinite(seconds) ? Math.min(86400, Math.max(0, seconds)) : 0
}

// Only public song metadata is allowed on the wire, never URLs or credentials.
export function roomTrack(track) {
  if (!track || typeof track !== 'object' || !track.id || track.localUrl || String(track.id).startsWith('local-')) return null
  const result = {}
  for (const key of ['id', 'hash', 'album_audio_id', 'mixsongid', 'album_id', 'audio_id', 'albumId', 'artistId', 'source', 'type', 'name', 'artist', 'album', 'duration', 'time']) {
    if (typeof track[key] === 'string') result[key] = track[key].slice(0, 300)
    else if (typeof track[key] === 'number' && Number.isFinite(track[key])) result[key] = track[key]
  }
  if (!result.id) return null
  if (typeof track.coverUrl === 'string' && /^https?:\/\//i.test(track.coverUrl)) result.coverUrl = track.coverUrl.slice(0, 2048)
  if (Array.isArray(track.qualities)) result.qualities = track.qualities.filter(value => ['128', '320', 'flac', 'high'].includes(value))
  return result
}

export function roomQueue(tracks) {
  const seen = new Set()
  return (Array.isArray(tracks) ? tracks : []).slice(0, ROOM_QUEUE_LIMIT).map(roomTrack).filter(track => {
    const key = trackKey(track)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function playbackPosition(playback, serverNow) {
  if (!playback) return 0
  const elapsed = playback.playing && !playback.preparing ? Math.max(0, serverNow - playback.anchorTime) / 1000 : 0
  const position = Math.max(0, (Number(playback.position) || 0) + elapsed)
  return playback.duration > 0 ? Math.min(position, playback.duration) : position
}
