import { cropImage } from './screenDrawing.js'

export const screenInk = { bg: '#050d18', ice: '#a7ddff', white: '#f2f7ff', muted: '#b2c3d3' }
const TAU = Math.PI * 2

function ellipse(ctx, x, y, rx, ry, color, width = 1) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU)
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke()
}
function glow(ctx, x, y, rx, ry, color, composite = 'lighter') {
  ctx.save(); ctx.globalCompositeOperation = composite; ctx.translate(x, y); ctx.scale(1, ry / rx)
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
  gradient.addColorStop(0, color); gradient.addColorStop(1, '#00000000')
  ctx.fillStyle = gradient; ctx.fillRect(-rx, -rx, rx * 2, rx * 2); ctx.restore()
}

function silkRibbon(ctx, outer, inner, colors) {
  const edge = amount => outer.map((value, index) => value + (inner[index] - value) * amount)
  const gradient = (strength, shine = false) => {
    const paint = ctx.createLinearGradient(outer[0], outer[1], outer[6], outer[7])
    paint.addColorStop(0, `rgba(${colors[0]},0)`)
    paint.addColorStop(.27, `rgba(${colors[0]},${strength * .48})`)
    paint.addColorStop(.58, `rgba(${shine ? '212,235,246' : colors[1]},${strength})`)
    paint.addColorStop(.82, `rgba(${colors[2]},${strength * .4})`)
    paint.addColorStop(1, `rgba(${colors[2]},0)`)
    return paint
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'
  // Overlapping curved strips create a soft folded surface without blur passes.
  for (let i = 0; i < 40; i++) {
    const u = i / 40, a = edge(u), b = edge(Math.min(1, u + .031))
    const sheen = .13 + .28 * Math.exp(-(((u - .18) / .13) ** 2)) + .42 * Math.exp(-(((u - .87) / .055) ** 2))
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.bezierCurveTo(...a.slice(2))
    ctx.lineTo(b[6], b[7]); ctx.bezierCurveTo(b[4], b[5], b[2], b[3], b[0], b[1]); ctx.closePath()
    ctx.fillStyle = gradient(sheen); ctx.fill()
  }
  for (const u of [0, .18, .87, 1]) {
    const points = edge(u)
    ctx.beginPath(); ctx.moveTo(points[0], points[1]); ctx.bezierCurveTo(...points.slice(2))
    ctx.strokeStyle = gradient(u === .87 ? .56 : .24, true); ctx.lineWidth = u === .87 ? 1.6 : .8; ctx.stroke()
  }
  ctx.restore()
}

function drawAmbientRibbons(ctx) {
  glow(ctx, 205, 452, 395, 220, '#4b85b122')
  glow(ctx, 1840, 317, 420, 330, '#8b68b01c')
  silkRibbon(ctx,
    [-140, 522, 185, 528, 64, 264, 636, 130],
    [-140, 697, 410, 621, 162, 185, 636, 130],
    ['52,117,145', '126,185,211', '153,147,201'])
  silkRibbon(ctx,
    [1430, 674, 1820, 530, 1710, 355, 2190, 238],
    [1430, 674, 1950, 654, 1620, 134, 2190, 20],
    ['63,117,165', '140,144,205', '187,158,210'])
}

// Static grooves, particles and reflections refresh only with artwork or resolution.
export function drawListeningBackdrop(ctx, art) {
  ctx.fillStyle = screenInk.bg; ctx.fillRect(0, 0, 2048, 840)
  const wash = ctx.createLinearGradient(0, 0, 2048, 840)
  wash.addColorStop(0, '#112132'); wash.addColorStop(.36, '#050e1a'); wash.addColorStop(.75, '#0a1728'); wash.addColorStop(1, '#081522')
  ctx.fillStyle = wash; ctx.fillRect(0, 0, 2048, 840)
  glow(ctx, 1070, 215, 720, 540, '#5782b023')
  glow(ctx, 1260, 578, 570, 290, '#7263c02a')
  drawAmbientRibbons(ctx)
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 2048, 684); ctx.clip()
  const cx = 1038, cy = 376, radius = 390
  const vinyl = ctx.createRadialGradient(cx - 115, cy - 178, 28, cx, cy, radius)
  vinyl.addColorStop(0, '#58718b'); vinyl.addColorStop(.26, '#172b42'); vinyl.addColorStop(.63, '#06101d'); vinyl.addColorStop(.89, '#15263a'); vinyl.addColorStop(1, '#040a13')
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, TAU); ctx.fillStyle = vinyl; ctx.fill()
  for (let r = 249; r <= 387; r += 3) ellipse(ctx, cx, cy, r, r, r % 2 ? '#a8c7e911' : '#030911b0', r % 9 ? 1 : 2)
  for (let i = 0; i < 34; i++) {
    const angle = -2.38 + i * .008
    ctx.beginPath(); ctx.arc(cx, cy, 317, angle, angle + .37)
    ctx.strokeStyle = `rgba(180,210,242,${.006 + Math.sin(i / 34 * Math.PI) * .027})`
    ctx.lineWidth = 133; ctx.stroke()
  }
  for (const [r, color, width] of [[397, '#a9cae27a', 2], [407, '#172d48', 10], [415, '#537baf70', 2], [442, '#39577364', 2]]) ellipse(ctx, cx, cy, r, r, color, width)
  for (const [start, end, color] of [[-2.4, -1.69, '#b1d7f7bd'], [.11, .94, '#8d94ddb0'], [2.62, 3.21, '#7bb7e68c']]) {
    ctx.beginPath(); ctx.arc(cx, cy, 416, start, end); ctx.lineWidth = 5; ctx.strokeStyle = color; ctx.stroke()
  }
  for (let i = 0; i < 88; i++) {
    const angle = i / 88 * TAU, outer = i % 11 ? 438 : 448
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(angle) * 432, cy + Math.sin(angle) * 432)
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer)
    ctx.strokeStyle = i % 11 ? '#60799d36' : '#a5cce577'; ctx.lineWidth = 1; ctx.stroke()
  }
  if (art) {
    ctx.save(); ctx.globalAlpha = .76; cropImage(ctx, art, cx - 241, cy - 241, 482, 241); ctx.restore()
  } else {
    const label = ctx.createRadialGradient(cx - 80, cy - 90, 0, cx, cy, 240)
    label.addColorStop(0, '#354c65'); label.addColorStop(.45, '#152439'); label.addColorStop(1, '#06101e')
    ctx.fillStyle = label; ctx.beginPath(); ctx.arc(cx, cy, 240, 0, TAU); ctx.fill()
    for (let i = 0; i < 11; i++) {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(i * .53)
      ctx.beginPath(); ctx.ellipse(0, -60, 64, 159, .18, 0, TAU)
      ctx.strokeStyle = i % 2 ? '#9cabd132' : '#83cee63d'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore()
    }
  }
  ellipse(ctx, cx, cy, 245, 245, '#b6d2e13b', 2)
  glow(ctx, 1030, 394, 725, 178, '#020811ed', 'source-over')
  ctx.restore()
  let seed = 71317
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 850; i++) {
    const x = 410 + random() * 1190, y = 665 - Math.pow(random(), 2.4) * 196, size = .6 + random() * 1.7
    ctx.fillStyle = i % 3 ? `rgba(149,188,243,${.12 + random() * .54})` : `rgba(192,163,248,${.16 + random() * .6})`
    ctx.fillRect(x, y, size, size * 1.8)
  }
  ctx.restore()
  glow(ctx, 1040, 672, 790, 49, '#759ee148')
  glow(ctx, 1100, 658, 450, 35, '#a9baff69')
  const plinth = ctx.createLinearGradient(0, 680, 0, 744)
  plinth.addColorStop(0, '#091320'); plinth.addColorStop(.43, '#213550'); plinth.addColorStop(.55, '#7895b17a'); plinth.addColorStop(.67, '#0a1626'); plinth.addColorStop(1, '#030a13')
  ctx.fillStyle = plinth; ctx.beginPath(); ctx.ellipse(1038, 721, 538, 38, 0, 0, TAU); ctx.fill()
  ellipse(ctx, 1038, 721, 538, 38, '#7186b398', 2)
  ctx.fillStyle = '#081321'; ctx.beginPath(); ctx.ellipse(1038, 683, 451, 28, 0, 0, TAU); ctx.fill()
  ellipse(ctx, 1038, 683, 451, 28, '#a3c1ddaa', 1.5)
  ellipse(ctx, 1038, 697, 470, 28, '#648fb467', 2)
  glow(ctx, 1038, 666, 420, 25, '#deedffee')
  glow(ctx, 1038, 669, 760, 10, '#8ecbffbb')
  ctx.lineWidth = 1
  const horizon = ctx.createLinearGradient(32, 0, 2016, 0)
  horizon.addColorStop(0, '#8cbfff00'); horizon.addColorStop(.38, '#a8d5ff80'); horizon.addColorStop(.53, '#e7f2ffa6'); horizon.addColorStop(1, '#8cbfff00')
  ctx.strokeStyle = horizon; ctx.beginPath(); ctx.moveTo(32, 666); ctx.lineTo(2016, 666); ctx.stroke()
  const footer = ctx.createLinearGradient(0, 730, 0, 840)
  footer.addColorStop(0, '#050d1800'); footer.addColorStop(1, '#050c17f2')
  ctx.fillStyle = footer; ctx.fillRect(0, 728, 2048, 112)
  ctx.strokeStyle = '#648ba044'; ctx.strokeRect(17.5, 17.5, 2013, 805)
  for (const side of [29, 2016]) {
    ctx.fillStyle = screenInk.ice; ctx.globalAlpha = .58; ctx.fillRect(side, 377, 3, 31)
  }
  ctx.globalAlpha = 1
}

