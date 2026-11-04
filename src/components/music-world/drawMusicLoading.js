import { rounded } from './screenDrawing.js'

// A silent loading motif: record grooves orbit a small, breathing waveform.
export function drawMusicLoading(ctx, x, y, radius, accent, now = 0, reducedMotion = false) {
  const time = reducedMotion ? 0 : now / 1000
  ctx.save(); ctx.translate(x, y); ctx.scale(radius / 100, radius / 100)
  ctx.fillStyle = '#102d3c'; ctx.beginPath(); ctx.arc(0, 0, 91, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = accent; ctx.lineWidth = 1
  for (let r = 46; r <= 86; r += 8) {
    ctx.globalAlpha = .13; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.save(); ctx.rotate(time * .85)
  for (let i = 0; i < 2; i++) {
    ctx.globalAlpha = .5; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(0, 0, 78, i * Math.PI, i * Math.PI + .72); ctx.stroke()
    ctx.globalAlpha = .2; ctx.lineWidth = 9
    ctx.beginPath(); ctx.arc(0, 0, 64, i * Math.PI + .1, i * Math.PI + .4); ctx.stroke()
  }
  ctx.restore()
  for (let i = 0; i < 48; i++) {
    const angle = i / 48 * Math.PI * 2 - Math.PI / 2, pulse = (.5 + .5 * Math.sin(angle * 3 - time * 2.4)) ** 3
    const outer = 106 + pulse * 9
    ctx.globalAlpha = .17 + pulse * .63; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(Math.cos(angle) * 100, Math.sin(angle) * 100); ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer); ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.fillStyle = '#081d2a'; ctx.beginPath(); ctx.arc(0, 0, 36, 0, Math.PI * 2); ctx.fill()
  for (let i = 0; i < 5; i++) {
    const h = 9 + (1 - Math.abs(i - 2) / 3) * (12 + 17 * (.5 + .5 * Math.sin(time * 3.6 - i * .85)))
    rounded(ctx, i * 10 - 22, -h / 2, 4, h, 2, accent)
  }
  ctx.restore()
}
