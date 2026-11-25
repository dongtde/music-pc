<template>
  <span
    ref="viewport"
    class="overflow-marquee"
    :class="{ 'is-enabled': enabled, 'is-overflowing': enabled && overflowing, 'is-active': active }"
    :style="marqueeStyle"
    :title="text"
  >
    <span class="overflow-marquee__track">
      <span ref="content" class="overflow-marquee__text">{{ text }}</span>
      <span v-if="enabled && overflowing" class="overflow-marquee__text" aria-hidden="true">{{ text }}</span>
    </span>
  </span>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  text: { type: String, default: '' },
  enabled: { type: Boolean, default: true },
  active: { type: Boolean, default: true }
})

const viewport = ref(null)
const content = ref(null)
const overflowing = ref(false)
const distance = ref(0)
const marqueeStyle = computed(() => ({
  '--marquee-distance': `${-distance.value}px`,
  '--marquee-duration': `${Math.max(10, distance.value / 28)}s`
}))
let observer = null
let frame = 0
let disposed = false

function scheduleMeasure() {
  if (disposed || frame) return
  frame = window.requestAnimationFrame(() => {
    frame = 0
    if (!viewport.value || !content.value) return
    const width = content.value.getBoundingClientRect().width
    overflowing.value = width > viewport.value.clientWidth + 1
    distance.value = width + 40
  })
}

watch(() => [props.text, props.enabled], async () => {
  await nextTick()
  scheduleMeasure()
})

onMounted(() => {
  observer = new ResizeObserver(scheduleMeasure)
  observer.observe(viewport.value)
  observer.observe(content.value)
  document.fonts?.ready.then(scheduleMeasure)
  scheduleMeasure()
})

onBeforeUnmount(() => {
  disposed = true
  observer?.disconnect()
  if (frame) window.cancelAnimationFrame(frame)
})
</script>

<style scoped>
.overflow-marquee {
  display: block;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  vertical-align: bottom;
}

.overflow-marquee__track {
  display: flex;
  width: max-content;
  min-width: 100%;
  align-items: center;
  justify-content: inherit;
  gap: 40px;
}

.overflow-marquee:not(.is-enabled) { overflow: visible; }
.overflow-marquee:not(.is-enabled) .overflow-marquee__track { display: block; width: auto; }
.overflow-marquee:not(.is-enabled) .overflow-marquee__text { white-space: normal; }

.overflow-marquee__text {
  flex: 0 0 auto;
  white-space: nowrap;
}

.is-overflowing {
  text-align: start;
  mask-image: linear-gradient(90deg, transparent, #000 10px, #000 calc(100% - 10px), transparent);
}

.is-overflowing .overflow-marquee__track {
  animation: overflow-marquee-scroll var(--marquee-duration) linear infinite;
  animation-play-state: paused;
}

.is-overflowing.is-active .overflow-marquee__track {
  animation-play-state: running;
}

@keyframes overflow-marquee-scroll {
  0%, 12% { transform: translateX(0); }
  100% { transform: translateX(var(--marquee-distance)); }
}

@media (prefers-reduced-motion: reduce) {
  .is-overflowing .overflow-marquee__track { animation: none; }
  .is-overflowing { overflow-x: auto; mask-image: none; scrollbar-width: none; }
}

:global(html[data-reduced-motion='true'] .overflow-marquee.is-overflowing .overflow-marquee__track) { animation: none; }
:global(html[data-reduced-motion='true'] .overflow-marquee.is-overflowing) { overflow-x: auto; mask-image: none; scrollbar-width: none; }
</style>
