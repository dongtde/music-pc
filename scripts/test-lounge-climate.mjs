import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { normalizeLoungeClimate, formatLoungeTime, loungeClockHour, sampleLoungeClimate } from '../src/components/music-world/loungeClimate.js'
import { createLoungeClimate } from '../src/components/music-world/createLoungeClimate.js'
import { createLoungeAtmosphere } from '../src/components/music-world/createLoungeAtmosphere.js'
import { createRenderScaleController } from '../src/components/music-world/worldRenderBudget.js'

test('stored climate settings recover from invalid values and wrap midnight', () => {
  assert.deepEqual(normalizeLoungeClimate(null), { weather: 'clear', hour: 17.5, mode: 'manual' })
  assert.deepEqual(normalizeLoungeClimate({ weather: 'storm', hour: NaN, mode: 'bad' }), normalizeLoungeClimate(null))
  assert.equal(normalizeLoungeClimate({ hour: -1 }).hour, 23)
  assert.equal(normalizeLoungeClimate({ hour: 24 }).hour, 0)
  assert.equal(formatLoungeTime(23.999), '00:00')
})

test('local clock and twelve-minute cycle advance without a running render loop', () => {
  const now = new Date(2026, 10, 12, 9, 30, 0).getTime()
  assert.equal(loungeClockHour({ mode: 'local' }, now), 9.5)
  assert.equal(loungeClockHour({ mode: 'cycle', hour: 23 }, now + 60000, now, 23), 1)
  assert.equal(loungeClockHour({ mode: 'cycle', hour: 7 }, now + 720000, now, 7), 7)
})

test('day, night and weather produce consistent lighting and continuous midnight', () => {
  const day = sampleLoungeClimate(12), night = sampleLoungeClimate(0)
  assert.ok(day.sunIntensity > night.sunIntensity * 5)
  assert.ok(day.cityBrightness > night.cityBrightness * 5)
  assert.ok(night.practicalIntensity > day.practicalIntensity)
  assert.ok(sampleLoungeClimate(12, 'fog').fogDensity > day.fogDensity)
  assert.ok(sampleLoungeClimate(12, 'rain').sunIntensity < day.sunIntensity)
  assert.equal(sampleLoungeClimate(12, 'rain').rain, 1)
  const before = sampleLoungeClimate(23.999), after = sampleLoungeClimate(.001)
  for (const channel of ['r', 'g', 'b']) assert.ok(Math.abs(before.skyTop[channel] - after.skyTop[channel]) < .00001)
  for (const weather of ['clear', 'cloudy', 'rain', 'fog']) for (let hour = 0; hour < 24; hour += .25) {
    for (const value of Object.values(sampleLoungeClimate(hour, weather))) {
      if (typeof value === 'number') assert.ok(Number.isFinite(value))
      if (value?.isColor) assert.ok([value.r, value.g, value.b].every(Number.isFinite))
    }
  }
})

function fixture() {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(); scene.fog = new THREE.FogExp2()
  const ambient = new THREE.HemisphereLight(), sun = new THREE.DirectionalLight(), practicals = [new THREE.PointLight()]
  const renderer = { shadowMap: {} }, frames = []
  const climate = createLoungeClimate({ scene, renderer, ambient, sun, practicals, getLounge: () => ({ setAtmosphere: frame => frames.push(frame) }) })
  const tick = (reduced = false) => climate.update(1 / 60, { power: 0 }, reduced, 'balanced')
  return { climate, tick, frames, ambient, sun, renderer }
}

test('clear manual weather settles; silent rain keeps animating; reduced motion settles', () => {
  const { climate, tick, frames, renderer } = fixture()
  climate.set({ hour: 12, weather: 'clear', mode: 'manual' })
  for (let i = 0; i < 600; i++) tick()
  assert.equal(tick(), false)
  climate.set({ hour: 22, weather: 'rain', mode: 'manual' })
  for (let i = 0; i < 600; i++) tick()
  assert.equal(tick(), true)
  tick(true)
  assert.equal(tick(true), false)
  assert.equal(frames.at(-1).rain, 1)
  assert.ok(renderer.shadowMap.needsUpdate)
})

test('crossing midnight takes the short route and weather changes preserve the cycle', t => {
  let now = 1000000
  t.mock.method(Date, 'now', () => now)
  const { climate, tick } = fixture()
  climate.set({ hour: 23.75, weather: 'clear', mode: 'manual' }); tick(true)
  climate.set({ hour: .25, weather: 'clear', mode: 'manual' }); tick()
  assert.ok(climate.getState().currentHour > 23.75)
  climate.set({ hour: 23, weather: 'clear', mode: 'cycle' }); tick(true)
  now += 60000
  climate.set({ hour: 23, weather: 'rain', mode: 'cycle' }); tick(true)
  assert.equal(climate.getState().currentHour, 1)
})

test('rain stays outside the lounge and respects quality and reduced motion', () => {
  const root = new THREE.Group(), sky = new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.MeshBasicMaterial())
  root.add(sky)
  const atmosphere = createLoungeAtmosphere(root, sky)
  const rain = root.getObjectByName('sky-lounge-outdoor-rain'), positions = rain.geometry.attributes.dropOrigin
  for (let i = 0; i < positions.count; i++) assert.ok(Math.abs(positions.getX(i)) > 15 || positions.getZ(i) > 24)
  atmosphere.setQuality('smooth'); assert.equal(atmosphere.getState().rainDrops, 240)
  atmosphere.setQuality('high'); assert.equal(atmosphere.getState().rainDrops, 1000)
  atmosphere.update(sampleLoungeClimate(22, 'rain'), 1, false); assert.equal(rain.visible, true)
  atmosphere.update(sampleLoungeClimate(22, 'rain'), 1, true); assert.equal(rain.visible, false)
  atmosphere.update(sampleLoungeClimate(22, 'clear'), 1, false); assert.equal(rain.visible, false)
  root.traverse(object => { object.geometry?.dispose(); object.material?.dispose() })
})

test('weather budget reduces instances without reallocating geometry or adding lights', () => {
  const root = new THREE.Group(), sky = new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.MeshBasicMaterial())
  root.add(sky)
  const atmosphere = createLoungeAtmosphere(root, sky)
  atmosphere.setQuality('high')
  const rain = root.getObjectByName('sky-lounge-outdoor-rain'), drops = root.getObjectByName('sky-lounge-window-droplets')
  const original = rain.geometry.attributes.dropOrigin
  atmosphere.setBudget(.6)
  assert.equal(atmosphere.getState().rainDrops, 600)
  assert.equal(atmosphere.getState().windowDroplets, 120)
  assert.equal(original, rain.geometry.attributes.dropOrigin)
  assert.ok(root.children.every(child => !child.isLight))
  for (let i = 0; i < 240; i++) atmosphere.update(sampleLoungeClimate(22, 'rain'), i / 60, false)
  assert.equal(atmosphere.getState().extraDrawCalls, 2)
  for (let i = 0; i < 900; i++) atmosphere.update(sampleLoungeClimate(12, 'clear'), i / 60, false)
  assert.equal(drops.visible, false)
  atmosphere.setQuality('smooth')
  assert.equal(atmosphere.getState().windowDroplets, 0)
  atmosphere.setBudget(1)
  assert.equal(atmosphere.getState().rainDrops, 240)
  root.traverse(object => { object.geometry?.dispose(); object.material?.dispose() })
})

test('reusable climate sampling preserves colors without allocating replacement objects', () => {
  const output = sampleLoungeClimate(12), color = output.skyTop
  const before = color.clone()
  assert.equal(sampleLoungeClimate(22, 'rain', output), output)
  assert.equal(output.skyTop, color)
  assert.ok(!before.equals(color))
})

test('adaptive scale backs off under sustained GPU load and recovers slowly', () => {
  const controller = createRenderScaleController({ minimumScale: .6 })
  for (let i = 0; i < 200; i++) controller.observe(24)
  assert.equal(controller.getState().scale, .6)
  for (let i = 0; i < 40; i++) controller.observe(5)
  assert.equal(controller.getState().scale, .6)
  for (let i = 0; i < 1500; i++) controller.observe(5)
  assert.ok(controller.getState().scale > .6 && controller.getState().scale <= 1)
  const previous = controller.getState().scale
  for (const invalid of [0, -2, NaN, Infinity, 1000]) controller.observe(invalid)
  assert.equal(controller.getState().scale, previous)
})
