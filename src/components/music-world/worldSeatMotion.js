const clamp = value => Math.max(0, Math.min(1, value))
const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t) }
const mix = (a, b, t) => a + (b - a) * t
const angle = (to, from) => Math.atan2(Math.sin(to - from), Math.cos(to - from))

export function createSeatMotion(from, to) {
  return {
    from: { ...from, sitBlend: from.sitBlend ?? (from.motion === 'sit' ? 1 : 0) },
    to: { ...to, sitBlend: to.motion === 'sit' ? 1 : 0 },
    duration: to.motion === 'sit' ? 1.15 : .95,
  }
}

export function sampleSeatMotion(transition, elapsed) {
  const { from, to, duration } = transition, t = clamp(elapsed / duration)
  const sitting = to.motion === 'sit'
  // Turn at the approach point, then back onto the cushion and lower the hips.
  // Getting up reverses the order: straighten the legs before stepping out.
  const move = sitting ? ease((t - .25) / .75) : ease((t - .45) / .55)
  const posture = sitting ? ease((t - .45) / .55) : ease(t / .7)
  const turn = sitting ? ease(t / .3) : ease((t - .65) / .35)
  return {
    ...to,
    x: mix(from.x, to.x, move), y: mix(from.y, to.y, posture), z: mix(from.z, to.z, move),
    yaw: from.yaw + angle(to.yaw, from.yaw) * turn,
    sitBlend: mix(from.sitBlend, to.sitBlend, posture),
    move, posture, done: t === 1,
  }
}
