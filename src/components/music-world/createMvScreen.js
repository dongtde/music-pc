import * as THREE from 'three'
import { canvasSurface } from './worldSurfaces.js'
import { text, rounded, wrap, createScreenImages, cropImage, formatTime } from './screenDrawing.js'
import { drawPlayerIcon } from '../playerTransportDrawing.js'
import { drawMusicLoading } from './drawMusicLoading.js'
import { worldControls as controls } from './worldControlTheme.js'
import { fitVideoFrame } from '../../utils/videoFrame.js'
import { formatCompactCount } from '../../utils/number.js'

const SIZE = 768, EDGE = 1.76

export function createMvScreen(invalidate = () => {}, onAction = () => {}) {
  const ui = canvasSurface(SIZE, SIZE, { dynamic: true, onReady: invalidate }), ctx = ui.context
  const backdrop = canvasSurface(128, 128), bg = backdrop.context
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(EDGE, EDGE), new THREE.MeshBasicMaterial({ map: backdrop.texture, toneMapped: false }))
  mesh.name = 'world-mv-screen'
  mesh.userData = { action: 'mv', hint: 'MV' }
  const foreground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }))
  const overlay = new THREE.Mesh(new THREE.PlaneGeometry(EDGE, EDGE), new THREE.MeshBasicMaterial({ map: ui.texture, transparent: true, depthWrite: false, toneMapped: false }))
  foreground.position.z = .003; overlay.position.z = .006
  foreground.visible = false; mesh.add(foreground, overlay)
  let state = { comments: {}, mv: null }, playback = {}, open = false, visible = true, resumeVisible = false, disposed = false, dirty = true, current = null
  let zones = [], lastDraw = -Infinity, lastBackdrop = -Infinity, commentScroll = 0, commentHeight = 0, wheelAt = -Infinity, waiting = false, mediaError = ''
  const sessions = new Map(), images = createScreenImages(changed)
  function changed() { dirty = true; invalidate() }
  function clearBackdrop() { bg.fillStyle = '#081d2a'; bg.fillRect(0, 0, 128, 128); backdrop.refresh() }
  clearBackdrop()
  function fit() {
    const video = current?.video
    if (!video?.videoWidth || !video.videoHeight) return
    const frame = fitVideoFrame(video.videoWidth, video.videoHeight, EDGE, EDGE)
    foreground.scale.set(frame.width, frame.height, 1)
  }
  function frame(session) {
    if (session !== current || disposed) return
    const previous = foreground.visible, wasWaiting = waiting
    foreground.visible = session.video.readyState >= 2 && !session.video.seeking
    if (foreground.visible) { if (!previous) fit(); waiting = false }
    // VideoTexture updates directly from the decoder. Only repaint controls
    // when their state changes; timeupdate supplies the progress-bar cadence.
    if (previous !== foreground.visible || wasWaiting !== waiting) changed()
    else invalidate()
  }
  function release(session) {
    if (session.frameId != null) session.video.cancelVideoFrameCallback?.(session.frameId)
    session.cleanup(); session.video.pause(); session.video.removeAttribute('src'); session.video.load(); session.texture.dispose()
  }
  function sessionFor(mv) {
    if (!mv?.url) return null
    if (sessions.has(mv.url)) return sessions.get(mv.url)
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'; video.playsInline = true; video.preload = 'auto'; video.loop = true
    video.volume = THREE.MathUtils.clamp(playback.volume ?? 1, 0, 1)
    const texture = new THREE.VideoTexture(video); texture.colorSpace = THREE.SRGBColorSpace
    const session = { video, texture, frameId: null, cleanup: () => {} }
    const events = {
      loadeddata: () => frame(session), loadedmetadata: () => { if (session === current) fit() },
      playing: () => { if (!open || !visible || state.commentsOpen || document.hidden || session !== current) { video.pause(); return }; waiting = false; mediaError = ''; onAction('mv-playing'); changed() },
      pause: changed, timeupdate: changed, seeked: () => frame(session),
      waiting: () => { if (session === current) { waiting = true; changed() } },
      error: () => { if (session === current) { waiting = false; mediaError = '视频加载失败，点击重试'; foreground.visible = false; changed() } },
    }
    for (const [event, handler] of Object.entries(events)) video.addEventListener(event, handler)
    session.cleanup = () => { for (const [event, handler] of Object.entries(events)) video.removeEventListener(event, handler) }
    if (video.requestVideoFrameCallback) {
      const decoded = () => {
        if (disposed || !sessions.has(mv.url)) return
        frame(session); session.frameId = video.requestVideoFrameCallback(decoded)
      }
      session.frameId = video.requestVideoFrameCallback(decoded)
    }
    sessions.set(mv.url, session); video.src = mv.url
    return session
  }
  function trimSessions() {
    const keep = new Set([state.mv?.url, state.next?.url])
    for (const [url, session] of sessions) if (!keep.has(url)) { sessions.delete(url); release(session) }
  }
  function pause() { current?.video.pause(); changed() }
  function play() {
    const session = current
    if (!session || !open || !visible || state.commentsOpen || document.hidden || disposed) return
    mediaError = ''; onAction('mv-playing')
    session.video.play().catch(error => {
      if (disposed || session !== current || !open || error.name === 'AbortError') return
      waiting = false; mediaError = '点击播放'; changed()
    })
  }
  function toggle() {
    if (mediaError && mediaError !== '点击播放') { onAction('mv-control', { command: 'retry' }); return }
    if (!current) { onAction('mv-control', { command: 'retry' }); return }
    if (current.video.paused) play(); else pause()
  }
  function icon(kind, x, y, size = 30) {
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = controls.accent; ctx.fillStyle = controls.accent
    ctx.lineWidth = 2.5; ctx.lineCap = ctx.lineJoin = 'round'; ctx.beginPath()
    if (kind === 'like') {
      ctx.moveTo(0, 12); ctx.bezierCurveTo(-30, -5, -13, -25, 0, -12); ctx.bezierCurveTo(13, -25, 30, -5, 0, 12)
      if (state.liked) ctx.fill(); else ctx.stroke()
    } else if (kind === 'comments') { ctx.roundRect(-16, -14, 32, 25, 8); ctx.moveTo(-8, 11); ctx.lineTo(-12, 18); ctx.lineTo(0, 11); ctx.stroke() }
    else if (kind === 'cast') {
      ctx.moveTo(-17, -9); ctx.lineTo(-17, -14); ctx.lineTo(17, -14); ctx.lineTo(17, 11); ctx.lineTo(1, 11)
      ctx.moveTo(-18, 11); ctx.lineTo(-18, 12); ctx.moveTo(-18, 3); ctx.quadraticCurveTo(-9, 3, -9, 12); ctx.moveTo(-18, -5); ctx.quadraticCurveTo(-1, -5, -1, 12); ctx.stroke()
    } else if (kind === 'close') { ctx.moveTo(-8, -8); ctx.lineTo(8, 8); ctx.moveTo(8, -8); ctx.lineTo(-8, 8); ctx.stroke() }
    else drawPlayerIcon(ctx, kind, 0, 0, size, controls.accent)
    ctx.restore()
  }
  function drawComments(now) {
    const data = state.comments || {}, top = 170
    rounded(ctx, 0, top, SIZE, SIZE - top, 20, '#1a1b20')
    zones.push({ x: 0, y: top, w: SIZE, h: SIZE - top, command: 'comments-sheet' })
    rounded(ctx, 360, top + 12, 48, 4, 2, '#ffffff38')
    text(ctx, `歌曲评论  ${data.loaded ? formatCompactCount(data.total) : ''}`, 28, top + 57, 25, '#f5f5f6')
    icon('close', 725, top + 48); zones.push({ x: 691, y: top + 20, w: 64, h: 64, command: 'comments-close' })
    zones.push({ x: 0, y: 0, w: SIZE, h: top, command: 'comments-close' })
    ctx.save(); ctx.beginPath(); ctx.rect(0, 246, SIZE, SIZE - 246); ctx.clip()
    let y = 266 - commentScroll
    for (const group of [{ title: '热门评论', items: data.hotComments || [] }, { title: '全部评论', items: data.comments || [] }]) {
      if (!group.items.length) continue
      text(ctx, group.title, 28, y + 20, 21, '#a7a8b2'); y += 50
      for (const comment of group.items) {
        const lines = wrap(ctx, comment.content, 570, 23), height = 75 + lines.length * 34
        if (y + height >= 246 && y < SIZE) {
          const avatar = images.get(comment.user?.avatarUrl)
          if (avatar) cropImage(ctx, avatar, 26, y, 44, 22)
          else { rounded(ctx, 26, y, 44, 44, 22, '#ffffff12'); text(ctx, (comment.user?.name || '匿').slice(0, 1), 36, y + 30, 23, '#b5b5bf') }
          text(ctx, comment.user?.name || '匿名用户', 88, y + 18, 21, '#a7a8b2', 540)
          lines.forEach((line, index) => text(ctx, line, 88, y + 54 + index * 34, 23, '#f5f5f6'))
          text(ctx, comment.time, 88, y + height - 15, 18, '#83858f', 560)
          text(ctx, formatCompactCount(comment.likedCount || 0), 693, y + 26, 18, '#a7a8b2', 60)
        }
        y += height
      }
    }
    const label = data.loading ? '正在加载评论' : data.error || (!data.hotComments?.length && !data.comments?.length ? '暂无评论' : data.more ? '加载更多评论' : '已显示全部评论')
    if (data.loading) drawMusicLoading(ctx, 225, y + 24, 17, controls.accent, now, playback.reducedMotion)
    text(ctx, label, 266, y + 33, 21, controls.accent, 440)
    zones.push({ x: 80, y, w: 620, h: 65, command: data.error ? 'comments-retry' : 'comments-more' })
    commentHeight = y + commentScroll + 65 - 246
    ctx.restore()
  }
  function draw(now = performance.now()) {
    const video = current?.video, playing = Boolean(video && !video.paused), loading = state.loading || waiting
    if (foreground.visible && video?.readyState >= 2 && now - lastBackdrop > 120) {
      lastBackdrop = now
      const fill = fitVideoFrame(video.videoWidth, video.videoHeight, 160, 160, 'cover')
      try { bg.filter = 'blur(9px) brightness(.5)'; bg.drawImage(video, fill.left - 16, fill.top - 16, fill.width, fill.height); bg.filter = 'none'; backdrop.refresh() } catch { /* Wait for a decoded frame. */ }
    }
    if (!dirty && (!loading || playback.reducedMotion)) return playing
    if (!dirty && now - lastDraw < 1000 / 30) return playing || loading
    dirty = false; lastDraw = now; zones = []; ctx.clearRect(0, 0, SIZE, SIZE)
    if (!state.mv) {
      if (state.loading) drawMusicLoading(ctx, 384, 350, 85, controls.accent, now, playback.reducedMotion)
      text(ctx, state.error || (state.loading ? '正在加载 MV' : '暂无 MV'), 230, 475, 27, '#eef2e8', 500)
      zones.push({ x: 0, y: 0, w: SIZE, h: SIZE, command: 'retry' })
    } else {
      const shade = ctx.createLinearGradient(0, 530, 0, SIZE); shade.addColorStop(0, '#0000'); shade.addColorStop(1, '#000b')
      ctx.fillStyle = shade; ctx.fillRect(0, 530, SIZE, SIZE - 530)
      if (loading && !foreground.visible) drawMusicLoading(ctx, 384, 355, 42, controls.accent, now, playback.reducedMotion)
      else if (!playing && !state.commentsOpen) { rounded(ctx, 356, 326, 56, 56, 28, '#0005'); icon('play', 384, 354, 23) }
      if (mediaError || state.error) text(ctx, mediaError || state.error, 244, 414, 23, controls.accent, 480)
      text(ctx, state.mv.title, 28, 663, 28, '#fff', 580, 500)
      text(ctx, state.mv.artist, 28, 702, 22, '#e5e5e8', 580)
      for (const [index, action] of ['like', 'comments', 'cast'].entries()) {
        const y = 440 + index * 100
        icon(action, 713, y)
        ctx.save(); ctx.textAlign = 'center'; text(ctx, action === 'like' ? (state.likeLabel || '喜欢') : action === 'comments' ? (state.commentLabel || '评论') : '投屏', 713, y + 46, 20, controls.accent, 92); ctx.restore()
        zones.push({ x: 660, y: y - 32, w: 108, h: 96, command: action })
      }
      ctx.fillStyle = '#ffffff40'; ctx.fillRect(28, 744, 712, 3)
      const progress = video?.duration ? THREE.MathUtils.clamp(video.currentTime / video.duration, 0, 1) : 0
      ctx.fillStyle = controls.accent; ctx.fillRect(28, 744, 712 * progress, 3)
      text(ctx, `${formatTime(video?.currentTime)} / ${formatTime(video?.duration)}`, 28, 732, 16, '#ddd')
      zones.push({ x: 20, y: 729, w: 728, h: 39, command: 'seek' })
      if (state.commentsOpen) drawComments(now)
    }
    ui.refresh(); return playing || (loading && !playback.reducedMotion)
  }
  function step(delta) { onAction('mv-control', { command: 'step', payload: Math.sign(delta) }) }
  function visibility() { if (document.hidden) pause() }
  document.addEventListener('visibilitychange', visibility)
  return {
    mesh, draw, pause, toggle,
    setVisible(value) {
      if (visible === value) return
      visible = value
      if (!visible) { resumeVisible = Boolean(current && !current.video.paused); pause() }
      else if (resumeVisible) { resumeVisible = false; play() }
    },
    setResolution(width) { if (ui.setScale(width / SIZE)) dirty = true },
    setOpen(value) { if (open === Boolean(value)) return; open = Boolean(value); if (open) play(); else { resumeVisible = false; pause() } },
    setPlayback(value) {
      const changedControls = playback.reducedMotion !== value.reducedMotion
      playback = value
      sessions.forEach(s => { s.video.volume = THREE.MathUtils.clamp(value.volume ?? 1, 0, 1) })
      if (value.playing) { resumeVisible = false; if (current && !current.video.paused) pause() }
      if (changedControls) changed()
    },
    setState(value) {
      const previous = state, switched = previous.mv?.url !== value.mv?.url
      state = value
      if (previous.commentsOpen !== state.commentsOpen || previous.mv?.id !== state.mv?.id) commentScroll = 0
      if (switched) {
        current?.video.pause(); foreground.visible = false; clearBackdrop(); mediaError = ''; waiting = Boolean(value.mv)
        current = sessionFor(value.mv)
        foreground.material.map = current?.texture || null; foreground.material.needsUpdate = true
        if (current) { frame(current); if (open) play() }
      }
      sessionFor(value.next); trimSessions()
      if (state.commentsOpen) pause()
      changed()
    },
    scroll(delta, wheel = false) {
      if (state.commentsOpen) {
        commentScroll = THREE.MathUtils.clamp(commentScroll + delta, 0, Math.max(0, commentHeight - 522)); changed()
        if (commentScroll >= commentHeight - 570 && state.comments?.more && !state.comments?.loading && !state.comments?.error) onAction('mv-control', { command: 'comments-more' })
      } else if (!wheel || performance.now() - wheelAt > 500) { wheelAt = performance.now(); step(delta) }
    },
    isCommentsOpen: () => Boolean(state.commentsOpen),
    select(uv) {
      draw(); const p = { x: uv.x * SIZE, y: (1 - uv.y) * SIZE }
      const zone = [...zones].reverse().find(z => p.x >= z.x && p.x < z.x + z.w && p.y >= z.y && p.y < z.y + z.h)
      const wasOpen = open
      if (!open) onAction('mv-open')
      if (!zone) { if (wasOpen && !state.commentsOpen) toggle(); return }
      if (zone.command === 'seek') { if (Number.isFinite(current?.video.duration)) current.video.currentTime = THREE.MathUtils.clamp((p.x - 28) / 712, 0, 1) * current.video.duration; changed() }
      else if (zone.command === 'cast') {
        if (current?.video.readyState >= 2) { const v = current.video; pause(); onAction('mv-cast', { url: v.currentSrc || v.src, title: state.mv.title, artist: state.mv.artist, currentTime: v.currentTime, volume: v.volume }) }
      } else onAction('mv-control', { command: zone.command })
    },
    getState: () => ({ id: state.mv?.id, count: state.count, index: state.index, open, playing: Boolean(current && !current.video.paused), width: current?.video.videoWidth, height: current?.video.videoHeight, commentsOpen: state.commentsOpen, sessions: sessions.size }),
    dispose() { disposed = true; document.removeEventListener('visibilitychange', visibility); sessions.forEach(release); sessions.clear(); images.dispose(); ui.texture.dispose(); backdrop.texture.dispose(); for (const m of [foreground, overlay, mesh]) { m.geometry.dispose(); m.material.dispose() }; mesh.removeFromParent() },
  }
}
