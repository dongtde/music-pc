<template>
  <div class="view home-view" :class="{ 'home-view--video': activeHomeSection === 'video' }">
    <nav
      class="soda-feed__tabs"
      aria-label="首页分类"
      :style="{ '--active-tab-index': activeHomeSectionIndex }"
    >
      <button
        v-for="section in homeSections"
        :key="section.value"
        type="button"
        :class="{ active: activeHomeSection === section.value }"
        @click="setHomeSection(section.value)"
      >
        {{ section.label }}
      </button>
    </nav>

    <section
      v-show="activeHomeSection === 'music'"
      class="soda-feed"
      :class="{ 'soda-feed--settling': musicFeedSettling }"
      aria-label="主页推荐听歌"
      :aria-hidden="activeHomeSection !== 'music'"
    >

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
            :key="`danmaku-${song.id}`"
            class="soda-slide__danmaku"
            :enabled="danmakuEnabled"
            :song="song"
            :hot-comments="songDanmakuState.hotComments"
            :comments="songDanmakuState.comments"
            :max-items="homeDanmakuMaxItems"
            :has-more="songDanmakuState.more"
            :loading="songDanmakuState.loading"
            :prefetch-threshold="homeDanmakuPrefetchThreshold"
            @need-more="loadMoreSongDanmaku"
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

    <section
      v-show="activeHomeSection === 'video'"
      class="soda-video-feed"
      aria-label="沉浸式视频 MV"
      :aria-hidden="activeHomeSection !== 'video'"
    >
      <div
        ref="mvScroller"
        class="soda-video-feed__scroller"
        :class="{ 'soda-video-feed__scroller--dragging': mvDragging }"
        tabindex="0"
        @scroll="handleMvScroll"
        @keydown="handleMvKeydown"
        @pointerdown="startMvDrag"
        @pointermove="handleMvPointerMove"
        @pointerup="stopMvDrag"
        @pointerleave="stopMvDrag"
        @pointercancel="stopMvDrag"
      >
        <article
          v-for="(mv, index) in mvQueue"
          :key="mv.id"
          class="soda-mv-slide"
          :class="{ active: index === activeMvIndex }"
          :aria-label="`${mv.title} - ${mv.artist}`"
        >
          <div class="soda-mv-slide__backdrop" aria-hidden="true">
            <img
              v-if="mv.coverUrl"
              :src="mv.coverUrl"
              alt=""
              :loading="index === activeMvIndex ? 'eager' : 'lazy'"
              :fetchpriority="index === activeMvIndex ? 'high' : 'low'"
              decoding="async"
            />
            <span v-else class="soda-slide__fallback" :class="`cover--${mv.type}`" />
          </div>

          <div class="soda-mv-stage">
            <video
              v-if="index === activeMvIndex && getHomeMvVideoUrl(mv)"
              :key="`${mv.id}-${getHomeMvVideoUrl(mv)}`"
              :ref="(element) => setHomeVideoElement(element, index)"
              class="soda-mv-stage__video"
              :src="getHomeMvVideoUrl(mv)"
              :poster="mv.coverUrl"
              playsinline
              preload="metadata"
              @loadedmetadata="handleHomeMvMetadata"
              @timeupdate="handleHomeMvTimeUpdate"
              @play="handleHomeMvPlay"
              @pause="handleHomeMvPause"
              @ended="goNextMvFromGesture"
              @error="handleHomeMvError"
              @click="toggleHomeMvPlayback(index)"
            />
            <button
              v-else
              class="soda-mv-poster"
              type="button"
              :disabled="mvQueueLoading || isActiveMvLoading(mv)"
              @click.stop="playMvFromGesture(index)"
            >
              <img v-if="mv.coverUrl" :src="mv.coverUrl" :alt="mv.title" />
              <span>
                <Loader2 v-if="isActiveMvLoading(mv)" class="soda-spin" :size="34" />
                <Play v-else :size="38" fill="currentColor" />
              </span>
              <small v-if="index === activeMvIndex && homeMvState.error">{{ homeMvState.error }}</small>
              <small v-else>{{ isActiveMvLoading(mv) ? '正在获取播放地址' : '点击播放 MV' }}</small>
            </button>
            <button
              v-if="index === activeMvIndex && getHomeMvVideoUrl(mv) && !homeMvState.isPlaying"
              class="soda-mv-stage__play"
              type="button"
              :disabled="isActiveMvLoading(mv)"
              :aria-label="`播放 ${mv.title}`"
              @click.stop="playMvFromGesture(index)"
            >
              <Play :size="42" fill="currentColor" />
            </button>
          </div>

          <section class="soda-mv-caption">
            <h1>{{ mv.title }}</h1>
            <p>{{ mv.artist }}<span v-if="mv.playCount"> · {{ mv.playCount }} 播放</span></p>
            <small v-if="mv.desc">{{ mv.desc }}</small>
          </section>

          <DanmakuLayer
            v-if="index === activeMvIndex"
            :key="`home-mv-danmaku-${mv.id}`"
            class="soda-mv-slide__danmaku"
            :enabled="homeMvDanmakuEnabled"
            :song="{ id: mv.id, name: mv.title }"
            :hot-comments="homeMvDanmakuState.hotComments"
            :comments="homeMvDanmakuState.comments"
            :max-items="homeDanmakuMaxItems"
            :has-more="homeMvDanmakuState.more"
            :loading="homeMvDanmakuState.loading"
            :prefetch-threshold="homeDanmakuPrefetchThreshold"
            @need-more="loadMoreHomeMvDanmaku"
          />

          <aside class="soda-action-rail soda-mv-action-rail" aria-label="MV 操作">
            <button
              type="button"
              :aria-label="`${isHomeMvLiked(mv) ? '取消喜欢' : '喜欢'} ${getHomeMvLikeLabel(mv)}`"
              :title="isHomeMvLiked(mv) ? '取消喜欢' : '喜欢'"
              :class="{ active: isHomeMvLiked(mv) }"
              @click.stop="toggleHomeMvLike(mv)"
            >
              <Heart :size="24" :fill="isHomeMvLiked(mv) ? 'currentColor' : 'none'" />
              <span class="soda-action-rail__label">{{ isHomeMvLiked(mv) ? '已喜欢' : '喜欢' }}</span>
              <span v-if="getHomeMvLikeLabel(mv)" class="soda-action-rail__count">
                {{ getHomeMvLikeLabel(mv) }}
              </span>
            </button>
            <button
              type="button"
              :aria-label="`评论 ${getHomeMvCommentLabel(mv)}`"
              title="评论"
              @click.stop="openHomeMvComments(mv)"
            >
              <MessageCircleMore :size="24" />
              <span class="soda-action-rail__label">评论</span>
              <span v-if="getHomeMvCommentLabel(mv)" class="soda-action-rail__count">
                {{ getHomeMvCommentLabel(mv) }}
              </span>
            </button>
            <button
              type="button"
              :aria-label="homeMvDanmakuEnabled ? '关闭弹幕' : '开启弹幕'"
              :title="homeMvDanmakuEnabled ? '关闭弹幕' : '开启弹幕'"
              :class="{ active: homeMvDanmakuEnabled }"
              @click.stop="toggleHomeMvDanmaku"
            >
              <Radio :size="24" />
              <span class="soda-action-rail__label">{{ homeMvDanmakuEnabled ? '弹幕开' : '弹幕' }}</span>
            </button>
          </aside>

          <footer class="soda-mv-slide__footer">
            <div
              class="soda-slide__progress soda-mv-progress"
              role="slider"
              :tabindex="index === activeMvIndex ? 0 : -1"
              :aria-valuemin="0"
              :aria-valuemax="Math.floor(getHomeMvDuration(mv) || 0)"
              :aria-valuenow="getHomeMvProgressNow(mv)"
              :aria-label="`${mv.title} 播放进度`"
              @pointerdown="seekHomeMvFromProgress($event, mv)"
            >
              <span class="soda-slide__progress-time">{{ getHomeMvCurrentTimeLabel(mv) }}</span>
              <span class="soda-slide__progress-rail" aria-hidden="true">
                <span :style="{ width: `${getHomeMvProgress(mv)}%` }" />
              </span>
              <span class="soda-slide__progress-time">{{ getHomeMvDurationLabel(mv) }}</span>
            </div>
          </footer>
        </article>

        <div v-if="mvQueueLoading && !mvQueue.length" class="soda-video-empty">
          <Loader2 class="soda-spin" :size="34" />
          <span>正在加载 MV</span>
        </div>
      </div>
    </section>

  <CommentModal
    v-if="songCommentsModalMounted"
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

  <CommentModal
    v-if="homeMvCommentsModalMounted"
    v-model:show="homeMvCommentsModalVisible"
    title="MV 评论"
    :subtitle="homeMvCommentSubtitle"
    :total="homeMvCommentState.total"
    :hot-comments="homeMvCommentState.hotComments"
    :comments="homeMvCommentState.comments"
    :loading="homeMvCommentState.loading"
    :error="homeMvCommentState.error"
    :has-more="homeMvCommentState.more"
    @load-more="loadMoreHomeMvComments"
  />
  </div>
</template>

<script setup>
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  shallowRef,
  watch
} from 'vue'
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
import DanmakuLayer from '../components/DanmakuLayer.vue'
import { recommendedMvs as fallbackMvs, recommendedSingles } from '../data/music'
import {
  getMusicFeedData,
  getMvCommentsData,
  getMvPlaybackData,
  getSongCommentsData,
  getSongInteractionStatsData,
  getTrackLyricData,
  getVideoCenterData
} from '../services/netease'
import { usePlayerStore } from '../stores/player'
import { useSongComments } from '../composables/useSongComments'
import {
  EMPTY_SLIDE_STYLE as emptySlideStyle,
  FEED_DRAG_THRESHOLD as feedDragThreshold,
  HOME_DANMAKU_COMMENT_LIMIT as homeDanmakuCommentLimit,
  HOME_DANMAKU_MAX_ITEMS as homeDanmakuMaxItems,
  HOME_DANMAKU_PREFETCH_THRESHOLD as homeDanmakuPrefetchThreshold,
  HOME_SECTIONS as homeSections,
  LYRICS_DRAG_SCROLL_SPEED as lyricsDragScrollSpeed,
  LYRICS_LOAD_TIMEOUT_MS as lyricsLoadTimeoutMs,
  LYRICS_WHEEL_SCROLL_SPEED as lyricsWheelScrollSpeed,
  MOOD_SIGNALS as moodSignals,
  MV_RECOMMENDATION_LIMIT as mvRecommendationLimit,
  RECOMMENDATION_LIMIT as recommendationLimit,
  SLIDE_HYDRATE_RADIUS as slideHydrateRadius
} from './home/homeConstants'
import {
  applyMoodQueue,
  createLyricPlaceholder,
  createSlideStyle,
  findCurrentLyricIndex,
  formatActionCount,
  formatTime,
  getFallbackCoverTintRgb,
  isNeteaseTrackId,
  normalizeVideoUrl,
  parseDuration,
  prepareMvQueue,
  prepareQueue,
  resizeNeteaseCover,
  sampleCoverTint,
  uniqueMvs
} from './home/homeUtils'
import '../styles/home.css'

const CommentModal = defineAsyncComponent(() => import('../components/CommentModal.vue'))
const player = usePlayerStore()
const message = useMessage()
const feedScroller = ref(null)
const mvScroller = ref(null)
const homeVideoElement = ref(null)
const activeHomeSection = ref('music')
const activeMood = ref('daily')
const activeIndex = ref(0)
const activeMvIndex = ref(0)
const musicFeedSettling = ref(false)
const autoPlayAfterGesture = ref(false)
const mvAutoPlayAfterGesture = ref(false)
const likedIds = shallowRef(new Set())
const likedMvIds = shallowRef(new Set())
const songStats = shallowRef(new Map())
const mvQueue = shallowRef(prepareMvQueue(fallbackMvs))
const mvQueueLoading = ref(false)
const activeMvLoading = ref(false)
const mvDragging = ref(false)
const homeMvDanmakuEnabled = ref(true)
const homeMvCommentsModalVisible = ref(false)
const homeMvCommentsModalMounted = ref(false)
const homeMvState = reactive({
  isPlaying: false,
  isReady: false,
  currentTime: 0,
  duration: 0,
  error: ''
})
const homeMvCommentState = reactive({
  trackId: '',
  loading: false,
  error: '',
  hotComments: [],
  comments: [],
  total: 0,
  more: false,
  offset: 0
})
const homeMvDanmakuState = reactive({
  trackId: '',
  loading: false,
  error: '',
  hotComments: [],
  comments: [],
  total: 0,
  more: false,
  offset: 0
})
const songDanmakuState = reactive({
  trackId: '',
  loading: false,
  error: '',
  hotComments: [],
  comments: [],
  total: 0,
  more: false,
  offset: 0
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
const songCommentsModalMounted = ref(false)
const feedDragState = {
  pointerId: null,
  startIndex: 0,
  startY: 0,
  startScrollTop: 0,
  moved: false
}
const mvDragState = {
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
const lyricCache = new Map()
const songStatsLoadingIds = new Set()
const coverTintCache = new Map()
const coverTintRequests = new Set()
const mvPlaybackCache = new Map()
const mvPlaybackRequests = new Map()
const mvCommentCache = new Map()
let scrollFrame = 0
let mvScrollFrame = 0
let resizeFrame = 0
let autoPlayTimer = 0
let mvAutoPlayTimer = 0
let sectionSwitchSnapTimer = 0
let removeTrackEndedListener = null
let lyricRequestId = 0
let songDanmakuRequestId = 0
let homeMvDanmakuRequestId = 0
let mvPlaybackRequestId = 0
let mvQueueLoaded = false
let feedScrollLocked = false
let syncedQueue = null
let feedSnapRequestId = 0
let mvSnapRequestId = 0
let lyricsPreviewFrame = 0
let lyricsPreviewTimer = null
let lyricsWheelTimer = null
let suppressNextLyricClick = false

const activeHomeSectionIndex = computed(() =>
  Math.max(0, homeSections.findIndex((section) => section.value === activeHomeSection.value))
)
const activeSong = computed(() => recommendationQueue.value[activeIndex.value])
const activeSongId = computed(() => String(activeSong.value?.id ?? ''))
const activeMv = computed(() => mvQueue.value[activeMvIndex.value])
const activeMvId = computed(() => String(activeMv.value?.id ?? ''))
const homeMvCommentSubtitle = computed(() => {
  const mv = activeMv.value

  if (!mv) {
    return ''
  }

  return `${mv.title} - ${mv.artist}`
})
const currentTrackId = computed(() => String(player.state.currentTrack.id ?? ''))
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
const displaySongCommentTotal = songCommentState.displayTotal
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
    resetSongDanmakuStream()
    loadMoreSongDanmaku()
    hydrateVisibleCoverTints()
  },
  { immediate: true }
)

watch(danmakuEnabled, (enabled) => {
  if (enabled) {
    loadMoreSongDanmaku()
  }
})

watch(activeLyricIndex, async () => {
  if (lyricsInteractionActive.value) {
    return
  }

  await nextTick()
  centerCurrentLyric()
})

watch(activeHomeSection, async (section) => {
  if (section === 'video') {
    await loadHomeMvs()
    await snapMvToActiveIndex('auto')
    loadActiveMvPlayback(activeMv.value?.id)
    return
  }

  pauseHomeMv()
})

watch(
  () => activeMv.value?.id,
  (id) => {
    if (activeHomeSection.value !== 'video') {
      return
    }

    pauseHomeMv()
    resetHomeMvState()
    restoreHomeMvComments(id)
    resetHomeMvDanmakuStream(id)
    loadActiveMvPlayback(id, { autoplay: mvAutoPlayAfterGesture.value })
  }
)

onMounted(() => {
  activateHomeView()
  bindHomeViewEffects()
  loadRecommendations()
})

onActivated(() => {
  activateHomeView()
  bindHomeViewEffects()
})

onDeactivated(() => {
  unbindHomeViewEffects()
})

onUnmounted(() => {
  feedSnapRequestId += 1
  mvSnapRequestId += 1
  window.cancelAnimationFrame(scrollFrame)
  window.cancelAnimationFrame(mvScrollFrame)
  window.cancelAnimationFrame(resizeFrame)
  window.cancelAnimationFrame(lyricsPreviewFrame)
  window.clearTimeout(autoPlayTimer)
  window.clearTimeout(mvAutoPlayTimer)
  window.clearTimeout(sectionSwitchSnapTimer)
  clearLyricsPreviewTimer()
  clearLyricsWheelTimer()
  unbindHomeViewEffects()
})

function bindHomeViewEffects() {
  if (!removeTrackEndedListener) {
    removeTrackEndedListener = player.onTrackEnded(handleTrackEnded)
  }

  window.addEventListener('resize', handleLyricsResize)
  window.addEventListener('keydown', handleGlobalPlaybackKeydown)
}

function unbindHomeViewEffects() {
  window.removeEventListener('resize', handleLyricsResize)
  window.removeEventListener('keydown', handleGlobalPlaybackKeydown)
  pauseHomeMv()
  removeTrackEndedListener?.()
  removeTrackEndedListener = null
}

function activateHomeView() {
  if (!recommendationQueue.value.length) {
    recommendationQueue.value = applyMoodQueue(allSongs.value, activeMood.value)
  }

  restoreActiveTrackPosition()
  syncPlayerQueue()
  snapFeedToActiveIndex('auto')
  hydrateVisibleCoverTints()

  if (activeHomeSection.value === 'video') {
    snapMvToActiveIndex('auto')
  }
}

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

function setHomeSection(value) {
  if (value === activeHomeSection.value) {
    return
  }

  if (value === 'music') {
    stabilizeMusicFeedAfterSectionSwitch()
    activeHomeSection.value = value
    return
  }

  musicFeedSettling.value = false
  activeHomeSection.value = value
  nextTick(() => snapMvToActiveIndex('auto'))
}

function stabilizeMusicFeedAfterSectionSwitch() {
  const targetIndex = clampSongIndex(activeIndex.value)

  cancelPendingFeedScroll()
  feedDragging.value = false
  feedDragState.pointerId = null
  feedScrollLocked = true
  musicFeedSettling.value = true
  window.clearTimeout(sectionSwitchSnapTimer)

  nextTick(async () => {
    await waitForLayoutFrame()

    if (activeHomeSection.value !== 'music') {
      finishMusicFeedSectionSwitch(false)
      return
    }

    activeIndex.value = targetIndex
    scrollToIndex(targetIndex, 'auto')
    await waitForLayoutFrame()

    if (activeHomeSection.value !== 'music') {
      finishMusicFeedSectionSwitch(false)
      return
    }

    activeIndex.value = targetIndex
    scrollToIndex(targetIndex, 'auto')

    sectionSwitchSnapTimer = window.setTimeout(() => {
      if (activeHomeSection.value === 'music') {
        activeIndex.value = targetIndex
        scrollToIndex(targetIndex, 'auto')
        finishMusicFeedSectionSwitch(true)
        return
      }

      finishMusicFeedSectionSwitch(false)
    }, 80)
  })
}

function finishMusicFeedSectionSwitch(visible) {
  if (!visible) {
    musicFeedSettling.value = false
    feedScrollLocked = false
    return
  } else {
    window.requestAnimationFrame(() => {
      if (activeHomeSection.value === 'music') {
        musicFeedSettling.value = false
      }

      feedScrollLocked = false
    })
  }
}

function cancelPendingFeedScroll() {
  if (!scrollFrame) {
    return
  }

  window.cancelAnimationFrame(scrollFrame)
  scrollFrame = 0
}

function handleGlobalPlaybackKeydown(event) {
  if (!isPlaybackSpaceKey(event) || shouldIgnorePlaybackShortcut(event)) {
    return
  }

  event.preventDefault()

  if (activeHomeSection.value === 'video') {
    toggleHomeMvPlayback(activeMvIndex.value)
    return
  }

  autoPlayAfterGesture.value = true
  playActiveSong()
}

function isPlaybackSpaceKey(event) {
  return (
    event.code === 'Space' ||
    event.key === ' ' ||
    event.key === 'Spacebar'
  )
}

function shouldIgnorePlaybackShortcut(event) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) {
    return true
  }

  const target = event.target

  return Boolean(target?.closest?.(
    'input, textarea, select, button, a, [contenteditable="true"], [role="textbox"]'
  ))
}

async function loadHomeMvs({ force = false } = {}) {
  if ((mvQueueLoaded && !force) || mvQueueLoading.value) {
    return
  }

  mvQueueLoading.value = true
  homeMvState.error = ''

  try {
    const data = await getVideoCenterData({ limit: mvRecommendationLimit })
    const mvs = uniqueMvs([
      data.active?.mv,
      ...data.recommended,
      ...data.first,
      ...data.top,
      ...data.exclusive,
      ...data.all
    ])

    mvQueue.value = prepareMvQueue(mvs.length ? mvs : fallbackMvs)
    activeMvIndex.value = Math.min(activeMvIndex.value, Math.max(0, mvQueue.value.length - 1))
    mvQueueLoaded = true

    if (data.active?.mv?.id) {
      rememberHomeMvPayload(data.active)
    }
  } catch (error) {
    console.warn('Failed to load home MV feed:', error)
    homeMvState.error = error?.message || 'MV 加载失败'
    mvQueue.value = prepareMvQueue(fallbackMvs)
  } finally {
    mvQueueLoading.value = false
  }
}

async function loadActiveMvPlayback(id, { autoplay = false } = {}) {
  const mvId = String(id ?? '')

  if (!mvId) {
    return
  }

  const requestId = ++mvPlaybackRequestId
  homeMvState.error = ''

  if (mvPlaybackCache.has(mvId)) {
    activeMvLoading.value = false
    rememberHomeMvPayload(mvPlaybackCache.get(mvId))
    await nextTick()

    if (autoplay && requestId === mvPlaybackRequestId) {
      await playCurrentHomeMv({ skipLoad: true })
    }
    return
  }

  activeMvLoading.value = true

  try {
    const payload = await getHomeMvPlayback(mvId)

    if (requestId !== mvPlaybackRequestId || mvId !== activeMvId.value) {
      return
    }

    rememberHomeMvPayload(payload)
    await nextTick()

    if (autoplay) {
      await playCurrentHomeMv({ skipLoad: true })
    }
  } catch (error) {
    if (requestId === mvPlaybackRequestId) {
      console.warn('Failed to load home MV playback:', error)
      homeMvState.error = error?.message || '播放地址加载失败'
    }
  } finally {
    if (requestId === mvPlaybackRequestId) {
      activeMvLoading.value = false
    }
  }
}

function getHomeMvPlayback(id) {
  const mvId = String(id)

  if (mvPlaybackCache.has(mvId)) {
    return Promise.resolve(mvPlaybackCache.get(mvId))
  }

  if (mvPlaybackRequests.has(mvId)) {
    return mvPlaybackRequests.get(mvId)
  }

  const request = getMvPlaybackData(mvId)
    .then((payload) => {
      mvPlaybackCache.set(mvId, payload)
      return payload
    })
    .finally(() => {
      mvPlaybackRequests.delete(mvId)
    })

  mvPlaybackRequests.set(mvId, request)
  return request
}

function rememberHomeMvPayload(payload) {
  const mv = payload?.mv

  if (!mv?.id) {
    return
  }

  mvPlaybackCache.set(String(mv.id), payload)
  if (payload.comments) {
    cacheHomeMvComments(mv.id, payload.comments)
  }
  mvQueue.value = mvQueue.value.map((item) =>
    String(item.id) === String(mv.id)
      ? {
          ...item,
          ...mv,
          coverUrl: resizeNeteaseCover(mv.coverUrl ?? item.coverUrl, 960),
          playCount: mv.playCount || item.playCount,
          desc: mv.description || mv.desc || item.desc
        }
      : item
  )

  if (String(mv.id) === activeMvId.value && payload.comments) {
    applyHomeMvComments(mv.id, payload.comments)
    resetHomeMvDanmakuStream(mv.id, payload.comments)
    loadMoreHomeMvDanmaku(mv.id)
  }
}

function cacheHomeMvComments(trackId, data) {
  const id = String(trackId ?? '')

  if (!id) {
    return
  }

  mvCommentCache.set(id, {
    hotComments: data.hotComments ?? [],
    comments: data.comments ?? [],
    total: data.total ?? 0,
    more: Boolean(data.more),
    offset: data.comments?.length ?? 0
  })
}

function restoreHomeMvComments(trackId) {
  const id = String(trackId ?? '')
  const cached = mvCommentCache.get(id)

  if (cached) {
    applyHomeMvComments(id, cached)
    return
  }

  homeMvCommentState.trackId = id
  homeMvCommentState.error = ''
  homeMvCommentState.hotComments = []
  homeMvCommentState.comments = []
  homeMvCommentState.total = 0
  homeMvCommentState.more = false
  homeMvCommentState.offset = 0
}

function applyHomeMvComments(trackId, data) {
  homeMvCommentState.trackId = String(trackId ?? '')
  homeMvCommentState.error = ''
  homeMvCommentState.hotComments = data.hotComments ?? []
  homeMvCommentState.comments = data.comments ?? []
  homeMvCommentState.total = data.total ?? 0
  homeMvCommentState.more = Boolean(data.more)
  homeMvCommentState.offset = data.offset ?? data.comments?.length ?? 0
}

function toggleHomeMvLike(mv) {
  if (!mv?.id) {
    return
  }

  const nextLikedIds = new Set(likedMvIds.value)
  const id = String(mv.id)

  if (nextLikedIds.has(id)) {
    nextLikedIds.delete(id)
  } else {
    nextLikedIds.add(id)
  }

  likedMvIds.value = nextLikedIds
}

async function openHomeMvComments(mv = activeMv.value) {
  if (!mv?.id) {
    return
  }

  homeMvCommentsModalMounted.value = true
  homeMvCommentsModalVisible.value = true

  if (String(homeMvCommentState.trackId) !== String(mv.id)) {
    restoreHomeMvComments(mv.id)
  }

  if (!homeMvCommentState.comments.length && !homeMvCommentState.hotComments.length) {
    await loadHomeMvComments(mv.id, { reset: true })
  }
}

async function loadHomeMvComments(trackId, { reset = false } = {}) {
  const id = String(trackId ?? '')

  if (!id || homeMvCommentState.loading) {
    return
  }

  homeMvCommentState.loading = true
  homeMvCommentState.error = ''

  try {
    const data = await getMvCommentsData({
      id,
      limit: homeDanmakuCommentLimit,
      offset: reset ? 0 : homeMvCommentState.offset
    })
    const nextData = {
      hotComments: reset ? data.hotComments : homeMvCommentState.hotComments,
      comments: reset ? data.comments : [...homeMvCommentState.comments, ...data.comments],
      total: data.total,
      more: data.more,
      offset: reset
        ? data.comments.length
        : homeMvCommentState.comments.length + data.comments.length
    }

    cacheHomeMvComments(id, nextData)
    applyHomeMvComments(id, nextData)
  } catch (error) {
    console.warn('Failed to load home MV comments:', error)
    homeMvCommentState.error = error?.message || 'MV 评论加载失败'
  } finally {
    homeMvCommentState.loading = false
  }
}

function loadMoreHomeMvComments() {
  if (!homeMvCommentState.more) {
    return
  }

  loadHomeMvComments(homeMvCommentState.trackId || activeMv.value?.id)
}

function toggleHomeMvDanmaku() {
  homeMvDanmakuEnabled.value = !homeMvDanmakuEnabled.value

  if (homeMvDanmakuEnabled.value) {
    loadMoreHomeMvDanmaku()
  }
}

function resetHomeMvDanmakuStream(trackId = activeMv.value?.id, data = null) {
  const id = String(trackId ?? '')
  homeMvDanmakuRequestId += 1
  homeMvDanmakuState.trackId = id
  homeMvDanmakuState.loading = false
  homeMvDanmakuState.error = ''
  homeMvDanmakuState.hotComments = data?.hotComments ?? []
  homeMvDanmakuState.comments = data?.comments ?? []
  homeMvDanmakuState.total = data?.total ?? 0
  homeMvDanmakuState.offset = data?.offset ?? data?.comments?.length ?? 0
  homeMvDanmakuState.more = Boolean(isNeteaseTrackId(id) && (data?.more ?? true))
}

async function loadMoreHomeMvDanmaku(trackId = activeMv.value?.id) {
  const id = String(trackId ?? homeMvDanmakuState.trackId ?? '')

  if (
    !id ||
    !homeMvDanmakuEnabled.value ||
    !isNeteaseTrackId(id) ||
    homeMvDanmakuState.loading ||
    !homeMvDanmakuState.more ||
    String(homeMvDanmakuState.trackId) !== id
  ) {
    return
  }

  const requestId = ++homeMvDanmakuRequestId
  homeMvDanmakuState.loading = true
  homeMvDanmakuState.error = ''

  try {
    const data = await getMvCommentsData({
      id,
      limit: homeDanmakuCommentLimit,
      offset: homeMvDanmakuState.offset
    })

    if (requestId !== homeMvDanmakuRequestId || id !== String(activeMv.value?.id ?? '')) {
      return
    }

    homeMvDanmakuState.hotComments = homeMvDanmakuState.offset === 0 ? data.hotComments : []
    homeMvDanmakuState.comments = data.comments
    homeMvDanmakuState.total = data.total
    homeMvDanmakuState.offset += data.comments.length
    homeMvDanmakuState.more = Boolean(data.more && data.comments.length)
  } catch (error) {
    if (requestId === homeMvDanmakuRequestId) {
      console.warn('Failed to load home MV danmaku comments:', error)
      homeMvDanmakuState.error = error?.message || 'MV 弹幕评论加载失败'
      homeMvDanmakuState.more = false
    }
  } finally {
    if (requestId === homeMvDanmakuRequestId) {
      homeMvDanmakuState.loading = false
    }
  }
}

async function snapMvToActiveIndex(behavior = 'auto') {
  const requestId = ++mvSnapRequestId

  await nextTick()
  await waitForLayoutFrame()

  if (requestId !== mvSnapRequestId) {
    return
  }

  scrollToMvIndex(activeMvIndex.value, behavior)
  await waitForLayoutFrame()

  if (requestId === mvSnapRequestId) {
    scrollToMvIndex(activeMvIndex.value, 'auto')
  }
}

function handleMvScroll() {
  if (mvScrollFrame) {
    return
  }

  mvScrollFrame = window.requestAnimationFrame(() => {
    mvScrollFrame = 0

    if (!mvScroller.value?.clientHeight || !mvQueue.value.length) {
      return
    }

    const nextIndex = getMvIndexFromScroll()

    if (nextIndex === activeMvIndex.value) {
      return
    }

    activeMvIndex.value = nextIndex

    if (mvAutoPlayAfterGesture.value && !mvDragging.value) {
      scheduleMvAutoPlay()
    }
  })
}

function startMvDrag(event) {
  const scroller = mvScroller.value

  if (!scroller || event.button > 0 || shouldIgnoreMvDrag(event)) {
    return
  }

  mvSnapRequestId += 1
  mvDragging.value = true
  mvDragState.pointerId = event.pointerId
  mvDragState.startIndex = activeMvIndex.value
  mvDragState.startY = event.clientY
  mvDragState.startScrollTop = scroller.scrollTop
  mvDragState.moved = false
  scroller.style.scrollSnapType = 'none'
  scroller.setPointerCapture?.(event.pointerId)
  event.preventDefault()
}

function handleMvPointerMove(event) {
  const scroller = mvScroller.value

  if (!scroller || !mvDragging.value || event.pointerId !== mvDragState.pointerId) {
    return
  }

  const deltaY = event.clientY - mvDragState.startY

  if (Math.abs(deltaY) < feedDragThreshold && !mvDragState.moved) {
    return
  }

  mvDragState.moved = true
  event.preventDefault()
  scroller.scrollTop = mvDragState.startScrollTop - deltaY
}

function stopMvDrag(event) {
  if (!mvDragging.value || event.pointerId !== mvDragState.pointerId) {
    return
  }

  const scroller = mvScroller.value
  const shouldSnap = mvDragState.moved

  scroller?.releasePointerCapture?.(event.pointerId)
  if (scroller) {
    scroller.style.scrollSnapType = ''
  }
  mvDragging.value = false
  mvDragState.pointerId = null

  if (!shouldSnap || !scroller?.clientHeight) {
    return
  }

  const nextIndex = getMvIndexFromScroll()
  activeMvIndex.value = nextIndex
  scrollToMvIndex(nextIndex, 'smooth')

  if (nextIndex !== mvDragState.startIndex) {
    mvAutoPlayAfterGesture.value = true
    scheduleMvAutoPlay()
  }
}

function shouldIgnoreMvDrag(event) {
  const target = event.target

  return Boolean(target?.closest?.(
    '.soda-mv-stage, .soda-mv-action-rail, .soda-mv-progress, button, a, input, textarea, select'
  ))
}

function handleMvKeydown(event) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
    return
  }

  event.preventDefault()
  scrollToMvIndex(activeMvIndex.value + (event.key === 'ArrowDown' ? 1 : -1), 'smooth')
}

function getMvIndexFromScroll() {
  const scroller = mvScroller.value

  if (!scroller?.clientHeight || !mvQueue.value.length) {
    return activeMvIndex.value
  }

  let nearestIndex = activeMvIndex.value
  let nearestDistance = Number.POSITIVE_INFINITY

  Array.from(scroller.children).forEach((slide, index) => {
    if (!slide.classList?.contains('soda-mv-slide')) {
      return
    }

    const distance = Math.abs(slide.offsetTop - scroller.scrollTop)

    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  })

  return Math.min(
    mvQueue.value.length - 1,
    Math.max(0, nearestIndex)
  )
}

function getMvSlideTop(index) {
  const scroller = mvScroller.value
  const slide = scroller?.querySelectorAll('.soda-mv-slide')?.[index]

  return slide?.offsetTop ?? index * (scroller?.clientHeight || 0)
}

function scrollToMvIndex(index, behavior = 'smooth') {
  const scroller = mvScroller.value

  if (!scroller || !mvQueue.value.length) {
    return
  }

  const nextIndex = Math.min(
    mvQueue.value.length - 1,
    Math.max(0, index)
  )

  scroller.scrollTo({
    top: getMvSlideTop(nextIndex),
    behavior
  })
}

function scheduleMvAutoPlay() {
  window.clearTimeout(mvAutoPlayTimer)
  mvAutoPlayTimer = window.setTimeout(() => {
    loadActiveMvPlayback(activeMv.value?.id, { autoplay: true })
  }, 220)
}

async function playMvFromGesture(index) {
  mvAutoPlayAfterGesture.value = true
  const shouldScroll = index !== activeMvIndex.value
  activeMvIndex.value = index
  await nextTick()

  if (shouldScroll) {
    scrollToMvIndex(index, 'smooth')
  }

  if (!shouldScroll && getHomeMvVideoUrl(activeMv.value)) {
    await playCurrentHomeMv({ skipLoad: true })
    return
  }

  await loadActiveMvPlayback(activeMv.value?.id, { autoplay: true })
  await playCurrentHomeMv({ skipLoad: true })
}

async function toggleHomeMvPlayback(index = activeMvIndex.value) {
  if (index !== activeMvIndex.value) {
    await playMvFromGesture(index)
    return
  }

  if (homeMvState.isPlaying) {
    pauseHomeMv()
    return
  }

  await playMvFromGesture(index)
}

async function goNextMvFromGesture() {
  if (!mvQueue.value.length) {
    return
  }

  mvAutoPlayAfterGesture.value = true
  const nextIndex = (activeMvIndex.value + 1) % mvQueue.value.length
  activeMvIndex.value = nextIndex
  scrollToMvIndex(nextIndex, 'smooth')
  await loadActiveMvPlayback(activeMv.value?.id, { autoplay: true })
}

async function playCurrentHomeMv({ skipLoad = false } = {}) {
  const mv = activeMv.value

  if (!mv?.id) {
    return false
  }

  if (!skipLoad && !getHomeMvVideoUrl(mv)) {
    await loadActiveMvPlayback(mv.id, { autoplay: true })
    return false
  }

  await nextTick()
  const video = homeVideoElement.value

  if (!video || !getHomeMvVideoUrl(mv)) {
    return false
  }

  try {
    if (player.state.isPlaying) {
      await player.togglePlay()
    }

    await video.play()
    homeMvState.error = ''
    return true
  } catch (error) {
    console.warn('Failed to play home MV:', error)
    homeMvState.error = '浏览器阻止自动播放，请点击播放'
    return false
  }
}

function pauseHomeMv() {
  const video = homeVideoElement.value

  if (video && !video.paused) {
    video.pause()
  }

  homeMvState.isPlaying = false
}

function resetHomeMvState() {
  homeVideoElement.value = null
  homeMvState.isPlaying = false
  homeMvState.isReady = false
  homeMvState.currentTime = 0
  homeMvState.duration = 0
  homeMvState.error = ''
}

function setHomeVideoElement(element, index) {
  if (element && index === activeMvIndex.value) {
    homeVideoElement.value = element
  }
}

function handleHomeMvMetadata(event) {
  const video = event.target
  homeMvState.isReady = true
  homeMvState.duration = Number.isFinite(video.duration)
    ? video.duration
    : parseDuration(activeMv.value?.duration)
}

function handleHomeMvTimeUpdate(event) {
  homeMvState.currentTime = Number.isFinite(event.target.currentTime)
    ? event.target.currentTime
    : 0
}

function handleHomeMvPlay() {
  homeMvState.isPlaying = true
  homeMvState.error = ''

  if (player.state.isPlaying) {
    player.togglePlay()
  }
}

function handleHomeMvPause() {
  homeMvState.isPlaying = false
}

function handleHomeMvError() {
  homeMvState.isPlaying = false
  homeMvState.error = '视频播放失败'
}

function seekHomeMvFromProgress(event, mv) {
  if (String(mv?.id) !== activeMvId.value) {
    return
  }

  const video = homeVideoElement.value
  const duration = homeMvState.duration || video?.duration || parseDuration(mv.duration)

  if (!video || !duration) {
    return
  }

  const rail = event.currentTarget.querySelector('.soda-slide__progress-rail')
  const rect = (rail ?? event.currentTarget).getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  const nextTime = ratio * duration

  video.currentTime = nextTime
  homeMvState.currentTime = nextTime
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
  if (feedScrollLocked || activeHomeSection.value !== 'music' || scrollFrame) {
    return
  }

  scrollFrame = window.requestAnimationFrame(() => {
    scrollFrame = 0

    if (feedScrollLocked || activeHomeSection.value !== 'music') {
      return
    }

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

  songCommentsModalMounted.value = true
  songCommentsModalVisible.value = true
  await songCommentState.open(song)
}

function toggleDanmaku() {
  danmakuEnabled.value = !danmakuEnabled.value
}

function resetSongDanmakuStream(song = activeSong.value) {
  songDanmakuRequestId += 1
  songDanmakuState.trackId = String(song?.id ?? '')
  songDanmakuState.loading = false
  songDanmakuState.error = ''
  songDanmakuState.hotComments = []
  songDanmakuState.comments = []
  songDanmakuState.total = 0
  songDanmakuState.offset = 0
  songDanmakuState.more = Boolean(isNeteaseTrackId(songDanmakuState.trackId))
}

async function loadMoreSongDanmaku(song = activeSong.value) {
  const id = String(song?.id ?? songDanmakuState.trackId ?? '')

  if (
    !danmakuEnabled.value ||
    !isNeteaseTrackId(id) ||
    songDanmakuState.loading ||
    !songDanmakuState.more
  ) {
    return
  }

  const requestId = ++songDanmakuRequestId
  songDanmakuState.loading = true
  songDanmakuState.error = ''

  try {
    const data = await getSongCommentsData({
      id,
      limit: homeDanmakuCommentLimit,
      offset: songDanmakuState.offset
    })

    if (requestId !== songDanmakuRequestId || id !== String(activeSong.value?.id ?? '')) {
      return
    }

    songDanmakuState.trackId = id
    songDanmakuState.hotComments = songDanmakuState.offset === 0 ? data.hotComments : []
    songDanmakuState.comments = data.comments
    songDanmakuState.total = data.total
    songDanmakuState.offset += data.comments.length
    songDanmakuState.more = Boolean(data.more && data.comments.length)

    updateSongStats(id, {
      commentCount: data.total,
      commentCountLabel: formatActionCount(data.total)
    })
  } catch (error) {
    if (requestId === songDanmakuRequestId) {
      console.warn('Failed to load song danmaku comments:', error)
      songDanmakuState.error = error?.message || '弹幕评论加载失败'
      songDanmakuState.more = false
    }
  } finally {
    if (requestId === songDanmakuRequestId) {
      songDanmakuState.loading = false
    }
  }
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

function getHomeMvVideoUrl(mv) {
  return normalizeVideoUrl(mv?.url)
}

function isHomeMvLiked(mv) {
  return Boolean(mv?.id && likedMvIds.value.has(String(mv.id)))
}

function getHomeMvStats(mv) {
  return mv?.stats ?? mv ?? {}
}

function getHomeMvLikeLabel(mv) {
  const stats = getHomeMvStats(mv)
  const baseCount = Number(stats.likedCount) || 0
  const count = baseCount + (isHomeMvLiked(mv) ? 1 : 0)

  return formatActionCount(count)
}

function getHomeMvCommentLabel(mv) {
  if (String(mv?.id) === String(homeMvCommentState.trackId) && homeMvCommentState.total) {
    return formatActionCount(homeMvCommentState.total)
  }

  const stats = getHomeMvStats(mv)

  return formatActionCount(stats.commentCount)
}

function isActiveMvLoading(mv) {
  return Boolean(
    activeMvLoading.value &&
    mv?.id &&
    String(mv.id) === activeMvId.value
  )
}

function isActiveMvPlaying(mv) {
  return Boolean(
    mv?.id &&
    String(mv.id) === activeMvId.value &&
    homeMvState.isPlaying
  )
}

function getHomeMvDuration(mv) {
  if (String(mv?.id) === activeMvId.value) {
    return homeMvState.duration || parseDuration(mv.duration)
  }

  return parseDuration(mv?.duration)
}

function getHomeMvProgress(mv) {
  const duration = getHomeMvDuration(mv)

  if (String(mv?.id) !== activeMvId.value || !duration) {
    return 0
  }

  return Math.min(100, (homeMvState.currentTime / duration) * 100)
}

function getHomeMvProgressNow(mv) {
  return String(mv?.id) === activeMvId.value
    ? Math.floor(homeMvState.currentTime || 0)
    : 0
}

function getHomeMvCurrentTimeLabel(mv) {
  return String(mv?.id) === activeMvId.value
    ? formatTime(homeMvState.currentTime)
    : '0:00'
}

function getHomeMvDurationLabel(mv) {
  if (String(mv?.id) === activeMvId.value && homeMvState.duration) {
    return formatTime(homeMvState.duration)
  }

  return mv?.duration || '0:00'
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

function clampSongIndex(index) {
  if (!recommendationQueue.value.length) {
    return 0
  }

  return Math.min(
    recommendationQueue.value.length - 1,
    Math.max(0, index)
  )
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

function showPlaybackError(success) {
  if (success) {
    return
  }

  message.error(player.state.error?.message || '当前歌曲暂无可播放链接')
}

</script>
