import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { createConcertLights } from '../../src/components/music-room/createConcertLights.js'

function setup(t) {
  const scene = new THREE.Scene(), concert = createConcertLights(scene)
  const rig = scene.getObjectByName('ceiling-concert-lights')
  t.after(() => {
    const geometry = new Set(), materials = new Set()
    scene.traverse(object => { if (object.isMesh) { geometry.add(object.geometry); materials.add(object.material) }; if (object.isInstancedMesh) object.dispose() })
    geometry.forEach(value => value.dispose()); materials.forEach(value => value.dispose())
  })
  return { scene, concert, rig }
}
function checkTransforms(scene, concert, rig) {
  scene.updateMatrixWorld(true)
  let batches = 0, instances = 0
  for (const batch of rig.children.filter(object => object.isInstancedMesh)) {
    batches++; instances += batch.count
    const [, side, part] = batch.name.split('-')
    const members = concert.fixtures.filter(fixture => fixture.side === (side === 'left' ? -1 : 1))
    const pivot = part === 'yoke' ? 'pan' : part === 'trim' ? 'head' : part
    assert.equal(batch.count, members.length)
    members.forEach((fixture, index) => {
      const instance = new THREE.Matrix4()
      batch.getMatrixAt(index, instance)
      const world = instance.clone().premultiply(batch.matrixWorld)
      // Instance buffers are Float32; original Object3D transforms are doubles.
      world.elements.forEach((value, i) => assert.ok(Math.abs(value - fixture[pivot].matrixWorld.elements[i]) < 2e-5, `${batch.name} instance ${index} differs from its original pivot`))
      const sphere = batch.geometry.boundingSphere.clone().applyMatrix4(instance)
      assert.ok(sphere.center.distanceTo(batch.boundingSphere.center) + sphere.radius <= batch.boundingSphere.radius + 1e-5, 'updated bounds must not cull moving fixture geometry')
    })
  }
  assert.equal(batches, 8)
  assert.equal(instances, 48)
}

test('all 48 opaque fixture parts retain their articulated transforms in eight batches', t => {
  const { scene, concert, rig } = setup(t)
  checkTransforms(scene, concert, rig)
  // Scene selection also changes positions while lighting is off (no update call).
  for (const layout of ['sky-lounge', 'rain', 'sky-lounge']) {
    concert.setLayout(layout)
    checkTransforms(scene, concert, rig)
    for (const fixture of concert.fixtures) {
      assert.equal(fixture.mount.position.x, fixture.side * (layout === 'sky-lounge' ? 12.8 : 5.5))
      assert.equal(fixture.mount.scale.x, layout === 'sky-lounge' ? .78 : 1)
    }
  }
})

test('batching retains all twelve real lights, moving heads, lens colors and music beams', t => {
  const { scene, concert, rig } = setup(t)
  concert.setLayout('sky-lounge'); concert.setQuality('high')
  for (let tick = 0; tick < 20; tick++) {
    const commands = concert.fixtures.map((fixture, i) => ({
      x: Math.sin(tick * .1 + i) * 9, y: .04, z: Math.cos(tick * .13 + i) * 10,
      angle: .1 + (i % 3) * .05, intensity: .2 + i * .06, mix: i / 12, hue: .02, white: .1,
    }))
    concert.update({ live: true, phase: tick * .1, beats: tick, energy: .6, power: 1, bass: .7, pulse: .4, treble: .3 }, { primary: '#66ccff', secondary: '#ff88bb' }, false, commands)
    checkTransforms(scene, concert, rig)
    concert.fixtures.forEach((fixture, i) => {
      assert.equal(fixture.spot.visible, true)
      assert.equal(fixture.spot.intensity, commands[i].intensity * 100)
      assert.equal(fixture.spot.angle, commands[i].angle)
      assert.deepEqual(fixture.spot.target.position.toArray(), [commands[i].x, commands[i].y, commands[i].z])
      assert.ok(fixture.lens.emissive.equals(fixture.spot.color))
      assert.ok(fixture.beam.material.uniforms.tint.value.equals(fixture.spot.color))
      assert.equal(fixture.beam.material.uniforms.strength.value, commands[i].intensity * .2)
      assert.equal(fixture.pool.material.uniforms.strength.value, commands[i].intensity * .38)
      assert.equal(fixture.beam.visible, true)
      assert.equal(fixture.pool.visible, true)
    })
  }
  for (const [quality, count] of [['smooth', 2], ['balanced', 4], ['high', 12]]) {
    concert.setQuality(quality)
    assert.equal(concert.fixtures.filter(fixture => fixture.spot.visible).length, count)
    checkTransforms(scene, concert, rig)
  }
})

test('unchanged fixtures reuse instance buffers and only moving parts upload new matrices', t => {
  const { scene, concert, rig } = setup(t)
  concert.setLayout('sky-lounge')
  const state = { live: true, phase: 2, beats: 8, energy: .6, power: 1, bass: .7, pulse: .4, treble: .3 }
  const theme = { primary: '#66ccff', secondary: '#ff88bb' }
  const commands = concert.fixtures.map(f => ({ x: -f.side * 2, y: .04, z: f.z, angle: .2, intensity: .7, mix: .5, hue: 0, white: 0 }))
  concert.update(state, theme, false, commands)
  const batches = rig.children.filter(o => o.isInstancedMesh), versions = batches.map(o => o.instanceMatrix.version)
  concert.update(state, theme, false, commands)
  assert.deepEqual(batches.map(o => o.instanceMatrix.version), versions)
  commands[0].x += 2
  concert.update(state, theme, false, commands)
  batches.forEach((batch, i) => {
    if (batch.name.includes('-mount-') || batch.name.includes('-right-')) assert.equal(batch.instanceMatrix.version, versions[i])
  })
  assert.ok(batches.some((batch, i) => batch.instanceMatrix.version > versions[i]))
  checkTransforms(scene, concert, rig)
  const geometries = new Set()
  rig.traverse(o => { if (o.geometry?.userData.exactIndexing) geometries.add(o.geometry) })
  const counts = [...geometries].reduce((sum, g) => ({ before: sum.before + g.userData.exactIndexing.before, after: sum.after + g.userData.exactIndexing.after }), { before: 0, after: 0 })
  assert.ok(counts.after < counts.before * .7)
  t.diagnostic(`shared fixture/truss geometry: ${counts.before} -> ${counts.after} vertices; triangle attributes are unchanged`)
})
