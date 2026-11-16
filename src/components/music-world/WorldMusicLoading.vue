<template>
  <div class="world-music-loading" role="status" :aria-label="label">
    <canvas ref="canvas" width="256" height="256" aria-hidden="true" />
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { drawMusicLoading } from './drawMusicLoading.js'
import { worldControls } from './worldControlTheme.js'

const props = defineProps({ paused: Boolean, accent: { type: String, default: worldControls.accent }, label: { type: String, default: '正在加载音乐' } })
const canvas = ref(null)
let frame = 0, lastDraw = -Infinity, motionQuery
function paint(now, reduced = false) {
  const ctx = canvas.value?.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, 256, 256)
  drawMusicLoading(ctx, 128, 128, 96, props.accent, now, reduced)
}
function tick(now) {
  if (now - lastDraw >= 1000 / 30) { paint(now); lastDraw = now }
  frame = requestAnimationFrame(tick)
}
function sync() {
  cancelAnimationFrame(frame); frame = 0
  if (!motionQuery) return
  paint(0, true)
  if (!props.paused && !document.hidden && !motionQuery.matches) frame = requestAnimationFrame(tick)
}
onMounted(() => {
  motionQuery = matchMedia('(prefers-reduced-motion: reduce)')
  motionQuery.addEventListener('change', sync)
  document.addEventListener('visibilitychange', sync)
  sync()
})
watch(() => [props.paused, props.accent], sync)
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  motionQuery?.removeEventListener('change', sync)
  document.removeEventListener('visibilitychange', sync)
})
</script>

<style scoped>
.world-music-loading { display:grid; place-items:center; min-height:230px; height:100%; }
.world-music-loading canvas { width:160px; height:160px; }
</style>
