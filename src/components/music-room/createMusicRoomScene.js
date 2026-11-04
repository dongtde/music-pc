import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { buildMusicRoom } from './buildMusicRoom'
import { createMusicScreen } from './createMusicScreen'
import { createConcertRhythm } from './createConcertRhythm'
import { findRoomPath, moveInRoom, ROOM_STATIONS } from './roomNavigation'

const THEMES = [
  { name: '极光', primary: '#63ddc7', secondary: '#648ff1' },
  { name: '日落', primary: '#e9ac6c', secondary: '#bc8cdc' },
  { name: '深海', primary: '#7fa4ee', secondary: '#4bc4d3' },
]
const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'ShiftLeft', 'ShiftRight'])

export function createMusicRoomScene(canvas, { onError, onStatus, onAction, onNotice, sampleAudio } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.shadowMap.autoUpdate = false
  renderer.shadowMap.needsUpdate = true
  const scene = new THREE.Scene()
  scene.name = 'lanyin-sound-field-room'
  scene.background = new THREE.Color('#070d16')
  scene.fog = new THREE.Fog('#0b1420', 20, 45)
  const camera = new THREE.PerspectiveCamera(68, 1, 0.08, 60)
  camera.name = 'walking-camera'
  camera.position.set(0, 1.75, 9.8)
  camera.rotation.order = 'YXZ'
  const screen = createMusicScreen(() => invalidate())
  const keys = new Set()
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const rhythm = createConcertRhythm()
  const houseLight = new THREE.HemisphereLight('#afcdeb', '#142130', 1.1)
  const ceilingLight = new THREE.DirectionalLight('#c2dbed', 2.1)
  let model
  let composer
  let bloom
  let renderPass
  let outputPass
  let environment
  let observer
  let disposed = false
  let active = true
  let reducedMotion = false
  let playing = false
  let playback = { track: {}, currentTime: 0, duration: 0, line: null, nextLine: null, loading: false }
  let frame = 0
  let lastTime = 0
  let settleUntil = 0
  let lastStatus = 0
  let yaw = 0
  let pitch = 0.045
  let drag = null
  let path = []
  let destination = null
  let themeIndex = 0
  let near = ''
  let live = false
  let frameCount = 0
  let playbackKey = ''
  let trackKey = ''
  let lighting = { power: 0, beats: 0, pulse: 0, live: false }
  const lightRigs = []

  function invalidate(duration = 400) {
    settleUntil = Math.max(settleUntil, performance.now() + duration)
    if (!frame && active && !document.hidden && !disposed) frame = requestAnimationFrame(render)
  }
  function clearMovement() { keys.clear(); drag = null }
  function stop() { cancelAnimationFrame(frame); frame = 0; lastTime = 0; clearMovement() }
  function cancelWalk() { path = []; destination = null }

  function navigate(name) {
    const station = ROOM_STATIONS[name]
    if (!station) return
    clearMovement()
    path = findRoomPath(camera.position, station)
    destination = station
    onNotice?.(`正在前往${station.label} · 按 WASD 可接管`)
    invalidate()
  }
  function reset() {
    cancelWalk(); clearMovement()
    camera.position.set(0, 1.75, 9.8)
    yaw = 0; pitch = 0.045
    invalidate()
  }
  function theme() {
    themeIndex = (themeIndex + 1) % THEMES.length
    const next = THEMES[themeIndex]
    model.accent.color.set(next.primary); model.accent.emissive.set(next.primary)
    model.blue.color.set(next.secondary); model.blue.emissive.set(next.secondary)
    lightRigs.forEach((light, index) => light.color.set(index % 2 ? next.secondary : next.primary))
    onNotice?.(`声场灯光 · ${next.name}`)
    invalidate()
  }
  function interact() {
    if (near === 'screen') { cancelWalk(); clearMovement(); onAction?.('console') }
    else onNotice?.('沿地面光带走近主屏，或点击「前往大屏」')
  }
  function setKey(code, pressed) {
    if (!movementKeys.has(code)) return
    if (pressed) { cancelWalk(); keys.add(code); invalidate() }
    else keys.delete(code)
  }
  function onKeyDown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    if (movementKeys.has(event.code)) { event.preventDefault(); setKey(event.code, true) }
    else if (event.code === 'KeyE' && !event.repeat) { event.preventDefault(); interact() }
    else if (event.code === 'Home') { event.preventDefault(); reset() }
    else if (event.code === 'Escape') { cancelWalk(); clearMovement(); onNotice?.('漫游已停止') }
  }
  function onKeyUp(event) { keys.delete(event.code) }
  function onPointerDown(event) {
    if (event.button !== 0 || !active) return
    canvas.focus({ preventScroll: true })
    canvas.setPointerCapture?.(event.pointerId)
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: 0 }
    invalidate()
  }
  function onPointerMove(event) {
    if (!drag || event.pointerId !== drag.id) return
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y
    drag.x = event.clientX; drag.y = event.clientY
    drag.moved += Math.abs(dx) + Math.abs(dy)
    if (drag.moved > 5) cancelWalk()
    yaw -= dx * 0.003
    pitch = THREE.MathUtils.clamp(pitch - dy * 0.0026, -0.9, 0.9)
    invalidate()
  }
  function onPointerUp(event) {
    if (!drag || drag.id !== event.pointerId) return
    const clicked = drag.moved < 6
    drag = null
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    if (!clicked || event.type === 'pointercancel') return
    const bounds = canvas.getBoundingClientRect()
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObject(model.screen)[0]
    if (hit) {
      if (near !== 'screen') { onNotice?.('走近主屏后即可点击操作'); return }
      const action = screen.hitTest(hit.uv)
      if (action) onAction?.(action.action, action.payload)
    }
  }
  function onBlur() { clearMovement() }
  function onVisibility() { if (document.hidden) stop(); else invalidate() }
  function onContextLost(event) {
    event.preventDefault(); active = false; stop()
    onError?.(new Error('WebGL context lost'))
  }

  function updateNavigation(delta) {
    const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 4.7 : 2.8) * delta
    const forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS'))
    const right = Number(keys.has('KeyD')) - Number(keys.has('KeyA'))
    if (forward || right) {
      const normalize = Math.hypot(forward, right)
      const next = moveInRoom(camera.position,
        (-Math.sin(yaw) * forward + Math.cos(yaw) * right) / normalize * speed,
        (-Math.cos(yaw) * forward - Math.sin(yaw) * right) / normalize * speed)
      camera.position.x = next.x; camera.position.z = next.z
    }
    yaw += (Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight'))) * delta * 1.1
    pitch = THREE.MathUtils.clamp(pitch + (Number(keys.has('ArrowUp')) - Number(keys.has('ArrowDown'))) * delta * 0.7, -0.9, 0.9)
    if (path.length) {
      const waypoint = path[0]
      const dx = waypoint.x - camera.position.x, dz = waypoint.z - camera.position.z
      const distance = Math.hypot(dx, dz)
      const step = Math.min(distance, 3.6 * delta)
      const next = moveInRoom(camera.position, dx / (distance || 1) * step, dz / (distance || 1) * step)
      camera.position.x = next.x; camera.position.z = next.z
      const heading = Math.atan2(-dx, -dz)
      yaw += angleDifference(heading, yaw) * Math.min(1, delta * 5)
      pitch += (0.025 - pitch) * Math.min(1, delta * 4)
      if (distance < 0.15) path.shift()
    } else if (destination) {
      const [x, y, z] = destination.look
      const heading = Math.atan2(-(x - camera.position.x), -(z - camera.position.z))
      const tilt = Math.atan2(y - camera.position.y, Math.hypot(x - camera.position.x, z - camera.position.z))
      yaw += angleDifference(heading, yaw) * Math.min(1, delta * 4)
      pitch += (tilt - pitch) * Math.min(1, delta * 4)
      if (Math.abs(angleDifference(heading, yaw)) < 0.003 && Math.abs(tilt - pitch) < 0.003) {
        onNotice?.(`已到达${destination.label}`)
        destination = null
      }
    }
    camera.rotation.set(pitch, yaw, 0, 'YXZ')
  }

  function render(now) {
    frame = 0
    if (disposed || !active || document.hidden) return
    const delta = Math.min((now - (lastTime || now - 16)) / 1000, 0.1)
    lastTime = now
    updateNavigation(delta)
    const sampled = playing && !reducedMotion ? sampleAudio?.() : null
    lighting = rhythm.update({ levels: sampled, playing, reducedMotion }, delta)
    live = lighting.live
    model.concert.update(lighting, THEMES[themeIndex], reducedMotion)
    // House lights fade down for the show; the modeled room stays navigable.
    houseLight.intensity = 1.1 - lighting.power * 0.65
    ceilingLight.intensity = 2.1 - lighting.power * 1.45
    lightRigs.forEach((light) => { light.intensity = 28 - lighting.power * 20 })
    model.white.emissiveIntensity = 2 - lighting.power * 1.82
    model.white.color.set('#d3eaf3').multiplyScalar(1 - lighting.power * 0.65)
    model.accent.emissiveIntensity = 1.6 - lighting.power * 0.55
    model.blue.emissiveIntensity = 1.7 - lighting.power * 0.6
    screen.draw({ ...playback, playing })
    try { composer.render() } catch (error) { active = false; stop(); onError?.(error); return }
    frameCount += 1
    if (now - lastStatus > 180) {
      lastStatus = now
      const screenDistance = Math.hypot(camera.position.x, camera.position.z + 11.15)
      near = screenDistance < 6.5 ? 'screen' : ''
      onStatus?.({ x: camera.position.x, z: camera.position.z, near, distance: screenDistance,
        navigating: Boolean(destination), live, theme: THEMES[themeIndex].name })
    }
    if (!frame && (keys.size || path.length || destination || drag || (playing && !reducedMotion) || lighting.settling || now < settleUntil)) {
      frame = requestAnimationFrame(render)
    }
  }

  function dispose() {
    if (disposed) return
    disposed = true; stop()
    observer?.disconnect()
    canvas.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', onBlur)
    document.removeEventListener('visibilitychange', onVisibility)
    canvas.removeEventListener('blur', onBlur)
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('pointercancel', onPointerUp)
    canvas.removeEventListener('webglcontextlost', onContextLost)
    const geometries = new Set(), materials = new Set(), textures = new Set()
    scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry)
      const surfaces = Array.isArray(object.material) ? object.material : object.material ? [object.material] : []
      surfaces.forEach((material) => { materials.add(material); Object.values(material).forEach((value) => { if (value?.isTexture) textures.add(value) }) })
    })
    geometries.forEach((value) => value.dispose())
    materials.forEach((value) => value.dispose())
    textures.forEach((value) => value.dispose())
    model?.reflector.getRenderTarget().dispose()
    scene.traverse((object) => object.shadow?.dispose())
    screen.dispose(); environment?.dispose()
    renderPass?.dispose(); bloom?.dispose(); outputPass?.dispose(); composer?.dispose()
    renderer.dispose()
    if (!renderer.getContext().isContextLost()) renderer.forceContextLoss()
  }

  try {
    const generator = new THREE.PMREMGenerator(renderer)
    const studio = new RoomEnvironment()
    try { environment = generator.fromScene(studio, 0.035) }
    finally { generator.dispose(); studio.dispose() }
    scene.environment = environment.texture
    scene.environmentIntensity = 0.32
    scene.add(houseLight)
    ceilingLight.position.set(-3, 6.5, 4)
    ceilingLight.castShadow = true
    ceilingLight.shadow.mapSize.set(1024, 1024)
    Object.assign(ceilingLight.shadow.camera, { left: -10, right: 10, top: 14, bottom: -14, near: 0.5, far: 30 })
    ceilingLight.shadow.normalBias = 0.04
    scene.add(ceilingLight)
    for (const [x, z, color] of [[-5, -7, '#64dfd0'], [5, -7, '#789aff'], [-5, 5, '#64dfd0'], [5, 5, '#789aff']]) {
      const light = new THREE.PointLight(color, 28, 12, 2)
      light.position.set(x, 4.5, z)
      scene.add(light); lightRigs.push(light)
    }
    const screenLight = new THREE.PointLight('#b1d9ee', 20, 11, 2)
    screenLight.position.set(0, 3.4, -9.4); scene.add(screenLight)
    model = buildMusicRoom(scene, screen.texture)
    screen.draw({ ...playback, playing })
    composer = new EffectComposer(renderer)
    renderPass = new RenderPass(scene, camera)
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.21, 0.4, 1.25)
    outputPass = new OutputPass()
    composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(outputPass)
    observer = new ResizeObserver(() => {
      const { width, height } = canvas.getBoundingClientRect()
      if (width < 1 || height < 1) return
      renderer.setSize(width, height, false)
      composer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      invalidate()
    })
    observer.observe(canvas)
    canvas.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    canvas.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    canvas.addEventListener('webglcontextlost', onContextLost)
    invalidate()
  } catch (error) { dispose(); throw error }

  return {
    navigate, reset, interact, setKey, clearMovement,
    setTheme: theme,
    setPlayback(state) {
      const nextTrack = [state.track?.id, state.track?.hash, state.track?.name].join('|')
      if (nextTrack !== trackKey || Math.abs((state.currentTime || 0) - (playback.currentTime || 0)) > 2) {
        rhythm.reset(); trackKey = nextTrack
      }
      playing = Boolean(state.playing)
      reducedMotion = Boolean(state.reducedMotion)
      playback = state
      const nextKey = [playing, reducedMotion, state.loading, state.track?.id, state.track?.name, state.track?.artist,
        state.track?.coverUrl, state.line?.text, state.line?.translation, state.nextLine?.text, state.duration, Math.floor(state.currentTime)].join('|')
      if (nextKey !== playbackKey) { playbackKey = nextKey; invalidate(350) }
    },
    setActive(value) { active = Boolean(value); if (active) invalidate(); else { cancelWalk(); stop() } },
    // Useful for checking navigation without coupling tests to DOM overlays.
    getState() { return { x: camera.position.x, z: camera.position.z, yaw, pitch, near, frameCount, navigating: Boolean(destination),
      lighting: { live: lighting.live, power: lighting.power, beats: lighting.beats, pulse: lighting.pulse } } },
    dispose,
  }
}

function angleDifference(target, value) { return Math.atan2(Math.sin(target - value), Math.cos(target - value)) }
