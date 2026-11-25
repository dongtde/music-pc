<template>
  <div
    ref="root"
    class="track-summary mini-player-track"
    :class="{ 'mini-player-track--moving': frames }"
    :data-phase="phase"
    :aria-busy="busy"
  >
    <img v-for="url in preloadUrls" :key="url" hidden :src="url" alt="" decoding="async" fetchpriority="low" />
    <button
      ref="albumArtButton"
      class="album-art album-art--mini album-art-button"
      :class="{ 'album-art-button--expanded': albumArtHidden }"
      type="button"
      aria-label="打开全屏播放器"
      @click="openFullPlayer"
    ><span /></button>
    <div ref="viewport" class="mini-player-track__viewport">
      <div ref="strip" class="mini-player-track__strip" :style="{ transform: translate(offset) }">
        <div
          v-for="layer in layers"
          :key="layer.key"
          class="mini-player-track__frame"
          :data-slot="layer.slot"
          :data-track-id="layer.track.id"
          :style="layerStyle(layer)"
          :aria-hidden="layer.slot !== 0"
          :inert="layer.slot !== 0"
        >
          <PlayerTrackSummary
            :track="layer.track"
            :show-artwork="false"
            :liked="layer.slot === 0 && liked"
            :comment-total="layer.slot === 0 ? commentTotal : 0"
            :mini-lyric="layer.lyric"
            @toggle-full-player="openFullPlayer"
            @toggle-like="$emit('toggle-like')"
            @open-comments="$emit('open-comments')"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import PlayerTrackSummary from './PlayerTrackSummary.vue'

const props = defineProps({
  track: { type: Object, required: true },
  previousTrack: { type: Object, default: null },
  nextTrack: { type: Object, default: null },
  miniLyric: { type: Object, default: null },
  fullPlayerOpen: { type: Boolean, default: false },
  albumArtHidden: { type: Boolean, default: false },
  liked: { type: Boolean, default: false },
  commentTotal: { type: Number, default: 0 },
  enabled: { type: Boolean, default: true }
})
const emit = defineEmits(['toggle-full-player', 'toggle-like', 'open-comments', 'cancel-swipe'])
const root = ref(null)
const albumArtButton = ref(null)
const viewport = ref(null)
const strip = ref(null)
const offset = ref(0)
const width = ref(1)
const frames = shallowRef(null)
const phase = ref('idle')
const busy = computed(() => phase.value === 'settling' || phase.value === 'waiting')
let sequence = 0
const currentLayer = shallowRef(createLayer(0, props.track, props.miniLyric))
const layers = computed(() => frames.value ?? [{ ...currentLayer.value, track: props.track, lyric: props.miniLyric }])
const preloadUrls = computed(() => [...new Set([props.previousTrack?.coverUrl, props.nextTrack?.coverUrl].filter(Boolean))])
let animation = null
let generation = 0
let disposed = false
let resizeObserver = null
let targetLayerKey = null

function createLayer(slot, track, lyric = null) {
  return track ? {
    key: `mini-track-${++sequence}`,
    slot,
    track: { ...track, coverPalette: track.coverPalette ? { ...track.coverPalette } : undefined },
    lyric: lyric ? { ...lyric } : null
  } : null
}
function translate(x) { return `translate3d(${x}px, 0, 0)` }
function layerStyle(layer) {
  return { transform: translate(layer.slot * width.value) }
}
function reducedMotion() {
  return document.documentElement.dataset.reducedMotion === 'true'
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
function prepareFrames() {
  if (frames.value) return
  width.value = Math.max(1, getSwipeWidth())
  frames.value = [
    { ...currentLayer.value, slot: 0, track: { ...props.track }, lyric: props.miniLyric ? { ...props.miniLyric } : null },
    createLayer(-1, props.previousTrack),
    createLayer(1, props.nextTrack)
  ].filter(Boolean)
}
function reset(layer = null) {
  generation += 1
  animation?.cancel()
  animation = null
  currentLayer.value = { ...(layer ?? createLayer(0, props.track)), slot: 0 }
  frames.value = null
  offset.value = 0
  phase.value = 'idle'
  targetLayerKey = null
}
function drag(dx) {
  if (disposed || busy.value || !props.enabled) return
  prepareFrames()
  const available = frames.value.some(layer => layer.slot === (dx < 0 ? 1 : -1))
  offset.value = reducedMotion() ? 0 : Math.max(-width.value, Math.min(width.value, available ? dx : dx * .25))
  phase.value = 'dragging'
}
async function animateTo(target, duration) {
  const token = ++generation
  const from = offset.value
  phase.value = 'settling'
  await nextTick()
  if (disposed || token !== generation || !strip.value) return false
  if (!reducedMotion() && strip.value.animate) {
    const running = strip.value.animate(
      [{ transform: translate(from) }, { transform: translate(target) }],
      { duration, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'forwards' }
    )
    animation = running
    offset.value = target
    try { await running.finished } catch { return false }
    if (disposed || token !== generation) return false
    running.cancel()
    animation = null
  } else offset.value = target
  return true
}
async function finish(direction) {
  if (disposed || busy.value || !props.enabled) return null
  prepareFrames()
  const target = direction ? frames.value.find(layer => layer.slot === direction) : null
  if (!target) {
    if (await animateTo(0, 200)) reset()
    return null
  }
  targetLayerKey = target.key
  if (!await animateTo(-direction * width.value, 300)) return null
  phase.value = 'waiting'
  const token = generation
  return {
    track: target.track,
    complete: async (accepted) => {
      await nextTick()
      if (disposed || token !== generation) return
      if (accepted && String(props.track.id) === String(target.track.id)) reset(target)
      else if (await animateTo(0, 240)) reset()
    }
  }
}
async function cancel() {
  if (disposed || busy.value || !frames.value) return
  if (await animateTo(0, 200)) reset()
}
function openFullPlayer() {
  if (!frames.value && !busy.value) emit('toggle-full-player')
}
function getAlbumArtRect() {
  const rect = albumArtButton.value?.getBoundingClientRect()
  return rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null
}
function getSwipeWidth() {
  return viewport.value?.getBoundingClientRect().width ?? 0
}

// Keep the preview in place until playback acknowledges it; unrelated changes cancel it.
watch(() => props.track.id, (id) => {
  const target = frames.value?.find(layer => layer.key === targetLayerKey)
  if (phase.value === 'waiting' && target && String(target.track.id) === String(id)) return
  emit('cancel-swipe')
  reset()
}, { flush: 'sync' })
watch(() => props.enabled, enabled => {
  if (!enabled) { emit('cancel-swipe'); reset() }
})
onMounted(() => {
  if (typeof ResizeObserver === 'undefined') return
  let lastWidth = getSwipeWidth()
  resizeObserver = new ResizeObserver(() => {
    const nextWidth = getSwipeWidth()
    if (Math.abs(nextWidth - lastWidth) > 1) { emit('cancel-swipe'); reset() }
    lastWidth = nextWidth
  })
  resizeObserver.observe(viewport.value)
})
onBeforeUnmount(() => {
  disposed = true
  resizeObserver?.disconnect()
  reset()
})
defineExpose({ drag, finish, cancel, reset, busy, getAlbumArtRect, getSwipeWidth })
</script>

<style scoped>
.mini-player-track {
  height: 44px;
  overflow: hidden;
}
.mini-player-track__viewport {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
}
.mini-player-track__strip {
  position: relative;
  width: 100%;
  height: 100%;
}
.mini-player-track__frame {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
}
.mini-player-track__frame :deep(.track-summary) {
  width: 100%;
  min-width: 0;
  gap: 10px;
}
.mini-player-track--moving .mini-player-track__strip { will-change: transform; }
.mini-player-track--moving :deep(.overflow-marquee__track) { animation-play-state: paused; }
</style>
