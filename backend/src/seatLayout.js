// Shared with the 3D client. Capacity comes from physical cushions, not hit boxes.
export const SEAT_LAYOUT = [
  { id: 'seat-front-left', x: -5, z: -10.8, yaw: Math.PI - .22, offsets: [0] },
  { id: 'seat-center', x: 0, z: -9, yaw: Math.PI, offsets: [-.73, .73] },
  { id: 'seat-front-right', x: 5, z: -10.8, yaw: Math.PI + .22, offsets: [0] },
  { id: 'seat-rear-left', x: -5, z: 12, yaw: Math.PI - .22, offsets: [0] },
  { id: 'seat-rear-right', x: 5, z: 12, yaw: Math.PI + .22, offsets: [0] },
].map(seat => ({ ...seat, capacity: seat.offsets.length }))

export function getSeat(id) { return SEAT_LAYOUT.find(seat => seat.id === id) }

export function getSeatSlot(id, index = 0) {
  const seat = getSeat(id)
  if (!seat || !Number.isInteger(index) || index < 0 || index >= seat.capacity) return null
  const x = seat.x + seat.offsets[index], z = seat.z
  const forwardX = Math.sin(seat.yaw), forwardZ = Math.cos(seat.yaw)
  return {
    seatId: id, seatIndex: index,
    camera: { x, y: 1.22, z },
    approach: { x: x + forwardX * 1.85, z: z + forwardZ * 1.85 },
    pose: { x: x + forwardX * .54, y: id === 'seat-center' ? .27 : .24, z: z + forwardZ * .54, yaw: seat.yaw, motion: 'sit', seatId: id, seatIndex: index },
  }
}

export function seatOccupants(id, players = [], excludeId = '') {
  return players.filter(player => (!excludeId || player.id !== excludeId) && player.active !== false && player.connected !== false && player.seatId === id)
}

export function availableSeatSlots(id, players = [], excludeId = '') {
  const seat = getSeat(id)
  if (!seat) return []
  const occupied = new Set(seatOccupants(id, players, excludeId).map(player => player.seatIndex ?? 0))
  return seat.offsets.map((_, index) => index).filter(index => !occupied.has(index))
}
