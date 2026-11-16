<template>
  <section
    v-show="placement"
    ref="screen"
    class="world-mv-screen"
    :style="screenStyle"
    aria-label="MV 屏幕"
    @pointerdown.stop
    @pointerup.stop
    @click.stop
    @wheel.stop
    @keydown.stop="onKey"
  >
    <HomeVideoFeed v-if="visited" :active="active" :preview="!open" :load-mvs="loadWorldMvs" embedded @activate="$emit('activate')" @cast="$emit('cast', $event)" />
  </section>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import HomeVideoFeed from '../../views/home/HomeVideoFeed.vue'
import { SCREEN_INPUT_SIZE } from './createScreenProjection.js'
import { loadWorldMvs } from './worldMvFeed.js'

const props = defineProps({ open: Boolean, placement: { type: Object, default: null } })
const emit = defineEmits(['activate', 'close', 'cast'])
const screen = ref(null), visited = ref(false)
const active = computed(() => props.open && Boolean(props.placement))
const screenStyle = computed(() => ({ width: `${SCREEN_INPUT_SIZE}px`, height: `${SCREEN_INPUT_SIZE}px`, transform: props.placement?.transform }))

function onKey(event) {
  if (event.key === 'Escape') { event.preventDefault(); emit('close') }
}
watch(() => props.placement, placement => { if (placement) visited.value = true }, { immediate: true })
watch(active, async enabled => {
  if (!enabled) return
  visited.value = true
  await nextTick()
  screen.value?.querySelector('.soda-video-feed__scroller')?.focus({ preventScroll: true })
}, { immediate: true })
</script>

<style scoped src="./world-mv.css"></style>
