// Room presence is independent from the music revision and playback readiness.
export const AVATAR_IDS = ['mint', 'sky', 'peach', 'lilac', 'honey']
export const SEATS = {
  'seat-front-left': { x: -5, z: -10.8, yaw: Math.PI - .22 },
  'seat-center': { x: 0, z: -9, yaw: Math.PI },
  'seat-front-right': { x: 5, z: -10.8, yaw: Math.PI + .22 },
  'seat-rear-left': { x: -5, z: 12, yaw: Math.PI - .22 },
  'seat-rear-right': { x: 5, z: 12, yaw: Math.PI + .22 },
}
export function initialPresence(index = 0, avatar) {
  return { avatar: AVATAR_IDS.includes(avatar) ? avatar : AVATAR_IDS[index % 5], x: (index % 10 - 4.5) * .75, z: 14 + Math.floor(index / 10) * .85, y: 0, yaw: Math.PI, motion: 'idle', seatId: '', active: false, seq: 0 }
}
export function movement(payload, previous) {
  if (!payload || !['x', 'z', 'y', 'yaw'].every(key => typeof payload[key] === 'number' && Number.isFinite(payload[key]))) return null
  if (Math.abs(payload.x) > 14.3 || payload.z < -18.7 || payload.z > 19.5 || payload.y < 0 || payload.y > 1.5) return null
  if (!Number.isSafeInteger(payload.seq) || payload.seq <= previous.seq) return null
  const motion = ['idle', 'walk', 'run', 'jump'].includes(payload.motion) ? payload.motion : 'idle'
  return { ...previous, x: payload.x, z: payload.z, y: payload.y, yaw: Math.atan2(Math.sin(payload.yaw), Math.cos(payload.yaw)), motion, seq: payload.seq }
}
export function seatPosition(id) {
  const seat = SEATS[id]
  return seat && { x: seat.x + Math.sin(seat.yaw) * .54, z: seat.z + Math.cos(seat.yaw) * .54, y: id === 'seat-center' ? .27 : .24, yaw: seat.yaw, motion: 'sit', seatId: id }
}
export function releasePosition(pose) {
  const seat = SEATS[pose.seatId]
  return { ...pose, ...(seat ? { x: seat.x === 0 ? 0 : seat.x + (seat.x < 0 ? 1.65 : -1.65), z: seat.x === 0 ? seat.z - 1.8 : seat.z } : {}), seatId: '', motion: 'idle', y: 0 }
}
