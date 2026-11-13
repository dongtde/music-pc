import * as THREE from 'three'

const SPRING_BONES = [
  { bone: 'Veil', driver: 'Head', omega: 8.5, lag: .075, length: .41, limit: .30 },
  { bone: 'VeilTip', driver: 'Head', omega: 7.2, lag: .105, length: .41, limit: .38 },
  { bone: 'Skirt.Back', driver: 'Hips', omega: 9.2, lag: .070, length: .50, limit: .26 },
  { bone: 'SkirtHem.Back', driver: 'Hips', omega: 7.5, lag: .095, length: .49, limit: .34 },
  { bone: 'Skirt.L', driver: 'Hips', omega: 9.2, lag: .070, length: .50, limit: .26 },
  { bone: 'SkirtHem.L', driver: 'Hips', omega: 7.5, lag: .095, length: .49, limit: .34 },
  { bone: 'Skirt.R', driver: 'Hips', omega: 9.2, lag: .070, length: .50, limit: .26 },
  { bone: 'SkirtHem.R', driver: 'Hips', omega: 7.5, lag: .095, length: .49, limit: .34 },
  { bone: 'Sleeve.L', driver: 'UpperArm.L', omega: 9, lag: .060, length: .37, limit: .24 },
  { bone: 'SleeveTip.L', driver: 'Forearm.L', omega: 7.5, lag: .085, length: .37, limit: .32 },
  { bone: 'Sleeve.R', driver: 'UpperArm.R', omega: 9, lag: .060, length: .37, limit: .24 },
  { bone: 'SleeveTip.R', driver: 'Forearm.R', omega: 7.5, lag: .085, length: .37, limit: .32 },
]

const MAX_STEP = 1 / 120
const vec = () => new THREE.Vector3()
const quat = () => new THREE.Quaternion()

function makeAngularVelocity(previous, current, delta, target, inverse, change) {
  inverse.copy(previous).invert()
  change.copy(current).multiply(inverse).normalize()
  if (change.w < 0) change.set(-change.x, -change.y, -change.z, -change.w)
  const angle = 2 * Math.acos(THREE.MathUtils.clamp(change.w, -1, 1))
  const sine = Math.sqrt(Math.max(0, 1 - change.w * change.w))
  if (sine < 1e-6 || angle < 1e-6) return target.set(0, 0, 0)
  return target.set(change.x / sine, change.y / sine, change.z / sine).multiplyScalar(angle / delta)
}

// Add a damped, per-avatar secondary-motion solve after the base clip is sampled.
export function createFantasyQueenSpringBones(model) {
  const drivers = new Map()
  const springs = SPRING_BONES.flatMap(settings => {
    const bone = model.getObjectByName(settings.bone)
    const driver = model.getObjectByName(settings.driver)
    if (!bone || !driver) return []
    if (!drivers.has(driver)) {
      drivers.set(driver, {
        bone: driver,
        previousRotation: quat(),
        previousPosition: vec(),
        rotation: quat(),
        position: vec(),
        deltaRotation: quat(),
        angularDelta: quat(),
        velocitySample: vec(),
        angularVelocity: vec(),
        previousAngularVelocity: vec(),
        angularAcceleration: vec(),
        linearVelocity: vec(),
        acceleration: vec(),
        ready: false,
      })
    }
    return [{
      ...settings,
      bone,
      source: drivers.get(driver),
      state: vec(),
      velocity: vec(),
      target: vec(),
      worldRotation: quat(),
      worldToBone: quat(),
      offset: quat(),
      angularAcceleration: vec(),
    }]
  })
  const sources = [...drivers.values()]
  const euler = new THREE.Euler()

  function update(delta, reducedMotion = false) {
    if (!springs.length || delta <= 0) return
    model.updateMatrixWorld(true)
    const sampleDelta = Math.min(delta, .1)
    const step = Math.min(delta, .05)

    for (const source of sources) {
      const rotation = source.bone.getWorldQuaternion(source.rotation)
      const position = source.bone.getWorldPosition(source.position)
      if (!source.ready || delta > .1) {
        source.previousRotation.copy(rotation)
        source.previousPosition.copy(position)
        source.angularVelocity.set(0, 0, 0)
        source.previousAngularVelocity.set(0, 0, 0)
        source.acceleration.set(0, 0, 0)
        source.ready = true
        continue
      }
      makeAngularVelocity(source.previousRotation, rotation, sampleDelta, source.angularVelocity,
        source.deltaRotation, source.angularDelta)
      const velocity = source.velocitySample.subVectors(position, source.previousPosition).multiplyScalar(1 / sampleDelta)
      source.acceleration.copy(velocity).sub(source.linearVelocity).multiplyScalar(1 / sampleDelta)
      source.linearVelocity.copy(velocity)
      source.angularAcceleration.copy(source.angularVelocity).sub(source.previousAngularVelocity).multiplyScalar(1 / sampleDelta)
    }

    for (const spring of springs) {
      const source = spring.source
      spring.worldRotation.copy(spring.bone.getWorldQuaternion(spring.worldRotation))
      spring.worldToBone.copy(spring.worldRotation).invert()
      if (!reducedMotion && source.ready) {
        const lagSquared = spring.lag * spring.lag
        spring.target.copy(source.angularAcceleration).multiplyScalar(-lagSquared)
          .addScaledVector(source.acceleration, -lagSquared / spring.length)
          .applyQuaternion(spring.worldToBone)
        spring.target.clampLength(0, spring.limit)
      } else {
        spring.target.set(0, 0, 0)
      }
    }

    let remaining = step
    while (remaining > 0) {
      const dt = Math.min(remaining, MAX_STEP)
      for (const spring of springs) {
        const omega = reducedMotion ? spring.omega * 1.5 : spring.omega
        const damping = reducedMotion ? 1.15 : 0.82
        const stiffness = omega * omega
        spring.velocity.addScaledVector(spring.target, stiffness * dt)
          .addScaledVector(spring.state, -stiffness * dt)
          .addScaledVector(spring.velocity, -2 * damping * omega * dt)
        spring.state.addScaledVector(spring.velocity, dt).clampLength(0, spring.limit)
      }
      remaining -= dt
    }

    for (const spring of springs) {
      euler.set(spring.state.x, spring.state.y, spring.state.z, 'XYZ')
      spring.offset.setFromEuler(euler)
      spring.bone.quaternion.multiply(spring.offset).normalize()
    }

    for (const source of sources) {
      source.previousRotation.copy(source.rotation)
      source.previousPosition.copy(source.position)
      source.previousAngularVelocity.copy(source.angularVelocity)
      if (reducedMotion || delta > .1) {
        source.angularVelocity.set(0, 0, 0)
        source.previousAngularVelocity.set(0, 0, 0)
        source.acceleration.set(0, 0, 0)
        source.linearVelocity?.set(0, 0, 0)
      }
    }
    return springs.some(spring => spring.state.lengthSq() > 1e-6 || spring.velocity.lengthSq() > 1e-5)
  }

  return { update, count: springs.length }
}
