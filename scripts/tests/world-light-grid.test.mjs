import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { WebGLLights } from 'three/src/renderers/webgl/WebGLLights.js'
import { createWorldLightGrid } from '../../src/components/music-world/worldLightGrid.js'
import { optimizeWorldMaterials } from '../../src/components/music-world/optimizeWorldMaterials.js'
import { createConcertLights } from '../../src/components/music-room/createConcertLights.js'

function setup(t) {
  const scene = new THREE.Scene(), grid = createWorldLightGrid(scene), camera = new THREE.PerspectiveCamera()
  t.after(() => grid.dispose())
  return { scene, grid, camera, update() { scene.updateMatrixWorld(true); grid.invalidate(); grid.prepare(camera) } }
}
function addSpot(scene, position, target, distance, angle) {
  const light = new THREE.SpotLight('white', 30, distance, angle, .75, 1.5)
  light.position.set(...position); light.target.position.set(...target); scene.add(light, light.target)
  return light
}
function randomGenerator() { let seed = 7919; return () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296) }

test('light cells conservatively include every sampled point inside finite spot cones and point lights', t => {
  const { scene, grid, update } = setup(t), random = randomGenerator()
  const spots = [
    addSpot(scene, [12.8, 11.8, -8], [-4, .04, 3], 30, .08),
    addSpot(scene, [-12.8, 11.8, 8], [10, .04, -10], 40, .31),
    addSpot(scene, [0, 3, 0], [0, -2, 0], 15, .9),
    addSpot(scene, [2, 2, 2], [1, 3, -1], 17, Math.PI / 2),
    addSpot(scene, [-30, 2, 20], [-25, 0, 0], 20, .0001),
  ]
  const point = new THREE.PointLight('white', 1, 15); point.position.set(10, 5.5, 7); scene.add(point)
  update()
  const axis = new THREE.Vector3(), u = new THREE.Vector3(), v = new THREE.Vector3(), p = new THREE.Vector3()
  spots.forEach((light, i) => {
    axis.copy(light.target.position).sub(light.position).normalize()
    u.crossVectors(axis, Math.abs(axis.y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize()
    v.crossVectors(axis, u)
    for (let sample = 0; sample < 10000; sample++) {
      const angle = light.angle * (sample % 3 === 0 ? .999999 : random()), azimuth = random() * Math.PI * 2
      const radius = light.distance * (sample % 5 === 0 ? .999999 : random())
      p.copy(light.position).addScaledVector(axis, radius * Math.cos(angle))
        .addScaledVector(u, radius * Math.sin(angle) * Math.cos(azimuth)).addScaledVector(v, radius * Math.sin(angle) * Math.sin(azimuth))
      assert.ok(grid.maskAt(p.x, p.y, p.z) & (1 << (16 + i)), `omitted spot ${i} at ${p.toArray()}`)
    }
  })
  for (let sample = 0; sample < 10000; sample++) {
    p.set(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize().multiplyScalar(14.99999).add(point.position)
    assert.ok(grid.maskAt(p.x, p.y, p.z) & 1)
  }
})

test('light slot order matches Three even with shadows, cookie maps, hidden ancestors and camera layers', t => {
  const { scene, grid, camera, update } = setup(t)
  const lights = []
  for (let i = 0; i < 4; i++) {
    const light = addSpot(scene, [i * 8 - 12, 5, 0], [i * 8 - 12, 0, 0], 5, .1)
    light.castShadow = i >= 2; light.map = i % 2 ? new THREE.Texture() : null
    lights.push(light)
  }
  const hidden = new THREE.Group(); hidden.visible = false; scene.add(hidden)
  hidden.add(new THREE.PointLight('white', 1, 100))
  const otherLayer = new THREE.PointLight('white', 1, 100); otherLayer.layers.set(1); scene.add(otherLayer)
  update()
  assert.equal(grid.getState().points, 0)
  const reference = WebGLLights({ has: () => false, get: () => null })
  reference.setup([...lights]); reference.setupView([...lights].sort((a, b) => Number(b.castShadow) * 2 + Number(Boolean(b.map)) - Number(a.castShadow) * 2 - Number(Boolean(a.map))), camera)
  reference.state.spot.forEach((light, slot) => {
    const mask = grid.maskAt(light.position.x, 2, 0)
    assert.ok(mask & (1 << (16 + slot)))
    assert.equal(mask >>> 16, 1 << slot, 'separated small cones must not use another light slot')
  })
  camera.layers.enable(1); grid.prepare(camera)
  assert.equal(grid.getState().points, 1)
  lights.forEach(light => light.map?.dispose())
})

test('unbounded lights, points outside the grid and more than sixteen lights fall back safely', t => {
  const { scene, grid, update } = setup(t)
  const infinite = addSpot(scene, [0, 5, 0], [0, 0, 0], 0, .1)
  update()
  assert.ok(grid.maskAt(25, 10, 20) & (1 << 16))
  assert.equal(grid.maskAt(100, 0, 0), 0xffffffff)
  infinite.intensity = 0; update()
  assert.equal(grid.maskAt(0, 0, 0), 0)
  for (let i = 0; i < 17; i++) scene.add(new THREE.PointLight('white', 1, 1))
  update()
  assert.equal(grid.uniforms.worldLightGridEnabled.value, false)
  assert.equal(grid.maskAt(0, 0, 0), 0xffffffff)
})

test('music movement refreshes the index, stable lights reuse it, and reflection cameras share the world grid', t => {
  const { scene, grid, camera, update } = setup(t)
  const light = addSpot(scene, [0, 8, 0], [-10, 0, 0], 20, .1)
  update()
  const version = grid.uniforms.worldLightGrid.value.version
  update()
  assert.equal(grid.uniforms.worldLightGrid.value.version, version)
  light.color.set('#ff4499'); light.intensity = 50; update()
  assert.equal(grid.uniforms.worldLightGrid.value.version, version, 'color/intensity changes do not alter an active light volume')
  const mirrored = camera.clone(); mirrored.position.y = -2; mirrored.lookAt(0, 2, -10); mirrored.updateMatrixWorld(true)
  grid.prepare(mirrored)
  assert.equal(grid.uniforms.worldLightGrid.value.version, version)
  light.target.position.x = 10; update()
  assert.ok(grid.uniforms.worldLightGrid.value.version > version)
  assert.ok(grid.maskAt(10, 0, 0) & (1 << 16))
  assert.equal(grid.maskAt(-10, 0, 0) & (1 << 16), 0)
})

test('generated material hooks retain original shading and use unrollable integer mask tests', t => {
  const { scene, grid } = setup(t)
  const material = new THREE.MeshStandardMaterial(), mesh = new THREE.Mesh(new THREE.BoxGeometry(), material)
  scene.add(mesh)
  optimizeWorldMaterials(scene, grid)
  const shader = { uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms), fragmentShader: THREE.ShaderLib.standard.fragmentShader }
  material.onBeforeCompile(shader, {})
  assert.equal(shader.uniforms.worldLightGrid, grid.uniforms.worldLightGrid)
  assert.match(shader.fragmentShader, /texelFetch\( worldLightGrid/)
  assert.match(shader.fragmentShader, /uint\( UNROLLED_LOOP_INDEX \+ 16 \)/)
  assert.match(shader.fragmentShader, /getSpotLightInfo\( spotLight, geometryPosition, directLight \)/)
  assert.match(shader.fragmentShader, /RE_Direct\( directLight, geometryPosition, geometryNormal/)
  // Three replaces array indices and UNROLLED_LOOP_INDEX, not arbitrary uses of i.
  const loopPattern = /#pragma unroll_loop_start\s+for \( int i = (\d+); i < (\d+); i \+\+ \) \{([\s\S]+?)\}\s+#pragma unroll_loop_end/g
  const counts = { POINT: 5, SPOT: 12, DIR: 1, HEMI: 1, RECT_AREA: 0 }
  const expanded = shader.fragmentShader.replace(/NUM_(POINT|SPOT|DIR|HEMI|RECT_AREA)_LIGHTS\b/g, (_, kind) => String(counts[kind])).replace(loopPattern, (_, start, end, body) => {
    let result = ''
    for (let i = Number(start); i < Number(end); i++) result += body.replace(/\[\s*i\s*\]/g, `[ ${i} ]`).replaceAll('UNROLLED_LOOP_INDEX', String(i))
    return result
  })
  assert.doesNotMatch(expanded, /uint\(\s*i\b|UNROLLED_LOOP_INDEX/)
  assert.match(expanded, /uint\( 11 \+ 16 \)/)
  mesh.geometry.dispose(); material.dispose()
})

test('a real twelve-light lounge rig greatly reduces candidate lights without deleting any lights', t => {
  const { scene, grid, update } = setup(t), concert = createConcertLights(scene)
  concert.setLayout('sky-lounge'); concert.setQuality('high')
  const commands = concert.fixtures.map((fixture, i) => ({ x: Math.sin(i) * 7, y: .04, z: fixture.z, angle: .2, intensity: .8, mix: i / 12, hue: 0, white: 0 }))
  concert.update({ live: true, phase: 2, beats: 8, energy: .6, power: 1 }, { primary: '#66ccff', secondary: '#ff88aa' }, false, commands)
  update()
  let candidates = 0, samples = 0
  for (let z = -20; z <= 22; z++) for (let x = -18; x <= 18; x++) {
    const mask = grid.maskAt(x, .04, z) >>> 16
    for (let bit = 0; bit < 12; bit++) candidates += (mask >>> bit) & 1
    samples++
  }
  assert.equal(grid.getState().spots, 12)
  assert.ok(candidates / samples < 3)
  t.diagnostic(`floor samples average ${(candidates / samples).toFixed(2)} candidate spotlights instead of 12; this is an algorithmic count, not an FPS benchmark`)
  const geometries = new Set(), materials = new Set()
  scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) materials.add(o.material); if (o.isInstancedMesh) o.dispose() })
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose())
})
