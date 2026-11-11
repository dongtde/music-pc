import * as THREE from 'three'
import { canvasSurface } from './worldSurfaces.js'
import { text, rounded } from './screenDrawing.js'
import { drawPlayerIcon } from '../playerTransportDrawing.js'

const SIZE = 1024, GOLD = '#efd4a1', WHITE = '#eef4ff', MUTED = '#8ca5bf'
const REFRESH_TURN = 600, FRAME_INTERVAL = 1000 / 30
export function createListeningLobbyScreen(invalidate) {
  const surface = canvasSurface(SIZE, SIZE, { dynamic: true, onReady: invalidate }), ctx = surface.context
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.76, 1.76), new THREE.MeshBasicMaterial({ map: surface.texture, toneMapped: false }))
  mesh.name = 'world-listening-lobby'; mesh.userData = { action: 'lobby', hint: '一起听 · 创建或加入房间' }
  let state = { rooms: [], total: 0 }, dirty = true, zones = [], hovered = '', scroll = 0
  let refreshStart = null, refreshEnd = 0, reducedMotion = false, lastFrame = -1, wasRefreshing = false
  const changed = () => { dirty = true; invalidate() }
  function button(x, y, w, h, label, action, payload, primary = false, disabled = false) {
    const id = `${action}:${payload || ''}`, hot = hovered === id && !disabled
    rounded(ctx, x, y, w, h, 8, disabled ? '#1c2c40' : primary ? hot ? '#ffe6b7' : GOLD : hot ? '#2d4764' : '#1a3048')
    ctx.save(); ctx.textAlign = 'center'
    text(ctx, label, x + w / 2, y + h / 2 + 10, 28, disabled ? '#617991' : primary ? '#172133' : WHITE, w - 16, 500); ctx.restore()
    zones.push({ x, y, w, h, action, payload, id, label, disabled })
  }
  function icon(x, y, glyph, label, action, payload, disabled = false, feedback = {}) {
    const id = `${action}:${payload || ''}`
    ctx.save(); ctx.translate(x + 32, y + 32); ctx.scale(feedback.scale || 1, feedback.scale || 1)
    rounded(ctx, -32, -32, 64, 64, 8, feedback.active ? '#34506d' : hovered === id && !disabled ? '#2d4764' : '#1a3048')
    drawPlayerIcon(ctx, glyph, 0, 0, 29, feedback.active ? GOLD : disabled ? '#617991' : WHITE, feedback.rotation || 0)
    ctx.restore()
    zones.push({ x, y, w: 64, h: 64, action, payload, id, label, disabled })
  }
  function avatar(x, y, label, color = '#9fbfee', r = 30) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = '#233f5b'; ctx.fill()
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke()
    ctx.save(); ctx.textAlign = 'center'; text(ctx, Array.from(label || '友')[0], x, y + 11, 29, WHITE); ctx.restore()
  }
  function draw(now = performance.now()) {
    const refreshing = refreshStart !== null && !state.room && (state.loading || now < refreshEnd)
    const needsFrame = refreshing && (!reducedMotion || now < refreshEnd)
    const animationFrame = refreshing && !reducedMotion ? Math.floor(now / FRAME_INTERVAL) : 0
    if (!dirty && refreshing === wasRefreshing && animationFrame === lastFrame) return needsFrame
    dirty = false; zones = []; lastFrame = animationFrame; wasRefreshing = refreshing
    if (!refreshing) refreshStart = null
    const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE); bg.addColorStop(0, '#1d3555'); bg.addColorStop(.5, '#0e2036'); bg.addColorStop(1, '#091423')
    ctx.fillStyle = bg; ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.strokeStyle = '#b5d3ff15'; ctx.lineWidth = 1
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(560 + i * 75, 0); ctx.lineTo(820 + i * 75, 230); ctx.stroke() }
    text(ctx, '一起听', 44, 96, 49, WHITE, 700, 600)
    if (state.room) {
      text(ctx, `# ${state.room.id}`, 232, 92, 29, GOLD, 184, 500)
      icon(434, 43, state.copied ? 'check' : 'copy', state.copied ? '邀请已复制' : '复制邀请', 'lobby-copy')
      ctx.save(); ctx.textAlign = 'right'
      text(ctx, `${state.room.members?.length || 0} / ${state.room.capacity} 人`, 884, 92, 25, MUTED, 210)
      ctx.restore()
      icon(916, 43, 'logout', state.isHost ? '结束一起听' : '退出房间', 'lobby-leave', null, state.busy)
    } else {
      text(ctx, `${state.rooms?.length || 0} 个房间`, 222, 94, 25, MUTED, 650)
      icon(916, 43, 'settings', '昵称与连接设置', 'lobby-input', 'settings', state.busy)
    }
    ctx.fillStyle = '#b4cceb24'; ctx.fillRect(44, 157, 936, 1)
    if (state.room) drawRoom()
    else drawDirectory(now, refreshing)
    const feedback = state.errorMessage || (state.room ? state.notice : '')
    if (feedback) text(ctx, feedback, 44, 916, 23, state.errorMessage ? '#f7b7ab' : GOLD, 935)
    if (state.room) {
      if (state.autoplayBlocked) icon(604, 936, 'volume', '启用声音', 'lobby-audio', null, state.busy)
      else if (state.localError) icon(604, 936, 'refresh', '重新加载歌曲', 'lobby-retry-local', null, state.busy || !state.connected)
      if (state.roomError) icon(682, 936, 'refresh', '重新同步', 'lobby-retry', null, state.busy || !state.connected)
    }
    surface.refresh(); return needsFrame
  }
  function drawDirectory(now, refreshing) {
    for (const [i, id, label] of [[0, 'all', '全部'], [1, 'open', '可加入'], [2, 'playing', '正在听']]) {
      button(44 + i * 173, 181, 156, 58, label, 'lobby-filter', id, state.filter === id)
    }
    icon(682, 178, state.pendingId === 'create' ? 'loading' : 'house-plus', state.pendingId === 'create' ? '正在创建房间' : '创建房间', 'lobby-create', null, state.busy)
    icon(760, 178, 'key', '房间码加入', 'lobby-input', 'code', state.busy)
    icon(838, 178, 'search', state.query ? `搜索：${state.query}` : '搜索房间', 'lobby-input', 'search', state.busy)
    const refreshAge = refreshing ? Math.max(0, now - refreshStart) : 0
    icon(916, 178, refreshing ? 'refresh' : state.loading ? 'loading' : 'refresh', state.loading || refreshing ? '正在刷新' : '刷新房间列表', 'lobby-refresh', null, state.loading || state.busy || refreshing, {
      active: refreshing,
      rotation: refreshing && !reducedMotion ? refreshAge / REFRESH_TURN * Math.PI * 2 : 0,
      scale: refreshing && !reducedMotion && refreshAge < 180 ? 1 - .1 * Math.sin(refreshAge / 180 * Math.PI) : 1,
    })
    const rooms = state.rooms || []
    scroll = Math.max(0, Math.min(scroll, Math.max(0, rooms.length - 3)))
    if (!rooms.length) {
      ctx.save(); ctx.textAlign = 'center'
      for (let i = 0; i < 3; i++) avatar(426 + i * 86, 411, ['你', '＋', '＋'][i], i ? '#4b6684' : GOLD, 35)
      text(ctx, state.error ? '暂时连接不上大厅' : state.initialLoading ? '正在查找房间' : state.total ? '没有匹配的房间' : '创建房间，邀请好友一起听', 512, 535, 36, WHITE, 880, 500)
      text(ctx, state.error ? '检查右上角连接设置，或点击刷新图标' : state.total ? '试试其他筛选或搜索词' : '分享此刻的旋律', 512, 584, 25, MUTED, 880)
      ctx.restore()
    }
    rooms.slice(scroll, scroll + 3).forEach((room, index) => {
      const y = 268 + index * 186
      rounded(ctx, 44, y, 936, 164, 10, '#182e48')
      ctx.fillStyle = room.joinable ? '#8ec8ed' : '#435a75'; ctx.fillRect(44, y + 16, 3, 132)
      avatar(104, y + 57, room.hostName)
      text(ctx, `${room.hostName} 的房间`, 156, y + 53, 29, WHITE, 570, 500)
      text(ctx, room.track?.name || '等你来点第一首', 156, y + 96, 24, MUTED, 570)
      for (let n = 0; n < Math.min(5, room.capacity); n++) {
        rounded(ctx, 156 + n * 25, y + 128, 15, 15, 4, n < room.memberCount ? '#b9d9f1' : '#34506d')
      }
      text(ctx, `${room.memberCount} / ${room.capacity} 人`, 312, y + 142, 22, MUTED)
      text(ctx, room.playing ? '正在共听' : room.preparing ? '准备歌曲' : '等你加入', 772, y + 46, 22, GOLD, 180)
      button(766, y + 71, 180, 64, state.pendingId === room.id ? '连接中' : room.joinable ? '加入' : room.unavailableReason === 'full' ? '已满员' : '重连中', 'lobby-join', room.id, room.joinable, state.busy || !room.joinable)
    })
    if (rooms.length > 3) {
      icon(838, 824, 'up', '上一页', 'lobby-page', -3, scroll === 0)
      icon(916, 824, 'down', '下一页', 'lobby-page', 3, scroll >= rooms.length - 3)
    }
  }
  function drawRoom() {
    const room = state.room
    rounded(ctx, 44, 195, 936, 154, 10, '#223b57')
    text(ctx, room.playback?.track?.name || '一起选一首喜欢的歌', 74, 257, 34, WHITE, 868, 500)
    text(ctx, room.playback?.track?.artist || '前往终端，所有人都能点歌', 75, 303, 24, MUTED, 860)
    const playbackLabel = { playing: '同步播放中', paused: '已暂停', loading: '加载歌曲', scheduled: '即将同步', reconnecting: '正在重连', waiting: '等待准备', error: '需要重试' }[state.syncStatus]
    if (playbackLabel) text(ctx, playbackLabel, 74, 390, 23, MUTED, 650)
    ctx.save(); ctx.textAlign = 'right'
    text(ctx, state.connected ? '已连接' : '正在重连', 950, 390, 23, MUTED, 200)
    ctx.restore()
    const members = room.members || []
    for (let i = 0; i < Math.min(10, room.capacity); i++) {
      const x = 135 + (i % 5) * 185, y = 500 + Math.floor(i / 5) * 220, member = members[i]
      const isHost = Boolean(member && member.id === room.hostId)
      avatar(x, y, member?.name || '＋', isHost ? GOLD : member ? '#9fbfee' : '#405675', 43)
      if (isHost) {
        ctx.beginPath(); ctx.arc(x + 32, y - 32, 19, 0, Math.PI * 2)
        ctx.fillStyle = GOLD; ctx.fill(); ctx.strokeStyle = '#0e2036'; ctx.lineWidth = 4; ctx.stroke()
        drawPlayerIcon(ctx, 'crown', x + 32, y - 32, 24, '#172133')
      }
      ctx.save(); ctx.textAlign = 'center'; text(ctx, member?.name || '待加入', x, y + 78, 23, member ? WHITE : MUTED, 158)
      const memberStatus = member && (!member.connected ? '重连中' : member.error ? '加载失败' : member.buffering ? '缓冲中' : '')
      if (memberStatus) text(ctx, memberStatus, x, y + 110, 19, MUTED, 158)
      ctx.restore()
    }
  }
  function hit(uv) {
    if (!uv) return null
    const x = uv.x * SIZE, y = (1 - uv.y) * SIZE
    return zones.find(zone => x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h)
  }
  return { mesh, draw,
    setState(value) {
      // Finish the current turn after the response, including very fast requests.
      if (refreshStart !== null && state.loading && !value.loading) {
        refreshEnd = refreshStart + Math.max(1, Math.ceil((performance.now() - refreshStart) / REFRESH_TURN)) * REFRESH_TURN
      }
      state = value; changed()
    },
    setPlayback(value) { if (reducedMotion !== Boolean(value.reducedMotion)) { reducedMotion = Boolean(value.reducedMotion); changed() } },
    setResolution(width) { if (surface.setScale(width / SIZE)) dirty = true },
    setHover(uv) { draw(); const id = hit(uv)?.id || ''; if (hovered !== id) { hovered = id; changed() } },
    hint(uv) { draw(); return hit(uv)?.label || '一起听' },
    cancelClick() {},
    select(uv) {
      draw(); const item = hit(uv)
      if (!item || item.disabled) return null
      if (item.action === 'lobby-page') { scroll = Math.max(0, Math.min(scroll + item.payload, Math.max(0, state.rooms.length - 3))); changed(); return null }
      if (item.action === 'lobby-refresh') { refreshStart = performance.now(); refreshEnd = refreshStart + REFRESH_TURN; changed() }
      return item
    },
    scroll(delta) { scroll = Math.max(0, Math.min(scroll + Math.sign(delta), Math.max(0, (state.rooms?.length || 0) - 3))); changed() },
    getState: () => ({ count: state.rooms?.length || 0, room: state.room?.id, controls: zones.map(zone => zone.action) }),
    dispose() { surface.texture.dispose() },
  }
}
