import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, VideoTexture } from 'three'
import { fitVideoFrame } from '../../utils/videoFrame.js'

// The cast owns its video, so leaving the small screen does not stop playback.
export function createWorldMvCast(mesh, { invalidate, onChange, onError } = {}) {
  const originalMaterial = mesh.material
  const layers = mesh.children.map(child => [child, child.visible])
  let session = null

  function publish() {
    const video = session?.video
    onChange?.(video ? { title: session.title, playing: !video.paused, loading: video.readyState < 2 } : null)
    invalidate?.()
  }

  function stop() {
    const old = session
    if (!old) return
    session = null
    clearTimeout(old.timeout)
    old.cleanup()
    old.video.pause()
    old.video.removeAttribute('src')
    old.video.load()
    mesh.material = originalMaterial
    for (const [child, visible] of layers) child.visible = visible
    old.texture.dispose()
    old.material.dispose()
    mesh.remove(old.foreground)
    old.foreground.geometry.dispose()
    old.foreground.material.dispose()
    old.backdropTexture.dispose()
    publish()
  }

  function start({ url, title, currentTime = 0, volume = 1 }) {
    stop()
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.playsInline = true
    video.preload = 'auto'
    video.volume = Math.max(0, Math.min(1, volume))
    const texture = new VideoTexture(video)
    texture.colorSpace = SRGBColorSpace
    const backdrop = document.createElement('canvas')
    backdrop.width = 128; backdrop.height = 64
    const backdropContext = backdrop.getContext('2d')
    const backdropTexture = new CanvasTexture(backdrop)
    backdropTexture.colorSpace = SRGBColorSpace
    const material = new MeshBasicMaterial({ map: backdropTexture, color: '#888888', toneMapped: false })
    const foreground = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: texture, toneMapped: false }))
    foreground.name = 'world-cast-video'
    foreground.position.z = .006
    foreground.visible = false
    mesh.add(foreground)
    const current = { video, texture, material, foreground, backdropTexture, title, cleanup: () => {} }
    session = current
    function updateFrame() {
      if (session !== current || !video.videoWidth || !video.videoHeight) return
      const { width, height } = mesh.geometry.parameters
      const fit = fitVideoFrame(video.videoWidth, video.videoHeight, width, height)
      foreground.scale.set(fit.width, fit.height, 1)
      // Keep the complete frame on the wide screen, filling the sides with a
      // small blurred copy instead of stretching faces or adding black bars.
      if (video.readyState >= 2 && !video.seeking) {
        try {
          const fill = fitVideoFrame(video.videoWidth, video.videoHeight, 144, 80, 'cover')
          backdropContext.filter = 'blur(6px)'
          backdropContext.drawImage(video, fill.left - 8, fill.top - 8, fill.width, fill.height)
          backdropTexture.needsUpdate = true
        } catch { /* A video frame may not yet be decoded during a seek. */ }
      }
      invalidate?.()
    }
    function metadata() {
      if (currentTime > 0) video.currentTime = Math.min(currentTime, Number.isFinite(video.duration) ? Math.max(0, video.duration - .1) : currentTime)
      updateFrame()
    }
    function playing() {
      clearTimeout(current.timeout)
      updateFrame()
      mesh.material = material
      foreground.visible = true
      for (const [child] of layers) child.visible = false
      publish()
    }
    function fail() {
      if (session !== current) return
      stop()
      onError?.('投屏未能播放，请返回 MV 重试。')
    }
    const events = { loadedmetadata: metadata, playing, pause: publish, timeupdate: updateFrame, seeked: updateFrame, error: fail, ended: stop }
    for (const [name, handler] of Object.entries(events)) video.addEventListener(name, handler)
    current.cleanup = () => { for (const [name, handler] of Object.entries(events)) video.removeEventListener(name, handler) }
    current.timeout = setTimeout(fail, 20000)
    video.src = url
    publish()
    video.play().catch(fail)
  }

  function toggle() {
    const current = session
    if (!current) return
    if (!current.video.paused) current.video.pause()
    else current.video.play().catch(() => { if (session === current) onError?.('请再次点击播放。') })
  }
  function visibility() { if (document.hidden) session?.video.pause() }
  document.addEventListener('visibilitychange', visibility)
  return {
    start, stop, toggle,
    isActive: () => Boolean(session),
    isPlaying: () => Boolean(session && !session.video.paused),
    dispose() { stop(); document.removeEventListener('visibilitychange', visibility) },
  }
}
