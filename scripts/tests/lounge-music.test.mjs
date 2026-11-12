import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createLoungeMusicMotion } from '../../src/components/music-world/createLoungeMusicExperience.js'

const buffer = await readFile(new URL('../../public/models/sky-lounge.glb', import.meta.url))
const data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
const { scene } = await new GLTFLoader().parseAsync(data, '')

function fixture() {
  const root = scene.clone(true), parts = []
  root.updateMatrixWorld(true)
  root.traverse(object => {
    object.matrixAutoUpdate = false
    if (object.userData.musicMotion) parts.push(object)
  })
  return { root, parts, motion: createLoungeMusicMotion(root) }
}
const signal = { live: true, energy: .6, pulse: .4 }

test('the generated scene contains six music exhibits with preserved animation pivots', () => {
  const exhibits = [], parts = [], labels = []
  scene.traverse(object => {
    if (object.userData.musicExhibit) exhibits.push(object.userData.musicExhibit)
    if (object.userData.musicLabel) labels.push(object)
    if (object.userData.musicMotion) parts.push(object)
    if (object.isMesh) {
      assert.ok(object.geometry.index.count > 0)
      assert.ok(object.geometry.attributes.position.array.every(Number.isFinite))
    }
  })
  assert.deepEqual(exhibits.sort(), ['headphones', 'hifi', 'records', 'synth', 'tape', 'vinyl'])
  assert.equal(labels.length, 6)
  assert.equal(parts.filter(p => p.userData.musicMotion === 'record').length, 1)
  assert.equal(parts.filter(p => p.userData.musicMotion === 'reel').length, 2)
  assert.equal(parts.filter(p => p.userData.musicMotion === 'needle').length, 4)
  for (const part of parts) assert.ok(part.children.some(child => child.isMesh), `${part.name} lost its geometry during batching`)
})

test('playing moves the frozen shell pivots and pausing stops rotation while meters settle', () => {
  const { root, parts, motion } = fixture()
  const rotors = parts.filter(p => p.userData.musicMotion !== 'needle')
  const before = rotors.map(p => p.matrixWorld.clone())
  for (let i = 0; i < 60; i++) assert.equal(motion.update(1 / 60, signal, { playing: true }), true)
  root.updateMatrixWorld(true)
  rotors.forEach((part, i) => assert.equal(part.matrixWorld.equals(before[i]), false))
  const paused = rotors.map(p => p.matrix.clone())
  let changing
  for (let i = 0; i < 180; i++) changing = motion.update(1 / 60, { live: false }, { playing: false })
  assert.equal(changing, false, 'paused scene should stop requesting frames')
  rotors.forEach((part, i) => assert.ok(part.matrix.equals(paused[i])))
  for (const part of parts.filter(p => p.userData.musicMotion === 'needle')) assert.ok(Math.abs(part.rotation.z - .7) < 1e-6)
})

test('reduced motion freezes discs and reels and returns meters to rest', () => {
  const { parts, motion } = fixture()
  for (let i = 0; i < 30; i++) motion.update(1 / 60, signal, { playing: true })
  const rotors = parts.filter(p => p.userData.musicMotion !== 'needle'), before = rotors.map(p => p.matrix.clone())
  motion.update(1 / 60, signal, { playing: true, reducedMotion: true })
  assert.equal(motion.update(1 / 60, signal, { playing: true, reducedMotion: true }), false)
  rotors.forEach((part, i) => assert.ok(part.matrix.equals(before[i])))
})
