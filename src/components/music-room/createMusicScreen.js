import { CanvasTexture, SRGBColorSpace } from 'three'
import { drawTransportButton } from '../playerTransportDrawing.js'

export function createMusicScreen(onUpdate = () => {}) {
  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = 1024
  const context = canvas.getContext('2d')
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  const zones = []
  let artwork = null
  let coverUrl = null
  let image = null
  let disposed = false
  let dirty = true
  let signature = ''

  const text = (value, x, y, font, color = '#e8f4fc', maxWidth) => {
    context.font = font
    context.fillStyle = color
    context.fillText(String(value || ''), x, y, maxWidth)
  }
  const line = (x1, y1, x2, y2, color) => {
    context.strokeStyle = color
    context.lineWidth = 2
    context.beginPath(); context.moveTo(x1, y1); context.lineTo(x2, y2); context.stroke()
  }
  function cover(url) {
    if (url === coverUrl) return
    coverUrl = url
    artwork = null
    dirty = true
    if (image) { image.onload = image.onerror = null; image.src = '' }
    if (!url) return
    const requestedImage = new Image()
    image = requestedImage
    requestedImage.crossOrigin = 'anonymous'
    requestedImage.onload = () => { if (!disposed && image === requestedImage) { artwork = requestedImage; dirty = true; onUpdate() } }
    requestedImage.onerror = () => { if (!disposed && image === requestedImage) { dirty = true; onUpdate() } }
    requestedImage.src = url
  }
  function addZone(x, y, width, height, action, payload) {
    zones.push({ x: x / 2048, y: y / 1024, width: width / 2048, height: height / 1024, action, payload })
  }
  function draw(state) {
    cover(state.track?.coverUrl || '')
    const nextSignature = [state.track?.id, state.track?.name, state.track?.artist, state.playing, state.loading,
      state.line?.text, state.line?.translation, state.nextLine?.text, Math.floor(state.currentTime), state.duration].join('|')
    if (!dirty && signature === nextSignature) return false
    dirty = false
    signature = nextSignature
    zones.length = 0
    const gradient = context.createLinearGradient(0, 0, 2048, 1024)
    gradient.addColorStop(0, '#112b42'); gradient.addColorStop(0.55, '#07131f'); gradient.addColorStop(1, '#112534')
    context.fillStyle = gradient; context.fillRect(0, 0, 2048, 1024)
    context.textAlign = 'left'
    text('L A N Y I N   /   S O U N D   F I E L D', 98, 90, '24px "Bahnschrift", sans-serif', '#78bacb')
    context.textAlign = 'right'
    text(state.playing ? '●  NOW PLAYING' : '○  READY TO PLAY', 1940, 90, '22px "Consolas", monospace', '#90ebdc')
    context.textAlign = 'left'
    line(98, 125, 1940, 125, '#304553')
    const artX = 105, artY = 192, artSize = 480
    context.save()
    context.beginPath(); context.roundRect(artX, artY, artSize, artSize, 8); context.clip()
    if (artwork) {
      const size = Math.min(artwork.naturalWidth, artwork.naturalHeight)
      context.drawImage(artwork, (artwork.naturalWidth - size) / 2, (artwork.naturalHeight - size) / 2, size, size, artX, artY, artSize, artSize)
    } else {
      context.fillStyle = '#173c51'; context.fillRect(artX, artY, artSize, artSize)
      for (let radius = 36; radius < 225; radius += 13) {
        context.strokeStyle = radius % 2 ? '#2e6878' : '#52868d'; context.lineWidth = 2
        context.beginPath(); context.arc(345, 432, radius, 0, Math.PI * 2); context.stroke()
      }
      context.fillStyle = '#a2eadb'; context.beginPath(); context.arc(345, 432, 10, 0, Math.PI * 2); context.fill()
    }
    context.restore()
    text('STEREO  /  沉浸聆听', 105, 724, '24px "Microsoft YaHei", sans-serif', '#7fa5b5')
    text(state.track?.id ? state.track.name : '音乐，从这里开始', 675, 250, '500 66px "Microsoft YaHei", sans-serif', '#f0f8ff', 1240)
    text(state.track?.id ? state.track.artist : '选择一首歌，点亮整个声场', 679, 310, '30px "Microsoft YaHei", sans-serif', '#a8c1cf', 1180)
    line(680, 360, 775, 360, '#88dfcf')
    const lyric = state.line?.text || '在音乐里，走一会儿。'
    const rows = wrapText(context, lyric, 1160, '52px "Microsoft YaHei", sans-serif', 3)
    rows.forEach((row, index) => text(row, 680, 460 + index * 68, '52px "Microsoft YaHei", sans-serif', '#a0f5df'))
    text(state.line?.translation || state.nextLine?.text || '', 683, 690, '27px "Microsoft YaHei", sans-serif', '#7798aa', 1170)
    if (state.line && !state.line.placeholder) addZone(670, 385, 1220, 240, 'lyric', state.line.seconds)

    const buttons = [{ x: 1030, action: 'previous' }, { x: 1215, action: 'toggle' }, { x: 1400, action: 'next' }]
    buttons.forEach((button) => {
      drawTransportButton(context,button.action,button.x,796,button.action==='toggle'?82:56,state)
      if(!state.loading)addZone(button.x-48,748,96,96,button.action)
    })
    context.textAlign = 'left'
    const progress = state.duration > 0 ? Math.min(1, Math.max(0, state.currentTime / state.duration)) : 0
    context.fillStyle = '#2a4254'; context.fillRect(105, 904, 1838, 6)
    context.fillStyle = '#a3f1da'; context.fillRect(105, 904, 1838 * progress, 6)
    addZone(105, 877, 1838, 60, 'progress')
    text(formatTime(state.currentTime), 105, 965, '25px "Consolas", monospace', '#afc7d5')
    context.textAlign = 'right'
    text(formatTime(state.duration), 1943, 965, '25px "Consolas", monospace', '#afc7d5')
    context.textAlign = 'left'
    texture.needsUpdate = true
    return true
  }
  return {
    texture, draw,
    hitTest(uv) {
      const x = uv.x, y = 1 - uv.y
      const zone = zones.find((item) => x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height)
      return zone ? { action: zone.action, payload: zone.action === 'progress' ? (x - zone.x) / zone.width : zone.payload } : null
    },
    dispose() { disposed = true; if (image) { image.onload = image.onerror = null; image.src = '' }; texture.dispose() },
  }
}

function formatTime(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
function wrapText(context, value, width, font, limit) {
  context.font = font
  const rows = []
  let row = ''
  for (const character of value) {
    if (context.measureText(row + character).width > width) {
      rows.push(row); row = ''
      if (rows.length >= limit) break
    }
    row += character
  }
  if (rows.length < limit && row) rows.push(row)
  if (rows.length === limit && rows.join('').length < value.length) rows[limit - 1] = rows[limit - 1].slice(0, -1) + '…'
  return rows
}
