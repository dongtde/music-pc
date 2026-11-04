import { createDanmakuQueue } from './danmakuQueue.js'
import { createDanmakuSchedule, danmakuLayout } from './danmakuSchedule.js'

export function createDanmakuStream(root, { onNeedMore = () => {} } = {}) {
  const queue = createDanmakuQueue(), pool = [], widths = new Map()
  // This detached canvas only measures new strings; it never draws or uploads animation frames.
  const measure = document.createElement('canvas').getContext('2d')
  let width = 0, height = 0, track = '', more = false, busy = false, running = false, reduced = false, disposed = false
  let timer = 0, requestedVersion = -1, elapsed = 0, startedAt = performance.now()
  let layout = danmakuLayout(0,0), schedule = createDanmakuSchedule(layout)
  const fragment = document.createDocumentFragment()
  for (let index = 0; index < 48; index++) {
    const element = document.createElement('span')
    element.className = 'world-danmaku-stream__bubble'
    fragment.append(element); pool.push({ element, item:null, animation:null })
  }
  root.append(fragment)

  const clock = () => elapsed + (running ? performance.now()-startedAt : 0)
  const active = () => pool.filter(slot => slot.item)
  function stopTimer() { clearTimeout(timer); timer = 0 }
  function prefetch() {
    const state = queue.getState()
    if (running && more && !busy && state.unread <= Math.max(12,layout.lanes*2) && requestedVersion !== state.version) {
      requestedVersion = state.version; onNeedMore()
    }
  }
  function release(slot, cancel = false) {
    if (slot.animation) {
      slot.animation.onfinish = null
      if (cancel) slot.animation.cancel(); else slot.animation.pause()
    }
    slot.item = null; slot.element.removeAttribute('data-comment-id')
  }
  function reset() {
    stopTimer(); pool.forEach(slot => release(slot,true))
    elapsed = 0; startedAt = performance.now(); schedule = createDanmakuSchedule(layout)
  }
  function prepare(slot, item, lane) {
    if (!widths.has(item.content)) {
      if (widths.size >= 512) widths.delete(widths.keys().next().value)
      widths.set(item.content, Math.ceil(measure.measureText(item.content).width)+1)
    }
    const size = Math.min(widths.get(item.content), Math.floor(Math.min(640,width*.9)))
    slot.item = item
    const element = slot.element
    element.textContent = item.content; element.classList.toggle('is-hot',item.hot)
    element.dataset.commentId = item.key; element.dataset.lane = lane
    element.style.top = `${lane*34+3}px`; element.style.width = `${size}px`
    return size
  }
  function fillStatic() {
    for (let lane = active().length; lane < layout.lanes; lane++) {
      const item = queue.take(active().map(slot => slot.item.key)), slot = pool.find(slot => !slot.item)
      if (!item || !slot) break
      prepare(slot,item,lane)
    }
    prefetch()
  }
  function pump() {
    stopTimer()
    if (disposed || !running || !width) return
    if (reduced) { fillStatic(); return }
    const next = schedule.next(clock(),active().length)
    if (next) timer = setTimeout(() => launch(next.lane),next.delay)
    prefetch()
  }
  function launch(lane) {
    timer = 0
    if (disposed || !running || reduced) return
    const slot = pool.find(slot => !slot.item), item = slot && queue.take(active().map(slot => slot.item.key))
    if (!item) { prefetch(); return }
    const size = prepare(slot,item,lane), start = width+12, end = -size-12
    const frames = [{transform:`translate3d(${start}px,0,0)`},{transform:`translate3d(${end}px,0,0)`}]
    const timing = {duration:(start-end)/layout.speed*1000,easing:'linear',fill:'both'}
    schedule.commit(lane,size,clock())
    if (slot.animation) {
      slot.animation.effect.setKeyframes(frames); slot.animation.effect.updateTiming(timing)
      slot.animation.currentTime = 0; slot.animation.play()
    } else slot.animation = slot.element.animate(frames,timing)
    slot.animation.onfinish = () => { if (!disposed && slot.item) { release(slot); pump() } }
    pump()
  }
  const observer = new ResizeObserver(values => {
    const rect = values[0]?.contentRect
    if (disposed || !rect?.width || !rect.height || Math.abs(width-rect.width)<1 && Math.abs(height-rect.height)<1) return
    width = rect.width; height = rect.height; layout = danmakuLayout(width,height)
    const style = getComputedStyle(root)
    measure.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    widths.clear(); reset(); pump()
  })
  observer.observe(root)
  return {
    setSource(id, comments, { hasMore = more, loading = busy } = {}) {
      if (disposed) return
      more = hasMore; busy = loading
      if (track !== String(id)) { track = String(id); reset(); requestedVersion = -1 }
      queue.setSource(track,comments); pump()
    },
    setActive(value) {
      if (disposed || running === value) return
      elapsed = clock(); running = value; startedAt = performance.now()
      active().forEach(slot => { if (slot.animation && !reduced) value ? slot.animation.play() : slot.animation.pause() })
      if (value) pump(); else stopTimer()
    },
    setReducedMotion(value) { if (!disposed && reduced !== value) { reduced = value; reset(); pump() } },
    getState: () => ({ count:active().length,pooled:pool.length,animations:pool.filter(slot=>slot.animation).length,scheduled:Boolean(timer),lanes:layout.lanes,disposed }),
    dispose() {
      if (disposed) return
      disposed = true; observer.disconnect(); reset(); widths.clear(); pool.forEach(slot => slot.element.remove())
    },
  }
}
