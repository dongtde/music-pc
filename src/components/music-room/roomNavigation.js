export const ROOM_BOUNDS = { minX: -8.15, maxX: 8.15, minZ: -10.2, maxZ: 11.3 }
export const PLAYER_RADIUS = 0.32
export const ROOM_OBSTACLES = [
  { x: -6.1, z: -8.35, halfX: 0.85, halfZ: 0.8 },
  { x: 6.1, z: -8.35, halfX: 0.85, halfZ: 0.8 },
  { x: -6.9, z: 7.1, halfX: 0.8, halfZ: 1.6 },
  { x: 6.9, z: 7.1, halfX: 0.8, halfZ: 1.6 },
]
export const ROOM_STATIONS = {
  entrance: { x: 0, z: 9.8, look: [0, 3.1, -11.15], label: '入口' },
  screen: { x: 0, z: -5.05, look: [0, 3.25, -11.15], label: '音乐主屏' },
}

export function canOccupy(x, z) {
  if (x < ROOM_BOUNDS.minX || x > ROOM_BOUNDS.maxX || z < ROOM_BOUNDS.minZ || z > ROOM_BOUNDS.maxZ) return false
  return ROOM_OBSTACLES.every((obstacle) => obstacle.radius
    ? Math.hypot(x - obstacle.x, z - obstacle.z) >= obstacle.radius + PLAYER_RADIUS
    : Math.abs(x - obstacle.x) >= obstacle.halfX + PLAYER_RADIUS || Math.abs(z - obstacle.z) >= obstacle.halfZ + PLAYER_RADIUS)
}

// Small, axis-separated steps prevent tunneling and allow sliding along walls.
export function moveInRoom(position, dx, dz) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.12))
  let { x, z } = position
  for (let index = 0; index < steps; index += 1) {
    if (canOccupy(x + dx / steps, z)) x += dx / steps
    if (canOccupy(x, z + dz / steps)) z += dz / steps
  }
  return { x, z }
}

// A small walkable grid keeps guided walks on the floor and around furniture.
export function findRoomPath(start, destination) {
  const size = 0.4
  const key = (x, z) => `${x},${z}`
  const cell = (point) => ({ x: Math.round(point.x / size), z: Math.round(point.z / size) })
  const first = cell(start)
  const last = cell(destination)
  const firstKey = key(first.x, first.z)
  const goalKey = key(last.x, last.z)
  const open = [{ ...first, g: 0, f: 0 }]
  const costs = new Map([[firstKey, 0]])
  const parents = new Map()
  const closed = new Set()
  while (open.length) {
    open.sort((a, b) => a.f - b.f)
    const current = open.shift()
    const currentKey = key(current.x, current.z)
    if (closed.has(currentKey)) continue
    if (currentKey === goalKey) {
      const path = [{ x: destination.x, z: destination.z }]
      let cursor = currentKey
      while (cursor !== firstKey) {
        const [x, z] = cursor.split(',').map(Number)
        path.unshift({ x: x * size, z: z * size })
        cursor = parents.get(cursor)
      }
      return path
    }
    closed.add(currentKey)
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const x = current.x + dx
      const z = current.z + dz
      if (!canOccupy(x * size, z * size)) continue
      if (dx && dz && (!canOccupy(current.x * size, z * size) || !canOccupy(x * size, current.z * size))) continue
      const nextKey = key(x, z)
      const cost = current.g + Math.hypot(dx, dz)
      if (cost >= (costs.get(nextKey) ?? Infinity)) continue
      costs.set(nextKey, cost)
      parents.set(nextKey, currentKey)
      open.push({ x, z, g: cost, f: cost + Math.hypot(last.x - x, last.z - z) })
    }
  }
  return []
}
