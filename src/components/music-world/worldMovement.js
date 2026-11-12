import { moveWorld } from './worldNavigation.js'

export const WORLD_WALK_SPEED = 3.8
export const WORLD_RUN_SPEED = 7

// Integrate at a fixed maximum step so acceleration, braking and collision
// response stay consistent on both high-refresh and slower machines.
export function createWorldMovement() {
  let vx = 0, vz = 0
  return {
    reset() { vx = vz = 0 },
    update(position, { forward = 0, right = 0, yaw = 0, running = false } = {}, delta = 0) {
      const dt = Math.max(0, Math.min(delta, .1)), inputLength = Math.hypot(forward, right)
      const speed = inputLength ? (running ? WORLD_RUN_SPEED : WORLD_WALK_SPEED) / inputLength : 0
      const targetX = (-Math.sin(yaw) * forward + Math.cos(yaw) * right) * speed
      const targetZ = (-Math.cos(yaw) * forward - Math.sin(yaw) * right) * speed
      const steps = Math.max(1, Math.ceil(dt * 120)), step = dt / steps
      let x = position.x, z = position.z
      for (let i = 0; i < steps && step > 0; i++) {
        const beforeX = vx, beforeZ = vz, dx = targetX - vx, dz = targetZ - vz
        const change = Math.hypot(dx, dz), acceleration = inputLength ? 24 : 32
        const blend = change ? Math.min(1, acceleration * step / change) : 0
        vx += dx * blend; vz += dz * blend
        const next = moveWorld({ x, z }, (beforeX + vx) * .5 * step, (beforeZ + vz) * .5 * step)
        x = next.x; z = next.z
        for (const normal of next.contacts) {
          const into = Math.min(0, vx * normal.x + vz * normal.z)
          vx -= normal.x * into; vz -= normal.z * into
        }
      }
      const distance = Math.hypot(x - position.x, z - position.z)
      return { x, z, speed: dt ? distance / dt : 0, moving: distance > .0001, active: Math.hypot(vx, vz) > .001 }
    },
  }
}
