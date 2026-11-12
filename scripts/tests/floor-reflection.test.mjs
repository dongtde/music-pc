import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { Reflector } from 'three/addons/objects/Reflector.js'
import { createFloorReflection, createReflectionViewport } from '../../src/components/music-world/createFloorReflection.js'

const close = (actual, expected, epsilon = 1e-8) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`)
const matrixClose = (actual, expected) => actual.elements.forEach((value, i) => close(value, expected.elements[i]))

function cameraAt(position, target, aspect = 16 / 9) {
  const camera = new THREE.PerspectiveCamera(65, aspect, .1, 600)
  camera.position.set(...position); camera.lookAt(...target); camera.updateMatrixWorld(true)
  return camera
}
function mockRenderer() {
  let target = null, face = 0, mip = 0
  return {
    xr: { enabled: true }, shadowMap: { autoUpdate: true }, autoClear: true, draws: [], clears: 0,
    state: { buffers: { depth: { setMask() {} } }, viewport() {} },
    getRenderTarget: () => target, getActiveCubeFace: () => face, getActiveMipmapLevel: () => mip,
    setRenderTarget(value, cubeFace = 0, mipLevel = 0) { target = value; face = cubeFace; mip = mipLevel },
    clear() { this.clears++ },
    render(scene, camera) {
      this.draws.push({ projection: camera.projectionMatrix.clone(), inverse: camera.projectionMatrixInverse.clone(), view: camera.matrixWorldInverse.clone(), viewport: target.viewport.clone() })
    },
  }
}
function setup(t, camera = cameraAt([0, 1.65, 12], [0, 1.65, -10])) {
  const scene = new THREE.Scene(), floor = createFloorReflection(), renderer = mockRenderer()
  scene.add(floor); scene.updateMatrixWorld(true)
  let now = 0
  t.mock.method(performance, 'now', () => now)
  t.after(() => { floor.geometry.dispose(); floor.dispose() })
  return { scene, floor, renderer, camera, render(time, force = false) {
    now = time; floor.forceUpdate ||= force; floor.onBeforeRender(renderer, scene, camera)
  } }
}

test('homogeneous clipping contains every visible floor sample, including near-plane crossings', t => {
  const { floor } = setup(t)
  const viewport = createReflectionViewport(512, 512)
  const poses = [
    [[0, 1.65, 12], [0, 1.65, -10], 16 / 9],
    [[0, 2.9, 13], [0, .2, -3], 9 / 16],
    [[-12, 1.65, 0], [0, 0, 0], 2.5],
    [[8, 1.1, -8], [0, .02, 0], 1],
    [[0, .04, 0], [0, .021, -6], 16 / 9],
    [[0, 8, 0], [0, 0, .1], 16 / 9],
  ]
  for (const [position, target, aspect] of poses) {
    const camera = cameraAt(position, target, aspect)
    assert.equal(viewport.update(floor, camera), true)
    let visible = 0
    for (let x = 0; x <= 40; x++) for (let y = 0; y <= 120; y++) {
      const point = new THREE.Vector4((x / 40 - .5) * 6.02, (y / 120 - .5) * 42, 0, 1)
        .applyMatrix4(floor.matrixWorld).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix)
      if (point.w <= 0 || ['x', 'y', 'z'].some(axis => Math.abs(point[axis]) > point.w)) continue
      visible++
      const px = (point.x / point.w * .5 + .5) * 512, py = (point.y / point.w * .5 + .5) * 512
      const rect = viewport.rect
      assert.ok(px >= rect.x && px <= rect.x + rect.z && py >= rect.y && py <= rect.y + rect.w)
      // Four texels cover the 1.28-texel blur plus bilinear filtering.
      if (rect.x > 0) assert.ok(px - rect.x >= 4 - 1e-8)
      if (rect.y > 0) assert.ok(py - rect.y >= 4 - 1e-8)
      if (rect.x + rect.z < 512) assert.ok(rect.x + rect.z - px >= 4 - 1e-8)
      if (rect.y + rect.w < 512) assert.ok(rect.y + rect.w - py >= 4 - 1e-8)
    }
    assert.ok(visible > 10, `pose has no meaningful floor coverage: ${position}`)
  }
})

test('floors behind the camera, outside the sides or beyond the far plane are rejected', t => {
  const { floor } = setup(t), viewport = createReflectionViewport(512, 512)
  for (const camera of [
    cameraAt([0, 2, 30], [0, 2, 40]),
    cameraAt([40, 2, 0], [40, 2, -10]),
    cameraAt([0, 2, 1000], [0, 2, 0]),
    cameraAt([0, 2, 0], [0, 10, 0]),
  ]) assert.equal(viewport.update(floor, camera), false)
})

test('cropped reflections keep original Reflector texture coordinates, depth and pixel density', t => {
  const { floor, scene, renderer } = setup(t)
  const reference = new Reflector(floor.geometry.clone(), { textureWidth: 512, textureHeight: 512, multisample: 0, clipBias: .003 })
  reference.matrixWorld.copy(floor.matrixWorld)
  t.after(() => { reference.geometry.dispose(); reference.dispose() })
  const cameras = [
    cameraAt([0, 1.65, 12], [0, 1.65, -10]),
    cameraAt([0, 2.9, 13], [0, .2, -3], 9 / 16),
    cameraAt([-12, 1.65, 0], [0, 0, 0], 2.5),
    cameraAt([8, 1.1, -8], [0, .02, 0], 1),
  ]
  const ortho = new THREE.OrthographicCamera(-16, 16, 9, -9, .1, 600)
  ortho.position.set(0, 4, 12); ortho.lookAt(0, 0, -10); ortho.updateMatrixWorld(true); cameras.push(ortho)
  let index = 0
  for (const camera of cameras) {
    const original = mockRenderer()
    reference.onBeforeRender(original, scene, camera)
    floor.forceUpdate = true; floor.onBeforeRender(renderer, scene, camera) // Initial full cache.
    floor.forceUpdate = true; floor.onBeforeRender(renderer, scene, camera) // Stationary crop.
    const baseline = original.draws.at(-1), cropped = renderer.draws.at(-1)
    assert.ok(baseline && cropped)
    matrixClose(cropped.view, baseline.view)
    matrixClose(floor.material.uniforms.textureMatrix.value, reference.material.uniforms.textureMatrix.value)
    matrixClose(cropped.projection.clone().multiply(cropped.inverse), new THREE.Matrix4())
    for (let x = -16; x <= 16; x += 2) for (let z = -22; z <= 22; z += 2) {
      const world = new THREE.Vector4(x, 2, z, 1).applyMatrix4(baseline.view)
      const a = world.clone().applyMatrix4(baseline.projection), b = world.clone().applyMatrix4(cropped.projection)
      if (Math.abs(a.w) < 1e-6) continue
      const r = cropped.viewport
      close((a.x / a.w * .5 + .5) * 512, r.x + (b.x / b.w * .5 + .5) * r.z)
      close((a.y / a.w * .5 + .5) * 512, r.y + (b.y / b.w * .5 + .5) * r.w)
      close(a.z / a.w, b.z / b.w)
    }
    t.diagnostic(`pose ${++index}: reflection viewport ${cropped.viewport.z} x ${cropped.viewport.w}; ${(100 * (1 - cropped.viewport.z * cropped.viewport.w / 512 ** 2)).toFixed(1)}% fewer target pixels (not an FPS measurement)`)
  }
  assert.equal(floor.getRenderTarget().width, 512)
  assert.equal(floor.getRenderTarget().texture.type, THREE.HalfFloatType)
  assert.equal(floor.getRenderTarget().samples, 0)
  assert.equal(floor.material.transparent, true)
  assert.equal(floor.material.depthWrite, false)
})

test('stationary rendering is cropped and throttled; camera movement refreshes the full cache once', t => {
  const { renderer, camera, floor, render } = setup(t)
  render(0, true)
  assert.equal(renderer.draws.length, 1)
  for (let i = 1; i < 6; i++) render(i * 20)
  assert.equal(renderer.draws.length, 1, 'six main frames are required even after 100 ms')
  render(120)
  assert.equal(renderer.draws.length, 2)
  assert.ok(floor.userData.reflectionMetrics.viewportPixels < 512 ** 2)
  camera.position.x += .1; camera.updateMatrixWorld(true)
  render(121)
  assert.equal(renderer.draws.length, 3, 'never sample newly exposed texels from a cropped cache')
  assert.deepEqual(renderer.draws.at(-1).viewport.toArray(), [0, 0, 512, 512])
  for (const time of [141, 161]) {
    camera.position.x += .1; camera.updateMatrixWorld(true); render(time)
  }
  assert.equal(renderer.draws.length, 3)
  camera.position.x += .1; camera.updateMatrixWorld(true); render(181)
  assert.equal(renderer.draws.length, 4, 'moving views keep the original three-frame / 50 ms cadence')
})

test('projection changes invalidate a cropped cache, and slow frames still respect frame throttling', t => {
  const { renderer, camera, render } = setup(t)
  render(0, true); render(100, true)
  camera.fov = 55; camera.updateProjectionMatrix(); render(101)
  assert.deepEqual(renderer.draws.at(-1).viewport.toArray(), [0, 0, 512, 512])
  for (let i = 1; i <= 5; i++) render(101 + i * 250)
  assert.equal(renderer.draws.length, 3)
  render(1601)
  assert.equal(renderer.draws.length, 4)
})

test('nested render failures restore the scene and renderer, and do not mark a failed cache valid', t => {
  const { floor, scene, renderer, camera, render } = setup(t)
  const previous = new THREE.WebGLRenderTarget(32, 32)
  t.after(() => previous.dispose())
  camera.viewport = new THREE.Vector4(3, 4, 300, 200)
  let restoredViewport
  renderer.state.viewport = value => { restoredViewport = value }
  renderer.setRenderTarget(previous, 2, 1); renderer.autoClear = false
  const normalRender = renderer.render
  renderer.render = () => {
    assert.equal(scene.matrixWorldAutoUpdate, false)
    assert.equal(renderer.xr.enabled, false)
    assert.equal(renderer.shadowMap.autoUpdate, false)
    assert.equal(floor.visible, false)
    throw new Error('simulated render failure')
  }
  assert.throws(() => render(0, true), /simulated render failure/)
  assert.equal(scene.matrixWorldAutoUpdate, true)
  assert.equal(renderer.xr.enabled, true)
  assert.equal(renderer.shadowMap.autoUpdate, true)
  assert.equal(renderer.getRenderTarget(), previous)
  assert.equal(renderer.getActiveCubeFace(), 2)
  assert.equal(renderer.getActiveMipmapLevel(), 1)
  assert.equal(restoredViewport, camera.viewport)
  assert.equal(floor.visible, true)
  assert.equal(floor.forceUpdate, true)
  assert.equal(floor.userData.reflectionMetrics.renders, 0)
  renderer.render = normalRender
  render(1)
  assert.equal(renderer.draws.length, 1)
  assert.equal(renderer.clears, 2)
})

test('back-facing and offscreen reflection passes do no work and preserve forced refresh', t => {
  const { camera, renderer, floor, render } = setup(t)
  camera.position.set(0, -2, 12); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true)
  render(0, true)
  camera.position.set(0, 2, 30); camera.lookAt(0, 2, 40); camera.updateMatrixWorld(true)
  render(100)
  assert.equal(renderer.draws.length, 0)
  assert.equal(floor.forceUpdate, true)
})
