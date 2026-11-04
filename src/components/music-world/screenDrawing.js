export const ink = { bg: '#081d2a', panel: '#102d3c', light: '#eef2e8', muted: '#91afb9', ice: '#87deda', copper: '#e6ad7c' }
export const font = (size, weight = 400) => `${weight} ${size}px "Microsoft YaHei", sans-serif`
export function text(ctx, value, x, y, size = 24, color = ink.light, width, weight = 400) {
  ctx.font = font(size, weight); ctx.fillStyle = color
  let label = String(value ?? '')
  if (width && ctx.measureText(label).width > width) {
    const chars = Array.from(label)
    while (chars.length && ctx.measureText(chars.join('') + '…').width > width) chars.pop()
    label = chars.join('') + '…'
  }
  ctx.fillText(label, x, y)
}
export function rounded(ctx, x, y, w, h, radius, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill()
}
export function cropImage(ctx, image, x, y, size, radius = 0) {
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, size, size, radius); ctx.clip()
  const side = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height)
  ctx.drawImage(image, ((image.naturalWidth || image.width) - side) / 2, ((image.naturalHeight || image.height) - side) / 2, side, side, x, y, size, size); ctx.restore()
}
export function createScreenImages(invalidate, limit = 48) {
  const images = new Map(); let disposed = false
  return {
    get(url) {
      if (!url || disposed) return null
      if (!images.has(url)) {
        if (images.size >= limit) { const first = images.keys().next().value, old = images.get(first); old.onload = old.onerror = null; images.delete(first) }
        const image = new Image(); image.crossOrigin = 'anonymous'; images.set(url, image)
        image.onload = () => { if (!disposed) invalidate() }; image.onerror = () => { image.onload = image.onerror = null }; image.src = url
      }
      const image = images.get(url)
      return image.complete && image.naturalWidth ? image : null
    },
    dispose() { disposed = true; images.forEach(image => { image.onload = image.onerror = null; image.src = '' }); images.clear() },
  }
}
export function wrap(ctx, value, width, size, maxRows = Infinity) {
  ctx.font = font(size)
  const rows = []; let row = ''
  for (const char of Array.from(String(value || ''))) {
    if (char === '\n' || ctx.measureText(row + char).width > width) { rows.push(row); row = ''; if (rows.length === maxRows) { rows[maxRows - 1] += '…'; return rows } }
    if (char !== '\n') row += char
  }
  if (row) rows.push(row)
  return rows
}
export const formatTime = value => { const seconds = Math.max(0, Math.floor(Number(value) || 0)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` }
