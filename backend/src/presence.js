// Room presence is independent from the music revision and playback readiness.
export const AVATAR_IDS = ['mint', 'sky', 'peach', 'lilac', 'honey']
import { SEAT_LAYOUT, getSeatSlot } from './seatLayout.js'
export const SEATS = Object.fromEntries(SEAT_LAYOUT.map(seat => [seat.id, seat]))
export function initialPresence(index = 0, avatar) {
  return { avatar: AVATAR_IDS.includes(avatar) ? avatar : AVATAR_IDS[index % 5], x: (index % 10 - 4.5) * .75, z: 14 + Math.floor(index / 10) * .85, y: 0, yaw: Math.PI, motion: 'idle', seatId: '', seatIndex: null, active: false, seq: 0 }
}
export function movement(payload, previous) {
  if (!payload || !['x', 'z', 'y', 'yaw'].every(key => typeof payload[key] === 'number' && Number.isFinite(payload[key]))) return null
  if (Math.abs(payload.x) > 14.3 || payload.z < -18.7 || payload.z > 19.5 || payload.y < 0 || payload.y > 1.5) return null
  if (!Number.isSafeInteger(payload.seq) || payload.seq <= previous.seq) return null
  const motion = ['idle', 'walk', 'run', 'jump'].includes(payload.motion) ? payload.motion : 'idle'
  return { ...previous, x: payload.x, z: payload.z, y: payload.y, yaw: Math.atan2(Math.sin(payload.yaw), Math.cos(payload.yaw)), motion, seq: payload.seq }
}
export function seatPosition(id, index = 0) { return getSeatSlot(id, index)?.pose }
export function releasePosition(pose) {
  const slot = getSeatSlot(pose.seatId, pose.seatIndex ?? 0)
  return { ...pose, ...slot?.approach, seatId: '', seatIndex: null, motion: 'idle', y: 0 }
}
