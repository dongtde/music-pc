import { paintScreen } from './screenRasterCommands.js'

const surfaces = new Map()
self.onmessage = async ({ data }) => {
  const { id, type } = data
  if (type === 'dispose') {
    const surface = surfaces.get(id)
    surface?.images.forEach(image => image.close())
    surfaces.delete(id)
    return
  }
  try {
    let surface = surfaces.get(id)
    if (!surface) {
      const canvas = new OffscreenCanvas(data.width, data.height)
      surface = { canvas, ctx: canvas.getContext('2d', { willReadFrequently: true }), images: new Map() }
      surfaces.set(id, surface)
    }
    if (surface.canvas.width !== data.width || surface.canvas.height !== data.height) {
      surface.canvas.width = data.width; surface.canvas.height = data.height
    }
    for (const [key, image] of data.images) {
      surface.images.get(key)?.close()
      surface.images.set(key, image)
    }
    // Only retain cover rasters used by this frame, not every song ever visited.
    const used = new Set(data.used)
    for (const [key, image] of surface.images) if (!used.has(key)) {
      image.close(); surface.images.delete(key)
    }
    paintScreen(surface.ctx, data.frame, surface.images)
    const bitmap = await createImageBitmap(surface.canvas, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
    if (surfaces.get(id) !== surface) { bitmap.close(); return }
    self.postMessage({ id, bitmap }, [bitmap])
  } catch (error) {
    self.postMessage({ id, error: String(error?.message || error) })
  }
}
