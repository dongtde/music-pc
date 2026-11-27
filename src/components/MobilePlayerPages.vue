<template>
  <div
    ref="playerRoot"
    class="mobile-full-player"
    :class="{ 'mobile-full-player--page-motion': pageDragging || pageAnimating }"
    :data-page="renderedPage"
    :data-page-preview="previewPage"
    :data-page-phase="pageAnimating ? 'settling' : pageDragging ? 'dragging' : 'idle'"
    @pointerdown.capture="startSwipe"
    @pointermove.capture="moveSwipe"
    @pointerup.capture="finishSwipe"
    @pointercancel="cancelSwipe"
    @lostpointercapture.self="cancelSwipe"
    @click.capture="suppressSwipeClick"
    @wheel="handleSongWheel"
  >
    <nav class="mobile-full-player__tabs" aria-label="播放器页面">
      <button
        v-for="(item, index) in pages"
        :key="item.id"
        type="button"
        :class="{ active: renderedPage === item.id }"
        :aria-label="item.label"
        :aria-pressed="renderedPage === item.id"
        @click="selectPage(index)"
        @keydown.right.prevent="selectPage(index + 1)"
        @keydown.left.prevent="selectPage(index - 1)"
      ><span /></button>
    </nav>

    <MobilePlayerBackground
      :ref="setPlayerBackground"
      :track="track"
      :previous-track="previousTrack"
      :next-track="nextTrack"
      :page="renderedPage"
      :page-preview="previewPage"
      :allow-song-swipe="renderedPage === 'cover'"
    />
    <div class="mobile-full-player__artwork" aria-hidden="true">
      <div
        v-for="layer in artworkLayers"
        :key="layer.key"
        class="mobile-full-player__artwork-layer"
        :data-track-id="layer.track.id"
        :style="artworkLayerStyle(layer)"
      >
        <img v-if="layer.track.coverUrl" :src="layer.track.coverUrl" alt="" decoding="async" />
        <Music2 v-else :size="96" />
      </div>
    </div>
    <div class="mobile-full-player__pager">
      <div ref="pageStrip" class="mobile-full-player__page-strip" :style="{ transform: pageTransform(pageIndex, pageOffset) }">
        <section
          v-for="(scene, index) in pages"
          :key="scene.id"
          class="mobile-full-player__scene"
          :data-scene="scene.id"
          :aria-label="scene.label"
          :aria-hidden="scene.id !== renderedPage"
          :inert="scene.id !== renderedPage"
        >
          <template v-if="isSceneRendered(index)">
            <div class="mobile-full-player__page-foreground">
              <section class="mobile-full-player__content" :class="{ 'mobile-full-player__content--cover': scene.id === 'cover' }">
                <header class="mobile-full-player__track">
                  <div class="mobile-full-player__identity">
                    <h1>{{ track.name }}</h1>
                    <p>{{ track.artist }}</p>
                  </div>
                  <button
                    class="mobile-full-player__like"
                    :class="{ active: liked }"
                    type="button"
                    :aria-label="liked ? '取消喜欢' : '喜欢这首歌'"
                    :aria-pressed="liked"
                    @click="$emit('toggle-like')"
                  ><Heart :size="29" :fill="liked ? 'currentColor' : 'none'" /></button>
                </header>

                <div v-if="scene.id === 'cover'" class="mobile-full-player__details">
                  <p v-if="track.album" class="mobile-full-player__album">{{ track.album }}</p>
                  <button class="mobile-full-player__lyric-preview" type="button" aria-label="查看歌词" @click="selectPage(getPlayerPageIndex('lyrics'))">
                    <span>{{ previewLyric || '查看歌词' }}</span><ChevronRight :size="17" />
                  </button>
                </div>

                <LyricsScroller
                  v-else-if="scene.id === 'lyrics'"
                  :ref="setLyricsScroller"
                  class="mobile-full-player__lyrics"
                  variant="full"
                  vertical-drag-only
                  :lines="lines"
                  :active-index="activeIndex"
                  :current-time="currentTime"
                  :playing="playing && scene.id === renderedPage"
                  :seekable="scene.id === renderedPage"
                  require-seekable
                  @seek="handleLyricSeek($event, scene.id)"
                />

                <div v-else class="mobile-full-player__danmaku-stage" aria-label="歌曲弹幕">
                  <DanmakuLayer
                    v-if="danmakuEnabled && hasComments"
                    class="mobile-full-player__danmaku"
                    :enabled="danmakuActive"
                    :paused="!playing"
                    :song="track"
                    :hot-comments="hotComments"
                    :comments="comments"
                    :max-items="18"
                    :lanes="6"
                    :has-more="hasMore"
                    :loading="loading"
                    :prefetch-threshold="12"
                    @need-more="$emit('need-more')"
                  />
                  <div v-if="!danmakuEnabled || !hasComments || !playing" class="mobile-full-player__empty" role="status">
                    <MessageSquare :size="32" :stroke-width="1.3" />
                    <p>{{ !danmakuEnabled ? '弹幕已关闭' : hasComments && !playing ? '播放后显示歌曲弹幕' : loading ? '正在加载歌曲弹幕…' : error ? '弹幕暂时无法加载' : '这首歌还没有评论弹幕' }}</p>
                    <button v-if="!danmakuEnabled" type="button" @click="$emit('toggle-danmaku')">开启弹幕</button>
                    <button v-else-if="error" type="button" @click="$emit('retry-danmaku')">重新加载</button>
                  </div>
                </div>
              </section>
            </div>
          </template>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ChevronRight, Heart, MessageSquare, Music2 } from 'lucide-vue-next'
import LyricsScroller from './LyricsScroller.vue'
import MobilePlayerBackground from './MobilePlayerBackground.vue'
import { getPlayerSwipeAction, getPlayerSwipeAxis, getPlayerPageIndex, getPlayerPageDragOffset, MOBILE_PLAYER_PAGES } from '../utils/mobilePlayerSwipe'

const DanmakuLayer = defineAsyncComponent(() => import('./DanmakuLayer.vue'))
const props = defineProps({
  page: { type: String, default: 'cover' },
  track: { type: Object, required: true },
  previousTrack: { type: Object, default: null },
  nextTrack: { type: Object, default: null },
  transportElement: { type: Object, default: null },
  liked: { type: Boolean, default: false },
  lines: { type: Array, default: () => [] },
  activeIndex: { type: Number, default: 0 },
  currentTime: { type: Number, default: 0 },
  playing: { type: Boolean, default: false },
  canChangeTrack: { type: Boolean, default: false },
  trackLoading: { type: Boolean, default: false },
  danmakuEnabled: { type: Boolean, default: true },
  danmakuActive: { type: Boolean, default: false },
  hotComments: { type: Array, default: () => [] },
  comments: { type: Array, default: () => [] },
  hasMore: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' }
})
const emit = defineEmits(['update:page', 'toggle-like', 'seek', 'need-more', 'toggle-danmaku', 'retry-danmaku', 'swipe-next', 'swipe-previous'])
const pages = MOBILE_PLAYER_PAGES
const normalizedPage = page => pages[getPlayerPageIndex(page)].id
const renderedPage = ref(normalizedPage(props.page))
const pageIndex = computed(() => getPlayerPageIndex(renderedPage.value))
const pageOffset = ref(0)
const previewIndex = ref(null)
const previewPage = computed(() => pages[previewIndex.value ?? pageIndex.value].id)
const pageDragging = ref(false)
const pageAnimating = ref(false)
const pageBusy = computed(() => pageDragging.value || pageAnimating.value)
const previewLyric = computed(() => {
  const line = props.lines[props.activeIndex]
  return line && !line.placeholder ? line.text : ''
})
const hasComments = computed(() => [...props.hotComments, ...props.comments].some(comment => String(comment?.content ?? '').trim()))
const playerRoot = ref(null)
const pageStrip = ref(null)
const lyricsScroller = ref(null)
const playerBackground = ref(null)
const artworkLayers = computed(() => playerBackground.value?.layers ?? [{ key: 'initial-cover', slot: 0, track: props.track }])
const artworkOffset = computed(() => playerBackground.value?.offset ?? 0)
const artworkHeight = computed(() => playerBackground.value?.height ?? 0)
const artworkSettleDuration = computed(() => playerBackground.value?.settleDuration ?? 0)
let swipe = null
let suppressClickUntil = 0
let wheelDelta = 0
let lastWheelAt = 0
let lastWheelSwitchAt = 0
let pageAnimation = null
let transportAnimation = null
let pageGeneration = 0
let resizeObserver = null
let alive = true

function setPlayerBackground(instance) { playerBackground.value = instance }
function setLyricsScroller(instance) { lyricsScroller.value = instance }
function pageTransform(index, offset = 0) { return `translate3d(calc(${-index * 100}% + ${offset}px), 0, 0)` }
function transportTransform(offset = 0) { return `translate3d(${offset}px, 0, 0)` }
function artworkLayerStyle(layer) {
  const duration = artworkSettleDuration.value
  return {
    transform: `translate3d(0, ${layer.slot * artworkHeight.value + artworkOffset.value}px, 0)`,
    transition: duration ? `transform ${duration}ms cubic-bezier(.22, 1, .36, 1)` : 'none'
  }
}
function isSceneRendered(index) {
  const target = previewIndex.value ?? pageIndex.value
  return index >= Math.min(pageIndex.value, target) && index <= Math.max(pageIndex.value, target)
}
function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
function getTransportElement() {
  const value = props.transportElement
  return value?.value ?? value
}
function setTransportOffset(offset) {
  const element = getTransportElement()
  if (!element) return
  element.style.transform = transportTransform(offset)
  element.style.pointerEvents = 'none'
  element.classList.add('player--page-motion')
}
function clearTransportMotion() {
  const element = getTransportElement()
  if (!element) return
  element.style.transform = ''
  element.style.opacity = ''
  element.style.pointerEvents = ''
  element.classList.remove('player--page-motion')
}
function resetPageTransition(page = props.page) {
  pageGeneration += 1
  pageAnimation?.cancel()
  transportAnimation?.cancel()
  pageAnimation = null
  transportAnimation = null
  renderedPage.value = normalizedPage(page)
  pageOffset.value = 0
  previewIndex.value = null
  pageDragging.value = false
  pageAnimating.value = false
  clearTransportMotion()
}

watch([() => props.page, () => props.track.id], async ([page, trackId], previous = []) => {
  const previousTrackId = previous[1]
  const acknowledgedPage = pageAnimating.value
    && String(trackId) === String(previousTrackId)
    && normalizedPage(page) === renderedPage.value
  if (acknowledgedPage) {
    await nextTick()
    lyricsScroller.value?.resetInteraction()
    lyricsScroller.value?.refreshLayout('auto')
    return
  }
  cancelSwipe({ resetPages: false })
  resetPageTransition()
  wheelDelta = 0
  await nextTick()
  lyricsScroller.value?.resetInteraction()
  lyricsScroller.value?.refreshLayout('auto')
}, { immediate: true })

watch([() => props.page, () => props.danmakuEnabled], () => {
  if (props.page === 'danmaku' && props.danmakuEnabled && props.hasMore && !hasComments.value && !props.loading && !props.error) emit('need-more')
}, { immediate: true })

function selectPage(index) {
  if (pageAnimating.value || playerBackground.value?.busy) return
  cancelSwipe({ resetPages: false })
  void settlePage(index)
}

async function settlePage(index) {
  if (!alive || pageAnimating.value || playerBackground.value?.busy) return
  const source = pageIndex.value
  const target = Math.max(0, Math.min(pages.length - 1, index))
  if (target === source && pageOffset.value === 0) {
    previewIndex.value = null
    pageDragging.value = false
    return
  }
  if (target !== source || previewIndex.value === null) previewIndex.value = target
  pageDragging.value = false
  pageAnimating.value = true
  const token = ++pageGeneration
  await nextTick()
  if (!alive || token !== pageGeneration || !pageStrip.value) return
  const element = pageStrip.value
  const transport = getTransportElement()
  const width = playerRoot.value?.clientWidth ?? window.innerWidth
  const destination = pageTransform(target)
  const destinationOffset = (source - target) * width
  const duration = reducedMotion() ? 0 : target === source ? 200 : 300
  const easing = 'cubic-bezier(.22, 1, .36, 1)'
  const running = duration ? element.animate?.(
    [{ transform: pageTransform(source, pageOffset.value) }, { transform: destination }],
    { duration, easing, fill: 'forwards' }
  ) : null
  const leaving = duration && target !== source && transport?.animate
    ? transport.animate(
      [
        { transform: transportTransform(pageOffset.value), opacity: 1 },
        { transform: transportTransform(destinationOffset), opacity: 0 }
      ],
      { duration, easing, fill: 'forwards' }
    )
    : null
  pageAnimation = running ?? null
  transportAnimation = leaving ?? null
  if (transport) {
    transport.style.pointerEvents = 'none'
    transport.classList.add('player--page-motion')
  }
  if (running || leaving) {
    try { await Promise.all([running?.finished, leaving?.finished].filter(Boolean)) } catch { return }
    if (!alive || token !== pageGeneration) return
  }
  element.style.transform = destination
  running?.cancel()
  pageAnimation = null
  if (transport) {
    transport.style.transform = transportTransform(destinationOffset)
    transport.style.opacity = target === source ? '1' : '0'
    leaving?.cancel()
    transportAnimation = null
  }
  pageOffset.value = 0
  renderedPage.value = pages[target].id
  if (target !== source) emit('update:page', pages[target].id)
  await nextTick()
  if (!alive || token !== pageGeneration) return
  if (normalizedPage(props.page) !== pages[target].id) {
    resetPageTransition()
    return
  }
  if (transport?.animate && target !== source && duration) {
    const enteringOffset = (target - source) * width
    const entering = transport.animate(
      [
        { transform: transportTransform(enteringOffset), opacity: 0 },
        { transform: transportTransform(0), opacity: 1 }
      ],
      { duration: 190, easing, fill: 'forwards' }
    )
    transportAnimation = entering
    try { await entering.finished } catch { return }
    if (!alive || token !== pageGeneration) return
    transport.style.transform = ''
    transport.style.opacity = ''
    transport.style.pointerEvents = ''
    transport.classList.remove('player--page-motion')
    entering.cancel()
    transportAnimation = null
  } else clearTransportMotion()
  previewIndex.value = null
  pageAnimating.value = false
  lyricsScroller.value?.resetInteraction()
  lyricsScroller.value?.refreshLayout('auto')
}

function startSwipe(event) {
  if (event.pointerType !== 'touch' || event.isPrimary === false || event.button > 0 || pageBusy.value || playerBackground.value?.busy) return
  const control = event.target.closest?.('button, a, input, [role="slider"]')
  if (control && !control.classList.contains('full-player__lyric-line')) return
  swipe = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dy: 0, axis: null, element: event.currentTarget }
}

function moveSwipe(event) {
  if (!swipe || swipe.id !== event.pointerId) return
  const dx = event.clientX - swipe.x
  const dy = event.clientY - swipe.y
  if (!swipe.axis) {
    const axis = getPlayerSwipeAxis(dx, dy, { page: renderedPage.value, canChangeTrack: props.canChangeTrack, trackLoading: props.trackLoading })
    if (axis === 'scroll') { cancelSwipe(); return }
    if (!axis) return
    swipe.axis = axis
    if (axis === 'horizontal') {
      pageDragging.value = true
      lyricsScroller.value?.resetInteraction()
    }
    if (event.isTrusted) swipe.element.setPointerCapture(event.pointerId)
  }
  swipe.dx = dx
  swipe.dy = dy
  if (swipe.axis === 'vertical') playerBackground.value?.drag(dy)
  else {
    previewIndex.value = Math.max(0, Math.min(pages.length - 1, pageIndex.value + (dx < 0 ? 1 : -1)))
    pageOffset.value = reducedMotion() ? 0 : getPlayerPageDragOffset(renderedPage.value, dx, swipe.element.clientWidth)
    setTransportOffset(pageOffset.value)
  }
  event.preventDefault()
  event.stopPropagation()
}

function finishSwipe(event) {
  if (!swipe || swipe.id !== event.pointerId) return
  const current = swipe
  const action = getPlayerSwipeAction({ axis: current.axis, dx: current.dx, dy: current.dy, width: current.element.clientWidth, height: current.element.clientHeight })
  cancelSwipe({ resetBackground: false, resetPages: false })
  if (current.axis) {
    if (current.axis === 'horizontal') {
      const direction = action === 'next-page' ? 1 : action === 'previous-page' ? -1 : 0
      void settlePage(pageIndex.value + direction)
    } else void finishSongSwipe(action)
    suppressClickUntil = Date.now() + 500
    lyricsScroller.value?.resetInteraction()
    event.preventDefault()
    event.stopPropagation()
  }
}

function cancelSwipe({ resetBackground = true, resetPages = true } = {}) {
  const previous = swipe
  swipe = null
  if (previous?.element.hasPointerCapture?.(previous.id)) previous.element.releasePointerCapture(previous.id)
  if (resetBackground && previous?.axis === 'vertical') void playerBackground.value?.cancel()
  if (resetPages && previous?.axis === 'horizontal') void settlePage(pageIndex.value)
}

async function finishSongSwipe(action) {
  if (renderedPage.value !== 'cover' || !props.canChangeTrack || props.trackLoading || pageBusy.value) {
    await playerBackground.value?.cancel()
    return
  }
  const direction = action === 'next-song' ? 1 : action === 'previous-song' ? -1 : 0
  const request = await playerBackground.value?.finish(direction)
  if (!request) return
  if (renderedPage.value === 'cover' && props.canChangeTrack && !props.trackLoading && !pageBusy.value) {
    emit(direction > 0 ? 'swipe-next' : 'swipe-previous', request)
  } else void request.complete(false)
}

function handleLyricSeek(event, scene) {
  if (scene === renderedPage.value && !pageBusy.value) emit('seek', event)
}
function suppressSwipeClick(event) {
  if (Date.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation() }
}
function handleSongWheel(event) {
  if (renderedPage.value !== 'cover' || !props.canChangeTrack || props.trackLoading || pageBusy.value || playerBackground.value?.busy || event.defaultPrevented
    || event.target.closest?.('button, a, input, [role="slider"]')
    || Math.abs(event.deltaY) <= Math.abs(event.deltaX) * 1.4) return
  event.preventDefault()
  const now = Date.now()
  if (now - lastWheelSwitchAt < 900) return
  if (now - lastWheelAt > 180) wheelDelta = 0
  lastWheelAt = now
  wheelDelta += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? event.currentTarget.clientHeight : 1)
  if (Math.abs(wheelDelta) < 48) return
  void finishSongSwipe(wheelDelta > 0 ? 'next-song' : 'previous-song')
  wheelDelta = 0
  lastWheelSwitchAt = now
}

onMounted(() => {
  if (typeof ResizeObserver === 'undefined') return
  let width = playerRoot.value.clientWidth
  let height = playerRoot.value.clientHeight
  resizeObserver = new ResizeObserver(() => {
    const nextWidth = playerRoot.value?.clientWidth ?? width
    const nextHeight = playerRoot.value?.clientHeight ?? height
    if (Math.abs(nextWidth - width) > 1 || Math.abs(nextHeight - height) > 1) {
      cancelSwipe({ resetPages: false })
      resetPageTransition()
    }
    width = nextWidth
    height = nextHeight
  })
  resizeObserver.observe(playerRoot.value)
})
onBeforeUnmount(() => {
  alive = false
  resizeObserver?.disconnect()
  cancelSwipe({ resetPages: false })
  resetPageTransition()
})
</script>
