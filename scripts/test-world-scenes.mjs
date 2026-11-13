import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createServer } from 'vite'

// Vite supplies the asset base used by scene modules; no browser or GPU is needed.
const server = await createServer({
  configFile: false, appType: 'custom', server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true, include: [] }, cacheDir: 'node_modules/.vite-world-scene-tests',
})
const { createWorldScenes } = await server.ssrLoadModule('/src/components/music-world/createWorldScenes.js')
after(() => server.close())

function fixture(t) {
  const scene = new THREE.Scene(), pavilion = new THREE.Group(), changes = [], downloads = []
  scene.background = new THREE.Color(); scene.fog = new THREE.FogExp2()
  for (const name of ['pavilion-shell', 'pavilion-equipment']) {
    const group = new THREE.Group(); group.name = name; pavilion.add(group)
  }
  const world = createWorldScenes({
    scene, pavilion, renderer: { shadowMap: {} }, ambient: new THREE.HemisphereLight(),
    sun: new THREE.DirectionalLight(), practicals: [], onChange: value => changes.push(value),
    loadAsset: (file, progress) => new Promise((resolve, reject) => downloads.push({ file, progress, resolve, reject })),
  })
  t.after(() => world.dispose())
  return { world, downloads, changes }
}

test('download progress leaves room for preparation and completes only after applying the scene', async t => {
  const { world, downloads, changes } = fixture(t), values = []
  const pending = world.select('studio', value => values.push(value))
  downloads[0].progress({ loaded: 50, total: 100 })
  assert.equal(values.at(-1), .4)
  downloads[0].progress({ loaded: 100, total: 100 })
  assert.ok(values.at(-1) < 1)
  assert.equal(world.getConfig().id, 'rain')
  assert.equal(changes.at(-1).scenePending, 'studio')
  downloads[0].resolve(new THREE.Group())
  assert.equal(await pending, true)
  assert.equal(world.getConfig().id, 'studio')
  assert.equal(values.at(-1), 1)
  assert.ok(values.every((value, index) => !index || value >= values[index - 1]))
})

test('unknown content length does not invent download progress', async t => {
  const { world, downloads } = fixture(t), values = []
  const pending = world.select('stage', value => values.push(value))
  downloads[0].progress({ loaded: 100, total: 0 })
  assert.deepEqual(values, [0])
  downloads[0].resolve(new THREE.Group())
  await pending
  assert.equal(values.at(-1), 1)
})

test('failed download preserves the active scene and can be retried', async t => {
  const { world, downloads, changes } = fixture(t), values = []
  const failed = world.select('studio', value => values.push(value))
  downloads[0].reject(new Error('offline'))
  assert.equal(await failed, false)
  assert.equal(world.getConfig().id, 'rain')
  assert.ok(changes.at(-1).sceneError)
  assert.ok(!values.includes(1))
  const retry = world.select('studio')
  downloads[1].resolve(new THREE.Group())
  assert.equal(await retry, true)
  assert.equal(world.getConfig().id, 'studio')
})

test('superseded downloads cannot report progress or replace the latest destination', async t => {
  const { world, downloads } = fixture(t), oldValues = [], newValues = []
  const first = world.select('studio', value => oldValues.push(value))
  const second = world.select('stage', value => newValues.push(value))
  downloads[0].progress({ loaded: 100, total: 100 })
  downloads[0].resolve(new THREE.Group())
  assert.equal(await first, false)
  assert.deepEqual(oldValues, [0])
  downloads[1].resolve(new THREE.Group())
  assert.equal(await second, true)
  assert.equal(newValues.at(-1), 1)
  assert.equal(world.getConfig().id, 'stage')
})

test('cached and already active scenes complete without another download', async t => {
  const { world, downloads } = fixture(t)
  const initial = world.select('studio')
  downloads[0].resolve(new THREE.Group()); await initial
  await world.select('rain')
  const cached = [], active = []
  assert.equal(await world.select('studio', value => cached.push(value)), true)
  assert.equal(await world.select('studio', value => active.push(value)), true)
  assert.equal(downloads.length, 1)
  assert.equal(cached.at(-1), 1)
  assert.deepEqual(active, [1])
})

test('closing the world ignores late progress and completion', async t => {
  const { world, downloads, changes } = fixture(t), values = []
  const pending = world.select('stage', value => values.push(value))
  world.dispose()
  const changeCount = changes.length
  downloads[0].progress({ loaded: 100, total: 100 })
  downloads[0].resolve(new THREE.Group())
  assert.equal(await pending, false)
  assert.deepEqual(values, [0])
  assert.equal(changes.length, changeCount)
})
