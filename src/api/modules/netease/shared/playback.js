export function toSongUrlResponse(response = {}) {
  const data = response.data ?? response
  const entries = Array.isArray(data) ? data : [data]
  const url = entries
    .flatMap((entry) => collectAudioUrlCandidates(entry))
    .map(normalizeAudioUrl)
    .find(Boolean) || ''

  return {
    ...response,
    data: url ? [{ url }] : []
  }
}

export function collectAudioUrlCandidates(source, depth = 0) {
  if (!source || depth > 4) {
    return []
  }

  if (typeof source === 'string') {
    return [source]
  }

  if (Array.isArray(source)) {
    return source.flatMap((item) => collectAudioUrlCandidates(item, depth + 1))
  }

  if (typeof source !== 'object') {
    return []
  }

  const directKeys = [
    'url',
    'play_url',
    'playUrl',
    'backup_url',
    'backupUrl',
    'download_url',
    'downloadUrl',
    'audio_url',
    'audioUrl',
    'tracker_url',
    'trackerUrl'
  ]
  const nestedKeys = ['data', 'info', 'urls', 'url_info', 'urlInfo']

  return [
    ...directKeys.flatMap((key) => collectAudioUrlCandidates(source[key], depth + 1)),
    ...nestedKeys.flatMap((key) => collectAudioUrlCandidates(source[key], depth + 1))
  ]
}

export function normalizeAudioUrl(url = '') {
  if (typeof url !== 'string') {
    return ''
  }

  if (url.startsWith('//')) {
    return `https:${url}`
  }

  return url
}

export function decodeBase64Utf8(value = '') {
  if (typeof value !== 'string' || !value) {
    return ''
  }

  try {
    const binary = atob(value)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))

    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    return value
  }
}
