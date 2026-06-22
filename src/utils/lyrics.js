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

export function getLyricFrame(lines = [], currentTime = 0) {
  const sourceLines = Array.isArray(lines) && lines.length
    ? lines
    : createLyricPlaceholder('暂无歌词')
  const activeIndex = findCurrentLyricIndex(sourceLines, currentTime)
  const activeLine = sourceLines[activeIndex] ?? sourceLines[0] ?? createLyricPlaceholder('暂无歌词')[0]
  const nextLine = sourceLines[activeIndex + 1] ?? null

  return {
    currentTime: Math.max(0, Number(currentTime) || 0),
    activeIndex,
    activeLine,
    nextLine,
    progress: getLyricLineProgress(activeLine, nextLine, currentTime),
  }
}

export function isNeteaseTrackId(trackId) {
  return /^\d+$/.test(String(trackId ?? '')) || /^[a-f0-9]{32}$/i.test(String(trackId ?? ''))
}

export function getLyricLineProgress(line, nextLine, currentTime) {
  if (line?.placeholder) {
    return 0
  }

  const wordProgress = getLyricWordProgress(line, currentTime)

  if (wordProgress !== null) {
    return wordProgress
  }

  const lineDuration = getLyricLineDuration(line, nextLine)

  return clampLyricProgress((currentTime - line.seconds) / lineDuration)
}

export function getLyricWordState(line, word, currentTime, activeIndex = line?.index ?? 0) {
  if (!line || !word || line.placeholder) {
    return { active: false, sung: false }
  }

  const lineIndex = Number(line.index) || 0

  if (lineIndex < activeIndex) {
    return { active: false, sung: true }
  }

  if (lineIndex !== activeIndex) {
    return { active: false, sung: false }
  }

  const { start, end } = getLyricWordBounds(word)

  return {
    active: currentTime >= start && currentTime < end,
    sung: currentTime >= end,
  }
}

export function getLyricWordBounds(word) {
  const rawStart = Number(word?.seconds)
  const start = Number.isFinite(rawStart) ? rawStart : 0
  const duration = Math.max(0.08, Number(word?.duration) || 0)

  return {
    start,
    duration,
    end: start + duration,
  }
}

function getLyricWordProgress(line, currentTime) {
  const words = Array.isArray(line?.words)
    ? line.words.filter((word) => word.text && Number.isFinite(Number(word.seconds)))
    : []

  if (!words.length) {
    return null
  }

  const textLength = Math.max(1, words.reduce((total, word) => total + getLyricTextWeight(word.text), 0))
  let consumedLength = 0

  for (const word of words) {
    const wordLength = getLyricTextWeight(word.text)
    const { start, duration, end } = getLyricWordBounds(word)

    if (currentTime >= end) {
      consumedLength += wordLength
      continue
    }

    if (currentTime <= start) {
      return clampLyricProgress(consumedLength / textLength)
    }

    consumedLength += wordLength * ((currentTime - start) / duration)
    return clampLyricProgress(consumedLength / textLength)
  }

  return 1
}

function getLyricLineDuration(line, nextLine) {
  if (line?.duration) {
    return Math.max(0.08, Number(line.duration) || 0.08)
  }

  if (nextLine && Number(nextLine.seconds) > Number(line?.seconds)) {
    return Math.max(0.08, Number(nextLine.seconds) - Number(line.seconds))
  }

  return 4.2
}

function getLyricTextWeight(text = '') {
  return Math.max(1, Array.from(String(text)).length)
}

function clampLyricProgress(value) {
  return Math.min(1, Math.max(0, Number(value) || 0))
}
