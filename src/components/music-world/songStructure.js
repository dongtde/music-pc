export const SECTION_LABELS = { intro: '前奏', verse: '主歌', chorus: '副歌 / 高潮', bridge: '间奏', outro: '尾奏', ambient: '自由律动' }
const clean = text => String(text || '').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase()
export function timedLyrics(lines = []) {
  return lines.filter(line => !line.placeholder && line.text?.trim() && Number.isFinite(Number(line.seconds)) && Number(line.seconds) >= 0)
    .map(line => ({ ...line, seconds: Number(line.seconds) })).sort((a, b) => a.seconds - b.seconds)
}

// Features come from the decoded song. Section names are musical estimates,
// combining energy changes with repeated, time-aligned lyric phrases.
export function classifySections(features, duration, lyrics = []) {
  if (!(duration > 0) || !Number.isFinite(duration)) return []
  const lines = timedLyrics(lyrics), count = new Map()
  for (const line of lines) { const key = clean(line.text); if (key.length > 3) count.set(key, (count.get(key) || 0) + 1) }
  const energy = features.map(frame => frame.energy).sort((a, b) => a - b)
  const low = energy[Math.floor(energy.length * .3)] || 0, high = energy[Math.floor(energy.length * .72)] || 0
  const contrast = high > low * 1.16 && high > .008
  const first = lines[0]?.seconds ?? 0, last = lines.at(-1)
  const lyricEnd = last ? Math.min(duration, last.seconds + Math.max(4, Math.min(10, last.duration || 6))) : duration
  const cells = [], step = 4
  for (let start = 0; start < duration; start += step) {
    const frames = features.filter(frame => frame.time >= start - 2 && frame.time < start + step + 2)
    const average = frames.reduce((sum, frame) => sum + frame.energy, 0) / Math.max(1, frames.length)
    const local = lines.filter(line => line.seconds >= start - 4 && line.seconds < start + step + 4)
    const repeated = local.filter(line => (count.get(clean(line.text)) || 0) > 1).length >= 2
    let type = 'verse'
    if (lines.length && start + step <= first) type = 'intro'
    else if (lines.length && start >= lyricEnd && duration - lyricEnd >= 5) type = 'outro'
    else if (repeated && (!features.length || average >= low) || contrast && average >= high) type = 'chorus'
    else if (lines.length && !local.length && start > first + 8 && start < lyricEnd - 8) type = 'bridge'
    else if (!lines.length && !features.length) type = 'ambient'
    cells.push({ start, end: Math.min(duration, start + step), type })
  }
  // Reject isolated four-second peaks; a chorus is a sustained section.
  for (let i = 1; i < cells.length - 1; i++) {
    if (cells[i].type === 'chorus' && cells[i - 1].type !== 'chorus' && cells[i + 1].type !== 'chorus') cells[i].type = 'verse'
  }
  const segments = []
  for (const cell of cells) {
    const previous = segments.at(-1)
    if (previous?.type === cell.type) previous.end = cell.end
    else segments.push({ ...cell, label: SECTION_LABELS[cell.type] })
  }
  return segments
}

export function sectionAt(segments, seconds) {
  return segments.find(segment => seconds >= segment.start && seconds < segment.end) || { type: 'ambient', label: SECTION_LABELS.ambient, start: 0, end: 0 }
}

export function extractSongFeatures(samples, sampleRate) {
  const step = Math.round(sampleRate * 2), features = []
  for (let start = 0; start < samples.length; start += step) {
    let sum = 0, count = 0
    for (let i = start; i < Math.min(samples.length, start + step); i += 4) { sum += samples[i] ** 2; count++ }
    features.push({ time: start / sampleRate, energy: Math.sqrt(sum / Math.max(1, count)) })
  }
  return features
}

export function createSongAnalysis() {
  let revision = 0, request = null, context = null, disposed = false
  const cache = new Map()
  return {
    async analyze(url, duration, lyrics) {
      const token = ++revision; request?.abort(); request = new AbortController()
      const fallback = () => ({ source: timedLyrics(lyrics).length ? 'lyrics' : 'unavailable', segments: classifySections([], duration, lyrics) })
      if (!url || disposed || duration > 1200) return fallback()
      try {
        let features = cache.get(url)
        if (!features) {
          const timeout = setTimeout(() => request?.abort(), 20000)
          let response, bytes
          try {
            response = await fetch(url, { signal: request.signal })
            if (!response.ok || Number(response.headers.get('content-length')) > 48 * 1024 * 1024) throw Error('Analysis source unavailable')
            const reader = response.body.getReader(), chunks = []; let size = 0
            while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 48 * 1024 * 1024) { await reader.cancel(); throw Error('Analysis source too large') }; chunks.push(value) }
            bytes = new Uint8Array(size); let offset = 0; chunks.forEach(chunk => { bytes.set(chunk, offset); offset += chunk.length })
          } finally { clearTimeout(timeout) }
          if (disposed || token !== revision) return null
          const AudioContext = window.AudioContext || window.webkitAudioContext
          context ||= new AudioContext(typeof AudioContext.prototype.setSinkId === 'function' ? { sinkId: { type: 'none' } } : undefined)
          const buffer = await context.decodeAudioData(bytes.buffer)
          if (disposed || token !== revision) return null
          features = extractSongFeatures(buffer.getChannelData(0), buffer.sampleRate)
          cache.set(url, features); if (cache.size > 3) cache.delete(cache.keys().next().value)
        }
        return { source: 'audio', segments: classifySections(features, duration, lyrics) }
      } catch { return disposed || token !== revision ? null : fallback() }
    },
    cancel() { revision++; request?.abort() },
    dispose() { disposed = true; revision++; request?.abort(); context?.close().catch(() => {}); cache.clear() },
  }
}
