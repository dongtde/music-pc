import * as THREE from 'three'
import { canvasSurface, DISCOVERY_PORTALS } from './worldSurfaces.js'
import { ink, text, rounded, createScreenImages } from './screenDrawing.js'
import { ARTIST_INITIALS, FEED_LAYOUT, FEED_VIEW_ROWS } from './screenFeeds.js'
import { createScreenList } from './createScreenList.js'
import { drawMusicLoading } from './drawMusicLoading.js'

const FRAME_INTERVAL = 1000 / 30, REVEAL_DURATION = 520

function drawNavigationIcon(ctx, icon, x, y, color) {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = ctx.lineJoin = 'round'
  ctx.beginPath()
  if (icon === 'focus') {
    ctx.moveTo(-9, 3); ctx.lineTo(-9, 10); ctx.lineTo(9, 10); ctx.lineTo(9, 3)
    ctx.moveTo(-9, -3); ctx.lineTo(-9, -10); ctx.lineTo(-3, -10)
    ctx.moveTo(1, -10); ctx.lineTo(10, -10); ctx.lineTo(10, -1); ctx.moveTo(10, -10); ctx.lineTo(-1, 1)
  } else if (icon === 'back') {
    ctx.moveTo(3, -8); ctx.lineTo(-5, 0); ctx.lineTo(3, 8)
  } else if (icon === 'retry') {
    ctx.arc(0, 0, 9, -.7, Math.PI * 1.6); ctx.moveTo(8, -10); ctx.lineTo(8, -4); ctx.lineTo(2, -4)
  }
  ctx.stroke(); ctx.restore()
}

export function createDiscoveryScreen(index, invalidate) {
  const portal = DISCOVERY_PORTALS[index], surface = canvasSurface(FEED_LAYOUT.size, FEED_LAYOUT.size), ctx = surface.context
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.76, 1.76), new THREE.MeshBasicMaterial({ map: surface.texture, toneMapped: false }))
  mesh.name = 'discovery-screen-' + portal.id; mesh.userData = { action: 'feed', payload: portal.id, hint: portal.name }
  let state = { items: [], scroll: 0, busy: true, initial: -1 }, playback = {}
  let dirty = true, zones = [], lastDraw = -Infinity, wasAnimating = false, revealStart = null, revealPending = false
  const changed = () => { dirty = true; invalidate() }
  const images = createScreenImages(changed)
  const list = createScreenList(ctx, { images, invalidate: changed })
  const accent = [ink.ice, ink.copper, '#b4c5f0', '#d6dbaa'][index]
  const point = uv => uv ? { x: uv.x * FEED_LAYOUT.size, y: (1 - uv.y) * FEED_LAYOUT.size } : null

  function draw(now = performance.now(), audioLevels = null) {
    if (revealPending) { revealStart = now; revealPending = false }
    const age = revealStart === null ? Infinity : now - revealStart
    const { listTop: top, listBottom: bottom, rowHeight } = FEED_LAYOUT, items = state.items || []
    const revealing = !playback.reducedMotion && age < REVEAL_DURATION
    const animating = !playback.reducedMotion && (state.busy || revealing || list.getState().animating)
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
    text(ctx, state.detail ? state.title : portal.name, titleX, 86, state.detail ? 29 : 36, ink.light, (state.busy || state.error ? 590 : 650) - titleX, 500)
    rounded(ctx, 684, 47, 54, 50, 25, '#a9c5d014'); drawNavigationIcon(ctx, 'focus', 711, 72, accent)
    zones.push({ x: 674, y: 34, w: 80, h: 76, action: 'feed-focus' })
    if (state.busy && items.length) drawMusicLoading(ctx, 630, 72, 17, accent, now, playback.reducedMotion)
    else if (state.error && items.length) {
      rounded(ctx, 604, 47, 50, 50, 25, '#a9c5d014'); drawNavigationIcon(ctx, 'retry', 629, 72, accent)
      zones.push({ x: 600, y: 34, w: 60, h: 76, action: 'feed-retry' })
    }
    ctx.fillStyle = '#aacad221'; ctx.fillRect(30, 117, 708, 1)

    list.draw({
      items, area: { x: 20, y: top, width: listRight - 26, height: bottom - top, rowHeight },
      scroll: state.scroll || 0, playback, accent, action: 'enqueue', now, revealAge: revealing ? age : Infinity, audioLevels,
    })
    if (items.length > FEED_VIEW_ROWS) {
      const h = Math.max(16, (bottom - top) * FEED_VIEW_ROWS / items.length), y = top + (bottom - top - h) * state.scroll / (items.length - FEED_VIEW_ROWS)
      rounded(ctx, listRight + 6, top, 3, bottom - top, 2, '#adcbd51a'); rounded(ctx, listRight + 5, y, 5, h, 3, accent)
    }
    if (hasInitials) drawInitials(top, bottom)
    if (!items.length) {
      const center = (20 + listRight) / 2
      if (state.busy) drawMusicLoading(ctx, center, 414, 94, accent, now, playback.reducedMotion)
      else {
        drawMusicLoading(ctx, center, 370, 54, '#617b8a', 0, true)
        ctx.save(); ctx.textAlign = 'center'
        text(ctx, state.error ? '加载失败' : hasInitials ? '暂无歌手' : '暂无内容', center, 479, 22, ink.muted)
        if (state.error) {
          rounded(ctx, center - 60, 507, 120, 45, 22, '#a9c5d014')
          text(ctx, '重试', center, 538, 21, accent)
          zones.push({ x: center - 60, y: 507, w: 120, h: 45, action: 'feed-retry' })
        }
        ctx.restore()
      }
    }
    surface.refresh()
    return !playback.reducedMotion && (state.busy || revealing || list.getState().animating)
  }

  function drawInitials(top, bottom) {
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

  function headerHit(uv) {
    const at = point(uv)
    return at && zones.find(zone => at.x >= zone.x && at.x < zone.x + zone.w && at.y >= zone.y && at.y < zone.y + zone.h)
  }

  return {
    mesh, draw,
    setState(value) {
      if (!value || ['items', 'title', 'detail', 'scroll', 'busy', 'error', 'more', 'initial'].every(key => value[key] === state[key])) return
      if (value.items !== state.items || value.detail !== state.detail || value.scroll !== state.scroll) list.reset()
      if (!value.items.length) { revealStart = null; revealPending = false }
      else if (!value.busy && (!state.items.length || state.detail !== value.detail)) revealPending = true
      state = { ...value }; dirty = true
    },
    setPlayback(value) {
      if (playback.track?.id !== value.track?.id || playback.playing !== value.playing || playback.loading !== value.loading || playback.loadingTrack?.id !== value.loadingTrack?.id || (playback.pendingKeys || []).join('|') !== (value.pendingKeys || []).join('|') || playback.reducedMotion !== Boolean(value.reducedMotion)) dirty = true
      playback = { track: value.track, playing: value.playing, loading: value.loading, loadingTrack: value.loadingTrack, pendingKeys: value.pendingKeys, reducedMotion: Boolean(value.reducedMotion) }
    },
    setHover(uv) { draw(); return list.setHover(point(uv)) },
    cancelClick: () => list.cancelClick(),
    select(uv, options) {
      draw()
      const control = headerHit(uv)
      if (control) { list.cancelClick(); return { action: control.action, payload: { id: portal.id, initial: control.initial } } }
      const row = list.select(point(uv), options)
      return row ? { action: 'feed-select', payload: { id: portal.id, item: row.item } } : null
    },
    getState: () => ({ id: portal.id, scroll: state.scroll, count: state.items.length, detail: state.detail?.id, initial: state.initial, list: list.getState(), controls: zones.map(zone => zone.action) }),
    dispose() { images.dispose(); surface.texture.dispose() },
  }
}
