import { paintScreen } from './screenRasterCommands.js'

let worker = null, nextId = 0, workerFailed = false
const clients = new Map()
function stopWorker() { worker?.terminate(); worker = null }
function failWorker() {
  workerFailed = true; stopWorker()
  for (const client of clients.values()) client.fail()
}
function getWorker() {
  if (workerFailed || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap !== 'function') return null
  if (!worker) {
    try {
      worker = new Worker(new URL('./screenRaster.worker.js', import.meta.url), { type: 'module', name: 'music-screen-raster' })
      worker.onmessage = ({ data }) => {
        const client = clients.get(data.id)
        if (!client) { data.bitmap?.close(); return }
        if (data.error) failWorker()
        else client.ready(data.bitmap)
      }
      worker.onerror = failWorker
      worker.onmessageerror = failWorker
    } catch { workerFailed = true; return null }
  }
  return worker
}

const properties = {
  fillStyle: '#000000', strokeStyle: '#000000', globalAlpha: 1,
  globalCompositeOperation: 'source-over', font: '10px sans-serif',
  textAlign: 'start', textBaseline: 'alphabetic', direction: 'inherit',
  lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', miterLimit: 10,
  shadowColor: 'rgba(0, 0, 0, 0)', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
  imageSmoothingEnabled: true, imageSmoothingQuality: 'low', filter: 'none',
}
const methods = ['beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'ellipse', 'rect', 'roundRect', 'quadraticCurveTo', 'bezierCurveTo', 'clip', 'fill', 'stroke', 'fillRect', 'clearRect', 'strokeRect', 'fillText', 'strokeText', 'translate', 'rotate', 'scale', 'transform', 'setTransform', 'resetTransform', 'setLineDash', 'strokeSvg']

export function createScreenRaster(canvas, publish) {
  const id = ++nextId, metrics = document.createElement('canvas').getContext('2d')
  const width = canvas.width, height = canvas.height
  const widths = new Map(), imageIds = new WeakMap()
  let imageId = 0, state = { ...properties }, startState = { ...state }, stack = [], commands = [], sources = new Map()
  let pending = null, inFlight = null, knownImages = new Set(), disposed = false, fallback = false, context = null, scale = 1
  const ctx = { canvas }
  for (const key of Object.keys(properties)) Object.defineProperty(ctx, key, {
    get: () => state[key],
    set: value => { if (state[key] !== value) { state[key] = value; commands.push(['set', key, value]) } },
  })
  for (const method of methods) ctx[method] = (...args) => commands.push([method, ...args])
  ctx.save = () => { stack.push({ ...state }); commands.push(['save']) }
  ctx.restore = () => { state = stack.pop() || state; commands.push(['restore']) }
  for (const method of ['createLinearGradient', 'createRadialGradient']) {
    ctx[method] = (...points) => {
      const gradient = { gradient: method, points, stops: [] }
      // Methods cannot be structured-cloned; the recorded value is plain data.
      Object.defineProperty(gradient, 'addColorStop', { value: (...stop) => gradient.stops.push(stop) })
      return gradient
    }
  }
  ctx.measureText = text => {
    const key = `${state.font}\n${state.direction}\n${text}`
    let result = widths.get(key)
    if (!result) {
      metrics.font = state.font; metrics.direction = state.direction
      result = { width: metrics.measureText(text).width }
      if (widths.size >= 1024) widths.clear()
      widths.set(key, result)
    }
    return result
  }
  ctx.drawImage = (source, ...args) => {
    let key = imageIds.get(source)
    if (!key) { key = ++imageId; imageIds.set(source, key) }
    sources.set(key, source); commands.push(['drawImage', key, ...args])
  }
  function paintFallback(job) {
    canvas.width = job.width; canvas.height = job.height
    context ||= canvas.getContext('2d')
    paintScreen(context, job.frame, job.sources)
    publish(canvas)
  }
  async function submit() {
    if (disposed || inFlight || !pending) return
    const job = pending; pending = null
    const target = fallback ? null : getWorker()
    if (!target) { fallback = true; paintFallback(job); return }
    inFlight = job
    const images = []
    try {
      // Covers are immutable cached rasters. Snapshot them once when they enter
      // the visible list; no main-thread screen snapshots occur during playback.
      for (const [key, source] of job.sources) if (!knownImages.has(key)) {
        images.push([key, await createImageBitmap(source)])
      }
      if (disposed || fallback || target !== worker) { images.forEach(([, image]) => image.close()); return }
      knownImages = new Set(job.sources.keys())
      target.postMessage({ type: 'draw', id, width: job.width, height: job.height, frame: job.frame, used: [...knownImages], images }, images.map(([, image]) => image))
    } catch {
      images.forEach(([, image]) => image.close())
      failWorker()
    }
  }
  clients.set(id, {
    ready(bitmap) {
      if (disposed) { bitmap.close(); return }
      publish(bitmap); inFlight = null; submit()
    },
    fail() {
      fallback = true
      const job = pending || inFlight
      pending = inFlight = null; knownImages.clear()
      if (job && !disposed) paintFallback(job)
    },
  })
  return {
    context: ctx,
    setScale(value) {
      const next = Math.max(.25, Math.min(1, Math.ceil(value * 4) / 4))
      if (next === scale) return false
      if (next < scale && value > scale - .30) return false
      scale = next; return true
    },
    refresh() {
      if (disposed) return
      pending = { width: Math.ceil(width * scale), height: Math.ceil(height * scale), frame: { state: startState, commands, scale }, sources }
      startState = { ...state }; commands = []; sources = new Map()
      // One in-flight frame and one replaceable pending frame per screen.
      submit()
    },
    dispose() {
      disposed = true; pending = inFlight = null; commands = []; sources.clear(); widths.clear()
      clients.delete(id); worker?.postMessage({ type: 'dispose', id })
      if (!clients.size) { stopWorker(); workerFailed = false }
    },
  }
}
