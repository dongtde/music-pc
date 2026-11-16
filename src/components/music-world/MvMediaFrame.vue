<template>
  <div ref="frame" class="mv-media-frame" @load.capture="inspect" @loadedmetadata.capture="inspect" @loadeddata.capture="inspect" @seeked.capture="inspect" @timeupdate.capture="inspect">
    <div v-if="enabled" class="mv-media-frame__backdrop" :style="backdrop ? { backgroundImage: `url(${JSON.stringify(backdrop)})` } : undefined" aria-hidden="true"><canvas ref="backdropCanvas" width="128" height="128" /></div>
    <slot />
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { fitVideoFrame } from '../../utils/videoFrame'

const props = defineProps({ enabled: Boolean, backdrop: String })
const frame = ref(null), backdropCanvas = ref(null)
let observer, media = null

function layout() {
  if (!props.enabled || !media || !frame.value) return
  const width = media.videoWidth || media.naturalWidth
  const height = media.videoHeight || media.naturalHeight
  if (!width || !height) return
  const fit = fitVideoFrame(width, height, frame.value.clientWidth, frame.value.clientHeight)
  Object.assign(media.style, {
    position: 'absolute', inset: 'auto', width: `${fit.width}px`, height: `${fit.height}px`,
    left: `${fit.left}px`, top: `${fit.top}px`, maxWidth: 'none', maxHeight: 'none', clipPath: 'none', zIndex: '1',
  })
}

function inspect(event) {
  const target = event.target
  if (!props.enabled || !['VIDEO', 'IMG'].includes(target.tagName)) return
  media = target
  const width = target.videoWidth || target.naturalWidth
  const height = target.videoHeight || target.naturalHeight
  if (!width || !height) return
  if (target.tagName === 'VIDEO' && (target.readyState < 2 || target.seeking)) { layout(); return }
  if (backdropCanvas.value) {
    try {
      const fill = fitVideoFrame(width, height, 128, 128, 'cover')
      backdropCanvas.value.getContext('2d').drawImage(target, fill.left, fill.top, fill.width, fill.height)
    } catch { /* Use the blurred poster until a decoded frame is available. */ }
  }
  layout()
}

onMounted(() => {
  observer = new ResizeObserver(layout)
  observer.observe(frame.value)
  const initial = frame.value.querySelector('video, img')
  if (initial) inspect({ target: initial })
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<style scoped>
.mv-media-frame { position: absolute; inset: 0; overflow: hidden; }
.mv-media-frame__backdrop { position: absolute; inset: -24px; pointer-events: none; background: #323943 center / cover; filter: blur(24px) brightness(.75); }
.mv-media-frame__backdrop canvas { display: block; width: 100%; height: 100%; }
</style>
