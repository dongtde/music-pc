<template>
  <div class="view home-view">
    <section class="soda-feed" aria-label="主页推荐听歌">
      <nav
        class="soda-feed__tabs"
        aria-label="推荐口味"
        :style="{ '--active-tab-index': activeMoodIndex }"
      >
        <button
          v-for="mood in moods"
          :key="mood.value"
          type="button"
          :class="{ active: activeMood === mood.value }"
          @click="setMood(mood.value)"
        >
          {{ mood.label }}
        </button>
      </nav>

      <div
        ref="feedScroller"
        class="soda-feed__scroller"
        :class="{ 'soda-feed__scroller--dragging': feedDragging }"
        tabindex="0"
        @scroll="handleFeedScroll"
        @keydown="handleFeedKeydown"
        @pointerdown="startFeedDrag"
        @pointermove="handleFeedPointerMove"
        @pointerup="stopFeedDrag"
        @pointerleave="stopFeedDrag"
        @pointercancel="stopFeedDrag"
      >
        <article
          v-for="(song, index) in recommendationQueue"
          :key="song.id"
          class="soda-slide"
          :class="{
            active: index === activeIndex,
            'soda-slide--light': !isSlideHydrated(index)
          }"
          :style="getSlideStyle(song, index)"
          :aria-label="`${song.name} - ${song.artist}`"
        >
          <template v-if="isSlideHydrated(index)">
          <div class="soda-slide__backdrop" aria-hidden="true">
            <img
              v-if="song.coverUrl"
              :src="song.coverUrl"
              alt=""
              :loading="index === activeIndex ? 'eager' : 'lazy'"
              :fetchpriority="index === activeIndex ? 'high' : 'low'"
              decoding="async"
            />
            <span v-else class="soda-slide__fallback" :class="`cover--${song.type}`" />
          </div>

          <div class="soda-slide__player">
            <div class="soda-slide__visual" aria-hidden="true">
              <span class="soda-slide__disc" :class="{ 'soda-slide__disc--playing': isSongPlaying(song) }" />
              <span class="soda-slide__cover" :class="`cover--${song.type}`">
                <img
                  v-if="song.coverUrl"
                  :src="song.coverUrl"
                  :alt="song.name"
                  :loading="index === activeIndex ? 'eager' : 'lazy'"
                  :fetchpriority="index === activeIndex ? 'high' : 'low'"
                  decoding="async"
                />
              </span>
            </div>

            <section class="soda-slide__caption">
              <div class="soda-slide__tag-row">
                <span class="soda-slide__kicker">
                  <AudioLines :size="16" />
                  {{ getMoodSignal(index) }}
                </span>
                <span v-if="song.vip" class="soda-slide__meta-tag">VIP</span>
                <span v-if="song.hasVideo" class="soda-slide__meta-tag">视频</span>
              </div>
              <h1>{{ song.name }}</h1>
              <p>{{ song.artist }}<span v-if="song.album"> · {{ song.album }}</span></p>
              <div class="soda-slide__position" aria-hidden="true">
                <ChevronUp :size="14" />
                <span>{{ song.rank }} / {{ recommendationQueue.length }}</span>
                <ChevronDown :size="14" />
              </div>
            </section>
          </div>

          <section
            v-if="index === activeIndex"
            class="soda-lyrics-panel"
            :class="{
              'soda-lyrics-panel--dragging': lyricsDragging,
              'soda-lyrics-panel--wheeling': lyricsWheeling,
              'soda-lyrics-panel--previewing': lyricsInteractionActive
            }"
            aria-label="歌词"
            :aria-busy="isLyricLoading"
          >
            <div
              v-if="hasLyricContent && lyricsInteractionActive && previewLyric"
              class="soda-lyric-guide"
            >
              <span class="soda-lyric-guide__time">{{ previewLyric.time }}</span>
              <span class="soda-lyric-guide__line" />
              <button
                class="soda-lyric-guide__play"
                type="button"
                :disabled="previewLyric.placeholder"
                aria-label="跳转到选中歌词"
                @click.stop="seekToPreviewLyric"
              >
                <Play :size="13" fill="currentColor" />
              </button>
            </div>

            <div
              ref="lyricsScroll"
              class="soda-lyrics-list"
              aria-label="滚动歌词"
              @pointerdown="startLyricsDrag"
              @pointermove="handleLyricsPointerMove"
              @pointerup="stopLyricsDrag"
              @pointerleave="stopLyricsDrag"
              @pointercancel="stopLyricsDrag"
              @wheel.prevent="handleLyricsWheel"
            >
              <button
                v-for="line in displayLyricLines"
                :key="`${line.index}-${line.time}`"
                type="button"
                :class="{
                  active: line.index === activeLyricIndex,
                  preview: lyricsInteractionActive && previewLyricIndex === line.index,
                  past: line.index < activeLyricIndex,
                  future: line.index > activeLyricIndex,
                  placeholder: line.placeholder
                }"
                :aria-disabled="line.placeholder || undefined"
                :data-lyric-index="line.index"
                @click="selectLyric(line.index)"
              >
                <span>{{ line.text }}</span>
                <small v-if="line.translation">{{ line.translation }}</small>
              </button>
            </div>
          </section>

          <DanmakuLayer
            v-if="index === activeIndex"
            :key="`danmaku-${song.id}-${songCommentTrackId}`"
            class="soda-slide__danmaku"
            :enabled="danmakuEnabled"
            :song="song"
            :hot-comments="activeDanmakuHotComments"
            :comments="activeDanmakuComments"
          />

          <aside class="soda-action-rail" aria-label="歌曲操作">
            <button
              type="button"
              :aria-label="`${isLiked(song) ? '取消喜欢' : '喜欢'} ${getSongLikeLabel(song)}`"
              :title="isLiked(song) ? '取消喜欢' : '喜欢'"
              :class="{ active: isLiked(song) }"
              @click.stop="toggleLike(song)"
            >
              <Heart :size="24" :fill="isLiked(song) ? 'currentColor' : 'none'" />
              <span class="soda-action-rail__label">{{ isLiked(song) ? '已喜欢' : '喜欢' }}</span>
              <span v-if="getSongLikeLabel(song)" class="soda-action-rail__count">
                {{ getSongLikeLabel(song) }}
              </span>
            </button>
            <button
              type="button"
              :aria-label="`评论 ${getSongCommentLabel(song)}`"
              title="评论"
              @click.stop="openSongCommentsModal(song)"
            >
              <MessageCircleMore :size="24" />
              <span class="soda-action-rail__label">评论</span>
              <span v-if="getSongCommentLabel(song)" class="soda-action-rail__count">
                {{ getSongCommentLabel(song) }}
              </span>
            </button>
            <button
              type="button"
              :aria-label="danmakuEnabled ? '关闭弹幕' : '开启弹幕'"
              :title="danmakuEnabled ? '关闭弹幕' : '开启弹幕'"
              :class="{ active: danmakuEnabled }"
              @click.stop="toggleDanmaku"
            >
              <Radio :size="24" />
              <span class="soda-action-rail__label">{{ danmakuEnabled ? '弹幕开' : '弹幕' }}</span>
            </button>
            <button type="button" aria-label="下一首" title="下一首" @click.stop="goNextFromGesture">
              <SkipForward :size="24" />
              <span class="soda-action-rail__label">下一首</span>
            </button>
            <button
              class="soda-action-rail__play"
              type="button"
              :aria-label="getPlayLabel(song)"
              :title="getPlayLabel(song)"
              :disabled="player.state.isLoading && isActiveSong(song)"
              @click.stop="playSongFromGesture(index)"
            >
              <Loader2
                v-if="player.state.isLoading && isActiveSong(song)"
                class="soda-spin"
                :size="26"
              />
              <Pause v-else-if="isSongPlaying(song)" :size="26" fill="currentColor" />
              <Play v-else :size="26" fill="currentColor" />
              <span class="soda-action-rail__label">{{ isSongPlaying(song) ? '暂停' : '播放' }}</span>
            </button>
          </aside>

          <footer class="soda-slide__footer">
            <div
              class="soda-slide__progress"
              role="slider"
              :tabindex="isActiveSong(song) ? 0 : -1"
              :aria-valuemin="0"
              :aria-valuemax="Math.floor(player.state.duration || 0)"
              :aria-valuenow="getSongProgressNow(song)"
              :aria-label="`${song.name} 播放进度`"
              @pointerdown="seekFromProgress($event, song)"
              @keydown="handleProgressKeydown($event, song)"
            >
              <span class="soda-slide__progress-time">{{ getCurrentTimeLabel(song) }}</span>
              <span class="soda-slide__progress-rail" aria-hidden="true">
                <span :style="{ width: `${getSongProgress(song)}%` }" />
              </span>
              <span class="soda-slide__progress-time">{{ getDurationLabel(song) }}</span>
            </div>
          </footer>
          </template>
        </article>
      </div>

    </section>

  <CommentModal
    v-model:show="songCommentsModalVisible"
    title="歌曲评论"
    :subtitle="songCommentSubtitle"
    :total="displaySongCommentTotal"
    :hot-comments="songHotComments"
    :comments="songComments"
    :loading="songCommentsLoading"
    :error="songCommentsError"
    :has-more="songCommentsHasMore"
    @load-more="loadMoreSongComments"
  />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useMessage } from 'naive-ui'
import {
  AudioLines,
  ChevronDown,
  ChevronUp,
  Heart,
  Loader2,
  MessageCircleMore,
  Pause,
  Play,
  Radio,
  SkipForward
} from 'lucide-vue-next'
import CommentModal from '../components/CommentModal.vue'
import DanmakuLayer from '../components/DanmakuLayer.vue'
import { recommendedSingles } from '../data/music'
import {
  getMusicFeedData,
  getSongInteractionStatsData,
  getTrackLyricData
} from '../services/netease'
import { usePlayerStore } from '../stores/player'
import { useSongComments } from '../composables/useSongComments'
import '../styles/home.css'

const player = usePlayerStore()
const message = useMessage()
const feedScroller = ref(null)
const activeMood = ref('daily')
const activeIndex = ref(0)
const autoPlayAfterGesture = ref(false)
const likedIds = shallowRef(new Set())
const songStats = shallowRef(new Map())
const defaultCoverTintRgb = '255, 63, 115'
const coverTintFallbacks = Object.freeze({
  sunset: '236, 127, 56',
  neon: '240, 25, 141',
  lofi: '139, 186, 213',
  stage: '183, 218, 233',
  piano: '246, 212, 142'
})
const emptySlideStyle = Object.freeze({
  '--soda-cover-image': 'none',
  '--soda-cover-tint-rgb': defaultCoverTintRgb
})
const allSongs = shallowRef(prepareQueue(recommendedSingles))
const recommendationQueue = shallowRef(applyMoodQueue(allSongs.value, activeMood.value))
const coverTintVersion = ref(0)
const lyricLines = shallowRef(createLyricPlaceholder('点击播放后显示歌词'))
const isLyricLoading = ref(false)
const lyricsScroll = ref(null)
const feedDragging = ref(false)
const lyricsDragging = ref(false)
const lyricsWheeling = ref(false)
const previewLyricIndex = ref(null)
const lyricsPreviewing = ref(false)
const danmakuEnabled = ref(true)
const songCommentsModalVisible = ref(false)
const feedDragState = {
  pointerId: null,
  startIndex: 0,
  startY: 0,
  startScrollTop: 0,
  moved: false
}
const lyricsDragState = {
  startY: 0,
  startScrollTop: 0,
  moved: false
}
const feedDragThreshold = 6
const lyricsDragScrollSpeed = 2.2
const lyricsWheelScrollSpeed = 1.2
const lyricsLoadTimeoutMs = 12000
const recommendationLimit = 36
const slideHydrateRadius = 2
const lyricCache = new Map()
const songStatsLoadingIds = new Set()
const coverTintCache = new Map()
const coverTintRequests = new Set()
let scrollFrame = 0
let resizeFrame = 0
let autoPlayTimer = 0
let removeTrackEndedListener = null
let lyricRequestId = 0
let syncedQueue = null
let feedSnapRequestId = 0
let lyricsPreviewFrame = 0
let lyricsPreviewTimer = null
let lyricsWheelTimer = null
let suppressNextLyricClick = false

const moods = [
  { label: '推荐', value: 'daily' },
  { label: '热歌', value: 'hot' },
  { label: '新歌', value: 'new' },
  { label: '放松', value: 'chill' }
]

const moodSignals = {
  daily: ['猜你喜欢', '今日日推', '继续探索'],
  hot: ['正在流行', '高热播放', '旋律上头'],
  new: ['新鲜发行', '新歌速递', '本周新声'],
  chill: ['低压氛围', '通勤友好', '耳机时间']
}

const activeSong = computed(() => recommendationQueue.value[activeIndex.value])
const activeSongId = computed(() => String(activeSong.value?.id ?? ''))
const currentTrackId = computed(() => String(player.state.currentTrack.id ?? ''))
const activeMoodIndex = computed(() =>
  Math.max(0, moods.findIndex((mood) => mood.value === activeMood.value))
)
const hydratedSlideBounds = computed(() => ({
  start: Math.max(0, activeIndex.value - slideHydrateRadius),
  end: Math.min(recommendationQueue.value.length - 1, activeIndex.value + slideHydrateRadius)
}))
const activeLyricIndex = computed(() => findCurrentLyricIndex(lyricLines.value, player.state.currentTime))
const displayLyricLines = computed(() => {
  const lines = lyricLines.value.length
    ? lyricLines.value
    : createLyricPlaceholder('暂无歌词')

  return lines.map((line, index) => ({
    ...line,
    index
  }))
})
const lyricsInteractionActive = computed(
  () => lyricsDragging.value || lyricsWheeling.value || lyricsPreviewing.value
)
const hasLyricContent = computed(() => lyricLines.value.some((line) => !line.placeholder))
const previewLyric = computed(() => {
  const index = previewLyricIndex.value ?? activeLyricIndex.value

  return lyricLines.value[index] ?? null
})
const songCommentState = useSongComments({
  track: activeSong,
  getFallbackTotal: getSongCommentCount,
  onLoaded: ({ trackId, data }) => {
    updateSongStats(trackId, {
      commentCount: data.total,
      commentCountLabel: formatActionCount(data.total)
    })
  }
})
const songCommentSong = songCommentState.track
const songHotComments = songCommentState.hotComments
const songComments = songCommentState.comments
const songCommentsHasMore = songCommentState.hasMore
const songCommentsLoading = songCommentState.loading
const songCommentsError = songCommentState.error
const songCommentTrackId = songCommentState.trackId
const displaySongCommentTotal = songCommentState.displayTotal
const activeDanmakuHotComments = songCommentState.activeHotComments
const activeDanmakuComments = songCommentState.activeComments
const songCommentSubtitle = computed(() => {
  const song = songCommentSong.value

  if (!song) {
    return ''
  }

  return `${song.name} - ${song.artist}`
})

watch(
  () => player.state.currentTrack.id,
  async (trackId) => {
    const nextIndex = recommendationQueue.value.findIndex((song) => String(song.id) === String(trackId))

    if (nextIndex >= 0 && nextIndex !== activeIndex.value) {
      activeIndex.value = nextIndex
      scrollToIndex(nextIndex, 'smooth')
      return
    }

    if (trackId && String(trackId) === String(activeSong.value?.id)) {
      await nextTick()
      loadActiveLyrics(trackId)
    }
  }
)

watch(
  () => activeSong.value?.id,
  (trackId) => {
    loadActiveLyrics(trackId)
    loadActiveSongStats(trackId)
    preloadActiveSongComments()
    hydrateVisibleCoverTints()
  },
  { immediate: true }
)

watch(danmakuEnabled, (enabled) => {
  if (enabled) {
    preloadActiveSongComments()
  }
})

watch(activeLyricIndex, async () => {
  if (lyricsInteractionActive.value) {
    return
  }

  await nextTick()
  centerCurrentLyric()
})

onMounted(() => {
  restoreActiveTrackPosition()
  syncPlayerQueue()
  removeTrackEndedListener = player.onTrackEnded(handleTrackEnded)
  window.addEventListener('resize', handleLyricsResize)
  snapFeedToActiveIndex('auto')
  hydrateVisibleCoverTints()
  loadRecommendations()
})

onUnmounted(() => {
  feedSnapRequestId += 1
  window.cancelAnimationFrame(scrollFrame)
  window.cancelAnimationFrame(resizeFrame)
  window.cancelAnimationFrame(lyricsPreviewFrame)
  window.clearTimeout(autoPlayTimer)
  window.removeEventListener('resize', handleLyricsResize)
  clearLyricsPreviewTimer()
  clearLyricsWheelTimer()
  removeTrackEndedListener?.()
  removeTrackEndedListener = null
})

async function loadRecommendations() {
  try {
    const data = await getMusicFeedData({ limit: recommendationLimit })
    const songs = data.songs.length ? data.songs : recommendedSingles
    allSongs.value = prepareQueue(songs)
    recommendationQueue.value = applyMoodQueue(allSongs.value, activeMood.value)
    restoreActiveTrackPosition()
    syncPlayerQueue()
    hydrateVisibleCoverTints()
    await snapFeedToActiveIndex('auto')
  } catch (error) {
    console.warn('Failed to load home recommendations:', error)
  }
}

function syncPlayerQueue() {
  if (syncedQueue === recommendationQueue.value) {
    return
  }

  syncedQueue = recommendationQueue.value
  player.setQueue(syncedQueue)
}

function restoreActiveTrackPosition() {
  const currentId = currentTrackId.value
  const nextIndex = recommendationQueue.value.findIndex((song) => String(song.id) === currentId)

  activeIndex.value = nextIndex >= 0 ? nextIndex : 0
}

async function snapFeedToActiveIndex(behavior = 'auto') {
  const requestId = ++feedSnapRequestId

  await nextTick()
  await waitForLayoutFrame()

  if (requestId !== feedSnapRequestId) {
    return
  }

  scrollToIndex(activeIndex.value, behavior)
  await waitForLayoutFrame()

  if (requestId === feedSnapRequestId) {
    scrollToIndex(activeIndex.value, 'auto')
  }
}

function waitForLayoutFrame() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(resolve)
  })
}

function prepareQueue(songs) {
  return songs.map((song, index) => {
    const coverUrl = resizeNeteaseCover(song.coverUrl, 640)
    const type = song.type ?? getCoverType(index)

    return {
      ...song,
      coverUrl,
      id: song.id ?? `home-${index + 1}`,
      rank: String(index + 1).padStart(2, '0'),
      type,
      slideStyle: createSlideStyle(coverUrl, getFallbackCoverTintRgb(type))
    }
  })
}

function applyMoodQueue(songs, mood) {
  const queue = [...songs]
  const filters = {
    daily: (items) => items,
    hot: (items) => items.filter((song) => song.feedSource === 'chart' || song.hasVideo),
    new: (items) => items.filter((song) => song.feedSource === 'new'),
    chill: (items) => items.filter((song) => getChillWeight(song) >= 2)
  }
  const sorters = {
    daily: (items) => items,
    hot: (items) => items.sort((current, next) =>
      Number(next.hasVideo) - Number(current.hasVideo) ||
      Number(next.vip) - Number(current.vip)
    ),
    new: (items) => items.reverse(),
    chill: (items) => items.sort((current, next) => getChillWeight(next) - getChillWeight(current))
  }
  const filteredQueue = (filters[mood] ?? filters.daily)(queue)
  const sortedQueue = (sorters[mood] ?? sorters.daily)(
    filteredQueue.length ? filteredQueue : queue
  )

  return sortedQueue.map((song, index) => ({
    ...song,
    rank: String(index + 1).padStart(2, '0')
  }))
}

function getChillWeight(song) {
  const typeScore = {
    piano: 4,
    lofi: 3,
    sunset: 2,
    stage: 1,
    neon: 0
  }

  return typeScore[song.type] ?? 0
}

function setMood(value) {
  if (value === activeMood.value) {
    return
  }

  activeMood.value = value

  feedScroller.value?.scrollTo({
    top: 0,
    behavior: 'auto'
  })
  recommendationQueue.value = applyMoodQueue(allSongs.value, value)
  activeIndex.value = 0
  syncPlayerQueue()
  hydrateVisibleCoverTints()
  nextTick(() => scrollToIndex(0, 'auto'))

  if (autoPlayAfterGesture.value) {
    scheduleAutoPlay({ restart: true })
  }
}

function handleFeedScroll() {
  if (scrollFrame) {
    return
  }

  scrollFrame = window.requestAnimationFrame(() => {
    scrollFrame = 0
    const scroller = feedScroller.value

    if (!scroller?.clientHeight || !recommendationQueue.value.length) {
      return
    }

    const nextIndex = getFeedIndexFromScroll()

    if (nextIndex === activeIndex.value) {
      return
    }

    activeIndex.value = nextIndex

    if (autoPlayAfterGesture.value && !feedDragging.value) {
      scheduleAutoPlay({ restart: true })
    }
  })
}

function startFeedDrag(event) {
  const scroller = feedScroller.value

  if (!scroller || event.button > 0 || shouldIgnoreFeedDrag(event)) {
    return
  }

  feedSnapRequestId += 1
  feedDragging.value = true
  feedDragState.pointerId = event.pointerId
  feedDragState.startIndex = activeIndex.value
  feedDragState.startY = event.clientY
  feedDragState.startScrollTop = scroller.scrollTop
  feedDragState.moved = false
  scroller.style.scrollSnapType = 'none'
  scroller.setPointerCapture?.(event.pointerId)
  event.preventDefault()
}

function handleFeedPointerMove(event) {
  const scroller = feedScroller.value

  if (!scroller || !feedDragging.value || event.pointerId !== feedDragState.pointerId) {
    return
  }

  const deltaY = event.clientY - feedDragState.startY

  if (Math.abs(deltaY) < feedDragThreshold && !feedDragState.moved) {
    return
  }

  feedDragState.moved = true
  event.preventDefault()
  scroller.scrollTop = feedDragState.startScrollTop - deltaY
}

function stopFeedDrag(event) {
  if (!feedDragging.value || event.pointerId !== feedDragState.pointerId) {
    return
  }

  const scroller = feedScroller.value
  const shouldSnap = feedDragState.moved

  scroller?.releasePointerCapture?.(event.pointerId)
  if (scroller) {
    scroller.style.scrollSnapType = ''
  }
  feedDragging.value = false
  feedDragState.pointerId = null

  if (!shouldSnap || !scroller?.clientHeight) {
    return
  }

  const nextIndex = getFeedIndexFromScroll()
  activeIndex.value = nextIndex
  scrollToIndex(nextIndex, 'smooth')

  if (nextIndex !== feedDragState.startIndex) {
    autoPlayAfterGesture.value = true
    scheduleAutoPlay({ restart: true })
  }
}

function shouldIgnoreFeedDrag(event) {
  const target = event.target

  return Boolean(target?.closest?.(
    '.soda-lyrics-panel, .soda-action-rail, .soda-slide__progress, button, a, input, textarea, select'
  ))
}

function handleFeedKeydown(event) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
    return
  }

  event.preventDefault()
  scrollToIndex(activeIndex.value + (event.key === 'ArrowDown' ? 1 : -1), 'smooth')
}

function scrollToIndex(index, behavior = 'smooth') {
  const scroller = feedScroller.value

  if (!scroller || !recommendationQueue.value.length) {
    return
  }

  const nextIndex = Math.min(
    recommendationQueue.value.length - 1,
    Math.max(0, index)
  )

  scroller.scrollTo({
    top: getSlideTop(nextIndex),
    behavior
  })
}

function scheduleAutoPlay(options = {}) {
  window.clearTimeout(autoPlayTimer)
  autoPlayTimer = window.setTimeout(() => {
    playActiveSong({ auto: true, restart: true, ...options })
  }, 180)
}

async function playSongFromGesture(index) {
  autoPlayAfterGesture.value = true
  const shouldScroll = index !== activeIndex.value
  activeIndex.value = index
  await nextTick()
  if (shouldScroll) {
    scrollToIndex(index, 'smooth')
  }
  await playActiveSong()
}

async function goNextFromGesture() {
  if (!recommendationQueue.value.length) {
    return
  }

  autoPlayAfterGesture.value = true
  const nextIndex = (activeIndex.value + 1) % recommendationQueue.value.length
  activeIndex.value = nextIndex
  scrollToIndex(nextIndex, 'smooth')
  await playActiveSong()
}

async function handleTrackEnded() {
  if (!recommendationQueue.value.length) {
    return
  }

  autoPlayAfterGesture.value = true
  activeIndex.value = (activeIndex.value + 1) % recommendationQueue.value.length
  scrollToIndex(activeIndex.value, 'smooth')
  await playActiveSong({ auto: true, restart: true })
}

async function loadActiveLyrics(trackId) {
  lyricRequestId += 1
  const requestId = lyricRequestId
  resetLyricsInteraction()
  isLyricLoading.value = false
  lyricLines.value = createLyricPlaceholder(trackId ? '歌词加载中...' : '暂无歌词')
  await refreshLyricsLayout('auto')

  if (!isNeteaseTrackId(trackId)) {
    lyricLines.value = createLyricPlaceholder('在线歌曲播放后显示歌词')
    await refreshLyricsLayout('auto')
    return
  }

  isLyricLoading.value = true

  try {
    const lines = await getCachedTrackLyrics(trackId)

    if (requestId !== lyricRequestId) {
      return
    }

    lyricLines.value = lines
  } catch (error) {
    if (requestId !== lyricRequestId) {
      return
    }

    console.warn('Failed to load feed lyrics:', error)
    lyricLines.value = createLyricPlaceholder('歌词加载失败')
  } finally {
    if (requestId === lyricRequestId) {
      isLyricLoading.value = false
    }
  }

  if (requestId === lyricRequestId) {
    await refreshLyricsLayout('auto')
  }
}

async function loadActiveSongStats(trackId) {
  const id = String(trackId ?? '')

  if (!isNeteaseTrackId(id) || songStats.value.has(id) || songStatsLoadingIds.has(id)) {
    return
  }

  songStatsLoadingIds.add(id)

  try {
    const stats = await getSongInteractionStatsData(id)
    updateSongStats(id, stats)
  } catch (error) {
    console.warn('Failed to load feed song stats:', error)
  } finally {
    songStatsLoadingIds.delete(id)
  }
}

function updateSongStats(trackId, stats) {
  const id = String(trackId ?? '')

  if (!id) {
    return
  }

  const previousStats = songStats.value.get(id) ?? {}
  const nextStats = {
    ...previousStats,
    ...stats
  }
  const nextSongStats = new Map(songStats.value)

  nextSongStats.set(id, nextStats)
  songStats.value = nextSongStats
  mergeStatsIntoTracks(id, nextStats)
}

function mergeStatsIntoTracks(trackId, stats) {
  const id = String(trackId)

  for (const queue of [allSongs.value, recommendationQueue.value]) {
    queue
      .filter((song) => String(song?.id) === id)
      .forEach((song) => Object.assign(song, stats))
  }

  if (String(player.state.currentTrack.id) === id) {
    Object.assign(player.state.currentTrack, stats)
  }
}

function getFeedIndexFromScroll() {
  const scroller = feedScroller.value

  if (!scroller?.clientHeight || !recommendationQueue.value.length) {
    return activeIndex.value
  }

  let nearestIndex = activeIndex.value
  let nearestDistance = Number.POSITIVE_INFINITY

  Array.from(scroller.children).forEach((slide, index) => {
    const distance = Math.abs(slide.offsetTop - scroller.scrollTop)

    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  })

  return Math.min(
    recommendationQueue.value.length - 1,
    Math.max(0, nearestIndex)
  )
}

function getSlideTop(index) {
  const scroller = feedScroller.value
  const slide = scroller?.children[index]

  return slide?.offsetTop ?? index * (scroller?.clientHeight || 0)
}

async function getCachedTrackLyrics(trackId) {
  const cacheKey = String(trackId)
  const cachedLyrics = lyricCache.get(cacheKey)

  if (cachedLyrics) {
    return cachedLyrics
  }

  const lyricsRequest = loadTrackLyricsWithTimeout(trackId)
    .then((lines) => {
      lyricCache.set(cacheKey, lines)
      return lines
    })
    .catch((error) => {
      lyricCache.delete(cacheKey)
      throw error
    })

  lyricCache.set(cacheKey, lyricsRequest)
  return lyricsRequest
}

function loadTrackLyricsWithTimeout(trackId) {
  let timeoutId = 0

  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error('歌词加载超时'))
    }, lyricsLoadTimeoutMs)
  })

  return Promise.race([
    getTrackLyricData(trackId),
    timeout
  ]).finally(() => {
    window.clearTimeout(timeoutId)
  })
}

async function playActiveSong(options = {}) {
  const song = recommendationQueue.value[activeIndex.value]

  if (!song) {
    return
  }

  syncPlayerQueue()

  if (String(player.state.currentTrack.id) === String(song.id)) {
    if (options.restart) {
      player.seekTo(0)

      if (!player.state.isPlaying) {
        const resumed = await player.togglePlay()
        showPlaybackError(resumed)

        if (!resumed) {
          return
        }
      }

      loadActiveLyrics(song.id)
      return
    }

    if (options.auto && player.state.isPlaying) {
      return
    }

    const toggled = await player.togglePlay()
    showPlaybackError(toggled)

    if (toggled) {
      loadActiveLyrics(song.id)
    }

    return
  }

  const played = await player.playTrack(song)
  showPlaybackError(played)
}

function toggleLike(song) {
  const nextLikedIds = new Set(likedIds.value)
  const id = String(song.id)
  const wasLiked = nextLikedIds.has(id)

  if (wasLiked) {
    nextLikedIds.delete(id)
  } else {
    nextLikedIds.add(id)
  }

  likedIds.value = nextLikedIds

  if (isNeteaseTrackId(id)) {
    const nextLikedCount = Math.max(0, getSongLikeCount(song) + (wasLiked ? -1 : 1))
    const previousLabel = getSongStats(song).likedCountLabel

    updateSongStats(id, {
      likedCount: nextLikedCount,
      likedCountLabel: previousLabel || formatActionCount(nextLikedCount)
    })
  }
}

async function openSongCommentsModal(song = activeSong.value) {
  if (!song) {
    return
  }

  songCommentsModalVisible.value = true
  await songCommentState.open(song)
}

function toggleDanmaku() {
  danmakuEnabled.value = !danmakuEnabled.value
}

async function preloadActiveSongComments(song = activeSong.value) {
  await songCommentState.preload(song, { enabled: danmakuEnabled.value })
}

function loadMoreSongComments() {
  songCommentState.loadMore(songCommentSong.value)
}

function isLiked(song) {
  return likedIds.value.has(String(song.id))
}

function getSongStats(song) {
  return songStats.value.get(String(song?.id ?? '')) ?? song ?? {}
}

function getSongLikeCount(song) {
  return Number(getSongStats(song).likedCount) || 0
}

function getSongCommentCount(song) {
  return Number(getSongStats(song).commentCount) || 0
}

function getSongLikeLabel(song) {
  const stats = getSongStats(song)

  return stats.likedCountLabel || formatActionCount(getSongLikeCount(song))
}

function getSongCommentLabel(song) {
  const stats = getSongStats(song)

  return stats.commentCountLabel || formatActionCount(getSongCommentCount(song))
}

function formatActionCount(value = 0) {
  const count = Number(value) || 0

  if (count <= 0) {
    return ''
  }

  if (count >= 100000000) {
    return `${Math.floor(count / 100000000)}亿+`
  }

  if (count >= 10000) {
    return `${Math.floor(count / 10000)}w+`
  }

  if (count >= 1000) {
    return '999+'
  }

  return String(count)
}

function isActiveSong(song) {
  return Boolean(song?.id && activeSongId.value === String(song.id))
}

function isSongPlaying(song) {
  return Boolean(
    song?.id &&
    currentTrackId.value === String(song.id) &&
    player.state.isPlaying
  )
}

function getPlayLabel(song) {
  if (player.state.isLoading && isActiveSong(song)) {
    return '音乐加载中'
  }

  return isSongPlaying(song) ? '暂停' : '播放'
}

function getSongProgress(song) {
  if (!isActiveSong(song) || !player.state.duration) {
    return 0
  }

  return Math.min(100, (player.state.currentTime / player.state.duration) * 100)
}

function getSongProgressNow(song) {
  return isActiveSong(song) ? Math.floor(player.state.currentTime || 0) : 0
}

function getCurrentTimeLabel(song) {
  return isActiveSong(song) ? formatTime(player.state.currentTime) : '0:00'
}

function getDurationLabel(song) {
  if (isActiveSong(song) && player.state.duration) {
    return formatTime(player.state.duration)
  }

  return song.time || song.duration || '0:00'
}

function seekFromProgress(event, song) {
  if (!isActiveSong(song) || !player.state.duration) {
    return
  }

  const rail = event.currentTarget.querySelector('.soda-slide__progress-rail')
  const rect = (rail ?? event.currentTarget).getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  player.seekTo(ratio * player.state.duration)
}

function handleProgressKeydown(event, song) {
  if (!isActiveSong(song) || !player.state.duration) {
    return
  }

  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
    return
  }

  event.preventDefault()
  player.seekTo(player.state.currentTime + (event.key === 'ArrowRight' ? 5 : -5))
}

function getLyricsScroller() {
  const scroller = lyricsScroll.value

  return Array.isArray(scroller)
    ? scroller.find(Boolean) ?? null
    : scroller
}

async function refreshLyricsLayout(behavior = 'smooth') {
  await nextTick()
  updateLyricsEdgePadding()
  centerCurrentLyric(behavior)
}

function updateLyricsEdgePadding() {
  const scroller = getLyricsScroller()

  if (!scroller) {
    return
  }

  const firstLine = scroller.querySelector('[data-lyric-index="0"]')
  const lineHeight = firstLine?.offsetHeight || 62
  const edgePadding = Math.max(0, scroller.clientHeight / 2 - lineHeight / 2)

  scroller.style.setProperty('--lyrics-edge-padding', `${edgePadding}px`)
}

function startLyricsDrag(event) {
  const scroller = getLyricsScroller()

  if (!scroller || !hasLyricContent.value || event.button > 0) {
    return
  }

  lyricsDragging.value = true
  lyricsPreviewing.value = true
  previewLyricIndex.value = activeLyricIndex.value
  lyricsDragState.startY = event.clientY
  lyricsDragState.startScrollTop = scroller.scrollTop
  lyricsDragState.moved = false
  clearLyricsPreviewTimer()
  clearLyricsWheelTimer()
  lyricsWheeling.value = false
  scroller.setPointerCapture?.(event.pointerId)
  updatePreviewLyricFromCenter()
}

function handleLyricsPointerMove(event) {
  const scroller = getLyricsScroller()

  if (!scroller || !lyricsDragging.value) {
    return
  }

  const deltaY = event.clientY - lyricsDragState.startY

  if (Math.abs(deltaY) > 3) {
    lyricsDragState.moved = true
  }

  scroller.scrollTop = lyricsDragState.startScrollTop - deltaY * lyricsDragScrollSpeed
  requestPreviewLyricUpdate()
}

function stopLyricsDrag(event) {
  if (!lyricsDragging.value) {
    return
  }

  flushPreviewLyricUpdate()
  getLyricsScroller()?.releasePointerCapture?.(event.pointerId)
  lyricsDragging.value = false

  if (lyricsDragState.moved) {
    suppressNextLyricClick = true
    window.setTimeout(() => {
      suppressNextLyricClick = false
    }, 0)
  }

  schedulePlaybackLyricReturn()
}

function handleLyricsWheel(event) {
  const scroller = getLyricsScroller()

  if (!scroller || !hasLyricContent.value || lyricsDragging.value) {
    return
  }

  lyricsPreviewing.value = true
  lyricsWheeling.value = true
  clearLyricsPreviewTimer()
  clearLyricsWheelTimer()

  const wheelDelta = event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? event.deltaY * 18
    : event.deltaY

  scroller.scrollTop += wheelDelta * lyricsWheelScrollSpeed
  requestPreviewLyricUpdate()

  lyricsWheelTimer = window.setTimeout(() => {
    lyricsWheeling.value = false
    schedulePlaybackLyricReturn()
  }, 140)
}

function selectLyric(index) {
  const line = lyricLines.value[index]

  if (suppressNextLyricClick) {
    suppressNextLyricClick = false
    return
  }

  seekToLyricLine(line, index)
}

function seekToPreviewLyric() {
  seekToLyricLine(previewLyric.value, previewLyricIndex.value)
}

function seekToLyricLine(line, index) {
  if (!line || line.placeholder) {
    return
  }

  previewLyricIndex.value = null
  lyricsPreviewing.value = false
  lyricsWheeling.value = false
  clearLyricsPreviewTimer()
  clearLyricsWheelTimer()
  player.seekTo(line.seconds)
  nextTick(() => centerLyricIndex(index))
}

function requestPreviewLyricUpdate() {
  if (lyricsPreviewFrame) {
    return
  }

  lyricsPreviewFrame = window.requestAnimationFrame(() => {
    lyricsPreviewFrame = 0
    updatePreviewLyricFromCenter()
  })
}

function flushPreviewLyricUpdate() {
  if (lyricsPreviewFrame) {
    window.cancelAnimationFrame(lyricsPreviewFrame)
    lyricsPreviewFrame = 0
  }

  updatePreviewLyricFromCenter()
}

function updatePreviewLyricFromCenter() {
  const scroller = getLyricsScroller()

  if (!scroller) {
    return
  }

  const centerOffset = scroller.scrollTop + scroller.clientHeight / 2
  const lyricButtons = scroller.children
  let nearestIndex = previewLyricIndex.value ?? activeLyricIndex.value
  let nearestDistance = Number.POSITIVE_INFINITY

  Array.from(lyricButtons).forEach((button) => {
    const distance = Math.abs(button.offsetTop + button.offsetHeight / 2 - centerOffset)
    const lyricIndex = Number(button.dataset.lyricIndex)

    if (distance < nearestDistance && Number.isInteger(lyricIndex)) {
      nearestDistance = distance
      nearestIndex = lyricIndex
    }
  })

  if (nearestIndex !== previewLyricIndex.value) {
    previewLyricIndex.value = nearestIndex
  }
}

function schedulePlaybackLyricReturn() {
  clearLyricsPreviewTimer()
  lyricsPreviewTimer = window.setTimeout(() => {
    lyricsPreviewing.value = false
    previewLyricIndex.value = null
    centerCurrentLyric()
  }, 4200)
}

function clearLyricsPreviewTimer() {
  if (lyricsPreviewTimer) {
    window.clearTimeout(lyricsPreviewTimer)
    lyricsPreviewTimer = null
  }
}

function clearLyricsWheelTimer() {
  if (lyricsWheelTimer) {
    window.clearTimeout(lyricsWheelTimer)
    lyricsWheelTimer = null
  }
}

function resetLyricsInteraction() {
  lyricsDragging.value = false
  lyricsWheeling.value = false
  lyricsPreviewing.value = false
  previewLyricIndex.value = null
  suppressNextLyricClick = false
  if (lyricsPreviewFrame) {
    window.cancelAnimationFrame(lyricsPreviewFrame)
    lyricsPreviewFrame = 0
  }
  clearLyricsPreviewTimer()
  clearLyricsWheelTimer()
}

function centerCurrentLyric(behavior = 'smooth') {
  centerLyricIndex(activeLyricIndex.value, behavior)
}

function centerLyricIndex(index, behavior = 'smooth') {
  const scroller = getLyricsScroller()

  if (!scroller || index < 0) {
    return
  }

  const activeLine =
    scroller.children[index] ??
    scroller.querySelector(`[data-lyric-index="${index}"]`)

  if (!activeLine) {
    return
  }

  scroller.scrollTo({
    top:
      activeLine.offsetTop -
      scroller.clientHeight / 2 +
      activeLine.offsetHeight / 2,
    behavior
  })
}

function handleLyricsResize() {
  if (resizeFrame) {
    return
  }

  resizeFrame = window.requestAnimationFrame(() => {
    resizeFrame = 0
    updateLyricsEdgePadding()
    centerCurrentLyric('auto')
  })
}

function createLyricPlaceholder(text) {
  return [{ time: '--:--', text, seconds: 0, placeholder: true }]
}

function findCurrentLyricIndex(lines, currentTime) {
  if (!lines.length || lines[0]?.placeholder) {
    return 0
  }

  const targetTime = currentTime + 0.16
  let low = 0
  let high = lines.length - 1
  let currentIndex = 0

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)

    if (lines[middle].seconds <= targetTime) {
      currentIndex = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }

  return currentIndex
}

function isNeteaseTrackId(trackId) {
  return /^\d+$/.test(String(trackId ?? ''))
}

function formatTime(value = 0) {
  const totalSeconds = Math.max(0, Math.floor(value))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')

  return `${minutes}:${seconds}`
}

function getMoodSignal(index) {
  const signals = moodSignals[activeMood.value] ?? moodSignals.daily

  return signals[index % signals.length]
}

function isSlideHydrated(index) {
  const { start, end } = hydratedSlideBounds.value

  return index >= start && index <= end
}

function getSlideStyle(song, index) {
  coverTintVersion.value

  return isSlideHydrated(index)
    ? createSlideStyle(song?.coverUrl, getSongCoverTintRgb(song))
    : emptySlideStyle
}

function createSlideStyle(coverUrl, tintRgb = defaultCoverTintRgb) {
  return Object.freeze({
    '--soda-cover-image': coverUrl ? `url("${coverUrl}")` : 'none',
    '--soda-cover-tint-rgb': tintRgb
  })
}

function hydrateVisibleCoverTints() {
  if (typeof window === 'undefined') {
    return
  }

  const { start, end } = hydratedSlideBounds.value
  recommendationQueue.value.slice(start, end + 1).forEach(loadCoverTintForSong)
}

function loadCoverTintForSong(song) {
  if (!song?.coverUrl || coverTintCache.has(song.coverUrl) || coverTintRequests.has(song.coverUrl)) {
    return
  }

  coverTintRequests.add(song.coverUrl)
  sampleCoverTint(song.coverUrl)
    .then((tintRgb) => {
      coverTintCache.set(song.coverUrl, tintRgb)
      coverTintVersion.value += 1
    })
    .catch(() => {
      coverTintCache.set(song.coverUrl, getFallbackCoverTintRgb(song.type))
    })
    .finally(() => {
      coverTintRequests.delete(song.coverUrl)
    })
}

function getSongCoverTintRgb(song) {
  if (!song?.coverUrl) {
    return getFallbackCoverTintRgb(song?.type)
  }

  return coverTintCache.get(song.coverUrl) ?? getFallbackCoverTintRgb(song.type)
}

function getFallbackCoverTintRgb(type) {
  return coverTintFallbacks[type] ?? defaultCoverTintRgb
}

function sampleCoverTint(coverUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    image.onload = () => {
      try {
        const sampleSize = 28
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d', { willReadFrequently: true })

        if (!context) {
          reject(new Error('Canvas context unavailable'))
          return
        }

        canvas.width = sampleSize
        canvas.height = sampleSize
        context.drawImage(image, 0, 0, sampleSize, sampleSize)
        resolve(extractCoverTint(context.getImageData(0, 0, sampleSize, sampleSize).data))
      } catch (error) {
        reject(error)
      }
    }
    image.onerror = reject
    image.src = coverUrl
  })
}

function extractCoverTint(data) {
  let red = 0
  let green = 0
  let blue = 0
  let totalWeight = 0

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3]

    if (alpha < 128) {
      continue
    }

    const pixelRed = data[index]
    const pixelGreen = data[index + 1]
    const pixelBlue = data[index + 2]
    const max = Math.max(pixelRed, pixelGreen, pixelBlue)
    const min = Math.min(pixelRed, pixelGreen, pixelBlue)
    const luma = getLuma(pixelRed, pixelGreen, pixelBlue)

    if (luma < 24 || luma > 238) {
      continue
    }

    const saturation = max - min
    const weight = 1 + saturation / 80 + Math.max(0, 128 - Math.abs(luma - 128)) / 160

    red += pixelRed * weight
    green += pixelGreen * weight
    blue += pixelBlue * weight
    totalWeight += weight
  }

  if (!totalWeight) {
    return defaultCoverTintRgb
  }

  return tuneCoverTint(red / totalWeight, green / totalWeight, blue / totalWeight)
}

function tuneCoverTint(red, green, blue) {
  const luma = getLuma(red, green, blue)
  let next = { red, green, blue }

  if (luma < 74) {
    next = mixRgb(next, { red: 255, green: 255, blue: 255 }, 0.22)
  } else if (luma > 190) {
    next = mixRgb(next, { red: 0, green: 0, blue: 0 }, 0.18)
  }

  return `${Math.round(next.red)}, ${Math.round(next.green)}, ${Math.round(next.blue)}`
}

function mixRgb(current, target, ratio) {
  return {
    red: current.red + (target.red - current.red) * ratio,
    green: current.green + (target.green - current.green) * ratio,
    blue: current.blue + (target.blue - current.blue) * ratio
  }
}

function getLuma(red, green, blue) {
  return red * 0.2126 + green * 0.7152 + blue * 0.0722
}

function resizeNeteaseCover(url, size) {
  if (!url || !/music\.126\.net/.test(url)) {
    return url
  }

  const param = `param=${size}y${size}`

  if (/[?&]param=\d+y\d+/.test(url)) {
    return url.replace(/([?&])param=\d+y\d+/, `$1${param}`)
  }

  return `${url}${url.includes('?') ? '&' : '?'}${param}`
}

function showPlaybackError(success) {
  if (success) {
    return
  }

  message.error(player.state.error?.message || '当前歌曲暂无可播放链接')
}

function getCoverType(index) {
  return ['sunset', 'neon', 'lofi', 'stage', 'piano'][index % 5]
}
</script>
