/*! Lucide icons — ISC License
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part
 * of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 * Permission to use, copy, modify, and/or distribute this software for any purpose
 * with or without fee is hereby granted, provided that the above copyright notice
 * and this permission notice appear in all copies.
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 * OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE
 * OF THIS SOFTWARE.
 */
// Canvas equivalents of the Lucide icons used by the 2D player.
const modePaths = {
  shuffle:['m18 14 4 4-4 4','m18 2 4 4-4 4','M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22','M2 6h1.972a4 4 0 0 1 3.6 2.2','M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45'],
  order:['m17 2 4 4-4 4','M3 11v-1a4 4 0 0 1 4-4h14','m7 22-4-4 4-4','M21 13v1a4 4 0 0 1-4 4H3'],
  single:['m17 2 4 4-4 4','M3 11v-1a4 4 0 0 1 4-4h14','m7 22-4-4 4-4','M21 13v1a4 4 0 0 1-4 4H3','M11 10h1v4'],
  list:['m2 9 3-3 3 3','M13 18H7a2 2 0 0 1-2-2V6','m22 15-3 3-3-3','M11 6h6a2 2 0 0 1 2 2v10'],
}
const cachedModePaths = new Map()
export function drawPlayerIcon(ctx, icon, x, y, size, color = '#ffffff', rotation = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(size / 24, size / 24); ctx.translate(-12, -12)
  ctx.strokeStyle = ctx.fillStyle = color; ctx.lineWidth = 2; ctx.lineJoin = ctx.lineCap = 'round'
  if (modePaths[icon]) {
    if (!cachedModePaths.has(icon)) cachedModePaths.set(icon,modePaths[icon].map(path=>new Path2D(path)))
    cachedModePaths.get(icon).forEach(path=>ctx.stroke(path))
  } else if (icon === 'user') {
    ctx.beginPath();ctx.arc(12,8,4,0,Math.PI*2);ctx.stroke()
    ctx.beginPath();ctx.arc(12,21,8,Math.PI,Math.PI*2);ctx.stroke()
  } else if (icon === 'up' || icon === 'down') {
    ctx.beginPath();ctx.moveTo(6,icon==='up'?15:9);ctx.lineTo(12,icon==='up'?9:15);ctx.lineTo(18,icon==='up'?15:9);ctx.stroke()
  } else if (icon === 'play') {
    ctx.beginPath(); ctx.moveTo(6, 3); ctx.lineTo(20, 12); ctx.lineTo(6, 21); ctx.closePath(); ctx.fill(); ctx.stroke()
  } else if (icon === 'pause') {
    for (const x of [6, 14]) { ctx.beginPath(); ctx.roundRect(x, 4, 4, 16, 1); ctx.fill(); ctx.stroke() }
  } else if (icon === 'previous' || icon === 'next') {
    const back = icon === 'previous', edge = back ? 19 : 5, tip = back ? 9 : 15, bar = back ? 5 : 19
    ctx.beginPath(); ctx.moveTo(edge, 4); ctx.lineTo(tip, 12); ctx.lineTo(edge, 20); ctx.closePath(); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(bar, 5); ctx.lineTo(bar, 19); ctx.stroke()
  } else if (icon === 'loading') {
    ctx.beginPath(); ctx.arc(12, 12, 9, 0, Math.PI * 1.77); ctx.stroke()
  } else if (icon === 'volume' || icon === 'muted') {
    ctx.beginPath(); ctx.moveTo(11,5); ctx.lineTo(6,9); ctx.lineTo(3,9); ctx.lineTo(3,15); ctx.lineTo(6,15); ctx.lineTo(11,19); ctx.closePath(); ctx.stroke()
    if (icon === 'volume') { for (const radius of [5,9]) { ctx.beginPath(); ctx.arc(12,12,radius,-.78,.78); ctx.stroke() } }
    else { ctx.beginPath(); ctx.moveTo(17,9); ctx.lineTo(23,15); ctx.moveTo(23,9); ctx.lineTo(17,15); ctx.stroke() }
  }
  ctx.restore()
}

export function drawTransportButton(ctx, action, x, y, diameter, state = {}, { accent = '#d9c39e', color = '#d6e3e6', now = 0 } = {}) {
  const toggle = action === 'toggle'
  if (toggle) { ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(x, y, diameter / 2, 0, Math.PI * 2); ctx.fill() }
  const icon = toggle ? state.loading ? 'loading' : state.playing ? 'pause' : 'play' : action
  drawPlayerIcon(ctx, icon, x, y, diameter * (toggle ? .5 : .63), toggle ? '#ffffff' : color, icon === 'loading' && !state.reducedMotion ? now / 150 : 0)
}
