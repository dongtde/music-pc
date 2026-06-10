export function toFiniteNumber(value, fallback = 0) {
  const number = Number(value)

  return Number.isFinite(number) ? number : fallback
}

export function clampNumber(value, min = 0, max = Number.POSITIVE_INFINITY) {
  const number = toFiniteNumber(value, min)

  return Math.min(max, Math.max(min, number))
}

export function clampTime(value, duration = 0) {
  const currentTime = clampNumber(value, 0)

  return duration > 0 ? Math.min(currentTime, duration) : currentTime
}

export function parseDuration(duration) {
  if (typeof duration !== 'string') {
    return 0
  }

  const parts = duration.split(':').map(Number)

  if (!parts.length || parts.some(Number.isNaN)) {
    return 0
  }

  return parts.reduce((total, part) => total * 60 + part, 0)
}

export function formatTime(value = 0) {
  const totalSeconds = Math.max(0, Math.floor(toFiniteNumber(value, 0)))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')

  return `${minutes}:${seconds}`
}

export function waitForMinimumDelay(startedAt, minimumMs = 0) {
  const remaining = minimumMs - (Date.now() - startedAt)

  if (remaining <= 0 || typeof window === 'undefined') {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    window.setTimeout(resolve, remaining)
  })
}

