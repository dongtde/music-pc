import { createLruCache } from './lruCache'

export const DEFAULT_COVER_TINT_RGB = '255, 63, 115'
export const DEFAULT_COVER_PALETTE = Object.freeze({
  primary: '#213245',
  secondary: '#8bbad5',
  tertiary: '#e7a976'
})

const COVER_TINT_CONCURRENCY = 2
const COVER_TINT_CACHE_SIZE = 80
const coverTintSampleCache = createLruCache(COVER_TINT_CACHE_SIZE)
const coverTintFailureCache = createLruCache(COVER_TINT_CACHE_SIZE)
const coverTintPending = new Map()
const coverTintQueue = []
let coverTintActiveCount = 0

export function sampleCoverTint(coverUrl) {
  const cacheKey = normalizeCoverTintUrl(coverUrl)

  if (!cacheKey) {
    return Promise.reject(new Error('Cover URL unavailable'))
  }

  const cachedTint = coverTintSampleCache.get(cacheKey)

  if (cachedTint) {
    return Promise.resolve(cachedTint)
  }

  if (coverTintFailureCache.has(cacheKey)) {
    return Promise.reject(new Error('Cover tint sampling failed previously'))
  }

  const pendingTint = coverTintPending.get(cacheKey)

  if (pendingTint) {
    return pendingTint
  }

  const tintPromise = new Promise((resolve, reject) => {
    coverTintQueue.push({
      coverUrl: cacheKey,
      resolve,
      reject
    })
    processCoverTintQueue()
  })

  coverTintPending.set(cacheKey, tintPromise)
  return tintPromise
}

export function createCoverPaletteFromTint(tintRgb, fallbackPalette = DEFAULT_COVER_PALETTE) {
  const tint = parseRgb(tintRgb)

  if (!tint) {
    return normalizeCoverPalette(fallbackPalette)
  }

  const luma = getLuma(tint.red, tint.green, tint.blue)
  const primary = luma > 150
    ? mixRgb(tint, { red: 0, green: 0, blue: 0 }, 0.4)
    : mixRgb(tint, { red: 0, green: 0, blue: 0 }, 0.18)
  const secondary = luma < 94
    ? mixRgb(tint, { red: 255, green: 255, blue: 255 }, 0.3)
    : mixRgb(tint, { red: 255, green: 255, blue: 255 }, 0.16)
  const tertiary = createCompanionTint(tint, luma)

  return {
    primary: toCssRgb(primary),
    secondary: toCssRgb(secondary),
    tertiary: toCssRgb(tertiary)
  }
}

export function normalizeCoverPalette(palette = DEFAULT_COVER_PALETTE) {
  return {
    primary: palette.primary || DEFAULT_COVER_PALETTE.primary,
    secondary: palette.secondary || DEFAULT_COVER_PALETTE.secondary,
    tertiary: palette.tertiary || DEFAULT_COVER_PALETTE.tertiary
  }
}

function processCoverTintQueue() {
  while (coverTintActiveCount < COVER_TINT_CONCURRENCY && coverTintQueue.length) {
    const job = coverTintQueue.shift()
    coverTintActiveCount += 1

    sampleCoverTintNow(job.coverUrl)
      .then((tintRgb) => {
        coverTintSampleCache.set(job.coverUrl, tintRgb)
        coverTintFailureCache.delete(job.coverUrl)
        job.resolve(tintRgb)
      })
      .catch((error) => {
        coverTintFailureCache.set(job.coverUrl, true)
        job.reject(error)
      })
      .finally(() => {
        coverTintPending.delete(job.coverUrl)
        coverTintActiveCount -= 1
        processCoverTintQueue()
      })
  }
}

function sampleCoverTintNow(coverUrl) {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      reject(new Error('Cover tint sampling is unavailable'))
      return
    }

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
    image.src = getCoverTintSampleUrl(coverUrl)
  })
}

function normalizeCoverTintUrl(coverUrl) {
  return typeof coverUrl === 'string' ? coverUrl.trim() : ''
}

function getCoverTintSampleUrl(coverUrl) {
  if (
    typeof window !== 'undefined' &&
    window.mappicDesktop &&
    /^https?:\/\//i.test(coverUrl)
  ) {
    return `/media?url=${encodeURIComponent(coverUrl)}`
  }

  return coverUrl
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

function createCompanionTint(tint, luma) {
  const companion = {
    red: tint.green,
    green: tint.blue,
    blue: tint.red
  }

  if (luma > 150) {
    return mixRgb(companion, { red: 0, green: 0, blue: 0 }, 0.3)
  }

  return mixRgb(companion, { red: 255, green: 255, blue: 255 }, 0.2)
}

function parseRgb(value) {
  if (!value) {
    return null
  }

  const match = String(value)
    .replace(/^rgb\(/i, '')
    .replace(/\)$/i, '')
    .match(/-?\d+(?:\.\d+)?/g)

  if (!match || match.length < 3) {
    return null
  }

  const [red, green, blue] = match.map(Number)

  if (![red, green, blue].every(Number.isFinite)) {
    return null
  }

  return {
    red: clampColor(red),
    green: clampColor(green),
    blue: clampColor(blue)
  }
}

function toCssRgb(color) {
  return `rgb(${clampColor(color.red)}, ${clampColor(color.green)}, ${clampColor(color.blue)})`
}

function clampColor(value) {
  return Math.min(255, Math.max(0, Math.round(Number(value) || 0)))
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
