import * as THREE from 'three'

export function canvasSurface(width = 768, height = 384) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
  const context = canvas.getContext('2d'), texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace
  return { canvas, context, texture, refresh() { texture.needsUpdate = true } }
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
