import { Vector3 } from 'three'
import { DEFAULT_LOUNGE_CLIMATE, loungeClockHour, normalizeLoungeClimate, sampleLoungeClimate, wrapHour } from './loungeClimate.js'

export function createLoungeClimate({ scene, renderer, ambient, sun, practicals, getLounge, invalidate }) {
  let settings = { ...DEFAULT_LOUNGE_CLIMATE }, cycleStart = Date.now(), cycleHour = settings.hour
  let currentHour = settings.hour, currentWeather = sampleLoungeClimate(settings.hour, settings.weather)
  const targetFrame = sampleLoungeClimate(settings.hour, settings.weather)
  let initialized = false, elapsed = 0, shadowElapsed = 0
  const previousSun = new Vector3(Infinity, Infinity, Infinity)
  return {
    set(value) {
      const now = Date.now(), next = normalizeLoungeClimate(value)
      if (next.mode !== settings.mode || next.hour !== settings.hour) {
        cycleStart = now; cycleHour = next.hour
      }
      settings = next
      invalidate?.()
    },
    update(dt, audio, reducedMotion, quality) {
      const lounge = getLounge()
      if (!lounge) return false
      const targetHour = loungeClockHour(settings, Date.now(), cycleStart, cycleHour)
      const difference = ((targetHour - currentHour + 36) % 24) - 12
      const amount = !initialized || reducedMotion ? 1 : 1 - Math.exp(-dt * 2.5)
      currentHour = wrapHour(currentHour + difference * amount)
      const target = sampleLoungeClimate(currentHour, settings.weather, targetFrame)
      let settling = Math.abs(difference) > .002
      for (const key of ['cloud', 'rain', 'mist', 'sun', 'sunIntensity', 'ambientIntensity', 'environmentIntensity', 'practicalIntensity', 'fogDensity', 'cityBrightness']) {
        const gap = target[key] - currentWeather[key]
        settling ||= Math.abs(gap) > .001
        currentWeather[key] += gap * amount
        target[key] = currentWeather[key]
      }
      for (const key of ['skyTop', 'horizon', 'sunColor', 'ambientColor', 'cityTint']) {
        const from = currentWeather[key], to = target[key]
        settling ||= Math.abs(from.r - to.r) + Math.abs(from.g - to.g) + Math.abs(from.b - to.b) > .001
        currentWeather[key].lerp(target[key], amount)
        target[key].copy(currentWeather[key])
      }
      const motion = !reducedMotion && (target.rain > .01 || (quality !== 'smooth' && target.cloud > .7))
      if (motion) elapsed += dt
      ambient.color.copy(target.ambientColor)
      ambient.groundColor.set('#76614d')
      ambient.intensity = target.ambientIntensity * (1 - audio.power * .12)
      sun.color.copy(target.sunColor); sun.intensity = target.sunIntensity
      const angle = (currentHour - 6) / 24 * Math.PI * 2
      const celestialSide = target.elevation < 0 ? -1 : 1
      sun.position.set(Math.cos(angle) * -24 * celestialSide, 5 + Math.abs(target.elevation) * 24, -12 * celestialSide)
      practicals.forEach(light => { light.color.set('#ffdaa1'); light.intensity = target.practicalIntensity })
      scene.environmentIntensity = target.environmentIntensity
      scene.fog.color.copy(target.horizon); scene.fog.density = target.fogDensity
      scene.background.copy(target.skyTop)
      renderer.toneMappingExposure = 1
      shadowElapsed += dt
      // Color/intensity changes do not change a shadow depth map. Only direction
      // changes require another scene pass; overcast/night shadows are negligible.
      if (shadowElapsed > (quality === 'high' ? .3 : .6) && sun.intensity > .3 && previousSun.distanceToSquared(sun.position) > .09) {
        renderer.shadowMap.needsUpdate = true; previousSun.copy(sun.position); shadowElapsed = 0
      }
      const drying = lounge.setAtmosphere(target, elapsed, reducedMotion, dt) === true
      initialized = true
      return settling || motion || drying || (settings.mode === 'cycle' && !reducedMotion)
    },
    getState: () => ({ ...settings, currentHour }),
  }
}
