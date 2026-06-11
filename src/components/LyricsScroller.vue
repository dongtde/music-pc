<template>
  <component
    :is="rootTag"
    :class="rootClass"
    :aria-label="variant === 'home' ? '歌词' : undefined"
    :aria-busy="loading || undefined"
  >
    <div
      v-if="variant === 'full' && breath"
      class="full-player__lyric-breath"
      aria-hidden="true"
    >
      <span />
      <span />
      <span />
    </div>

    <div v-if="showGuide" :class="guideClass">
      <span :class="guideTimeClass">{{ previewLyric.time }}</span>
      <span :class="guideLineClass" />
      <button
        :class="guidePlayClass"
        type="button"
        :disabled="previewLyric.placeholder"
        aria-label="跳转到选中歌词"
        @click.stop="seekToPreviewLyric"
      >
        <Play :size="variant === 'full' ? 14 : 13" fill="currentColor" />
      </button>
    </div>

    <div
      ref="scroller"
      :class="scrollClass"
      aria-label="滚动歌词"
      @pointerdown="startDrag"
      @pointermove="handlePointerMove"
      @pointerup="stopDrag"
      @pointerleave="stopDrag"
      @pointercancel="stopDrag"
      @wheel.prevent="handleWheel"
    >
      <button
        v-for="line in normalizedLines"
        :key="`${line.index}-${line.time}-${line.text}`"
        type="button"
        :class="getLineClass(line)"
        :aria-disabled="line.placeholder || undefined"
        :data-lyric-index="line.index"
        @click="selectLyric(line.index)"
      >
        <span :class="textClass">{{ line.text }}</span>
        <component
          :is="variant === 'home' ? 'small' : 'span'"
          v-if="line.translation"
          :class="translationClass"
        >
          {{ line.translation }}
        </component>
      </button>
    </div>
  </component>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Play } from 'lucide-vue-next'

const props = defineProps({
  lines: {
    type: Array,
    default: () => []
  },
  activeIndex: {
    type: Number,
    default: 0
  },
  variant: {
    type: String,
    default: 'home',
    validator: (value) => ['home', 'full'].includes(value)
  },
  loading: {
    type: Boolean,
    default: false
  },
  playing: {
    type: Boolean,
    default: false
  },
  danmakuActive: {
    type: Boolean,
    default: false
  },
  breath: {
    type: Boolean,
    default: false
  },
  requireSeekable: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['seek'])
const scroller = ref(null)
const dragging = ref(false)
const wheeling = ref(false)
const previewing = ref(false)
const previewIndex = ref(null)
const dragState = {
  startY: 0,
  startScrollTop: 0,
  moved: false
}
let previewFrame = 0
let previewTimer = null
let wheelTimer = null
let suppressNextClick = false

const rootTag = computed(() => (props.variant === 'home' ? 'section' : 'div'))
const interactionActive = computed(() => dragging.value || wheeling.value || previewing.value)
const normalizedLines = computed(() =>
  props.lines.map((line, index) => ({
    ...line,
    index: Number.isInteger(line.index) ? line.index : index
  }))
)
const hasSeekableLines = computed(() => normalizedLines.value.some((line) => !line.placeholder))
const previewLyric = computed(() => {
  const index = previewIndex.value ?? props.activeIndex

  return normalizedLines.value.find((line) => line.index === index) ?? null
})
const showGuide = computed(() =>
  Boolean(
    interactionActive.value &&
    previewLyric.value &&
    (props.variant === 'full' || hasSeekableLines.value)
  )
)
const rootClass = computed(() => props.variant === 'home'
  ? {
      'soda-lyrics-panel': true,
      'soda-lyrics-panel--dragging': dragging.value,
      'soda-lyrics-panel--wheeling': wheeling.value,
      'soda-lyrics-panel--previewing': interactionActive.value
    }
  : {
      'full-player__qq-lyrics': true,
      'full-player__qq-lyrics--dragging': dragging.value,
      'full-player__qq-lyrics--wheeling': wheeling.value,
      'full-player__qq-lyrics--previewing': interactionActive.value,
      'full-player__qq-lyrics--danmaku': props.danmakuActive,
      'full-player__qq-lyrics--breath': props.breath,
      'is-playing': props.playing
    }
)
const guideClass = computed(() => props.variant === 'home' ? 'soda-lyric-guide' : 'full-player__lyric-guide')
const guideTimeClass = computed(() => props.variant === 'home' ? 'soda-lyric-guide__time' : 'full-player__lyric-guide-time')
const guideLineClass = computed(() => props.variant === 'home' ? 'soda-lyric-guide__line' : 'full-player__lyric-guide-line')
const guidePlayClass = computed(() => props.variant === 'home' ? 'soda-lyric-guide__play' : 'full-player__lyric-guide-play')
const scrollClass = computed(() => props.variant === 'home' ? 'soda-lyrics-list' : 'full-player__lyrics-scroll')
const textClass = computed(() => props.variant === 'home' ? '' : 'full-player__lyric-text')
const translationClass = computed(() => props.variant === 'home' ? '' : 'full-player__lyric-translation')

watch(
  () => props.activeIndex,
  async () => {
    if (interactionActive.value) {
      return
    }

    await nextTick()
    refreshLayout()
  }
)

watch(
  () => props.lines,
  async () => {
    resetInteraction()
    await refreshLayout('auto')
  }
)

onMounted(() => {
  window.addEventListener('resize', handleResize)
  nextTick(() => refreshLayout('auto'))
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  cleanupTimers()
})

function getLineClass(line) {
  const stateClass = {
    active: line.index === props.activeIndex,
    preview: interactionActive.value && previewIndex.value === line.index,
    past: line.index < props.activeIndex,
    future: line.index > props.activeIndex,
    placeholder: line.placeholder
  }

  return props.variant === 'home'
    ? stateClass
    : {
        'full-player__lyric-line': true,
        ...stateClass
      }
}

function startDrag(event) {
  const element = scroller.value

  if (!element || event.button > 0 || !canInteract()) {
    return
  }

  dragging.value = true
  previewing.value = true
  previewIndex.value = props.activeIndex
  dragState.startY = event.clientY
  dragState.startScrollTop = element.scrollTop
  dragState.moved = false
  clearPreviewTimer()
  clearWheelTimer()
  wheeling.value = false
  element.setPointerCapture?.(event.pointerId)
  updatePreviewFromCenter()
}

function handlePointerMove(event) {
  const element = scroller.value

  if (!element || !dragging.value) {
    return
  }

  const deltaY = event.clientY - dragState.startY

  if (Math.abs(deltaY) > 3) {
    dragState.moved = true
  }

  element.scrollTop = dragState.startScrollTop - deltaY * 2.2
  requestPreviewUpdate()
}

function stopDrag(event) {
  if (!dragging.value) {
    return
  }

  flushPreviewUpdate()
  scroller.value?.releasePointerCapture?.(event.pointerId)
  dragging.value = false

  if (dragState.moved) {
    suppressNextClick = true
    window.setTimeout(() => {
      suppressNextClick = false
    }, 0)
  }

  schedulePlaybackReturn()
}

function handleWheel(event) {
  const element = scroller.value

  if (!element || dragging.value || !canInteract()) {
    return
  }

  previewing.value = true
  wheeling.value = true
  clearPreviewTimer()
  clearWheelTimer()

  const wheelDelta = event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? event.deltaY * 18
    : event.deltaY

  element.scrollTop += wheelDelta * 1.2
  requestPreviewUpdate()

  wheelTimer = window.setTimeout(() => {
    wheeling.value = false
    schedulePlaybackReturn()
  }, 140)
}

function selectLyric(index) {
  if (suppressNextClick) {
    suppressNextClick = false
    return
  }

  seekToLine(index)
}

function seekToPreviewLyric() {
  seekToLine(previewIndex.value ?? props.activeIndex)
}

function seekToLine(index) {
  const line = normalizedLines.value.find((item) => item.index === index)

  if (!line || line.placeholder) {
    return
  }

  previewIndex.value = null
  previewing.value = false
  wheeling.value = false
  clearPreviewTimer()
  clearWheelTimer()
  emit('seek', { line, index: line.index, seconds: line.seconds })
  nextTick(() => centerLyricIndex(line.index))
}

function requestPreviewUpdate() {
  if (previewFrame) {
    return
  }

  previewFrame = window.requestAnimationFrame(() => {
    previewFrame = 0
    updatePreviewFromCenter()
  })
}

function flushPreviewUpdate() {
  if (previewFrame) {
    window.cancelAnimationFrame(previewFrame)
    previewFrame = 0
  }

  updatePreviewFromCenter()
}

function updatePreviewFromCenter() {
  const element = scroller.value

  if (!element) {
    return
  }

  const centerOffset = element.scrollTop + element.clientHeight / 2
  let nearestIndex = previewIndex.value ?? props.activeIndex
  let nearestDistance = Number.POSITIVE_INFINITY

  Array.from(element.children).forEach((button) => {
    const distance = Math.abs(button.offsetTop + button.offsetHeight / 2 - centerOffset)
    const lyricIndex = Number(button.dataset.lyricIndex)

    if (distance < nearestDistance && Number.isInteger(lyricIndex)) {
      nearestDistance = distance
      nearestIndex = lyricIndex
    }
  })

  if (nearestIndex !== previewIndex.value) {
    previewIndex.value = nearestIndex
  }
}

function schedulePlaybackReturn() {
  clearPreviewTimer()
  previewTimer = window.setTimeout(() => {
    previewing.value = false
    previewIndex.value = null
    centerCurrentLyric()
  }, 4200)
}

function refreshLayout(behavior = 'smooth') {
  updateEdgePadding()
  centerCurrentLyric(behavior)
}

function updateEdgePadding() {
  const element = scroller.value

  if (!element) {
    return
  }

  const activeLine = element.querySelector(`[data-lyric-index="${props.activeIndex}"]`)
  const firstLine = element.querySelector('[data-lyric-index="0"]')
  const fallbackHeight = props.variant === 'home' ? 62 : 86
  const lineHeight = activeLine?.offsetHeight || firstLine?.offsetHeight || fallbackHeight
  const edgePadding = Math.max(0, element.clientHeight / 2 - lineHeight / 2)

  element.style.setProperty(edgePaddingVar(), `${edgePadding}px`)
}

function centerCurrentLyric(behavior = 'smooth') {
  centerLyricIndex(props.activeIndex, behavior)
}

function centerLyricIndex(index, behavior = 'smooth') {
  const element = scroller.value

  if (!element || index < 0) {
    return
  }

  const activeLine =
    element.querySelector(`[data-lyric-index="${index}"]`) ??
    element.children[index]

  if (!activeLine) {
    return
  }

  element.scrollTo({
    top:
      activeLine.offsetTop -
      element.clientHeight / 2 +
      activeLine.offsetHeight / 2,
    behavior
  })
}

function handleResize() {
  refreshLayout('auto')
}

function resetInteraction() {
  dragging.value = false
  wheeling.value = false
  previewing.value = false
  previewIndex.value = null
  suppressNextClick = false
  cleanupTimers()
}

function cleanupTimers() {
  if (previewFrame) {
    window.cancelAnimationFrame(previewFrame)
    previewFrame = 0
  }
  clearPreviewTimer()
  clearWheelTimer()
}

function clearPreviewTimer() {
  if (previewTimer) {
    window.clearTimeout(previewTimer)
    previewTimer = null
  }
}

function clearWheelTimer() {
  if (wheelTimer) {
    window.clearTimeout(wheelTimer)
    wheelTimer = null
  }
}

function canInteract() {
  return !props.requireSeekable || hasSeekableLines.value
}

function edgePaddingVar() {
  return props.variant === 'home'
    ? '--lyrics-edge-padding'
    : '--full-player-lyrics-edge-padding'
}

defineExpose({
  refreshLayout,
  centerCurrentLyric,
  resetInteraction
})
</script>
