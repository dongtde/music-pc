import test from 'node:test'
import assert from 'node:assert/strict'
import { canOccupy, moveInRoom, findRoomPath, ROOM_STATIONS, ROOM_BOUNDS } from '../src/components/music-room/roomNavigation.js'

test('the visitor cannot walk through the room shell, screen or speakers', () => {
  assert.equal(canOccupy(0, 9.8), true)
  assert.equal(canOccupy(6.1, -8.35), false)
  assert.equal(canOccupy(0, -11.15), false)
  assert.equal(canOccupy(9.2, 0), false)
})

test('the removed core and matrix leave freely walkable floor space', () => {
  assert.equal(canOccupy(-3.4, 0.1), true)
  assert.equal(canOccupy(5.45, 1.8), true)
  assert.ok(Math.abs(moveInRoom({ x: -3.4, z: 4 }, 0, -8).z + 4) < 0.01)
  assert.equal(ROOM_STATIONS.core, undefined)
})

test('a large movement cannot tunnel through equipment or walls', () => {
  const stopped = moveInRoom({ x: -6.1, z: -4 }, 0, -7)
  assert.ok(stopped.z > -7.23)
  const bounded = moveInRoom({ x: 0, z: 10 }, 100, 0)
  assert.ok(bounded.x <= ROOM_BOUNDS.maxX)
  assert.ok(canOccupy(bounded.x, bounded.z))
})

test('movement slides along the wall instead of getting stuck', () => {
  const next = moveInRoom({ x: 8.1, z: 3 }, 2, -2)
  assert.ok(next.x <= ROOM_BOUNDS.maxX)
  assert.ok(next.z < 1.1)
})

test('guided walks reach each music station without crossing a model', () => {
  const starts = [...Object.values(ROOM_STATIONS), { x: -7.8, z: -4 }, { x: 7.8, z: 10.5 }, { x: -7, z: 1 }]
  for (const start of starts) for (const target of Object.values(ROOM_STATIONS)) {
    const path = findRoomPath(start, target)
    assert.ok(path.length, `No path from ${JSON.stringify(start)} to ${target.label}`)
    let position = { x: start.x, z: start.z }
    for (const waypoint of path) {
      let distance = Math.hypot(waypoint.x - position.x, waypoint.z - position.z)
      for (let step = 0; distance > 0.01 && step < 100; step += 1) {
        const scale = Math.min(0.08 / distance, 1)
        position = moveInRoom(position, (waypoint.x - position.x) * scale, (waypoint.z - position.z) * scale)
        assert.ok(canOccupy(position.x, position.z), 'Path crosses equipment')
        distance = Math.hypot(waypoint.x - position.x, waypoint.z - position.z)
      }
      assert.ok(distance < 0.02, `Path got stuck near ${JSON.stringify(waypoint)}`)
    }
    assert.ok(Math.hypot(position.x - target.x, position.z - target.z) < 0.03)
  }
})
