import test from 'node:test'
import assert from 'node:assert/strict'
import { createConcertRhythm } from '../src/components/music-room/createConcertRhythm.js'

const spectrum = (bass, rest = 0.08) => Float32Array.from({ length: 48 }, (_, i) => i < 14 ? bass : rest)
const tick = (rhythm, levels, count = 1, overrides = {}) => {
  let state
  for (let i = 0; i < count; i += 1) state = rhythm.update({ levels, playing: true, reducedMotion: false, ...overrides }, 1 / 60)
  return { ...state }
}

test('irregular bass onsets drive pulses, independent of a fixed BPM clock', () => {
  const rhythm = createConcertRhythm()
  let beats = 0
  for (const interval of [24, 39, 19, 53, 31]) {
    const quiet = tick(rhythm, spectrum(0.05), interval)
    assert.equal(quiet.beats, beats)
    const onset = tick(rhythm, spectrum(0.9))
    assert.equal(onset.beats, ++beats)
    assert.equal(onset.pulse, 1)
    assert.ok(tick(rhythm, spectrum(0.05), 8).pulse < 0.5)
  }
})

test('sustained bass does not manufacture repeated beats', () => {
  const rhythm = createConcertRhythm()
  tick(rhythm, spectrum(0.03), 30)
  assert.equal(tick(rhythm, spectrum(0.9)).beats, 1)
  const held = tick(rhythm, spectrum(0.9), 360)
  assert.equal(held.beats, 1)
  assert.equal(held.pulse, 0)
})

test('silence has no pulses, energy or sweep movement', () => {
  const rhythm = createConcertRhythm()
  const silent = tick(rhythm, spectrum(0, 0), 300)
  assert.equal(silent.live, true)
  assert.equal(silent.beats, 0)
  assert.equal(silent.phase, 0)
  assert.equal(silent.energy, 0)
})

test('unavailable analysis and reduced motion produce steady lighting without beats', () => {
  for (const options of [{ levels: null }, { levels: spectrum(1), reducedMotion: true }]) {
    const rhythm = createConcertRhythm()
    const state = tick(rhythm, options.levels, 200, options)
    assert.equal(state.live, false)
    assert.equal(state.power, 1)
    assert.equal(state.beats, 0)
    assert.equal(state.phase, 0)
    assert.equal(state.settling, false)
  }
})

test('pausing fully extinguishes the rig and reaches an idle state', () => {
  const rhythm = createConcertRhythm()
  tick(rhythm, spectrum(0.1), 100)
  tick(rhythm, spectrum(1))
  const paused = tick(rhythm, null, 90, { playing: false })
  assert.equal(paused.power, 0)
  assert.equal(paused.pulse, 0)
  assert.equal(paused.live, false)
  assert.equal(paused.settling, false)
})

test('a song change resets the previous beat history and sweep phrase', () => {
  const rhythm = createConcertRhythm()
  tick(rhythm, spectrum(0.05), 30)
  assert.equal(tick(rhythm, spectrum(0.9)).beats, 1)
  rhythm.reset()
  const next = tick(rhythm, spectrum(0, 0))
  assert.equal(next.beats, 0)
  assert.equal(next.phase, 0)
  assert.equal(next.pulse, 0)
})
