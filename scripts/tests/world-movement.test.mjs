import assert from 'node:assert/strict'
import test from 'node:test'
import { WORLD_BOUNDS, WORLD_MAP_DESTINATIONS, WORLD_OBSTACLES, WORLD_PLAYER_RADIUS, WORLD_STATIONS, canWalkWorld, isWorldPathClear, moveWorld, planWorldPath, resolveWorldPosition, worldCameraLimit } from '../../src/components/music-world/worldNavigation.js'
import { createWorldMovement } from '../../src/components/music-world/worldMovement.js'
import { createWorldTravel, stepWorldTravel } from '../../src/components/music-world/worldTravel.js'

const close = (actual, expected, tolerance = .005) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} should be near ${expected}`)

test('sweeps stop at every furniture face, including a single large movement', () => {
  for (const obstacle of WORLD_OBSTACLES) for (const axis of ['x', 'z']) for (const sign of [-1, 1]) {
    const half = obstacle[axis === 'x' ? 'halfX' : 'halfZ']
    const start = { x: obstacle.x, z: obstacle.z, [axis]: obstacle[axis] + sign * (half + WORLD_PLAYER_RADIUS + .3) }
    assert.ok(canWalkWorld(start.x, start.z))
    const next = moveWorld(start, axis === 'x' ? -sign * 20 : 0, axis === 'z' ? -sign * 20 : 0)
    assert.ok(canWalkWorld(next.x, next.z))
    close(next[axis], obstacle[axis] + sign * (half + WORLD_PLAYER_RADIUS))
    assert.ok(next.contacts.length)
  }
})

test('diagonal contact slides along a face and can move away immediately', () => {
  const next = moveWorld({ x: 0, z: 3.2 }, 1, -1)
  assert.ok(canWalkWorld(next.x, next.z))
  close(next.x, 1)
  close(next.z, 1.5 + .92 + WORLD_PLAYER_RADIUS)
  const away = moveWorld(next, 0, .5)
  close(away.z, next.z + .5)
})

test('rounded corners are walkable outside the player circle', () => {
  const obstacle = WORLD_OBSTACLES[0], corner = { x: obstacle.halfX, z: obstacle.z + obstacle.halfZ }
  assert.ok(canWalkWorld(corner.x + .31, corner.z + .31))
  assert.equal(canWalkWorld(corner.x + .2, corner.z + .2), false)
  const next = moveWorld({ x: corner.x + 1, z: corner.z + 1 }, -2, -2)
  assert.ok(canWalkWorld(next.x, next.z))
  assert.ok(next.x > corner.x && next.z > corner.z)
})

test('room walls stop running and allow sliding, with no axis-order preference', () => {
  const right = moveWorld({ x: 13, z: 15 }, 10, 1)
  const left = moveWorld({ x: -13, z: 15 }, -10, 1)
  close(right.x, WORLD_BOUNDS.maxX - WORLD_PLAYER_RADIUS)
  close(right.x, -left.x)
  close(right.z, left.z)
  assert.ok(right.z > 15.9)
  const back = moveWorld({ x: 0, z: 18 }, 1, 10)
  close(back.z, WORLD_BOUNDS.maxZ - WORLD_PLAYER_RADIUS)
})

test('overlaps, invalid reconnects and out-of-room positions recover to walkable ground', () => {
  for (const start of [...WORLD_OBSTACLES, { x: 50, z: -100 }, { x: NaN, z: Infinity }]) {
    const next = resolveWorldPosition(start)
    assert.ok(canWalkWorld(next.x, next.z), JSON.stringify({ start, next }))
    const moved = moveWorld(next, .1, .1)
    assert.ok(canWalkWorld(moved.x, moved.z))
  }
})

test('all map destinations can be reached without cutting furniture corners', () => {
  const destinations = [...Object.values(WORLD_STATIONS), ...WORLD_MAP_DESTINATIONS.map(point => point.view)]
  for (const start of destinations) for (const destination of destinations) {
    assert.ok(canWalkWorld(start.x, start.z), JSON.stringify(start))
    const path = planWorldPath(start, destination)
    assert.ok(path.length, JSON.stringify({ start, destination }))
    let previous = start
    for (const point of path) {
      assert.ok(isWorldPathClear(previous, point), JSON.stringify({ previous, point }))
      previous = point
    }
    close(previous.x, destination.x)
    close(previous.z, destination.z)
  }
})

test('automatic travel arrives around furniture at 15, 30, 60 and 144 fps', () => {
  for (const fps of [15, 30, 60, 144]) for (const point of WORLD_MAP_DESTINATIONS) {
    const travel = createWorldTravel(WORLD_STATIONS.atrium, point.view)
    assert.ok(travel)
    let view = { yaw: 0, pitch: 0 }, arrived = false
    for (let frame = 0; frame < fps * 60; frame++) {
      const next = stepWorldTravel(travel, view, 1 / fps)
      assert.ok(canWalkWorld(next.x, next.z), `${point.id} at ${fps} fps`)
      view = next
      if (next.arrived) { arrived = true; break }
    }
    assert.ok(arrived, `${point.id} at ${fps} fps failed to arrive`)
    close(view.x, point.view.x)
    close(view.z, point.view.z)
  }
})

function simulate(fps, input, duration = 1) {
  const movement = createWorldMovement()
  let position = { x: 0, z: 17 }
  for (let frame = 0; frame < fps * duration; frame++) position = movement.update(position, input, 1 / fps)
  return { movement, position }
}

test('walking accelerates, brakes and stays consistent across frame rates', () => {
  const reference = simulate(60, { forward: 1 }).position
  for (const fps of [15, 30, 60, 144]) {
    const { movement, position } = simulate(fps, { forward: 1 })
    close(position.z, reference.z, .015)
    close(position.speed, 3.8)
    let stopped = position
    for (let frame = 0; frame < fps / 2; frame++) stopped = movement.update(stopped, {}, 1 / fps)
    assert.equal(stopped.active, false)
    assert.equal(stopped.moving, false)
    assert.ok(position.z - stopped.z < .3)
  }
})

test('diagonal walking is normalized and sprinting is faster', () => {
  const straight = simulate(60, { forward: 1 }).position
  const diagonal = simulate(60, { forward: 1, right: 1 }).position
  close(Math.hypot(diagonal.x, diagonal.z - 17), 17 - straight.z)
  const running = simulate(60, { forward: 1, running: true }).position
  assert.ok(running.z < straight.z - 2)
})

test('pushing furniture settles the character to idle and reversing is responsive', () => {
  const movement = createWorldMovement()
  let position = { x: 0, z: 4 }
  for (let i = 0; i < 180; i++) position = movement.update(position, { forward: 1, running: true }, 1 / 60)
  assert.equal(position.moving, false)
  assert.ok(canWalkWorld(position.x, position.z))
  const blockedZ = position.z
  for (let i = 0; i < 12; i++) position = movement.update(position, { forward: -1 }, 1 / 60)
  assert.ok(position.z > blockedZ + .3)
  movement.reset()
  const paused = movement.update(position, {}, 1 / 60)
  close(paused.z, position.z)
})

test('long randomized runs never leave the room or enter furniture', () => {
  let seed = 73127
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
  let position = { x: 0, z: 12.8 }
  for (let i = 0; i < 20000; i++) {
    position = moveWorld(position, (random() - .5) * 4, (random() - .5) * 4)
    assert.ok(canWalkWorld(position.x, position.z), JSON.stringify(position))
  }
})

test('third person camera retracts from walls and tall furniture, clears low furniture', () => {
  const wall = worldCameraLimit({ x: 13, y: 2, z: 15 }, { x: 17, y: 3.1, z: 15 })
  assert.ok(wall > 0 && wall < .5)
  const shelf = worldCameraLimit({ x: 10, y: 2, z: 1 }, { x: 13.3, y: 3.1, z: 1 })
  assert.ok(shelf > 0 && shelf < .5)
  assert.equal(worldCameraLimit({ x: 0, y: 3, z: -11 }, { x: 0, y: 4, z: -8 }), 1)
  assert.equal(worldCameraLimit({ x: 0, y: 1.22, z: -9 }, { x: 0, y: 3.42, z: -5.7 }), 1)
})
