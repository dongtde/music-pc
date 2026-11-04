import test from 'node:test'
import assert from 'node:assert/strict'
import { createAudioSampler } from '../src/components/music-room/createAudioSampler.js'

function fixture(amplitude = 128) {
  const contexts = [], tracks = []
  globalThis.window = { AudioContext: class {
    constructor() { this.state = 'running'; this.sampleRate = 48000; this.closed = false; contexts.push(this) }
    createMediaElementSource() { throw new Error('Must not reroute ordinary playback') }
    createMediaStreamSource() { return { connect() {}, disconnect() {} } }
    createAnalyser() { return { frequencyBinCount: 1024, getByteFrequencyData: (data) => data.fill(amplitude), disconnect() {} } }
    resume() { return Promise.resolve() }
    close() { this.closed = true; return Promise.resolve() }
  } }
  const audio = { src: 'blob:local-music', currentSrc: 'blob:local-music', paused: false, volume: 0.75,
    captureStream() {
      const track = { stopped: false, stop() { this.stopped = true } }; tracks.push(track)
      return { getAudioTracks: () => [track], getTracks: () => [track], addEventListener() {} }
    },
  }
  return { contexts, tracks, audio }
}

test('frequency analysis leaves the original audio path, volume and playback untouched', () => {
  const { audio, tracks, contexts } = fixture()
  const sampler = createAudioSampler(audio)
  sampler.start()
  assert.equal(sampler.sample().length, 48)
  assert.ok(Math.abs(sampler.sample()[0] - 128 / 255) < 0.00001)
  assert.equal(audio.volume, 0.75)
  assert.equal(audio.paused, false)
  assert.equal(audio.src, 'blob:local-music')
  sampler.stop()
  assert.equal(tracks[0].stopped, true)
  assert.equal(contexts[0].closed, true)
  assert.equal(sampler.sample(), null)
  sampler.start()
  assert.equal(contexts.length, 2)
  sampler.dispose()
  sampler.start()
  assert.equal(contexts.length, 2)
  assert.equal(contexts[1].closed, true)
})

test('captured silence returns zero bands, while muted or ended capture is unavailable', () => {
  const { audio, tracks } = fixture(0)
  const sampler = createAudioSampler(audio)
  sampler.start()
  assert.ok(sampler.sample().every((value) => value === 0))
  tracks[0].muted = true
  assert.equal(sampler.sample(), null)
  tracks[0].muted = false
  tracks[0].readyState = 'ended'
  assert.equal(sampler.sample(), null)
  sampler.dispose()
})

test('an uncapturable stream falls back without retrying every animation frame', () => {
  const { audio, contexts } = fixture()
  let calls = 0
  audio.captureStream = () => { calls += 1; throw new Error('Cross-origin capture not allowed') }
  const sampler = createAudioSampler(audio)
  for (let frame = 0; frame < 100; frame += 1) sampler.start()
  assert.equal(calls, 1)
  assert.equal(contexts.length, 0)
  assert.equal(sampler.sample(), null)
  assert.equal(audio.paused, false)
  sampler.dispose()
})

test('switching songs releases the previous capture and disposal is idempotent', () => {
  const { audio, tracks, contexts } = fixture()
  const sampler = createAudioSampler(audio)
  sampler.start()
  audio.currentSrc = 'blob:next-track'
  sampler.start()
  assert.equal(tracks[0].stopped, true)
  assert.equal(contexts[0].closed, true)
  assert.equal(contexts.length, 2)
  assert.equal(contexts[1].closed, false)
  sampler.dispose(); sampler.dispose()
  assert.equal(tracks[1].stopped, true)
  assert.equal(contexts[1].closed, true)
})
