import * as THREE from 'three'
import { canvasSurface } from './worldSurfaces.js'
import { ink, text, rounded, createScreenImages } from './screenDrawing.js'
import { createScreenList } from './createScreenList.js'
import { drawMusicLoading } from './drawMusicLoading.js'
import { worldControls as controls } from './worldControlTheme.js'

const SIZE = 768, TOP = 274, BOTTOM = 710, ROW = 94
export const SEARCH_INPUT_RECT = Object.freeze({ x: 78, y: 129, width: 498, height: 66 })

export function createSongSearchScreen(invalidate = () => {}) {
  const surface = canvasSurface(SIZE, SIZE, { dynamic: true, onReady: invalidate }), ctx = surface.context
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.76, 1.76), new THREE.MeshBasicMaterial({ map: surface.texture, toneMapped: false }))
  mesh.name = 'world-song-search'
  mesh.userData = { action: 'song-search', hint: '歌曲搜索 · 输入歌名或歌手' }
  let state = { items: [], history: [], hot: [] }, playback = {}, scroll = 0, zones = [], dirty = true, lastDraw = -Infinity
  const changed = () => { dirty = true; invalidate() }
  const images = createScreenImages(changed), list = createScreenList(ctx, { images, invalidate: changed })
  const point = uv => uv && ({ x: uv.x * SIZE, y: (1 - uv.y) * SIZE })
  const maxScroll = () => Math.max(0, state.items.length - (BOTTOM - TOP) / ROW)
  function button(label, x, y, w, h, command, payload, primary = false) {
    rounded(ctx, x, y, w, h, 9, primary ? controls.accent : controls.surface)
    ctx.save(); ctx.textAlign = 'center'
    text(ctx, label, x + w / 2, y + h / 2 + 9, 25, primary ? controls.onAccent : controls.accent, w - 16)
    ctx.restore(); zones.push({ x, y, w, h, command, payload })
  }
  function draw(now = performance.now(), audioLevels) {
    const animating = (state.busy || state.hotLoading || list.getState().animating) && !playback.reducedMotion
    if (!dirty && !animating) return false
    if (!dirty && now - lastDraw < 1000 / 30) return animating
    dirty = false; lastDraw = now; zones = []
    ctx.fillStyle = ink.bg; ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.fillStyle = controls.accent; ctx.fillRect(0, 0, SIZE, 4)
    if (state.keyword) button('‹', 28, 38, 54, 55, 'discovery')
    text(ctx, '歌曲搜索', state.keyword ? 100 : 32, 82, 36, ink.light, 560, 500)
    ctx.fillStyle = '#aacad221'; ctx.fillRect(30, 111, 708, 1)
    rounded(ctx, 30, 126, 708, 72, 10, controls.surface)
    text(ctx, '⌕', 47, 175, 35, controls.accent)
    text(ctx, state.draft || '搜索歌名或歌手', 84, 172, 27, state.draft ? ink.light : ink.muted, 475)
    zones.push({ x: SEARCH_INPUT_RECT.x, y: SEARCH_INPUT_RECT.y, w: SEARCH_INPUT_RECT.width, h: SEARCH_INPUT_RECT.height, command: 'input' })
    button('搜索', 594, 135, 132, 54, 'search', undefined, true)
    if (!state.keyword) {
      text(ctx, '历史搜索', 32, 245, 28)
      if (state.history.length) button('清空', 630, 213, 108, 43, 'clear-history')
      let x = 32, y = 265
      state.history.slice(0, 8).forEach(keyword => {
        ctx.font = '25px "Microsoft YaHei", sans-serif'
        const w = Math.min(216, ctx.measureText(keyword).width + 30)
        if (x + w > 738) { x = 32; y += 54 }
        if (y > 322) return
        button(keyword, x, y, w, 44, 'keyword', keyword); x += w + 10
      })
      if (!state.history.length) text(ctx, '试试下面的热门歌曲', 32, 302, 24, ink.muted)
      text(ctx, '热门搜索', 32, 397, 28)
      if (state.hotLoading && !state.hot.length) drawMusicLoading(ctx, 384, 552, 76, controls.accent, now, playback.reducedMotion)
      else if (!state.hot.length) {
        text(ctx, state.hotError || '暂无热门搜索', 32, 470, 25, ink.muted)
        button('重新加载', 32, 497, 180, 50, 'hot-retry')
      } else state.hot.forEach((item, index) => {
        const x = 32 + index % 2 * 359, y = 422 + Math.floor(index / 2) * 63
        rounded(ctx, x, y, 347, 53, 8, controls.surface)
        text(ctx, index + 1, x + 14, y + 36, 28, controls.accent)
        text(ctx, item.keyword, x + 57, y + 35, 26, ink.light, 272)
        zones.push({ x, y, w: 347, h: 53, command: 'keyword', payload: item.keyword })
      })
    } else {
      text(ctx, '单曲', 32, 248, 28)
      text(ctx, state.feedback || `${state.total || state.items.length} 首结果`, 110, 247, 23, state.feedback ? controls.accent : ink.muted, 400)
      if (state.items.length) button('全部加入', 578, 213, 160, 43, 'add-all')
      list.draw({ items: state.items, area: { x: 20, y: TOP, width: 718, height: BOTTOM - TOP, rowHeight: ROW }, scroll, playback: { ...playback, pendingKeys: [...(playback.pendingKeys || []), ...(state.pending || [])] }, action: 'enqueue', now, audioLevels })
      if (!state.items.length) {
        if (state.busy) drawMusicLoading(ctx, 384, 465, 94, controls.accent, now, playback.reducedMotion)
        else {
          text(ctx, state.error ? '歌曲搜索失败' : '没有找到相关歌曲', 190, 463, 30, ink.light, 500)
          text(ctx, state.error || '换个歌名或歌手，再试一次', 190, 510, 24, ink.muted, 500)
          button(state.error ? '重新搜索' : '查看热门搜索', 274, 552, 220, 54, state.error ? 'search' : 'discovery')
        }
      }
      if (state.items.length && state.more) button(state.busy ? '正在加载' : state.error ? '重试' : '加载更多歌曲', 254, 718, 260, 40, 'more')
      if (maxScroll() > 0) {
        const h = Math.max(20, (BOTTOM - TOP) ** 2 / (state.items.length * ROW))
        rounded(ctx, 747, TOP + scroll / maxScroll() * (BOTTOM - TOP - h), 4, h, 2, controls.accent)
      }
    }
    surface.refresh()
    return animating
  }
  return {
    mesh, draw,
    setResolution(width) { if (surface.setScale(width / SIZE)) dirty = true },
    setState(value) { if (state.keyword !== value.keyword) { scroll = 0; list.reset() }; state = value; scroll = Math.min(scroll, maxScroll()); changed() },
    setPlayback(value) {
      if (playback.track?.id !== value.track?.id || playback.playing !== value.playing || playback.loading !== value.loading || playback.loadingTrack?.id !== value.loadingTrack?.id || (playback.pendingKeys || []).join('|') !== (value.pendingKeys || []).join('|') || playback.reducedMotion !== value.reducedMotion) changed()
      playback = value
    },
    setHover(uv) { return list.setHover(point(uv)) }, cancelClick: () => list.cancelClick(),
    scroll(delta) { scroll = THREE.MathUtils.clamp(scroll + delta / ROW, 0, maxScroll()); list.cancelClick(); changed(); return scroll >= maxScroll() - .3 && state.more && !state.busy && !state.error },
    select(uv, options) {
      draw(); const p = point(uv)
      const zone = p && zones.find(z => p.x >= z.x && p.x < z.x + z.w && p.y >= z.y && p.y < z.y + z.h)
      if (zone) return { command: zone.command, payload: zone.payload }
      const row = list.select(p, options)
      return row ? { command: 'add', payload: row.item } : null
    },
    getState: () => ({ keyword: state.keyword, count: state.items.length, scroll, list: list.getState() }),
    dispose() { images.dispose(); surface.texture.dispose(); mesh.geometry.dispose(); mesh.material.dispose(); mesh.removeFromParent() },
  }
}
