<template>
  <section
    v-if="danmakuItems.length"
    class="soda-danmaku"
    :class="{
      'soda-danmaku--disabled': !layerVisible,
      'soda-danmaku--paused': layerPaused
    }"
    aria-label="歌曲评论弹幕"
    :aria-hidden="!layerVisible"
    aria-live="off"
  >
    <span
      v-for="item in danmakuItems"
      :key="item.key"
      class="soda-danmaku__item"
      :class="{
        'soda-danmaku__item--hot': item.hot,
        'soda-danmaku__item--fallback': item.fallback,
        'soda-danmaku__item--empty': item.empty
      }"
      :style="item.style"
    >
      <span v-if="!item.empty" class="soda-danmaku__avatar" aria-hidden="true">
        <img
          v-if="item.avatarUrl"
          :src="item.avatarUrl"
          :alt="item.userName"
          loading="lazy"
          decoding="async"
        />
        <template v-else>{{ item.avatarText }}</template>
      </span>
      <span v-if="!item.empty" class="soda-danmaku__text">{{ item.content }}</span>
    </span>
  </section>
</template>

<script setup>
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import '../styles/danmaku.css'

const emit = defineEmits(['needMore'])

const props = defineProps({
  enabled: {
    type: Boolean,
    default: true
  },
  paused: {
    type: Boolean,
    default: false
  },
  song: {
    type: Object,
    default: null
  },
  hotComments: {
    type: Array,
    default: () => []
  },
  comments: {
    type: Array,
    default: () => []
  },
  maxItems: {
    type: Number,
    default: 48
  },
  hasMore: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  prefetchThreshold: {
    type: Number,
    default: 8
  }
})

const laneCount = 7
const fallbackNames = ['云听友', '耳机党', '夜航线', '旋律控', '今日循环']
const fallbackTexts = [
  '这段前奏一响就有画面了',
  '适合戴耳机慢慢听',
  '{song} 这首很有记忆点',
  '副歌进来的一瞬间很抓人',
  '今天的心情刚好对上了',
  '这首可以放进循环歌单',
  '越听越舒服',
  '这个音色太干净了',
  '旋律像慢慢亮起来',
  '突然想把音量调大一点'
]

const maxVisibleItems = computed(() => {
  const value = Math.floor(Number(props.maxItems))

  return Number.isFinite(value) && value > 0 ? value : 48
})
const launchBatchSize = computed(() => (danmakuItems.value.length ? 1 : 2))
const launchIntervalMs = computed(() => {
  const value = Math.floor(Number(props.maxItems))

  return value > 36 ? 460 : 560
})
const layerVisible = ref(false)
const layerPaused = computed(() => props.paused || !layerVisible.value)
const danmakuItems = shallowRef([])
const pendingComments = shallowRef([])
let seenCommentKeys = new Set()
let showingFallback = false
const slotTimers = new Map()
let sourceSyncTimer = 0
let fillTimer = 0
let resumeFrame = 0
let streamClockMs = 0
let streamStartedAt = 0

watch(
  () => props.song?.id,
  () => {
    resetDanmakuStream()
    scheduleSourceCommentsSync()
  },
  { immediate: true }
)

watch(
  () => [props.hotComments, props.comments],
  () => {
    scheduleSourceCommentsSync()
  }
)

watch(maxVisibleItems, () => {
  if (showingFallback) {
    showFallbackComments()
    return
  }

  danmakuItems.value = danmakuItems.value.slice(0, maxVisibleItems.value)
  clearOverflowSlotTimers()
  clearFillTimer()
  fillDanmakuSlots()
  requestMoreIfNeeded()
})

watch(
  () => [props.enabled, props.paused, props.hasMore, props.loading],
  ([enabled, paused]) => {
    clearResumeFrame()

    if (enabled && !paused) {
      if (layerVisible.value) {
        scheduleSourceCommentsSync()
        scheduleVisibleItems()
      } else {
        prepareStreamResume()
      }
    } else {
      pauseStreamClock()
      layerVisible.value = false
      clearFillTimer()
      clearSlotTimers()
    }

    requestMoreIfNeeded()
  },
  { immediate: true }
)

onUnmounted(() => {
  clearSourceSyncTimer()
  clearFillTimer()
  clearResumeFrame()
  clearSlotTimers()
})

function getSourceComments() {
  const hotComments = props.hotComments.map((comment, index) =>
    normalizeComment(comment, `hot-${index}`, true)
  )
  const regularComments = props.comments.map((comment, index) =>
    normalizeComment(comment, `comment-${index}`, false)
  )
  const sourceComments = dedupeComments([...hotComments, ...regularComments])

  return sourceComments
}

function normalizeComment(comment, fallbackId, hot) {
  const user = comment?.user ?? {}
  const content = clampCommentText(comment?.content)

  return {
    id: comment?.id ?? fallbackId,
    content,
    likedCount: Number(comment?.likedCount) || 0,
    userName: user.name || '匿名听友',
    avatarUrl: user.avatarUrl || '',
    avatarText: (user.name || '听').slice(0, 1),
    hot
  }
}

function dedupeComments(comments) {
  const seen = new Set()

  return comments.filter((comment) => {
    if (!comment.content || seen.has(comment.content)) {
      return false
    }

    seen.add(comment.content)
    return true
  })
}

function createFallbackComments() {
  const songName = props.song?.name || '这首歌'

  return fallbackTexts.map((text, index) => ({
    id: `fallback-${index}`,
    content: text.replace('{song}', songName),
    likedCount: 0,
    userName: fallbackNames[index % fallbackNames.length],
    avatarUrl: '',
    avatarText: fallbackNames[index % fallbackNames.length].slice(0, 1),
    hot: index < 2,
    fallback: true
  }))
}

function resetDanmakuStream() {
  clearSourceSyncTimer()
  clearFillTimer()
  clearResumeFrame()
  clearSlotTimers()
  resetStreamClock()
  danmakuItems.value = []
  pendingComments.value = []
  seenCommentKeys = new Set()
  showingFallback = false
}

function resetStreamClock() {
  streamClockMs = 0
  streamStartedAt = props.enabled && !props.paused && layerVisible.value
    ? performance.now()
    : 0
}

function prepareStreamResume() {
  refreshDanmakuItemStyles(streamClockMs)
  scheduleSourceCommentsSync()

  resumeFrame = window.requestAnimationFrame(() => {
    resumeFrame = 0

    if (!props.enabled || props.paused) {
      return
    }

    layerVisible.value = true
    startStreamClock()
    scheduleVisibleItems()
    requestMoreIfNeeded()
  })
}

function clearResumeFrame() {
  if (resumeFrame) {
    window.cancelAnimationFrame(resumeFrame)
    resumeFrame = 0
  }
}

function startStreamClock() {
  if (!streamStartedAt) {
    streamStartedAt = performance.now()
  }
}

function pauseStreamClock() {
  if (!streamStartedAt) {
    return
  }

  streamClockMs += performance.now() - streamStartedAt
  streamStartedAt = 0
  refreshDanmakuItemStyles(streamClockMs)
}

function getStreamClockMs() {
  if (!streamStartedAt) {
    return streamClockMs
  }

  return streamClockMs + performance.now() - streamStartedAt
}

function refreshDanmakuItemStyles(clockMs = getStreamClockMs()) {
  if (!danmakuItems.value.length) {
    return
  }

  danmakuItems.value = danmakuItems.value.map((item) => {
    if (!item?.timing) {
      return item
    }

    return {
      ...item,
      style: createDanmakuStyle(item.timing, item.hot, clockMs)
    }
  })
}

function scheduleSourceCommentsSync() {
  clearSourceSyncTimer()

  if (!props.enabled || props.paused) {
    return
  }

  sourceSyncTimer = window.setTimeout(() => {
    sourceSyncTimer = 0
    syncSourceComments()
  }, 0)
}

function clearSourceSyncTimer() {
  if (sourceSyncTimer) {
    window.clearTimeout(sourceSyncTimer)
    sourceSyncTimer = 0
  }
}

function syncSourceComments() {
  if (!props.enabled || props.paused) {
    return
  }

  const comments = getSourceComments()

  if (!comments.length) {
    if (!danmakuItems.value.length || showingFallback) {
      showFallbackComments()
    }

    requestMoreIfNeeded()
    return
  }

  if (showingFallback) {
    danmakuItems.value = []
    pendingComments.value = []
    seenCommentKeys = new Set()
    showingFallback = false
  }

  enqueueComments(comments)
  fillDanmakuSlots()
  requestMoreIfNeeded()
}

function showFallbackComments() {
  const comments = createFallbackComments()
  const count = Math.min(comments.length, maxVisibleItems.value)

  showingFallback = true
  pendingComments.value = []
  danmakuItems.value = comments.slice(0, count).map(createDanmakuItem)
  scheduleVisibleItems()
}

function enqueueComments(comments) {
  const nextComments = []

  comments.forEach((comment) => {
    const key = getCommentKey(comment)

    if (!key || seenCommentKeys.has(key)) {
      return
    }

    seenCommentKeys.add(key)
    nextComments.push(comment)
  })

  if (nextComments.length) {
    pendingComments.value = [...pendingComments.value, ...nextComments]
  }
}

function fillDanmakuSlots() {
  if (showingFallback || !pendingComments.value.length) {
    return
  }

  const items = [...danmakuItems.value].slice(0, maxVisibleItems.value)
  let filledCount = 0

  for (let index = 0; index < maxVisibleItems.value && pendingComments.value.length; index += 1) {
    if (items[index] && !items[index].empty) {
      continue
    }

    items[index] = createDanmakuItem(pendingComments.value.shift(), index)
    scheduleSlot(index, getRemainingCycleMs(items[index].timing))
    filledCount += 1

    if (filledCount >= launchBatchSize.value) {
      break
    }
  }

  danmakuItems.value = items

  if (pendingComments.value.length && hasAvailableSlot(items)) {
    scheduleFillDanmakuSlots()
  }
}

function scheduleFillDanmakuSlots() {
  if (fillTimer || !props.enabled || props.paused) {
    return
  }

  fillTimer = window.setTimeout(() => {
    fillTimer = 0

    if (!props.enabled || props.paused) {
      return
    }

    fillDanmakuSlots()
  }, launchIntervalMs.value)
}

function clearFillTimer() {
  if (fillTimer) {
    window.clearTimeout(fillTimer)
    fillTimer = 0
  }
}

function hasAvailableSlot(items = danmakuItems.value) {
  if (items.length < maxVisibleItems.value) {
    return true
  }

  return items.some((item) => !item || item.empty)
}

function cycleDanmakuItem(index) {
  if (showingFallback) {
    return
  }

  const nextComment = pendingComments.value.shift()
  const nextItems = danmakuItems.value.slice()

  nextItems[index] = nextComment
    ? createDanmakuItem(nextComment, index)
    : createEmptyDanmakuItem(index)
  danmakuItems.value = nextItems

  if (nextComment) {
    scheduleSlot(index, getRemainingCycleMs(nextItems[index].timing))
  } else {
    clearSlotTimer(index)
  }

  requestMoreIfNeeded()
}

function requestMoreIfNeeded() {
  if (!props.enabled || props.paused || props.loading || !props.hasMore) {
    return
  }

  const threshold = Math.max(0, Number(props.prefetchThreshold) || 0)

  if (pendingComments.value.length <= threshold) {
    emit('needMore')
  }
}

function createDanmakuItem(comment, index) {
  const isHot = comment.hot || comment.likedCount >= 500
  const timing = {
    ...createDanmakuTiming(comment.content, index),
    startedAtMs: getStreamClockMs()
  }

  return {
    ...comment,
    key: `${props.song?.id ?? 'song'}-${index}`,
    hot: isHot,
    timing,
    style: createDanmakuStyle(timing, isHot, getStreamClockMs())
  }
}

function createEmptyDanmakuItem(index) {
  const timing = {
    ...createDanmakuTiming('', index),
    startedAtMs: getStreamClockMs()
  }

  return {
    id: `empty-${index}`,
    key: `${props.song?.id ?? 'song'}-${index}`,
    content: '',
    hot: false,
    empty: true,
    timing,
    style: createDanmakuStyle(timing, false, getStreamClockMs())
  }
}

function scheduleVisibleItems() {
  if (!isLayerRunning() || showingFallback) {
    return
  }

  danmakuItems.value.forEach((item, index) => {
    if (!item?.empty && !slotTimers.has(index)) {
      scheduleSlot(index, getRemainingCycleMs(item.timing))
    }
  })
}

function scheduleSlot(index, delayMs) {
  if (!isLayerRunning() || showingFallback) {
    return
  }

  clearSlotTimer(index)
  const timeout = Math.max(250, Number(delayMs) || 1000)
  const timer = window.setTimeout(() => {
    slotTimers.delete(index)
    cycleDanmakuItem(index)
  }, timeout)

  slotTimers.set(index, timer)
}

function clearSlotTimer(index) {
  const timer = slotTimers.get(index)

  if (timer) {
    window.clearTimeout(timer)
    slotTimers.delete(index)
  }
}

function clearSlotTimers() {
  slotTimers.forEach((timer) => {
    window.clearTimeout(timer)
  })
  slotTimers.clear()
}

function clearOverflowSlotTimers() {
  slotTimers.forEach((timer, index) => {
    if (index >= maxVisibleItems.value) {
      window.clearTimeout(timer)
      slotTimers.delete(index)
    }
  })
}

function isLayerRunning() {
  return Boolean(props.enabled && !props.paused && layerVisible.value)
}

function createDanmakuTiming(content, index) {
  const lane = index % laneCount
  const row = Math.floor(index / laneCount)
  const duration = 20 + (index % 5) * 2 + Math.min(6, content.length / 8)
  const top = 6 + lane * 12 + (row % 2) * 2

  return {
    lane,
    top,
    delay: 0,
    duration,
    phaseMs: 0,
    durationMs: duration * 1000,
    firstCycleMs: duration * 1000
  }
}

function createDanmakuStyle(timing, isHot, clockMs = 0) {
  const phaseMs = getDanmakuPhaseMs(timing, clockMs)

  return {
    '--danmaku-top': `${timing.top}%`,
    '--danmaku-duration': `${timing.duration.toFixed(2)}s`,
    '--danmaku-delay': `${(-phaseMs / 1000).toFixed(2)}s`,
    '--danmaku-scale': isHot ? 1.04 : 1,
    '--danmaku-lane': timing.lane
  }
}

function getRemainingCycleMs(timing) {
  if (!timing) {
    return 1000
  }

  const durationMs = getTimingDurationMs(timing)
  const phaseMs = getDanmakuPhaseMs(timing, getStreamClockMs())
  const remainingMs = durationMs - phaseMs

  return Math.max(250, remainingMs || durationMs)
}

function getDanmakuPhaseMs(timing, clockMs = 0) {
  const durationMs = getTimingDurationMs(timing)
  const currentClockMs = Math.max(0, Number(clockMs) || 0)

  if (Number.isFinite(timing?.startedAtMs)) {
    return Math.max(0, currentClockMs - timing.startedAtMs) % durationMs
  }

  const basePhaseMs = Number.isFinite(timing?.phaseMs)
    ? timing.phaseMs
    : Math.abs(Number(timing?.delay) || 0) * 1000
  const phaseMs = (basePhaseMs + currentClockMs) % durationMs

  return phaseMs < 0 ? phaseMs + durationMs : phaseMs
}

function getTimingDurationMs(timing) {
  const durationMs = Number(timing?.durationMs) || Number(timing?.duration) * 1000

  return Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 1000
}

function getCommentKey(comment) {
  return String(comment?.id ?? comment?.content ?? '').trim()
}

function clampCommentText(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()

  return text.length > 28 ? `${text.slice(0, 28)}...` : text
}
</script>
