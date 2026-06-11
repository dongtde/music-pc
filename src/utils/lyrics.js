export function createLyricPlaceholder(text) {
  return [{ time: '--:--', text, seconds: 0, placeholder: true }]
}

export function findCurrentLyricIndex(lines, currentTime) {
  if (!lines.length || lines[0]?.placeholder) {
    return 0
  }

  const targetTime = currentTime + 0.16
  let low = 0
  let high = lines.length - 1
  let currentIndex = 0

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)

    if (lines[middle].seconds <= targetTime) {
      currentIndex = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }

  return currentIndex
}

export function isNeteaseTrackId(trackId) {
  return /^\d+$/.test(String(trackId ?? ''))
}
