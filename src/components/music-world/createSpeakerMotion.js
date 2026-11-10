// Animate only the diaphragms and shared emissive materials; no extra lights,
// shadow updates or texture uploads are needed for the speakers.
export function createSpeakerMotion(pavilion) {
  const drivers = [], lights = new Set()
  pavilion.traverse(object => {
    if (object.userData.speakerDriver) {
      drivers.push({ object, rest: object.position.z, index: object.userData.driverIndex || 0 })
      object.traverse(child => { if (child.isMesh) child.castShadow = child.receiveShadow = false })
    }
    const material = object.material
    if (material?.name === 'speaker-light-blue' || material?.name === 'speaker-light-violet') lights.add(material)
  })
  let envelope = 0, brightness = .22, phase = 0
  return {
    update(state, dt, { reducedMotion = false, lightsEnabled = true } = {}) {
      const delta = Math.max(0, Math.min(.1, dt))
      const live = state.live && !reducedMotion
      const target = live ? Math.min(1, Math.max(0, state.bass * .8 + state.pulse * .2)) : 0
      envelope += (target - envelope) * (1 - Math.exp(-delta * (target > envelope ? 24 : 10)))
      if (envelope < .0005) envelope = 0
      if (reducedMotion) envelope = 0
      if (envelope) phase = (phase + delta * 2 * Math.PI * 9) % (Math.PI * 2)
      for (const { object, rest, index } of drivers) object.position.z = rest + Math.sin(phase + index * .25) * envelope * .012
      const lightTarget = lightsEnabled ? .22 + envelope * 1.7 : 0
      brightness += (lightTarget - brightness) * (1 - Math.exp(-delta * 7))
      if (Math.abs(lightTarget - brightness) < .001) brightness = lightTarget
      for (const material of lights) material.emissiveIntensity = brightness
      return envelope > 0 || brightness !== lightTarget
    },
  }
}
