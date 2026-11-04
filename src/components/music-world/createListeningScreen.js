import { canvasSurface } from './worldSurfaces.js'
import { ink, font, text, rounded, cropImage, createScreenImages, formatTime } from './screenDrawing.js'
import { hasWordTiming, layoutLyric, wordFill } from './lyricTypography.js'
import { drawTransportButton } from '../playerTransportDrawing.js'

export function createListeningScreen(invalidate) {
  const surface = canvasSurface(2048, 840), ctx = surface.context, zones = []
  let dirty = true, signature = '', lastLine = '', changedAt = 0, lastDraw = 0, layout = null, layoutKey = '', wordTimed = false
  const images = createScreenImages(() => { dirty = true; invalidate() }, 4)
  const zone = (x, y, w, h, action, payload) => zones.push({ x, y, w, h, action, payload })
  function draw(state, now = performance.now()) {
    const line = state.line, track = state.track || {}, lyricKey = `${track.id}:${line?.seconds}:${line?.text}`
    if (lyricKey !== lastLine) { lastLine = lyricKey; changedAt = now; dirty = true }
    const animation = !state.reducedMotion && (now - changedAt < 600 || state.loading)
    const timed = hasWordTiming(line), clockRate = timed && !state.reducedMotion ? 30 : 8
    const next = [track.id, track.name, track.artist, track.coverUrl, state.playing, state.loading, state.loading&&!state.reducedMotion?Math.floor(now/40):0, Math.floor(state.currentTime*clockRate), state.duration, lyricKey, state.commentsTotal, line?.translation, timed].join('|')
    if (!dirty && next === signature && !animation || !dirty && now - lastDraw < 32) return animation
    lastDraw = now; signature = next; dirty = false; zones.length = 0
    const art = images.get(track.coverUrl)
    ctx.fillStyle = ink.bg; ctx.fillRect(0, 0, 2048, 840)
    if (art) {
      ctx.save(); ctx.globalAlpha = .15; cropImage(ctx, art, 0, -540, 2048); ctx.restore()
      const veil = ctx.createLinearGradient(0, 0, 2048, 0); veil.addColorStop(0, '#081d2a55'); veil.addColorStop(.36, '#081d2af2'); veil.addColorStop(1, '#081d2ae8'); ctx.fillStyle = veil; ctx.fillRect(0, 0, 2048, 840)
    }
    text(ctx, '澜音  /  LIVE SESSION', 64, 53, 22, ink.muted)
    text(ctx, state.loading ? '正在准备音乐…' : state.playing ? '● 正在播放' : '○ 静候播放', 1740, 53, 22, state.playing ? ink.ice : ink.muted)
    rounded(ctx, 64, 96, 516, 516, 8, '#c3d6d31a')
    if (art) cropImage(ctx, art, 76, 108, 492, 3)
    else {
      rounded(ctx, 76, 108, 492, 492, 3, ink.panel)
      for (let r = 30; r < 216; r += 8) { ctx.beginPath(); ctx.arc(322, 354, r, 0, Math.PI * 2); ctx.strokeStyle = r % 3 ? '#8eb5c11f' : '#cde4da3a'; ctx.stroke() }
      rounded(ctx, 293, 325, 58, 58, 29, ink.copper); rounded(ctx, 317, 349, 10, 10, 5, ink.bg)
    }
    text(ctx, track.id ? track.name : '挑一首歌，坐下来听', 64, 673, 40, ink.light, 535, 500)
    text(ctx, track.id ? track.artist || '未知歌手' : '右侧发现屏，遇见下一首喜欢', 66, 715, 23, ink.muted, 530)
    wordTimed = hasWordTiming(line)
    text(ctx, wordTimed ? '逐字同步' : line && !line.placeholder ? '逐行同步' : '音乐与此刻', 700, 139, 20, ink.ice)
    text(ctx, 'LYRICS', 1876, 139, 18, ink.muted)
    const displayLine = line && !line.placeholder ? line : { text: track.id ? '让旋律继续。' : '整个空间，为这一首歌而亮。' }
    const key = `${displayLine.text}:${wordTimed}:${line?.seconds}`
    if (key !== layoutKey || layout?.source !== displayLine) {
      let size = 64, result
      do { ctx.font = font(size, 500); result = layoutLyric(displayLine, char => ctx.measureText(char).width, 1220); if (result.rows <= 3 || size <= 32) break; size -= 4 } while (true)
      layout = { ...result, size, source: displayLine }; layoutKey = key
    }
    const entering = state.reducedMotion ? 1 : Math.min(1, (now - changedAt) / 520), ease = 1 - (1 - entering) ** 3
    const top = 404 - Math.min(2, layout.rows - 1) * layout.size * .72 + (1 - ease) * 22
    const lastBaseline = top + (layout.rows - 1) * layout.size * 1.45
    text(ctx, state.previousLine?.text || '', 700, top - layout.size * 1.6, 28, '#678895', 1220)
    ctx.save(); ctx.beginPath(); ctx.rect(684, 244, 1290, 350); ctx.clip(); ctx.globalAlpha = .35 + ease * .65
    ctx.font = font(layout.size, 500)
    for (const glyph of layout.glyphs) {
      const x = 700 + glyph.x, y = top + glyph.row * layout.size * 1.45, progress = wordFill(glyph.word, state.currentTime)
      ctx.fillStyle = progress === null ? ink.light : '#7d969f'; ctx.fillText(glyph.char, x, y)
      if (progress !== null) {
        const width = Math.max(0, Math.min(glyph.width, glyph.total * progress - glyph.offset))
        if (width) {
          ctx.save(); ctx.beginPath(); ctx.rect(x - .5, y - layout.size * 1.2, width + .5, layout.size * 1.6); ctx.clip()
          ctx.fillStyle = ink.light; ctx.shadowColor = ink.ice; ctx.shadowBlur = state.reducedMotion || progress >= 1 ? 0 : 12; ctx.fillText(glyph.char, x, y); ctx.restore()
        }
      }
    }
    ctx.restore()
    if (line && !line.placeholder) zone(684, 244, 1290, 350, 'lyric', line.seconds)
    text(ctx, line?.translation || (!line || line.placeholder ? '此曲暂无同步歌词' : ''), 700, Math.min(617,lastBaseline + 64), 25, ink.muted, 1220)
    text(ctx, state.nextLine?.text || '', 700, Math.min(688,lastBaseline + 130), 30, '#7595a0', 1220)
    rounded(ctx, 64, 751, 1920, 3, 2, '#99bdca36')
    const progress = state.duration > 0 ? Math.max(0, Math.min(1, state.currentTime / state.duration)) : 0
    rounded(ctx, 64, 751, Math.max(2, 1920 * progress), 3, 2, ink.ice); zone(64, 733, 1920, 35, 'progress')
    text(ctx, `${formatTime(state.currentTime)}  /  ${formatTime(state.duration)}`, 64, 802, 22, ink.muted)
    ;[{ x: 909, action: 'previous' }, { x: 1024, action: 'toggle' }, { x: 1139, action: 'next' }].forEach(button => {
      drawTransportButton(ctx,button.action,button.x,799,button.action==='toggle'?58:42,state,{now})
      if(!state.loading)zone(button.x-36,767,72,65,button.action)
    })
    text(ctx, `歌曲评论  ·  ${state.commentsTotal || 0} 条  ↗`, 1630, 804, 22, ink.copper, 350); zone(1620, 768, 380, 64, 'comments')
    surface.refresh(); return animation
  }
  return {
    texture: surface.texture, draw,
    hitTest(uv) { const x = uv.x * 2048, y = (1 - uv.y) * 840, hit = zones.find(z => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h); return hit ? { action: hit.action, payload: hit.action === 'progress' ? (x - hit.x) / hit.w : hit.payload } : null },
    getState: () => ({ wordTimed, line: lastLine }),
    dispose() { images.dispose(); surface.texture.dispose() },
  }
}
