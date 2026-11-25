<template>
  <div
    ref="root"
    class="mobile-player-background"
    :class="{
      'mobile-player-background--active': frames,
      'mobile-player-background--lyrics': pagePreview === 'lyrics',
      'mobile-player-background--cover': pagePreview !== 'lyrics'
    }"
    :data-phase="settling ? 'settling' : awaitingTrack ? 'waiting' : frames ? 'dragging' : 'idle'"
    :data-page="page"
    :data-page-preview="pagePreview"
    aria-hidden="true"
  >
    <img v-for="url in preloadUrls" :key="url" hidden :src="url" alt="" decoding="async" fetchpriority="low" />
    <div ref="strip" class="mobile-player-background__strip">
      <div
        v-for="layer in layers"
        :key="layer.key"
        class="mobile-player-background__layer"
        :data-slot="layer.slot"
        :data-track-id="layer.track.id"
        :style="backgroundLayerStyle(layer)"
      >
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { createCoverPaletteFromTint, sampleCoverTint } from '../utils/coverPalette'

const props = defineProps({
  track: { type: Object, required: true },
  previousTrack: { type: Object, default: null },
  nextTrack: { type: Object, default: null },
  page: { type: String, default: 'cover' },
  pagePreview: { type: String, default: 'cover' },
  allowSongSwipe: { type: Boolean, default: true }
})
const root = ref(null)
const strip = ref(null)
const offset = ref(0)
const height = ref(1)
const frames = shallowRef(null)
const settling = ref(false)
const settleDuration = ref(0)
const awaitingTrack = ref(false)
const busy = computed(() => settling.value || awaitingTrack.value)
let layerSequence = 0
const currentLayer = shallowRef(createLayer(0, props.track))
const layers = computed(() => frames.value ?? [{ ...currentLayer.value, track: props.track }])
const sampledPalettes = shallowRef(new Map())
const paletteRequests = new Set()
const preloadUrls = computed(() => [...new Set([props.previousTrack?.coverUrl, props.nextTrack?.coverUrl].filter(Boolean))])
let animations = []
let generation = 0
let resizeObserver = null
let disposed = false
let targetLayerKey = null

function createLayer(slot, track) {
  return track ? { key: `cover-${++layerSequence}`, slot, track: snapshot(track) } : null
}
function adoptTrack(track, layer) {
  currentLayer.value = { ...(layer ?? createLayer(0, track)), slot: 0, track }
}

// Resolve queue artwork before it is visible, using the same sampler as playback.
watch(() => [props.track.coverUrl, props.previousTrack?.coverUrl, props.nextTrack?.coverUrl], urls => {
  for (const url of new Set(urls.filter(Boolean))) {
    if (sampledPalettes.value.has(url) || paletteRequests.has(url)) continue
    paletteRequests.add(url)
    void sampleCoverTint(url).then(tint => {
      if (disposed) return
      const palettes = new Map(sampledPalettes.value)
      palettes.set(url, createCoverPaletteFromTint(tint))
      if (palettes.size > 80) palettes.delete(palettes.keys().next().value)
      sampledPalettes.value = palettes
    }).catch(() => {
      // Keep this track's palette or the shared fallback if sampling is unavailable.
    }).finally(() => paletteRequests.delete(url))
  }
}, { immediate: true })

// Keep ambient layers full-screen; only the artwork moves with the swipe.
function layerOpacity(slot, y = offset.value) {
  return slot === 0 ? 1 : Math.max(0, Math.min(1, -slot * y / height.value))
}
function backgroundLayerStyle(layer) {
  return {
    ...coverStyle(layer.track),
    opacity: layerOpacity(layer.slot),
    zIndex: layer.slot === 0 ? 0 : 1
  }
}
function coverStyle(track) {
  const palette = sampledPalettes.value.get(track.coverUrl) ?? track.coverPalette
  return {
    '--cover-primary': palette?.primary ?? '#213245',
    '--cover-image': track.coverUrl ? `url("${track.coverUrl}")` : 'none'
  }
}
function snapshot(track) {
  return track ? { ...track, coverPalette: track.coverPalette ? { ...track.coverPalette } : undefined } : null
}
function prepareFrames() {
  if (frames.value) return
  height.value = Math.max(1, root.value?.clientHeight || 1)
  frames.value = [
    createLayer(-1, props.previousTrack),
    { ...currentLayer.value, slot: 0, track: snapshot(props.track) },
    createLayer(1, props.nextTrack)
  ].filter(Boolean)
}
function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
function reset() {
  generation += 1
  animations.forEach(animation => animation.cancel())
  animations = []
  settling.value = false
  settleDuration.value = 0
  awaitingTrack.value = false
  frames.value = null
  offset.value = 0
  targetLayerKey = null
}

function drag(dy) {
  if (disposed || busy.value || !props.allowSongSwipe) return
  prepareFrames()
  const slot = dy < 0 ? 1 : -1
  const available = frames.value.some(layer => layer.slot === slot)
  offset.value = reducedMotion() ? 0 : Math.max(-height.value, Math.min(height.value, available ? dy : dy * .25))
}

async function animateTo(target, duration) {
  const token = ++generation
  const from = offset.value
  const motionDuration = reducedMotion() ? 0 : duration
  settling.value = true
  settleDuration.value = motionDuration && typeof strip.value?.animate === 'function' ? motionDuration : 0
  await nextTick()
  if (disposed || token !== generation || !strip.value) return false
  if (settleDuration.value) {
    const running = Array.from(strip.value.children, element => {
      const slot = Number(element.dataset.slot)
      return element.animate(
        [{ opacity: layerOpacity(slot, from) }, { opacity: layerOpacity(slot, target) }],
        { duration: motionDuration, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'forwards' }
      )
    })
    animations = running
    offset.value = target
    try { await Promise.all(running.map(animation => animation.finished)) } catch { return false }
    if (disposed || token !== generation) return false
    running.forEach(animation => animation.cancel())
    animations = []
  } else offset.value = target
  settling.value = false
  settleDuration.value = 0
  return true
}

async function finish(direction) {
  if (disposed || busy.value || !props.allowSongSwipe) return null
  prepareFrames()
  const slot = direction > 0 ? 1 : -1
  const targetLayer = direction ? frames.value.find(layer => layer.slot === slot) : null
  const target = targetLayer?.track
  if (!target) {
    if (await animateTo(0, 200)) reset()
    return null
  }
  targetLayerKey = targetLayer.key
  if (!await animateTo(-slot * height.value, 300)) return null
  awaitingTrack.value = true
  const token = generation
  return {
    track: target,
    complete: async (accepted) => {
      await nextTick()
      if (disposed || token !== generation) return
      if (accepted && String(props.track.id) === String(target.id)) {
        adoptTrack(props.track, targetLayer)
        reset()
      } else {
        awaitingTrack.value = false
        if (await animateTo(0, 240)) reset()
      }
    }
  }
}

async function cancel() {
  if (disposed || busy.value || !frames.value) return
  if (await animateTo(0, 200)) reset()
}

// Promote the already decoded preview instead of rebuilding it at playback commit.
watch(() => props.track.id, () => {
  const target = frames.value?.find(layer => layer.key === targetLayerKey && String(layer.track.id) === String(props.track.id))
  adoptTrack(props.track, target)
  reset()
}, { flush: 'sync' })
onMounted(() => {
  if (typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(() => {
    const nextHeight = Math.max(1, root.value?.clientHeight || 1)
    if (frames.value && Math.abs(nextHeight - height.value) > 1) reset()
    height.value = nextHeight
  })
  resizeObserver.observe(root.value)
})
onBeforeUnmount(() => {
  disposed = true
  resizeObserver?.disconnect()
  reset()
})
defineExpose({ drag, finish, cancel, busy, layers, offset, height, settleDuration })
</script>
