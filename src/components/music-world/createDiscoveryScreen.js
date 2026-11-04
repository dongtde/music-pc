import * as THREE from 'three'
import { canvasSurface, DISCOVERY_PORTALS } from './worldSurfaces.js'
import { ink, text, rounded, cropImage, createScreenImages } from './screenDrawing.js'
import { ARTIST_INITIALS, FEED_LAYOUT, FEED_VIEW_ROWS } from './screenFeeds.js'
import { drawPlayerIcon } from '../playerTransportDrawing.js'
import { drawMusicLoading } from './drawMusicLoading.js'

const FRAME_INTERVAL = 1000 / 30, REVEAL_DURATION = 520

function drawNavigationIcon(ctx, icon, x, y, color) {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = ctx.lineJoin = 'round'
  ctx.beginPath()
  if (icon === 'focus') {
    ctx.moveTo(-9, 3); ctx.lineTo(-9, 10); ctx.lineTo(9, 10); ctx.lineTo(9, 3)
    ctx.moveTo(-9, -3); ctx.lineTo(-9, -10); ctx.lineTo(-3, -10)
    ctx.moveTo(1, -10); ctx.lineTo(10, -10); ctx.lineTo(10, -1); ctx.moveTo(10, -10); ctx.lineTo(-1, 1)
  } else if (icon === 'back' || icon === 'forward') {
    const sign = icon === 'back' ? 1 : -1
    ctx.moveTo(3 * sign, -8); ctx.lineTo(-5 * sign, 0); ctx.lineTo(3 * sign, 8)
  } else if (icon === 'retry') {
    ctx.arc(0, 0, 9, -.7, Math.PI * 1.6); ctx.moveTo(8, -10); ctx.lineTo(8, -4); ctx.lineTo(2, -4)
  }
  ctx.stroke(); ctx.restore()
}

export function createDiscoveryScreen(index, invalidate) {
  const portal = DISCOVERY_PORTALS[index], surface = canvasSurface(FEED_LAYOUT.size, FEED_LAYOUT.size), ctx = surface.context
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.76, 1.76), new THREE.MeshBasicMaterial({ map: surface.texture, toneMapped: false }))
  mesh.name = `discovery-screen-${portal.id}`; mesh.userData = { action: 'feed', payload: portal.id, hint: portal.name }
  let state = { items: [], scroll: 0, busy: true, initial: -1 }, trackId = '', playing = false, loading = false, reducedMotion = false
  let dirty = true, zones = [], lastDraw = -Infinity, wasAnimating = false, revealStart = null, revealPending = false
  const images = createScreenImages(() => { dirty = true; invalidate() })
  const accent = [ink.ice, ink.copper, '#b4c5f0', '#d6dbaa'][index]

  function draw(now = performance.now()) {
    if (revealPending) { revealStart = now; revealPending = false }
    const age = revealStart === null ? Infinity : now - revealStart
    const { listTop: top, listBottom: bottom, rowHeight } = FEED_LAYOUT, items = state.items || [], start = Math.floor(state.scroll || 0)
    const visibleItems = items.slice(start, start + Math.ceil(FEED_VIEW_ROWS) + 1)
    const trackLoading = loading && visibleItems.some(item => item.kind === 'song' && String(item.id) === String(trackId))
    const revealing = !reducedMotion && age < REVEAL_DURATION
    const animating = !reducedMotion && (state.busy || trackLoading || revealing)
    if (!dirty && !animating && !wasAnimating) return false
    if (!dirty && animating && now - lastDraw < FRAME_INTERVAL) return true
    dirty = false; lastDraw = now; wasAnimating = animating; zones = []
    const hasInitials = portal.id === 'artists' && !state.detail, listRight = hasInitials ? 648 : 738
    ctx.fillStyle = ink.bg; ctx.fillRect(0, 0, 768, 768)
    rounded(ctx, 0, 0, 768, 4, 0, accent)
    if (state.detail) {
      rounded(ctx, 24, 47, 50, 50, 25, '#a9c5d014'); drawNavigationIcon(ctx, 'back', 49, 72, accent)
      zones.push({ x: 16, y: 34, w: 70, h: 76, action: 'feed-back' })
    }
    const titleX = state.detail ? 98 : 30
    text(ctx, state.detail ? state.title : portal.name, titleX, 86, state.detail ? 29 : 36, ink.light, 650 - titleX, 500)
    rounded(ctx, 684, 47, 54, 50, 25, '#a9c5d014'); drawNavigationIcon(ctx, 'focus', 711, 72, accent)
    zones.push({ x: 674, y: 34, w: 80, h: 76, action: 'feed-focus' })
    ctx.fillStyle = '#aacad221'; ctx.fillRect(30, 117, 708, 1)

    ctx.save(); ctx.beginPath(); ctx.rect(0, top, listRight, bottom - top); ctx.clip()
    visibleItems.forEach((item, offset) => {
      const i = start + offset, y = top + (i - (state.scroll || 0)) * rowHeight, current = item.kind === 'song' && String(item.id) === String(trackId)
      const progress = revealing ? Math.max(0, Math.min(1, (age - offset * 28) / 320)) : 1
      ctx.save(); ctx.globalAlpha = progress; ctx.translate(0, 10 * (1 - progress) ** 3)
      rounded(ctx, 20, y + 2, listRight - 26, 88, 6, current ? '#87deda1e' : i % 2 ? '#102d3c70' : '#102d3c20')
      const image = images.get(item.coverUrl), metadata = item.artist || item.tag || item.description || item.desc || item.label
      if (image) cropImage(ctx, image, 32, y + 13, 64, item.kind === 'artist' ? 32 : 3)
      else { rounded(ctx, 32, y + 13, 64, 64, item.kind === 'artist' ? 32 : 3, '#28434f'); text(ctx, item.kind === 'artist' ? '♪' : '♫', 49, y + 55, 29, accent) }
      text(ctx, item.name || item.title, 117, y + (metadata ? 37 : 54), 24, current ? accent : ink.light, listRight - 205, 500)
      if (metadata) text(ctx, metadata, 118, y + 66, 17, ink.muted, listRight - 215)
      if (item.kind === 'song') drawPlayerIcon(ctx, current && loading ? 'loading' : current && playing ? 'pause' : 'play', listRight - 35, y + 46, 24, accent, current && loading && !reducedMotion ? now / 180 : 0)
      else drawNavigationIcon(ctx, 'forward', listRight - 35, y + 46, accent)
      ctx.restore()
      // Row hitboxes stop before the alphabet rail, including during entry motion.
      zones.push({ x: 20, y: Math.max(top, y), w: listRight - 26, h: Math.max(0, Math.min(bottom, y + rowHeight) - Math.max(top, y)), action: 'feed-select', item })
    })
    ctx.restore()
    if (items.length > FEED_VIEW_ROWS) {
      const h = Math.max(16, (bottom - top) * FEED_VIEW_ROWS / items.length), y = top + (bottom - top - h) * state.scroll / (items.length - FEED_VIEW_ROWS)
      rounded(ctx, listRight + 6, top, 3, bottom - top, 2, '#adcbd51a'); rounded(ctx, listRight + 5, y, 5, h, 3, accent)
    }
    if (hasInitials) drawInitials(top, bottom)
    if (!items.length) {
      const center = (20 + listRight) / 2
      if (state.busy) drawMusicLoading(ctx, center, 404, 94, accent, now, reducedMotion)
      else {
        drawMusicLoading(ctx, center, 370, 54, '#617b8a', 0, true)
        ctx.save(); ctx.textAlign = 'center'
        text(ctx, state.error ? '加载失败' : hasInitials ? '暂无歌手' : '暂无内容', center, 479, 22, ink.muted)
        ctx.restore()
      }
    }
    ctx.fillStyle = '#aacad214'; ctx.fillRect(30, bottom + 8, 708, 1)
    const atBottom = state.scroll >= Math.max(0, items.length - FEED_VIEW_ROWS) - .1
    if (state.busy && items.length) drawMusicLoading(ctx, 384, 735, 18, accent, now, reducedMotion)
    else if (!state.busy && (state.error || !items.length || items.length > FEED_VIEW_ROWS || state.more)) {
      const retry = state.error || !items.length, up = !retry && atBottom && !state.more
      rounded(ctx, 336, 715, 96, 42, 21, '#a9c5d014')
      if (retry) drawNavigationIcon(ctx, 'retry', 384, 736, accent)
      else drawPlayerIcon(ctx, up ? 'up' : 'down', 384, 736, 24, accent)
      zones.push({ x: 326, y: bottom + 12, w: 116, h: 58, action: retry ? 'feed-retry' : !atBottom ? 'feed-page' : state.more ? 'feed-more' : 'feed-top' })
    }
    surface.refresh()
    return animating
  }

  function drawInitials(top, bottom) {
    // Two narrow columns keep every letter legible and clickable on a physical screen.
    const x = 676, width = 70, step = (bottom - top) / 14
    rounded(ctx, x - 6, top, width + 12, bottom - top, 10, '#102d3c70')
    ARTIST_INITIALS.forEach((initial, index) => {
      const hot = index === 0, col = hot ? 0 : (index - 1) % 2, row = hot ? 0 : Math.floor((index - 1) / 2) + 1
      const w = hot ? width : width / 2, left = x + col * width / 2, y = top + row * step, selected = initial === (state.initial ?? -1)
      if (selected) rounded(ctx, left + 2, y + 3, w - 4, step - 6, 7, accent)
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = selected ? ink.bg : ink.muted
      ctx.font = hot ? '500 17px "Microsoft YaHei", sans-serif' : '500 21px Bahnschrift, sans-serif'
      ctx.fillText(hot ? '热门' : initial, left + w / 2, y + step / 2 + 1); ctx.restore()
      zones.push({ x: left, y, w, h: step, action: 'feed-initial', initial })
    })
  }

  return {
    mesh, draw,
    setState(value) {
      if (!value || ['items', 'title', 'detail', 'scroll', 'busy', 'error', 'more', 'initial'].every(key => value[key] === state[key])) return
      if (!value.items.length) { revealStart = null; revealPending = false }
      else if (!value.busy && (!state.items.length || state.detail !== value.detail)) revealPending = true
      // Keep a snapshot: initial feed state is also mutated by the controller.
      state = { ...value }; dirty = true
    },
    setPlayback(value) {
      if (trackId !== value.track?.id || playing !== value.playing || loading !== value.loading || reducedMotion !== Boolean(value.reducedMotion)) {
        trackId = value.track?.id; playing = value.playing; loading = value.loading; reducedMotion = Boolean(value.reducedMotion); dirty = true
      }
    },
    hitTest(uv) {
      const x = uv.x * FEED_LAYOUT.size, y = (1 - uv.y) * FEED_LAYOUT.size, zone = zones.find(z => x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h)
      return zone ? { action: zone.action, payload: { id: portal.id, item: zone.item, initial: zone.initial } } : null
    },
    getState: () => ({ id: portal.id, scroll: state.scroll, count: state.items.length, detail: state.detail?.id, initial: state.initial }),
    dispose() { images.dispose(); surface.texture.dispose() },
  }
}
