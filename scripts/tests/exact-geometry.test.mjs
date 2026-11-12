import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { indexGeometryExactly } from '../../src/components/music-room/indexGeometryExactly.js'
import { createWorldLightShow } from '../../src/components/music-world/createWorldLightShow.js'

test('exact indexing preserves every triangle attribute, UV seam, group and draw range', () => {
  const geometry = new THREE.BoxGeometry(1, 2, 3, 3, 3, 3).toNonIndexed()
  geometry.setDrawRange(3, geometry.attributes.position.count - 6)
  const original = geometry.clone(), count = geometry.attributes.position.count
  indexGeometryExactly(geometry)
  assert.ok(geometry.index)
  assert.equal(geometry.index.count, count)
  assert.ok(geometry.attributes.position.count < count / 2)
  assert.deepEqual(geometry.groups, original.groups)
  assert.deepEqual(geometry.drawRange, original.drawRange)
  const expanded = geometry.toNonIndexed()
  for (const name of Object.keys(original.attributes)) {
    assert.deepEqual(expanded.attributes[name].array, original.attributes[name].array, `${name} changed during indexing`)
  }
  geometry.dispose(); original.dispose(); expanded.dispose()
})

test('nearby but distinct vertices and attribute seams remain distinct', () => {
  const geometry = new THREE.PlaneGeometry().toNonIndexed(), originalCount = geometry.attributes.position.count
  const uv = geometry.attributes.uv, position = geometry.attributes.position
  // Vertices 1/3 and 2/5 start identical. Preserve a UV seam and tiny displacement.
  uv.setX(3, .00000001)
  position.setZ(5, .00000001)
  const before = geometry.clone()
  indexGeometryExactly(geometry)
  assert.equal(geometry.attributes.position.count, originalCount)
  for (const name of Object.keys(before.attributes)) assert.deepEqual(geometry.attributes[name].array, before.attributes[name].array)
  geometry.dispose(); before.dispose()
})

test('merged light ribbons retain all four original boxes, including the shorter wall strips', () => {
  const scene = new THREE.Scene()
  createWorldLightShow(scene, { fixtures: [], update() {} })
  const ribbons = scene.getObjectByName('listening-room-light-ribbons')
  assert.equal(ribbons.children.length, 6)
  const original = new THREE.BoxGeometry(.055, .035, 1.15), transform = new THREE.Object3D(), point = new THREE.Vector3()
  ribbons.children.forEach((ribbon, i) => {
    let cursor = 0
    for (const side of [-1, 1]) for (const wall of [false, true]) {
      transform.position.set(wall ? side * 6.85 : side * 2.17, wall ? 1.3 + i * .84 : .065, wall ? -19.6 : -14.5 + i * 2.3)
      transform.rotation.set(wall ? Math.PI / 2 : 0, 0, 0); transform.scale.set(1, 1, wall ? .72 : 1); transform.updateMatrix()
      for (let index = 0; index < original.index.count; index++) {
        point.fromBufferAttribute(original.attributes.position, original.index.getX(index)).applyMatrix4(transform.matrix)
        const actual = new THREE.Vector3().fromBufferAttribute(ribbon.geometry.attributes.position, ribbon.geometry.index.getX(cursor++))
        assert.ok(actual.distanceTo(point) < 2e-6)
      }
    }
    assert.equal(cursor, ribbon.geometry.index.count)
    assert.equal(ribbon.material.emissiveIntensity, 0)
  })
  original.dispose()
  const geometries = new Set(), materials = new Set()
  scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) materials.add(o.material) })
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose())
})
