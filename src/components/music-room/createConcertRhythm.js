const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const follow = (value, target, rate, delta) => value + (target - value) * (1 - Math.exp(-rate * delta))

// Onsets come from the captured spectrum, never from a synthetic BPM clock.
export function createConcertRhythm() {
  const previous = new Float32Array(48)
  const state = { power: 0, energy: 0, bass: 0, treble: 0, pulse: 0, beats: 0, phase: 0, live: false, settling: false }
  let baseline = 0, fluxBaseline = 0, sinceBeat = 1, hasSample = false

  function reset() {
    previous.fill(0)
    baseline = fluxBaseline = 0
    sinceBeat = 1; hasSample = false
    state.pulse = state.energy = state.bass = state.treble = state.beats = state.phase = 0
  }

  function update({ levels, playing, reducedMotion }, delta) {
    delta = clamp(delta, 0, 0.1)
    state.live = Boolean(playing && !reducedMotion && levels?.length)
    state.power = follow(state.power, playing ? 1 : 0, playing ? 5 : 9, delta)
    if (Math.abs(state.power - Number(playing)) < 0.001) state.power = Number(playing)
    state.settling = state.power !== Number(playing)
    sinceBeat += delta
    let bass = 0, energy = 0, treble = 0, flux = 0
    if (state.live) {
      for (let i = 0; i < 48; i += 1) {
        const value = clamp(Number(levels[i]) || 0)
        energy += value / 48
        // The sampler's logarithmic bins put 40–225 Hz in the first 14 bands.
        if (i < 14) { bass += value / 14; flux += Math.max(0, value - previous[i]) / 14 }
        if (i >= 32) treble += value / 16
        previous[i] = value
      }
      const onset = hasSample && sinceBeat > 0.24 && bass > 0.13 &&
        bass > baseline * 1.12 + 0.018 && flux > Math.max(0.025, fluxBaseline * 1.7)
      if (onset) { state.pulse = 1; state.beats += 1; sinceBeat = 0 }
      else state.pulse *= Math.exp(-delta * 7)
      baseline = follow(baseline, bass, 2.4, delta)
      fluxBaseline = follow(fluxBaseline, flux, 3, delta)
      hasSample = true
      // Sweeps advance only while the music contains energy; silence freezes them.
      if (energy > 0.025) state.phase += delta * (0.2 + energy * 1.8)
    } else {
      previous.fill(0); hasSample = false
      baseline = fluxBaseline = state.pulse = 0
    }
    state.energy = follow(state.energy, energy, 9, delta)
    state.bass = follow(state.bass, bass, 12, delta)
    state.treble = follow(state.treble, treble, 10, delta)
    if (state.pulse < 0.001) state.pulse = 0
    return state
  }

  return { update, reset }
}
