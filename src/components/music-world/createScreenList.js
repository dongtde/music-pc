import { cropImage, formatTime, ink, rounded, text } from './screenDrawing.js'
import { drawPlayerIcon, drawPlayingBars } from '../playerTransportDrawing.js'
import { trackKey } from '../../services/listeningRoomProtocol.js'

const DOUBLE_CLICK_MS = 400
const contains = (rect, point) => Boolean(point && rect && point.x >= rect.x && point.x < rect.x + rect.w && point.y >= rect.y && point.y < rect.y + rect.h)
const clipped = (rect, area) => {
  const x = Math.max(rect.x, area.x), y = Math.max(rect.y, area.y)
  return { x, y, w: Math.max(0, Math.min(rect.x + rect.w, area.x + area.width) - x), h: Math.max(0, Math.min(rect.y + rect.h, area.y + area.height) - y) }
}

// UI tracks expose seconds or a formatted time. Raw API millisecond fields are explicit.
export function screenTrackTime(track = {}) {
  for (const value of [track.time, track.duration]) {
    if (value === null || value === undefined || value === '') continue
    if (typeof value === 'string' && /^\d+(?::\d{1,2}){1,2}$/.test(value.trim())) {
      const seconds = value.trim().split(':').reduce((total, part) => total * 60 + Number(part), 0)
      return formatTime(seconds)
    }
    const seconds = Number(value)
    if (Number.isFinite(seconds) && seconds >= 0) return formatTime(seconds)
  }
  const milliseconds = Number(track.dt ?? track.timelength)
  return Number.isFinite(milliseconds) && milliseconds >= 0 ? formatTime(milliseconds / 1000) : '—'
}

// One canvas list component supplies the same rows, cover actions and hit areas to every screen.
export function createScreenList(ctx, { images, invalidate = () => {} }) {
  let rows = [], pointer = null, hoveredKey = '', pendingClick = null, lastActivation = null, animating = false

  function hitTest(point) {
    const row = rows.find(row => contains(row.bounds, point))
    return row ? { ...row, part: row.song && contains(row.cover, point) ? 'play' : 'row' } : null
  }

  function cancelClick() { pendingClick = null }

  function setHover(point) {
    pointer = point
    const hit = hitTest(point), key = hit?.key || ''
    if (key !== hoveredKey) {
      hoveredKey = key
      invalidate()
    }
    return hit
  }

  function reset() {
    rows = []
    animating = false
    pendingClick = lastActivation = null
    if (hoveredKey) { hoveredKey = ''; invalidate() }
  }

  function draw({ items, area, scroll = 0, playback = {}, accent = ink.ice, songsOnly = false, action = 'play', now = 0, revealAge = Infinity, audioLevels = null }) {
    const { rowHeight } = area, first = Math.floor(scroll), count = Math.ceil(area.height / rowHeight) + 1
    const scale = rowHeight / 94, coverSize = Math.round(64 * scale)
    const inset = Math.max(10, 12 * scale), titleSize = Math.max(20, Math.round(24 * scale))
    const metadataSize = Math.max(15, Math.round(17 * scale)), timeSize = Math.max(16, Math.round(19 * scale))
    rows = []; animating = false
    const pending = new Set(playback.pendingKeys || []), loadingKey = playback.loading ? trackKey(playback.loadingTrack || playback.track) : ''
    ctx.save(); ctx.beginPath(); ctx.rect(area.x, area.y, area.width, area.height); ctx.clip()
    for (let index = first; index < Math.min(items.length, first + count); index++) {
      const item = items[index], song = songsOnly || !item.kind || item.kind === 'song'
      const progress = Math.max(0, Math.min(1, (revealAge - (index - first) * 28) / 320))
      const y = area.y + (index - scroll) * rowHeight + 10 * (1 - progress) ** 3
      const bounds = clipped({ x: area.x, y: y + 3, w: area.width, h: rowHeight - 6 }, area)
      const cover = { x: area.x + inset, y: y + (rowHeight - coverSize) / 2, w: coverSize, h: coverSize }
      const key = [item.kind || 'song', item.source || '', item.id, item.hash || '', index].join(':')
      const identity = trackKey(item), current = song && identity && identity === trackKey(playback.track)
      const hovered = progress > .5 && contains(bounds, pointer)
      const loading = song && (pending.has(identity) || Boolean(loadingKey && identity === loadingKey))
      const playing = current && playback.playing && !playback.loading && !loading
      const row = { item, index, key, song, loading, playing, bounds, cover: clipped(cover, area), disabled: loading || song && action === 'play' && Boolean(playback.loading) }
      if (bounds.h && progress > .5) rows.push(row)
      if (bounds.h && (loading || playing) && !playback.reducedMotion) animating = true
      ctx.save(); ctx.globalAlpha = progress
      rounded(ctx, area.x, y + 3, area.width, rowHeight - 6, 9 * scale, hovered ? '#87deda29' : current ? '#87deda18' : '#102d3c52')
      if (hovered) {
        ctx.strokeStyle = '#a9e9df38'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.roundRect(area.x + .5, y + 3.5, area.width - 1, rowHeight - 7, 9 * scale); ctx.stroke()
      }
      const radius = item.kind === 'artist' ? coverSize / 2 : 6 * scale
      const image = images.get(item.thumbnailUrl || item.coverUrl)
      if (image) cropImage(ctx, image, cover.x, cover.y, coverSize, radius)
      else {
        rounded(ctx, cover.x, cover.y, coverSize, coverSize, radius, '#2d4751')
        ctx.save(); ctx.textAlign = 'center'
        text(ctx, '♫', cover.x + coverSize / 2, cover.y + coverSize * .67, coverSize * .46, '#9ac9cb')
        ctx.restore()
      }
      if (song && (hovered || loading || playing)) {
        rounded(ctx, cover.x, cover.y, coverSize, coverSize, radius, '#071821a8')
        ctx.save()
        if (row.disabled && !current && !loading) ctx.globalAlpha *= .4
        if (playing) drawPlayingBars(ctx, cover.x + coverSize / 2, cover.y + coverSize / 2, coverSize * .44, accent, now, audioLevels, playback.reducedMotion)
        else drawPlayerIcon(ctx, loading ? 'loading' : 'play', cover.x + coverSize / 2, cover.y + coverSize / 2, coverSize * .4, '#edf9f3', loading && !playback.reducedMotion ? now / 180 : 0)
        ctx.restore()
      }
      const titleX = cover.x + coverSize + Math.max(12, 20 * scale)
      const right = area.x + area.width - inset - 3
      const timeWidth = song ? Math.max(60, timeSize * 4.2) : 28 * scale
      const textWidth = Math.max(20, right - timeWidth - 16 * scale - titleX)
      const metadata = item.artist || item.tag || item.description || item.desc || item.label || ''
      text(ctx, item.name || item.title || '未命名歌曲', titleX, y + (metadata ? rowHeight * .42 : rowHeight * .58), titleSize, current ? accent : ink.light, textWidth, 500)
      if (metadata) text(ctx, metadata, titleX, y + rowHeight * .72, metadataSize, ink.muted, textWidth)
      if (song) {
        ctx.save(); ctx.textAlign = 'right'
        text(ctx, screenTrackTime(item), right, y + rowHeight / 2 + timeSize * .35, timeSize, current ? '#b2d5d2' : ink.muted)
        ctx.restore()
      } else if (hovered) {
        ctx.save(); ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.lineCap = ctx.lineJoin = 'round'
        ctx.beginPath(); ctx.moveTo(right - 10, y + rowHeight / 2 - 7); ctx.lineTo(right - 3, y + rowHeight / 2); ctx.lineTo(right - 10, y + rowHeight / 2 + 7); ctx.stroke(); ctx.restore()
      }
      ctx.restore()
    }
    ctx.restore()
    hoveredKey = hitTest(pointer)?.key || ''
  }

  function select(point, { keyboard = false, now = performance.now() } = {}) {
    const hit = hitTest(point)
    if (!hit || hit.disabled) { cancelClick(); return null }
    if (!hit.song) { cancelClick(); return hit }
    if (!keyboard && hit.part !== 'play') {
      const doubleClick = pendingClick?.key === hit.key && now - pendingClick.time <= DOUBLE_CLICK_MS
      pendingClick = doubleClick ? null : { key: hit.key, time: now }
      if (!doubleClick) return null
    } else cancelClick()
    // A double click on the cover performs its action only once.
    if (lastActivation?.key === hit.key && now - lastActivation.time <= DOUBLE_CLICK_MS) return null
    lastActivation = { key: hit.key, time: now }
    return hit
  }

  return {
    draw, hitTest, select, setHover, cancelClick, reset,
    getState: () => ({ hoveredIndex: rows.find(row => row.key === hoveredKey)?.index ?? -1, visibleIndices: rows.map(row => row.index), loadingIndices: rows.filter(row => row.loading).map(row => row.index), playingIndex: rows.find(row => row.playing)?.index ?? -1, animating }),
  }
}

// Keep quick local additions visible long enough to acknowledge the click, without delaying the operation.
export function createScreenListFeedback(onChange) {
  const pending = new Map(), timers = new Set()
  let disposed = false
  return {
    begin(tracks) {
      if (disposed) return () => {}
      const keys = [...new Set((Array.isArray(tracks) ? tracks : [tracks]).map(trackKey).filter(Boolean))]
      const token = Symbol(), started = performance.now()
      keys.forEach(key => pending.set(key, token)); onChange([...pending.keys()])
      return () => {
        if (disposed) return
        const timer = setTimeout(() => {
          timers.delete(timer)
          keys.forEach(key => { if (pending.get(key) === token) pending.delete(key) })
          onChange([...pending.keys()])
        }, Math.max(0, 320 - (performance.now() - started)))
        timers.add(timer)
      }
    },
    dispose() { disposed = true; timers.forEach(clearTimeout); timers.clear(); pending.clear() },
  }
}

