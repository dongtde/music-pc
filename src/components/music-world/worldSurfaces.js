import * as THREE from 'three'
import { createScreenRaster } from './createScreenRaster.js'

export function canvasSurface(width = 768, height = 384, { dynamic = false, onReady } = {}) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  let bitmap = null, disposed = false, resizing = false
  let uploadedWidth = width, uploadedHeight = height
  if (dynamic) {
    // Keep orientation in the UV matrix so each upload needs no row reversal.
    texture.flipY = false; texture.repeat.y = -1; texture.offset.y = 1
    texture.generateMipmaps = false; texture.minFilter = THREE.LinearFilter
  }
  const raster = dynamic ? createScreenRaster(canvas, publish) : null
  const context = raster ? raster.context : canvas.getContext('2d')
  texture.addEventListener('dispose', () => {
    if (resizing) return
    disposed = true; raster?.dispose(); bitmap?.close(); bitmap = null
  })
  function publish(image) {
    if (disposed) { if (image !== canvas) image.close(); return }
    if (image.width !== uploadedWidth || image.height !== uploadedHeight) {
      // Three uses immutable texStorage2D: changing the raster size must release
      // its GPU allocation, without shutting down this screen's worker client.
      resizing = true; texture.dispose(); resizing = false
      uploadedWidth = image.width; uploadedHeight = image.height
    }
    bitmap?.close(); bitmap = image === canvas ? null : image
    texture.image = image
    texture.needsUpdate = true; onReady?.()
  }
  function refresh() {
    if (disposed) return
    if (raster) raster.refresh()
    else publish(canvas)
  }
  return { canvas, context, texture, refresh, setScale: value => raster?.setScale(value) || false }
}
export function panelText(ctx, value, x, y, size = 32, color = '#e5ece7', width = 680) {
  ctx.fillStyle = color; ctx.font = `${size}px "Microsoft YaHei", sans-serif`; ctx.fillText(String(value || ''), x, y, width)
}
export function wrappedText(ctx, value, x, y, width, size = 34, color = '#e5ece7', maxRows = 3) {
  ctx.font = `${size}px "Microsoft YaHei", sans-serif`; ctx.fillStyle = color
  let row = '', rowIndex = 0
  for (const char of String(value || '')) {
    if (ctx.measureText(row + char).width > width) { ctx.fillText(row, x, y + rowIndex * size * 1.5); row = ''; rowIndex++; if (rowIndex >= maxRows) return }
    row += char
  }
  ctx.fillText(row, x, y + rowIndex * size * 1.5)
}
export const DISCOVERY_PORTALS = [
  { id: 'recommend', name: '推荐' },
  { id: 'playlists', name: '歌单' },
  { id: 'artists', name: '歌手' },
  { id: 'charts', name: '排行榜' },
]
