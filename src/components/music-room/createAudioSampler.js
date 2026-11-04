// Capture a separate stream; never re-route the player's audio through another
// MediaElementSource (which can mute cross-origin tracks or bind it twice).
export function createAudioSampler(audio) {
  let context = null
  let stream = null
  let source = null
  let analyser = null
  let data = null
  let lastSource = ''
  let attempted = false
  let disposed = false
  let detach = null
  const levels = new Float32Array(48)
  const bins = []

  function release() {
    detach?.(); detach = null
    source?.disconnect()
    stream?.getTracks().forEach((track) => track.stop())
    analyser?.disconnect()
    source = stream = analyser = data = null
    if (context) context.close().catch(() => {})
    context = null
  }

  function start() {
    if (disposed || !audio) return
    const nextSource = audio.currentSrc || audio.src
    if (nextSource !== lastSource) {
      release()
      lastSource = nextSource
      attempted = false
    }
    if (context?.state === 'suspended') context.resume().catch(() => {})
    if (attempted || !nextSource || audio.paused) return
    attempted = true
    try {
      const capture = audio.captureStream || audio.mozCaptureStream
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!capture || !AudioContext) return
      stream = capture.call(audio)
      const attach = () => {
        if (disposed || analyser || !stream?.getAudioTracks().length) return
        try {
          // Analysis has no audible output and needs no second audio device.
          const silentSink = typeof AudioContext.prototype.setSinkId === 'function'
          context = new AudioContext(silentSink ? { sinkId: { type: 'none' } } : undefined)
          source = context.createMediaStreamSource(stream)
          analyser = context.createAnalyser()
          analyser.fftSize = 2048
          analyser.smoothingTimeConstant = 0.5
          data = new Uint8Array(analyser.frequencyBinCount)
          const binHz = (context.sampleRate || 48000) / analyser.fftSize
          for (let index = 0; index < levels.length; index += 1) {
            const first = Math.max(1, Math.min(data.length - 1, Math.floor(40 * 400 ** (index / 48) / binHz)))
            const last = Math.min(data.length, Math.max(first + 1, Math.ceil(40 * 400 ** ((index + 1) / 48) / binHz)))
            bins[index] = [first, last]
          }
          source.connect(analyser)
          context.resume().catch(() => {})
        } catch { release() }
      }
      stream.addEventListener('addtrack', attach, { once: true })
      const capturedStream = stream
      detach = () => capturedStream.removeEventListener?.('addtrack', attach)
      attach()
    } catch { release() }
  }

  return {
    start,
    stop() { release(); attempted = false },
    sample() {
      if (!analyser || context?.state !== 'running' || disposed) return null
      if (!stream.getAudioTracks().some((track) => !track.muted && track.readyState !== 'ended')) return null
      analyser.getByteFrequencyData(data)
      for (let index = 0; index < levels.length; index += 1) {
        const [first, last] = bins[index]
        let total = 0
        for (let bin = first; bin < last; bin += 1) total += data[bin]
        levels[index] = total / (last - first) / 255
      }
      // A valid silent signal stays silent. Unavailable capture is separately null.
      return levels
    },
    dispose() { disposed = true; release() },
  }
}
