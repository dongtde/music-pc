import { computed, nextTick, ref, toValue, watch } from 'vue'
import { sampleCoverPixels } from '../utils/coverPalette'

function readRgb(value, fallback) {
  const values = value.match(/[\d.]+/g)?.slice(0, 3).map(Number)
  if (!values || values.length !== 3) return fallback
  if (value.startsWith('color(srgb ')) return values.map(value => value * 255)
  return value.startsWith('rgb') ? values : fallback
}

function maskOpacity(y) {
  const stops = [[0, 1], [.2, 1], [.4, .88], [.76, .12], [.92, 0], [1, 0]]
  for (let index = 1; index < stops.length; index += 1) {
    const [end, alpha] = stops[index]
    const [start, previous] = stops[index - 1]
    if (y <= end) return previous + (alpha - previous) * (y - start) / (end - start)
  }
  return 0
}

function localCoverColor(sample, image, point, background) {
  const box = image.getBoundingClientRect()
  if (!box.width || !box.height || point.x < box.left || point.x > box.right
    || point.y < box.top || point.y > box.bottom) return null

  // The detail artwork uses object-fit: cover and object-position: center top.
  const scale = Math.max(box.width / sample.width, box.height / sample.height)
  const width = sample.width * scale
  const height = sample.height * scale
  const x = Math.round((point.x - box.left + (width - box.width) / 2) / width * (sample.size - 1))
  const y = Math.round((point.y - box.top) / height * (sample.size - 1))
  const rgb = [0, 0, 0]
  let count = 0
  for (let row = Math.max(0, y - 1); row <= Math.min(sample.size - 1, y + 1); row += 1) {
    for (let column = Math.max(0, x - 1); column <= Math.min(sample.size - 1, x + 1); column += 1) {
      const offset = (row * sample.size + column) * 4
      const alpha = sample.data[offset + 3] / 255
      rgb.forEach((_, channel) => {
        rgb[channel] += sample.data[offset + channel] * alpha + background[channel] * (1 - alpha)
      })
      count += 1
    }
  }
  return count ? {
    rgb: rgb.map(value => value / count),
    opacity: maskOpacity((point.y - box.top) / box.height)
  } : null
}

export function useDetailBackContrast(headerRef, enabled, coverUrl, headerProgress) {
  const ink = ref('')
  const outline = ref('')
  let requestUpdate = null

  watch([headerRef, () => toValue(enabled), () => toValue(coverUrl)], async ([header, active, url], _, onCleanup) => {
    ink.value = ''
    outline.value = ''
    if (!header || !active) return
    let disposed = false
    let frame = 0
    let sample = null
    let root = null
    let image = null
    let resizeObserver = null
    let themeObserver = null
    const render = () => {
      frame = 0
      if (disposed) return
      const button = header.querySelector('.history-actions button')
      if (!button) return
      const fallback = document.documentElement.dataset.theme === 'light' ? [247, 247, 249] : [18, 19, 22]
      const background = readRgb(getComputedStyle(header, '::before').backgroundColor, fallback)
      const box = button.getBoundingClientRect()
      const pixel = sample && image ? localCoverColor(sample, image, {
        x: box.left + box.width / 2,
        y: box.top + box.height / 2
      }, background) : null
      const progress = Math.max(0, Math.min(1, Number(toValue(headerProgress)) || 0))
      const alpha = pixel ? pixel.opacity * (1 - progress) : 0
      const rgb = background.map((value, index) => value * (1 - alpha) + (pixel?.rgb[index] || 0) * alpha)
      const linear = rgb.map(value => {
        value /= 255
        return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4
      })
      const light = linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722 > .21
      ink.value = light ? '#202127' : '#ffffff'
      outline.value = light ? '#ffffff' : '#17191f'
    }
    const queue = () => {
      if (!disposed && !frame) frame = requestAnimationFrame(render)
    }
    requestUpdate = queue
    onCleanup(() => {
      disposed = true
      if (frame) cancelAnimationFrame(frame)
      root?.removeEventListener('scroll', queue)
      image?.removeEventListener('load', queue)
      resizeObserver?.disconnect()
      themeObserver?.disconnect()
      if (requestUpdate === queue) requestUpdate = null
    })
    await nextTick()
    if (disposed) return
    const owner = header.closest('.mobile-detail-page, .main-panel')
    root = owner?.querySelector('.view')
    image = owner?.querySelector('.playlist-cover__image')
    root?.addEventListener('scroll', queue, { passive: true })
    image?.addEventListener('load', queue)
    resizeObserver = new ResizeObserver(queue)
    resizeObserver.observe(header)
    if (image) resizeObserver.observe(image)
    themeObserver = new MutationObserver(queue)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    queue()
    if (url) {
      sampleCoverPixels(url).then(value => {
        if (!disposed) { sample = value; queue() }
      }).catch(() => { if (!disposed) queue() })
    }
  }, { immediate: true, flush: 'post' })

  watch(() => toValue(headerProgress), () => requestUpdate?.())
  return computed(() => ({
    '--detail-back-ink': ink.value || 'var(--mobile-text)',
    '--detail-back-outline': outline.value || 'var(--mobile-bg)'
  }))
}
