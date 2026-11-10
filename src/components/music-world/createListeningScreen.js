import { canvasSurface } from './worldSurfaces.js'
import { font, text, createScreenImages, formatTime } from './screenDrawing.js'
import { hasWordTiming, layoutLyric, wordFill } from './lyricTypography.js'
import { drawPlayerIcon } from '../playerTransportDrawing.js'
import { drawListeningBackdrop, screenInk } from './listeningScreenArt.js'

const WIDTH = 2048, HEIGHT = 840
const TRANSPORT = [{ x: 89, action: 'previous' }, { x: 157, action: 'toggle' }, { x: 225, action: 'next' }]

export function createListeningScreen(invalidate) {
  const surface = canvasSurface(WIDTH, HEIGHT, { dynamic: true, onReady: invalidate })
  const layers = [
    { x: 364, y: 256, width: 1320, height: 328 },
    { x: 32, y: 736, width: 1984, height: 90 },
  ].map(region => ({ ...region, ...canvasSurface(region.width, region.height, { dynamic: true, onReady: invalidate }) }))
  let dirty = true, cover = '', staticKey = '', lyricKey = '', transportKey = ''
  let lastLine = '', changedAt = 0, lastLyrics = -Infinity, layout = null, layoutKey = '', wordTimed = false
  let playback = {}, hitLine = null
  const images = createScreenImages(() => { dirty = true; invalidate() }, 4)

  function draw(state, now = performance.now()) {
    playback = state
    const track = state.track || {}, line = state.line && !state.line.placeholder ? state.line : null
    const nextLine = [track.id, line?.seconds, line?.text].join(':')
    if (nextLine !== lastLine) { lastLine = nextLine; changedAt = now }
    if (track.coverUrl !== cover) { cover = track.coverUrl; dirty = true }
    wordTimed = hasWordTiming(line); hitLine = line
    const entering = !state.reducedMotion && now - changedAt < 460
    const nextStatic = [track.id, track.name, track.artist].join('|')
    const redraw = dirty || nextStatic !== staticKey
    if (redraw) {
      const ctx = surface.context
      drawListeningBackdrop(ctx, images.get(cover))
      if (track.id) text(ctx, [track.name || '未命名歌曲', track.artist].filter(Boolean).join('  ·  '), 303, 804, 25, screenInk.muted, 1220)
      surface.refresh(); staticKey = nextStatic; dirty = false
    }
    const clock = wordTimed ? Math.floor(state.currentTime * (state.reducedMotion ? 8 : 30)) : 0
    const secondary = line?.translation || (line ? state.nextLine?.text || '' : track.id ? track.artist || '暂无同步歌词' : '在控制终端或发现屏添加音乐')
    const nextLyric = [nextLine, secondary, wordTimed, clock, state.loading, state.reducedMotion].join('|')
    if (redraw || (now - lastLyrics >= 32 && (entering || nextLyric !== lyricKey))) {
      const layer = layers[0], ctx = layer.context
      ctx.clearRect(0, 0, layer.width, layer.height); ctx.save(); ctx.translate(-layer.x, -layer.y)
      const displayLine = line || { text: state.loading ? '正在准备音乐…' : track.id ? track.name || '暂无同步歌词' : '选一首歌，开始聆听' }
      const key = [displayLine.text, wordTimed, line?.seconds].join(':')
      if (key !== layoutKey || line && layout?.source !== line) {
        let size = line ? 72 : 62, result
        do {
          ctx.font = font(size, 500); result = layoutLyric(displayLine, char => ctx.measureText(char).width, 1050)
          if (result.rows <= 2 || size <= 30) break
          size -= 4
        } while (true)
        const widths = Array(result.rows).fill(0)
        for (const glyph of result.glyphs) widths[glyph.row] = Math.max(widths[glyph.row], glyph.x + glyph.width)
        layout = { ...result, widths, size, source: line }; layoutKey = key
      }
      const ease = state.reducedMotion ? 1 : 1 - (1 - Math.max(0, Math.min(1, (now - changedAt) / 460))) ** 3
      const rows = layout.rows, lineHeight = Math.min(layout.size * 1.32, 204 / Math.max(1, rows - 1))
      const top = 401 - (rows - 1) * lineHeight * .55 + (1 - ease) * 10
      ctx.globalAlpha = .35 + ease * .65; ctx.font = font(layout.size, 500)
      ctx.shadowColor = '#020813'; ctx.shadowBlur = 12
      for (const glyph of layout.glyphs) {
        const x = WIDTH / 2 - layout.widths[glyph.row] / 2 + glyph.x, y = top + glyph.row * lineHeight
        const progress = wordFill(glyph.word, state.currentTime)
        ctx.fillStyle = progress === null ? screenInk.white : '#91a6bd'; ctx.fillText(glyph.char, x, y)
        if (progress !== null) {
          const width = Math.max(0, Math.min(glyph.width, glyph.total * progress - glyph.offset))
          if (width) {
            ctx.save(); ctx.beginPath(); ctx.rect(x - .5, y - layout.size * 1.2, width + .5, layout.size * 1.6); ctx.clip()
            ctx.fillStyle = screenInk.white; ctx.fillText(glyph.char, x, y); ctx.restore()
          }
        }
      }
      ctx.shadowBlur = 0; ctx.globalAlpha = .85; ctx.textAlign = 'center'
      text(ctx, secondary, WIDTH / 2, Math.min(559, top + (rows - 1) * lineHeight + 71), 32, '#d0d8e4', 1050)
      ctx.restore(); layer.refresh(); lyricKey = nextLyric; lastLyrics = now
    }
    const nextTransport = [Math.floor(state.currentTime * 8), state.duration, state.playing, state.loading, state.loading && !state.reducedMotion ? Math.floor(now / 50) : 0, state.reducedMotion].join('|')
    if (redraw || nextTransport !== transportKey) {
      const layer = layers[1], ctx = layer.context
      ctx.clearRect(0, 0, layer.width, layer.height); ctx.save(); ctx.translate(-layer.x, -layer.y)
      const progress = state.duration > 0 ? Math.max(0, Math.min(1, state.currentTime / state.duration)) : 0
      ctx.fillStyle = '#a2c8e12b'; ctx.fillRect(64, 747, 1920, 2)
      if (progress) {
        const gradient = ctx.createLinearGradient(64, 0, 1984, 0)
        gradient.addColorStop(0, '#79c4e9'); gradient.addColorStop(1, '#d9e3ff')
        ctx.fillStyle = gradient; ctx.fillRect(64, 747, 1920 * progress, 2)
      }
      for (const control of TRANSPORT) {
        const icon = control.action === 'toggle' ? state.loading ? 'loading' : state.playing ? 'pause' : 'play' : control.action
        ctx.save(); if (state.loading && control.action !== 'toggle') ctx.globalAlpha = .35
        drawPlayerIcon(ctx, icon, control.x, 795, control.action === 'toggle' ? 29 : 25, screenInk.white, icon === 'loading' && !state.reducedMotion ? now / 150 : 0)
        ctx.restore()
      }
      ctx.textAlign = 'right'; ctx.font = '400 25px Bahnschrift, "Segoe UI", sans-serif'; ctx.fillStyle = screenInk.white
      ctx.fillText(formatTime(state.currentTime) + '  /  ' + formatTime(state.duration), 1984, 804)
      ctx.restore(); layer.refresh(); transportKey = nextTransport
    }
    return entering || state.loading && !state.reducedMotion
  }

  return {
    texture: surface.texture, layers, draw,
    setResolution(width) {
      const scale = width / WIDTH
      let changed = surface.setScale(scale)
      for (const layer of layers) changed = layer.setScale(scale) || changed
      if (changed) dirty = true
    },
    hitTest(uv) {
      const x = uv.x * WIDTH, y = (1 - uv.y) * HEIGHT
      if (y >= 735 && y <= 765 && x >= 64 && x <= 1984) return { action: 'progress', payload: (x - 64) / 1920 }
      if (y >= 767 && y <= 825) {
        if (!playback.loading) for (const control of TRANSPORT) if (Math.abs(x - control.x) <= 30) return { action: control.action }
      }
      if (hitLine && x >= 364 && x <= 1684 && y >= 256 && y <= 584) return { action: 'lyric', payload: hitLine.seconds }
      return null
    },
    getState: () => ({ wordTimed, line: lastLine }),
    dispose() { images.dispose(); surface.texture.dispose(); layers.forEach(layer => layer.texture.dispose()) },
  }
}
