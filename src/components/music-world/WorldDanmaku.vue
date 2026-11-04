<template>
  <section ref="root" class="world-danmaku world-danmaku-stream" :class="{'is-hidden':!running,'is-static':reducedMotion}" :style="{'--danmaku-opacity':visibleOpacity}" aria-label="歌曲评论弹幕" :aria-hidden="!running" aria-live="off" />
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createDanmakuStream } from './createDanmakuStream.js'
import { normalizeDanmakuOpacity } from './danmakuSettings.js'

const props = defineProps({
  songKey: { type: [String, Number], default: '' },
  comments: { type: Array, default: () => [] },
  enabled: { type: Boolean, default: true },
  paused: { type: Boolean, default: false },
  opacity: { type: Number, default: 1 },
  hasMore: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
})
const emit = defineEmits(['needMore'])
const root = ref(null), activePage = ref(!document.hidden), reducedMotion = ref(false)
const visibleOpacity = computed(() => normalizeDanmakuOpacity(props.opacity))
const running = computed(() => props.enabled && !props.paused && activePage.value && visibleOpacity.value > 0)
let stream, media
function syncSource() { stream?.setSource(props.songKey,props.comments,{hasMore:props.hasMore,loading:props.loading}) }
watch(() => [props.songKey,props.comments,props.hasMore,props.loading],syncSource)
watch(running, value => stream?.setActive(value))
function visibility() { activePage.value = !document.hidden }
function motion() { reducedMotion.value = media.matches; stream?.setReducedMotion(reducedMotion.value) }
onMounted(() => {
  stream = createDanmakuStream(root.value, {onNeedMore:() => emit('needMore')})
  media = matchMedia('(prefers-reduced-motion: reduce)'); motion()
  syncSource(); stream.setActive(running.value)
  media.addEventListener('change',motion); document.addEventListener('visibilitychange',visibility)
})
onBeforeUnmount(() => {
  stream?.dispose(); media?.removeEventListener('change',motion); document.removeEventListener('visibilitychange',visibility)
})
</script>

<style scoped>
.world-danmaku-stream{position:absolute;overflow:hidden;contain:strict;pointer-events:none;font:650 16px/28px 'Microsoft YaHei UI','Microsoft YaHei',sans-serif}
.world-danmaku-stream.is-hidden{visibility:hidden}
.world-danmaku-stream :deep(.world-danmaku-stream__bubble){position:absolute;left:0;height:28px;overflow:hidden;contain:strict;text-overflow:ellipsis;visibility:hidden;color:#f5f7fb;font:inherit;white-space:nowrap;text-shadow:0 1px 2px #000,1px 0 1px #000;opacity:var(--danmaku-opacity,1);transform:translate3d(100vw,0,0)}
.world-danmaku-stream :deep(.world-danmaku-stream__bubble[data-comment-id]){visibility:inherit;will-change:transform,opacity}
.world-danmaku-stream :deep(.world-danmaku-stream__bubble.is-hot){color:#9af2c9}
.world-danmaku-stream.is-static :deep(.world-danmaku-stream__bubble){left:auto;right:12px;transform:none;will-change:auto}
@media(max-width:700px){.world-danmaku-stream{font-size:14px}}
</style>

