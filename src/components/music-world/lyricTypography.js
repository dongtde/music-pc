const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null
export const graphemes = text => segmenter ? Array.from(segmenter.segment(text), part => part.segment) : Array.from(text)
export function hasWordTiming(line) {
  return Boolean(!line?.placeholder && line?.words?.length && line.words.every(word => word.text && Number.isFinite(word.seconds) && Number.isFinite(word.duration) && word.duration >= 0))
}
export function timedTokens(line) {
  return hasWordTiming(line) ? line.words : [{ text: line?.text || '', seconds: null, duration: null }]
}
export function wordFill(word, time) {
  if (word.seconds == null || word.duration == null || word.duration < 0) return null
  if (word.duration === 0) return time >= word.seconds ? 1 : 0
  return Math.max(0, Math.min(1, (time - word.seconds) / word.duration))
}
export function worldLyricIndex(lines, time) {
  let low = 0, high = lines.length - 1, current = 0
  while (low <= high) {
    const mid = (low + high) >>> 1
    if (lines[mid].seconds <= time) { current = mid; low = mid + 1 } else high = mid - 1
  }
  return current
}
// Glyph positions retain their source token and measured offset, including wrapped tokens.
export function layoutLyric(line, measure, width) {
  const glyphs = []; let x = 0, row = 0
  for (const word of timedTokens(line)) {
    const chars = graphemes(word.text), widths = chars.map(measure), total = widths.reduce((a, b) => a + b, 0)
    let offset = 0
    chars.forEach((char, index) => {
      const size = widths[index]
      if (char === '\n' || x + size > width && x > 0) { row++; x = 0 }
      if (char !== '\n') { glyphs.push({ char, x, row, width: size, word, offset, total }); x += size }
      offset += size
    })
  }
  return { glyphs, rows: row + 1 }
}
