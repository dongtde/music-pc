import { COVER_TINT_FALLBACKS, DEFAULT_COVER_TINT_RGB } from './homeConstants'
export {
  createLyricPlaceholder,
  findCurrentLyricIndex,
  isNeteaseTrackId
} from '../../utils/lyrics'
export { formatTime, parseDuration } from '../../utils/time'

export function prepareQueue(songs) {
  return songs.map((song, index) => {
    const coverUrl = resizeNeteaseCover(song.coverUrl, 640)
    const type = song.type ?? getCoverType(index)

    return {
      ...song,
      coverUrl,
      id: song.id ?? `home-${index + 1}`,
      rank: String(index + 1).padStart(2, '0'),
      type,
      slideStyle: createSlideStyle(coverUrl, getFallbackCoverTintRgb(type))
    }
  })
}

export function applyMoodQueue(songs, mood) {
  const queue = [...songs]
  const filters = {
    daily: (items) => items,
    hot: (items) => items.filter((song) => song.feedSource === 'chart' || song.hasVideo),
    new: (items) => items.filter((song) => song.feedSource === 'new'),
    chill: (items) => items.filter((song) => getChillWeight(song) >= 2)
  }
  const sorters = {
    daily: (items) => items,
    hot: (items) => items.sort((current, next) =>
      Number(next.hasVideo) - Number(current.hasVideo) ||
      Number(next.vip) - Number(current.vip)
    ),
    new: (items) => items.reverse(),
    chill: (items) => items.sort((current, next) => getChillWeight(next) - getChillWeight(current))
  }
  const filteredQueue = (filters[mood] ?? filters.daily)(queue)
  const sortedQueue = (sorters[mood] ?? sorters.daily)(
    filteredQueue.length ? filteredQueue : queue
  )

  return sortedQueue.map((song, index) => ({
    ...song,
    rank: String(index + 1).padStart(2, '0')
  }))
}

export function prepareMvQueue(mvs = []) {
  return uniqueMvs(mvs).map((mv, index) => {
    const coverUrl = resizeNeteaseCover(
      mv.coverUrl ?? mv.cover ?? mv.picUrl ?? mv.imgurl ?? mv.imgurl16v9,
      960
    )
    const id = mv.id ?? mv.mvid ?? mv.vid ?? `home-mv-${index + 1}`
    const title = mv.title ?? mv.name ?? '未命名 MV'
    const artist = mv.artist ?? mv.artistName ?? mv.creatorName ?? '未知艺人'
    const playCount = mv.playCount ?? mv.views ?? ''

    return {
      ...mv,
      id,
      title,
      name: title,
      artist,
      coverUrl,
      playCount: typeof playCount === 'number' ? formatActionCount(playCount) : playCount,
      duration: mv.duration || '--:--',
      desc: mv.desc ?? mv.description ?? mv.briefDesc ?? '',
      type: mv.type ?? getCoverType(index)
    }
  })
}

export function uniqueMvs(items = []) {
  const seen = new Set()

  return items.filter((item) => {
    const id = String(item?.id ?? item?.mvid ?? item?.vid ?? '')

    if (!id || seen.has(id)) {
      return false
    }

    seen.add(id)
    return true
  })
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

export function createSlideStyle(coverUrl, tintRgb = DEFAULT_COVER_TINT_RGB) {
  return Object.freeze({
    '--soda-cover-image': coverUrl ? `url("${coverUrl}")` : 'none',
    '--soda-cover-tint-rgb': tintRgb
  })
}

export function getFallbackCoverTintRgb(type) {
  return COVER_TINT_FALLBACKS[type] ?? DEFAULT_COVER_TINT_RGB
}

export function sampleCoverTint(coverUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    image.onload = () => {
      try {
        const sampleSize = 28
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d', { willReadFrequently: true })

        if (!context) {
          reject(new Error('Canvas context unavailable'))
          return
        }

        canvas.width = sampleSize
        canvas.height = sampleSize
        context.drawImage(image, 0, 0, sampleSize, sampleSize)
        resolve(extractCoverTint(context.getImageData(0, 0, sampleSize, sampleSize).data))
      } catch (error) {
        reject(error)
      }
    }
    image.onerror = reject
    image.src = coverUrl
  })
}

export function resizeNeteaseCover(url, size) {
  if (!url || !/music\.126\.net/.test(url)) {
    return url
  }

  const param = `param=${size}y${size}`

  if (/[?&]param=\d+y\d+/.test(url)) {
    return url.replace(/([?&])param=\d+y\d+/, `$1${param}`)
  }

  return `${url}${url.includes('?') ? '&' : '?'}${param}`
}

export function formatActionCount(value = 0) {
  const count = Number(value) || 0

  if (count <= 0) {
    return ''
  }

  if (count >= 100000000) {
    return `${Math.floor(count / 100000000)}亿+`
  }

  if (count >= 10000) {
    return `${Math.floor(count / 10000)}w+`
  }

  if (count >= 1000) {
    return '999+'
  }

  return String(count)
}

export function getCoverType(index) {
  return ['sunset', 'neon', 'lofi', 'stage', 'piano'][index % 5]
}

export function isPlaybackSpaceKey(event) {
  return (
    event.code === 'Space' ||
    event.key === ' ' ||
    event.key === 'Spacebar'
  )
}

export function shouldIgnorePlaybackShortcut(event) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) {
    return true
  }

  return Boolean(event.target?.closest?.(
    'input, textarea, select, button, a, [contenteditable="true"], [role="textbox"]'
  ))
}

function getChillWeight(song) {
  const typeScore = {
    piano: 4,
    lofi: 3,
    sunset: 2,
    stage: 1,
    neon: 0
  }

  return typeScore[song.type] ?? 0
}

function extractCoverTint(data) {
  let red = 0
  let green = 0
  let blue = 0
  let totalWeight = 0

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3]

    if (alpha < 128) {
      continue
    }

    const pixelRed = data[index]
    const pixelGreen = data[index + 1]
    const pixelBlue = data[index + 2]
    const max = Math.max(pixelRed, pixelGreen, pixelBlue)
    const min = Math.min(pixelRed, pixelGreen, pixelBlue)
    const luma = getLuma(pixelRed, pixelGreen, pixelBlue)

    if (luma < 24 || luma > 238) {
      continue
    }

    const saturation = max - min
    const weight = 1 + saturation / 80 + Math.max(0, 128 - Math.abs(luma - 128)) / 160

    red += pixelRed * weight
    green += pixelGreen * weight
    blue += pixelBlue * weight
    totalWeight += weight
  }

  if (!totalWeight) {
    return DEFAULT_COVER_TINT_RGB
  }

  return tuneCoverTint(red / totalWeight, green / totalWeight, blue / totalWeight)
}

function tuneCoverTint(red, green, blue) {
  const luma = getLuma(red, green, blue)
  let next = { red, green, blue }

  if (luma < 74) {
    next = mixRgb(next, { red: 255, green: 255, blue: 255 }, 0.22)
  } else if (luma > 190) {
    next = mixRgb(next, { red: 0, green: 0, blue: 0 }, 0.18)
  }

  return `${Math.round(next.red)}, ${Math.round(next.green)}, ${Math.round(next.blue)}`
}

function mixRgb(current, target, ratio) {
  return {
    red: current.red + (target.red - current.red) * ratio,
    green: current.green + (target.green - current.green) * ratio,
    blue: current.blue + (target.blue - current.blue) * ratio
  }
}

function getLuma(red, green, blue) {
  return red * 0.2126 + green * 0.7152 + blue * 0.0722
}
