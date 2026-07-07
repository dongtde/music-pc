<template>
  <section
    v-if="danmakuItems.length"
    ref="layerRoot"
    class="soda-danmaku"
    :class="{
      'soda-danmaku--disabled': !layerVisible,
      'soda-danmaku--paused': layerPaused
    }"
    aria-label="歌曲评论弹幕"
    :aria-hidden="!layerVisible"
    aria-live="off"
  >
    <canvas
      ref="canvasElement"
      class="soda-danmaku__canvas"
      aria-hidden="true"
    />
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
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
const launchBatchSize = computed(() => 1)
const launchIntervalMs = computed(() => {
  const value = Math.floor(Number(props.maxItems))

  return value > 36 ? 1320 : 1180
})
const launchWarmupIntervalMs = computed(() => {
  const value = Math.floor(Number(props.maxItems))

  return value > 36 ? 1800 : 1540
})
const layerVisible = ref(false)
const layerRoot = ref(null)
const canvasElement = ref(null)
const reducedMotion = ref(prefersReducedMotion())
const pageActive = ref(isPageActive())
const streamPaused = computed(() => props.paused || !pageActive.value)
const layerPaused = computed(() => streamPaused.value || !layerVisible.value)
const danmakuItems = shallowRef([])
const pendingComments = shallowRef([])
const activeLaunchSlots = ref(0)
let seenCommentKeys = new Set()
let sourceCommentsByKey = new Map()
let sourceCommentKeys = []
let showingFallback = false
const slotTimers = new Map()
let sourceSyncTimer = 0
let fillTimer = 0
let launchWarmupTimer = 0
let resumeFrame = 0
let canvasFrame = 0
let canvasResizeObserver = null
let observedCanvasRoot = null
let reducedMotionMedia = null
let streamClockMs = 0
let streamStartedAt = 0
let launchSequence = 0
let replayCursor = 0
const avatarImageCache = new Map()
let canvasSpriteCache = new WeakMap()
const canvasMetrics = {
  width: 0,
  height: 0,
  dpr: 1
}

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

  activeLaunchSlots.value = Math.min(
    maxVisibleItems.value,
    Math.max(getInitialLaunchSlotCount(), activeLaunchSlots.value || 0)
  )
  danmakuItems.value = danmakuItems.value.slice(0, maxVisibleItems.value)
  clearOverflowSlotTimers()
  clearFillTimer()
  fillDanmakuSlots()
  scheduleLaunchWarmup()
  requestMoreIfNeeded()
})

watch(
  () => [props.enabled, props.paused, pageActive.value, props.hasMore, props.loading],
  ([enabled, propPaused, active]) => {
    clearResumeFrame()

    const paused = Boolean(propPaused || !active)

    if (enabled && !paused) {
      if (layerVisible.value) {
        startStreamClock()
        scheduleSourceCommentsSync()
        scheduleVisibleItems()
        scheduleLaunchWarmup()
      } else {
        prepareStreamResume()
      }
    } else {
      pauseStreamClock()

      if (!enabled || propPaused) {
        layerVisible.value = false
      }

      clearFillTimer()
      clearLaunchWarmupTimer()
      clearSlotTimers()
    }

    requestMoreIfNeeded()
    scheduleCanvasRefresh()
  },
  { immediate: true }
)

watch(
  () => [layerVisible.value, layerPaused.value, reducedMotion.value],
  () => {
    scheduleCanvasRefresh()
  }
)

watch(
  danmakuItems,
  () => {
    scheduleCanvasRefresh()
  },
  { flush: 'post' }
)

onMounted(() => {
  if (typeof document === 'undefined') {
    return
  }

  pageActive.value = isPageActive()
  document.addEventListener('visibilitychange', handlePageActivityChange)
  window.addEventListener('blur', handlePageActivityChange)
  window.addEventListener('focus', handlePageActivityChange)
  window.addEventListener('resize', handleCanvasResize, { passive: true })
  setupReducedMotionListener()
  setupCanvasObserver()
  scheduleCanvasRefresh()
})

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handlePageActivityChange)
  }

  if (typeof window !== 'undefined') {
    window.removeEventListener('blur', handlePageActivityChange)
    window.removeEventListener('focus', handlePageActivityChange)
    window.removeEventListener('resize', handleCanvasResize)
  }

  teardownReducedMotionListener()
  teardownCanvasObserver()
  clearSourceSyncTimer()
  clearFillTimer()
  clearLaunchWarmupTimer()
  clearResumeFrame()
  clearCanvasFrame()
  clearSlotTimers()
})

function isPageActive() {
  if (typeof document === 'undefined') {
    return true
  }

  const focused = typeof document.hasFocus === 'function' ? document.hasFocus() : true

  return document.visibilityState !== 'hidden' && focused
}

function handlePageActivityChange() {
  pageActive.value = isPageActive()
}

function setupReducedMotionListener() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return
  }

  reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion.value = reducedMotionMedia.matches

  if (typeof reducedMotionMedia.addEventListener === 'function') {
    reducedMotionMedia.addEventListener('change', handleReducedMotionChange)
  } else if (typeof reducedMotionMedia.addListener === 'function') {
    reducedMotionMedia.addListener(handleReducedMotionChange)
  }
}

function teardownReducedMotionListener() {
  if (!reducedMotionMedia) {
    return
  }

  if (typeof reducedMotionMedia.removeEventListener === 'function') {
    reducedMotionMedia.removeEventListener('change', handleReducedMotionChange)
  } else if (typeof reducedMotionMedia.removeListener === 'function') {
    reducedMotionMedia.removeListener(handleReducedMotionChange)
  }

  reducedMotionMedia = null
}

function handleReducedMotionChange(event) {
  reducedMotion.value = Boolean(event.matches)
}

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
  clearLaunchWarmupTimer()
  clearResumeFrame()
  clearSlotTimers()
  resetStreamClock()
  danmakuItems.value = []
  pendingComments.value = []
  activeLaunchSlots.value = getInitialLaunchSlotCount()
  seenCommentKeys = new Set()
  sourceCommentsByKey = new Map()
  sourceCommentKeys = []
  showingFallback = false
  launchSequence = 0
  replayCursor = 0
}

function resetStreamClock() {
  streamClockMs = 0
  streamStartedAt = props.enabled && !streamPaused.value && layerVisible.value
    ? performance.now()
    : 0
}

function prepareStreamResume() {
  refreshDanmakuItemStyles(streamClockMs)
  scheduleSourceCommentsSync()

  resumeFrame = window.requestAnimationFrame(() => {
    resumeFrame = 0

    if (!props.enabled || streamPaused.value) {
      return
    }

    layerVisible.value = true
    startStreamClock()
    scheduleVisibleItems()
    scheduleLaunchWarmup()
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
    refreshDanmakuItemStyles(streamClockMs)
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
  scheduleCanvasRefresh()
}

function scheduleSourceCommentsSync() {
  clearSourceSyncTimer()

  if (!props.enabled || streamPaused.value) {
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
  if (!props.enabled || streamPaused.value) {
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
  ensureLaunchWarmup()
  fillDanmakuSlots()
  requestMoreIfNeeded()
}

function showFallbackComments() {
  const comments = createFallbackComments()
  const count = Math.min(comments.length, getCurrentLaunchSlotLimit())

  showingFallback = true
  pendingComments.value = []
  danmakuItems.value = comments.slice(0, count).map(createDanmakuItem)
  scheduleVisibleItems()
}

function enqueueComments(comments) {
  const nextComments = []

  comments.forEach((comment) => {
    const key = getCommentKey(comment)

    if (!key) {
      return
    }

    rememberSourceComment(key, comment)

    if (seenCommentKeys.has(key)) {
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
  const slotLimit = getCurrentLaunchSlotLimit()
  let filledCount = 0

  for (let index = 0; index < slotLimit && pendingComments.value.length; index += 1) {
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

  if (pendingComments.value.length && hasAvailableSlot(items, slotLimit)) {
    scheduleFillDanmakuSlots()
  } else if (pendingComments.value.length) {
    scheduleLaunchWarmup()
  }
}

function scheduleFillDanmakuSlots() {
  if (fillTimer || !props.enabled || streamPaused.value) {
    return
  }

  fillTimer = window.setTimeout(() => {
    fillTimer = 0

    if (!props.enabled || streamPaused.value) {
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

function hasAvailableSlot(items = danmakuItems.value, slotLimit = getCurrentLaunchSlotLimit()) {
  const limit = Math.min(maxVisibleItems.value, slotLimit)

  if (items.length < limit) {
    return true
  }

  return items.slice(0, limit).some((item) => !item || item.empty)
}

function ensureLaunchWarmup() {
  if (!activeLaunchSlots.value) {
    activeLaunchSlots.value = getInitialLaunchSlotCount()
  }

  scheduleLaunchWarmup()
}

function getInitialLaunchSlotCount() {
  return Math.max(1, Math.min(maxVisibleItems.value, laneCount))
}

function getCurrentLaunchSlotLimit() {
  const slotCount = Math.floor(Number(activeLaunchSlots.value))
  const fallbackCount = getInitialLaunchSlotCount()
  const nextCount = Number.isFinite(slotCount) && slotCount > 0 ? slotCount : fallbackCount

  return Math.max(1, Math.min(maxVisibleItems.value, nextCount))
}

function scheduleLaunchWarmup() {
  if (
    launchWarmupTimer ||
    showingFallback ||
    !pendingComments.value.length ||
    !props.enabled ||
    streamPaused.value ||
    getCurrentLaunchSlotLimit() >= maxVisibleItems.value
  ) {
    return
  }

  launchWarmupTimer = window.setTimeout(() => {
    launchWarmupTimer = 0

    if (!props.enabled || streamPaused.value || showingFallback) {
      return
    }

    activeLaunchSlots.value = Math.min(maxVisibleItems.value, getCurrentLaunchSlotLimit() + 1)
    fillDanmakuSlots()
  }, launchWarmupIntervalMs.value)
}

function clearLaunchWarmupTimer() {
  if (launchWarmupTimer) {
    window.clearTimeout(launchWarmupTimer)
    launchWarmupTimer = 0
  }
}

function cycleDanmakuItem(index) {
  if (showingFallback) {
    return
  }

  const nextComment = pendingComments.value.shift() ?? getReplayComment(index)
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
  if (!props.enabled || streamPaused.value || props.loading || !props.hasMore) {
    return
  }

  const threshold = Math.max(0, Number(props.prefetchThreshold) || 0)

  if (pendingComments.value.length <= threshold) {
    emit('needMore')
  }
}

function createDanmakuItem(comment, index) {
  const isHot = comment.hot || comment.likedCount >= 500
  const sourceKey = getCommentKey(comment)
  const timing = {
    ...createDanmakuTiming(comment.content, index),
    startedAtMs: getStreamClockMs()
  }

  return {
    ...comment,
    key: createLaunchKey(index),
    sourceKey,
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
    key: createLaunchKey(index),
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
  return Boolean(props.enabled && !streamPaused.value && layerVisible.value)
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
  const durationMs = getTimingDurationMs(timing)
  const progress = durationMs > 0 ? phaseMs / durationMs : 0
  const pausedVw = 18 - 138 * progress
  const pausedPercent = 100 * progress

  return {
    '--danmaku-top': `${timing.top}%`,
    '--danmaku-duration': `${timing.duration.toFixed(2)}s`,
    '--danmaku-delay': `${(-phaseMs / 1000).toFixed(2)}s`,
    '--danmaku-paused-x': `calc(${pausedVw.toFixed(4)}vw - ${pausedPercent.toFixed(4)}%)`,
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

function scheduleCanvasRefresh() {
  if (typeof window === 'undefined') {
    return
  }

  nextTick(() => {
    setupCanvasObserver()
    requestCanvasFrame()
  })
}

function requestCanvasFrame() {
  if (canvasFrame || !canvasElement.value) {
    return
  }

  canvasFrame = window.requestAnimationFrame(renderCanvasFrame)
}

function renderCanvasFrame() {
  canvasFrame = 0
  drawDanmakuCanvas()

  if (shouldRunCanvasLoop()) {
    requestCanvasFrame()
  }
}

function shouldRunCanvasLoop() {
  return Boolean(
    canvasElement.value &&
    danmakuItems.value.length &&
    props.enabled &&
    layerVisible.value &&
    !streamPaused.value &&
    !reducedMotion.value
  )
}

function clearCanvasFrame() {
  if (typeof window === 'undefined') {
    return
  }

  if (canvasFrame) {
    window.cancelAnimationFrame(canvasFrame)
    canvasFrame = 0
  }
}

function setupCanvasObserver() {
  const root = layerRoot.value

  if (!root || typeof ResizeObserver === 'undefined') {
    return
  }

  if (observedCanvasRoot === root && canvasResizeObserver) {
    return
  }

  teardownCanvasObserver()

  canvasResizeObserver = new ResizeObserver(() => {
    handleCanvasResize()
  })
  canvasResizeObserver.observe(root)
  observedCanvasRoot = root
}

function teardownCanvasObserver() {
  canvasResizeObserver?.disconnect()
  canvasResizeObserver = null
  observedCanvasRoot = null
}

function handleCanvasResize() {
  resizeCanvas(true)
  requestCanvasFrame()
}

function resizeCanvas(force = false) {
  const canvas = canvasElement.value
  const root = layerRoot.value

  if (!canvas || !root) {
    return false
  }

  const rect = root.getBoundingClientRect()
  const width = Math.max(1, Math.round(rect.width))
  const height = Math.max(1, Math.round(rect.height))
  const dpr = getCanvasPixelRatio()
  const pixelWidth = Math.round(width * dpr)
  const pixelHeight = Math.round(height * dpr)

  if (
    !force &&
    canvas.width === pixelWidth &&
    canvas.height === pixelHeight &&
    canvasMetrics.dpr === dpr
  ) {
    return false
  }

  canvas.width = pixelWidth
  canvas.height = pixelHeight
  canvasMetrics.width = width
  canvasMetrics.height = height
  canvasMetrics.dpr = dpr

  const context = canvas.getContext('2d')

  if (context) {
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
  }

  return true
}

function drawDanmakuCanvas() {
  const canvas = canvasElement.value

  if (!canvas) {
    return
  }

  resizeCanvas()

  const context = canvas.getContext('2d')
  const width = canvasMetrics.width
  const height = canvasMetrics.height

  if (!context || !width || !height) {
    return
  }

  context.clearRect(0, 0, width, height)

  if (!layerVisible.value || !danmakuItems.value.length) {
    return
  }

  const clockMs = getStreamClockMs()

  danmakuItems.value.forEach((item) => {
    if (!item || item.empty || !item.timing) {
      return
    }

    drawDanmakuItem(context, item, clockMs, width, height)
  })
}

function drawDanmakuItem(context, item, clockMs, width, height) {
  const sprite = getDanmakuSprite(context, item)

  if (!sprite) {
    return
  }

  const layout = sprite.layout
  const position = getCanvasItemPosition(item, layout, clockMs, width, height)

  if (
    position.x > width + layout.width ||
    position.x + layout.width < -layout.width ||
    position.y > height + layout.height ||
    position.y + layout.height < -layout.height
  ) {
    return
  }

  const drawX = position.x - sprite.margin
  const drawY = Math.round(position.y - sprite.margin)

  context.drawImage(
    sprite.canvas,
    drawX,
    drawY,
    sprite.width,
    sprite.height
  )
}

function getDanmakuSprite(context, item) {
  if (typeof document === 'undefined') {
    return null
  }

  const image = getAvatarImage(item.avatarUrl)
  const avatarReady = Boolean(image?.complete && image.naturalWidth > 0)
  const dpr = canvasMetrics.dpr || 1
  const maxWidth = getCanvasItemMaxWidth()
  const cacheKey = [
    maxWidth,
    dpr,
    item.content,
    item.hot ? 'hot' : 'normal',
    item.fallback ? 'fallback' : 'source',
    item.avatarUrl || '',
    avatarReady ? 'avatar-ready' : 'avatar-fallback',
    item.avatarText || ''
  ].join('|')
  const cached = canvasSpriteCache.get(item)

  if (cached?.cacheKey === cacheKey) {
    return cached
  }

  const layout = measureDanmakuItem(context, item, maxWidth)
  const margin = item.hot ? 28 : 24
  const spriteWidth = layout.width + margin * 2
  const spriteHeight = layout.height + margin * 2
  const spriteCanvas = document.createElement('canvas')

  spriteCanvas.width = Math.ceil(spriteWidth * dpr)
  spriteCanvas.height = Math.ceil(spriteHeight * dpr)

  const spriteContext = spriteCanvas.getContext('2d')

  if (!spriteContext) {
    return null
  }

  spriteContext.setTransform(dpr, 0, 0, dpr, 0, 0)
  spriteContext.imageSmoothingEnabled = true
  spriteContext.imageSmoothingQuality = 'high'
  spriteContext.translate(margin, margin)
  drawDanmakuBubble(spriteContext, item, layout)
  drawDanmakuAvatar(spriteContext, item, layout)
  drawDanmakuText(spriteContext, item, layout)

  const sprite = {
    cacheKey,
    canvas: spriteCanvas,
    height: spriteHeight,
    layout,
    margin,
    width: spriteWidth
  }

  canvasSpriteCache.set(item, sprite)

  return sprite
}

function measureDanmakuItem(context, item, maxWidth = getCanvasItemMaxWidth()) {
  const height = 34
  const leftPadding = 7
  const rightPadding = 14
  const avatarSize = 22
  const avatarGap = 8
  const textStart = leftPadding + avatarSize + avatarGap
  const textMaxWidth = Math.max(30, maxWidth - textStart - rightPadding)

  context.font = getDanmakuFont()

  const text = fitCanvasText(context, item.content, textMaxWidth)
  const textWidth = Math.ceil(context.measureText(text).width)
  const width = Math.min(maxWidth, textStart + textWidth + rightPadding)

  return {
    avatarGap,
    avatarSize,
    height,
    leftPadding,
    rightPadding,
    text,
    textMaxWidth,
    textStart,
    width
  }
}

function getCanvasItemMaxWidth() {
  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth

  return viewportWidth <= 1160
    ? Math.min(viewportWidth * 0.5, 360)
    : Math.min(viewportWidth * 0.44, 480)
}

function getCanvasPixelRatio() {
  return 1
}

function getCanvasItemPosition(item, layout, clockMs, width, height) {
  const top = Math.max(0, Math.min(height - layout.height, height * (Number(item.timing.top) || 0) / 100))

  if (reducedMotion.value) {
    return {
      x: Math.max(0, width - layout.width - 12 - (Number(item.timing.lane) || 0) * 10),
      y: top
    }
  }

  const phaseMs = getDanmakuPhaseMs(item.timing, clockMs)
  const durationMs = getTimingDurationMs(item.timing)
  const progress = durationMs > 0 ? phaseMs / durationMs : 0
  const viewportWidth = typeof window === 'undefined' ? width : window.innerWidth
  const startX = width + viewportWidth * 0.18
  const endX = width - viewportWidth * 1.2 - layout.width

  return {
    x: startX + (endX - startX) * progress,
    y: top
  }
}

function drawDanmakuBubble(context, item, layout) {
  const radius = layout.height / 2

  context.save()
  context.shadowColor = item.hot
    ? 'rgba(0, 0, 0, 0.28)'
    : 'rgba(0, 0, 0, 0.24)'
  context.shadowBlur = item.hot ? 18 : 14
  context.shadowOffsetY = 10
  createRoundedRectPath(context, 0, 0, layout.width, layout.height, radius)

  if (item.hot) {
    const gradient = context.createLinearGradient(0, 0, layout.width, 0)
    gradient.addColorStop(0, 'rgba(49, 194, 124, 0.38)')
    gradient.addColorStop(0.58, 'rgba(8, 8, 10, 0.38)')
    gradient.addColorStop(1, 'rgba(8, 8, 10, 0.34)')
    context.fillStyle = gradient
  } else {
    context.fillStyle = item.fallback
      ? 'rgba(10, 10, 12, 0.34)'
      : 'rgba(10, 10, 12, 0.42)'
  }

  context.fill()
  context.restore()

  context.save()
  createRoundedRectPath(context, 0.5, 0.5, layout.width - 1, layout.height - 1, radius)
  context.strokeStyle = item.hot
    ? 'rgba(49, 194, 124, 0.34)'
    : 'rgba(255, 255, 255, 0.14)'
  context.lineWidth = 1
  context.stroke()
  context.restore()
}

function drawDanmakuAvatar(context, item, layout) {
  const x = layout.leftPadding
  const y = (layout.height - layout.avatarSize) / 2
  const radius = layout.avatarSize / 2
  const image = getAvatarImage(item.avatarUrl)

  context.save()
  context.beginPath()
  context.arc(x + radius, y + radius, radius, 0, Math.PI * 2)
  context.closePath()
  context.clip()

  if (image?.complete && image.naturalWidth > 0) {
    context.drawImage(image, x, y, layout.avatarSize, layout.avatarSize)
  } else {
    const gradient = context.createLinearGradient(x, y, x + layout.avatarSize, y + layout.avatarSize)
    gradient.addColorStop(0, item.hot ? 'rgba(49, 194, 124, 0.86)' : 'rgba(255, 255, 255, 0.2)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.12)')
    context.fillStyle = gradient
    context.fillRect(x, y, layout.avatarSize, layout.avatarSize)
  }

  context.restore()

  if (!image?.complete || image.naturalWidth <= 0) {
    context.save()
    context.font = '900 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    context.fillStyle = 'rgba(255, 255, 255, 0.88)'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(item.avatarText || String(item.userName || '?').slice(0, 1), x + radius, y + radius + 0.5)
    context.restore()
  }
}

function drawDanmakuText(context, item, layout) {
  context.save()
  context.font = getDanmakuFont()
  context.fillStyle = item.hot ? '#ffffff' : 'rgba(255, 255, 255, 0.9)'
  context.textAlign = 'left'
  context.textBaseline = 'middle'
  context.shadowColor = 'rgba(0, 0, 0, 0.42)'
  context.shadowBlur = 3
  context.shadowOffsetY = 1
  context.fillText(layout.text, layout.textStart, layout.height / 2 + 0.5)
  context.restore()
}

function getAvatarImage(url) {
  if (!url) {
    return null
  }

  const cached = avatarImageCache.get(url)

  if (cached) {
    return cached
  }

  const image = new Image()

  image.decoding = 'async'
  image.onload = () => {
    canvasSpriteCache = new WeakMap()
    requestCanvasFrame()
  }
  image.onerror = () => {
    requestCanvasFrame()
  }
  image.src = url
  avatarImageCache.set(url, image)

  return image
}

function fitCanvasText(context, value, maxWidth) {
  const text = String(value ?? '')

  if (context.measureText(text).width <= maxWidth) {
    return text
  }

  const ellipsis = '...'
  let start = 0
  let end = text.length
  let fitted = ellipsis

  while (start <= end) {
    const midpoint = Math.floor((start + end) / 2)
    const candidate = `${text.slice(0, midpoint)}${ellipsis}`

    if (context.measureText(candidate).width <= maxWidth) {
      fitted = candidate
      start = midpoint + 1
    } else {
      end = midpoint - 1
    }
  }

  return fitted
}

function createRoundedRectPath(context, x, y, width, height, radius) {
  const nextRadius = Math.min(radius, width / 2, height / 2)

  context.beginPath()
  context.moveTo(x + nextRadius, y)
  context.lineTo(x + width - nextRadius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + nextRadius)
  context.lineTo(x + width, y + height - nextRadius)
  context.quadraticCurveTo(x + width, y + height, x + width - nextRadius, y + height)
  context.lineTo(x + nextRadius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - nextRadius)
  context.lineTo(x, y + nextRadius)
  context.quadraticCurveTo(x, y, x + nextRadius, y)
  context.closePath()
}

function getDanmakuFont() {
  return '800 13px "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
}

function rememberSourceComment(key, comment) {
  if (!sourceCommentsByKey.has(key)) {
    sourceCommentKeys.push(key)
  }

  sourceCommentsByKey.set(key, comment)
}

function getReplayComment(index) {
  if (!sourceCommentKeys.length) {
    return null
  }

  const currentKey = danmakuItems.value[index]?.sourceKey

  for (let attempt = 0; attempt < sourceCommentKeys.length; attempt += 1) {
    const key = sourceCommentKeys[replayCursor % sourceCommentKeys.length]
    replayCursor = (replayCursor + 1) % sourceCommentKeys.length

    if (sourceCommentKeys.length > 1 && key === currentKey) {
      continue
    }

    const comment = sourceCommentsByKey.get(key)

    if (comment) {
      return comment
    }
  }

  return null
}

function createLaunchKey(index) {
  launchSequence += 1

  return `${props.song?.id ?? 'song'}-${index}-${launchSequence}`
}

function getCommentKey(comment) {
  return String(comment?.id ?? comment?.content ?? '').trim()
}

function clampCommentText(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()

  return text.length > 28 ? `${text.slice(0, 28)}...` : text
}

function prefersReducedMotion() {
  return Boolean(
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
</script>
