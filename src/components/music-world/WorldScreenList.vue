<template>
  <div ref="viewport" class="world-screen-list" @scroll.passive="onScroll" @pointerleave="clearHover">
    <div class="world-screen-list__content">
      <canvas ref="canvas" class="world-screen-list__canvas" aria-hidden="true" />
      <ol aria-label="歌曲列表">
        <li v-for="(track, index) in items" :key="`${trackKey(track)}-${index}`" :style="{ height: `${ROW_HEIGHT}px` }">
          <button
            type="button"
            class="world-screen-list__row"
            :aria-label="`${track.name}，${track.artist || '未知歌手'}，${screenTrackTime(track)}，双击加入播放列表`"
            :disabled="isPending(track)"
            @pointerenter="hover(index, 'row')"
            @focus="hover(index, 'row')"
            @click="select(index, 'row', $event)"
          />
          <button
            type="button"
            class="world-screen-list__cover"
            :aria-label="`加入播放列表 ${track.name}`"
            :title="`加入播放列表 ${track.name}`"
            :disabled="isPending(track)"
            @pointerenter="hover(index, 'play')"
            @focus="hover(index, 'play')"
            @click="select(index, 'play', $event)"
          />
        </li>
      </ol>
      <slot />
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createScreenList, screenTrackTime } from './createScreenList.js'
import { createScreenImages } from './screenDrawing.js'
import { FEED_LAYOUT } from './screenFeeds.js'
import { SCREEN_INPUT_SIZE } from './createScreenProjection.js'
import { trackKey } from '../../services/listeningRoomProtocol.js'

const props = defineProps({ items: { type: Array, required: true }, playback: { type: Object, default: () => ({}) } })
const emit = defineEmits(['select', 'scroll'])
const SCALE = FEED_LAYOUT.size / SCREEN_INPUT_SIZE, ROW_HEIGHT = FEED_LAYOUT.rowHeight / SCALE
const viewport = ref(null), canvas = ref(null)
let ctx, images, list, observer, frame = 0, disposed = false

function schedule() {
  if (!disposed && !frame) frame = requestAnimationFrame(draw)
}

function draw(now = performance.now()) {
  frame = 0
  if (!ctx || !viewport.value) return
  const el = viewport.value, width = el.clientWidth, height = el.clientHeight
  if (!width || !height) return
  const ratio = Math.min(2, window.devicePixelRatio || 1)
  const pixelWidth = Math.round(width * ratio), pixelHeight = Math.round(height * ratio)
  if (canvas.value.width !== pixelWidth || canvas.value.height !== pixelHeight) {
    canvas.value.width = pixelWidth; canvas.value.height = pixelHeight
  }
  canvas.value.style.width = `${width}px`
  canvas.value.style.height = `${height}px`
  canvas.value.style.top = `${el.scrollTop}px`
  ctx.setTransform(ratio / SCALE, 0, 0, ratio / SCALE, 0, 0)
  ctx.clearRect(0, 0, width * SCALE, height * SCALE)
  // Use the chart screen's renderer and interaction model on the projected DOM screen.
  list.draw({
    items: props.items,
    area: { x: 0, y: 0, width: width * SCALE, height: height * SCALE, rowHeight: FEED_LAYOUT.rowHeight },
    scroll: el.scrollTop / ROW_HEIGHT, playback: props.playback, accent: '#d6dbaa', songsOnly: true, action: 'enqueue', now,
  })
  if (list.getState().animating && !document.hidden) schedule()
}

function point(index, part) {
  const el = viewport.value
  const top = Math.max(0, index * ROW_HEIGHT - el.scrollTop + 2)
  const bottom = Math.min(el.clientHeight, (index + 1) * ROW_HEIGHT - el.scrollTop - 2)
  return { x: part === 'play' ? 44 : 110, y: (top + bottom) / 2 * SCALE }
}

function hover(index, part) { list?.setHover(point(index, part)); schedule() }
function clearHover() { list?.setHover(null); schedule() }
function select(index, part, event) {
  // Scroll/focus can move a row since the last frame. Refresh its shared hit areas first.
  if (frame) { cancelAnimationFrame(frame); frame = 0 }
  draw()
  const hit = list.select(point(index, part), { keyboard: event.detail === 0 })
  if (hit) emit('select', hit.item)
}
function isPending(track) {
  const key = trackKey(track)
  return (props.playback.pendingKeys || []).includes(key) || Boolean(props.playback.loading && key === trackKey(props.playback.loadingTrack || props.playback.track))
}
function onScroll(event) { clearHover(); emit('scroll', event) }

watch(() => props.items, () => { list?.reset(); schedule() })
watch(() => [props.playback.track, props.playback.playing, props.playback.loading, props.playback.loadingTrack, (props.playback.pendingKeys || []).join('|'), props.playback.reducedMotion], schedule)
onMounted(() => {
  ctx = canvas.value.getContext('2d')
  images = createScreenImages(schedule)
  list = createScreenList(ctx, { images, invalidate: schedule })
  observer = new ResizeObserver(schedule)
  observer.observe(viewport.value)
  schedule()
})
onBeforeUnmount(() => { disposed = true; cancelAnimationFrame(frame); observer?.disconnect(); images?.dispose() })
</script>

<style scoped>
.world-screen-list { min-height: 0; overflow: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #91afb955 transparent; }
.world-screen-list__content { position: relative; min-height: 100%; }
.world-screen-list__canvas { position: absolute; left: 0; pointer-events: none; }
.world-screen-list ol { position: relative; margin: 0; padding: 0; list-style: none; }
.world-screen-list li { position: relative; }
.world-screen-list button { position: absolute; display: block; padding: 0; border: 0; border-radius: 6px; background: transparent; cursor: pointer; }
.world-screen-list button:hover { background: transparent; }
.world-screen-list button:focus-visible { outline: 2px solid #d6dbaa; outline-offset: -2px; }
.world-screen-list button:disabled { cursor: default; }
.world-screen-list__row { inset: 2px 0; width: 100%; }
.world-screen-list__cover { z-index: 1; top: 10px; left: 8px; width: 42.667px; height: 42.667px; }
</style>
