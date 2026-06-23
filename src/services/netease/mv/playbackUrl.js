export function getMvPlaybackUrl({ urlResponse = {}, brs, detail = {}, ugcResponse = {}, quality = 1080 } = {}) {
  const apiUrl = selectNearestMvUrl(collectMvUrlCandidates(urlResponse, quality), quality)

  if (apiUrl.url) {
    return apiUrl
  }

  const fallbackUrl = getMvFallbackUrl(brs, quality)

  if (fallbackUrl.url) {
    return fallbackUrl
  }

  return selectNearestMvUrl([
    ...collectMvUrlCandidates(ugcResponse, quality),
    ...collectMvUrlCandidates(detail, quality)
  ], quality)
}

export function getMvFallbackUrl(brs, quality = 1080) {
  if (!brs) {
    return { url: '', quality: '' }
  }

  const targetQuality = Number(quality) || 1080
  const candidates = Array.isArray(brs)
    ? brs.map((item) => ({
        quality: Number(item?.br ?? item?.r ?? item?.quality ?? 0),
        url: normalizeVideoUrl(
          typeof item === 'string' ? item : item?.url || item?.src || item?.playUrl || item?.videoUrl || ''
        )
      }))
    : Object.entries(brs).map(([key, value]) => ({
        quality: Number(key),
        url: normalizeVideoUrl(
          typeof value === 'string' ? value : value?.url || value?.src || value?.playUrl || value?.videoUrl || ''
        )
      }))

  return selectNearestMvUrl(candidates, targetQuality)
}

export function collectMvUrlCandidates(payload, fallbackQuality = 1080, depth = 0) {
  if (!payload || depth > 4) {
    return []
  }

  if (typeof payload === 'string') {
    const url = normalizeVideoUrl(payload)
    return url ? [{ url, quality: fallbackQuality }] : []
  }

  if (Array.isArray(payload)) {
    return payload.flatMap((item) => collectMvUrlCandidates(item, fallbackQuality, depth + 1))
  }

  if (typeof payload !== 'object') {
    return []
  }

  const quality = getMvUrlQuality(payload, fallbackQuality)
  const directUrl = normalizeVideoUrl(
    payload.url || payload.src || payload.playUrl || payload.videoUrl || payload.mp4Url || payload.downloadUrl || ''
  )
  const candidates = directUrl ? [{ url: directUrl, quality }] : []
  const entries = Object.entries(payload)
  const looksLikeQualityMap = entries.length > 0 && entries.every(([key, value]) => /^\d+$/.test(key) && value)

  if (looksLikeQualityMap) {
    candidates.push(
      ...entries
        .map(([key, value]) => ({
          quality: Number(key),
          url: normalizeVideoUrl(
            typeof value === 'string' ? value : value?.url || value?.src || value?.playUrl || value?.videoUrl || ''
          )
        }))
        .filter((item) => item.url)
    )
  }

  for (const key of ['data', 'urls', 'urlInfo', 'videoUrlInfo', 'videoInfo', 'video', 'mv', 'mp', 'brs']) {
    candidates.push(...collectMvUrlCandidates(payload[key], quality, depth + 1))
  }

  return candidates
}

export function selectNearestMvUrl(candidates = [], quality = 1080) {
  const targetQuality = Number(quality) || 1080

  return candidates
    .map((item) => ({
      quality: Number(item?.quality) || '',
      url: normalizeVideoUrl(item?.url)
    }))
    .filter((item) => item.url)
    .sort((current, next) => {
      const currentDistance = Math.abs((current.quality || targetQuality) - targetQuality)
      const nextDistance = Math.abs((next.quality || targetQuality) - targetQuality)

      return currentDistance - nextDistance
    })[0] ?? { url: '', quality: '' }
}

export function getMvUrlQuality(source = {}, fallbackQuality = 1080) {
  const quality = Number(source.r ?? source.br ?? source.quality ?? source.resolution ?? fallbackQuality)

  return Number.isFinite(quality) && quality > 0 ? quality : fallbackQuality
}

export function normalizeVideoUrl(url) {
  if (typeof url !== 'string') {
    return ''
  }

  const value = url.trim()

  if (!value) {
    return ''
  }

  return value.startsWith('//') ? `https:${value}` : value
}
