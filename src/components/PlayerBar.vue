<template>
  <FullScreenPlayer
    v-if="fullPlayerMounted"
    :open="fullPlayerOpen"
    :track="currentTrack"
    :source-rect="fullPlayerCoverRect"
    :danmaku-enabled="danmakuEnabled"
    :danmaku-hot-comments="fullPlayerDanmakuState.hotComments"
    :danmaku-comments="fullPlayerDanmakuState.comments"
    :danmaku-has-more="fullPlayerDanmakuState.more"
    :danmaku-loading="fullPlayerDanmakuState.loading"
    :danmaku-prefetch-threshold="fullPlayerDanmakuPrefetchThreshold"
    :danmaku-max-items="fullPlayerDanmakuMaxItems"
    :danmaku-activation-delay="fullPlayerDanmakuActivationDelay"
    :visualizer-mode="fullPlayerVisualizerMode"
    @danmaku-need-more="loadMoreFullPlayerDanmaku"
    @close="closeFullPlayer"
    @cover-flight-end="handleCoverFlightEnd"
  />

  <footer
    ref="playerBar"
    class="player"
    :class="{ 'player--full-screen': fullPlayerOpen }"
    :style="playerStyle"
  >
    <div class="track-summary">
      <button
        ref="albumArtButton"
        class="album-art album-art--mini album-art-button"
        :class="{ 'album-art-button--expanded': albumArtHidden }"
        type="button"
        :aria-label="fullPlayerOpen ? '收起全屏播放器' : '打开全屏播放器'"
        @click="toggleFullPlayer"
      >
        <span />
        <span class="album-art-button__hover">
          <component :is="fullPlayerOpen ? Minimize2 : Maximize2" :size="22" />
        </span>
      </button>
      <div class="track-summary__body">
        <div class="track-summary__text">
          <span
            ref="trackMetaViewport"
            class="track-summary__marquee"
            :class="{ 'is-overflowing': trackMetaOverflowing }"
            :title="`${currentTrack.name} - ${currentTrack.artist}`"
          >
            <span ref="trackMetaMeasure" class="track-summary__marquee-measure" aria-hidden="true">
              <strong class="track-summary__marquee-title">{{ currentTrack.name }}</strong>
              <span class="track-summary__separator">-</span>
              <small class="track-summary__marquee-artist">{{ currentTrack.artist }}</small>
            </span>
            <span class="track-summary__marquee-frame">
              <span class="track-summary__marquee-content">
                <strong class="track-summary__marquee-title">{{ currentTrack.name }}</strong>
                <span class="track-summary__separator" aria-hidden="true">-</span>
                <small class="track-summary__marquee-artist">{{ currentTrack.artist }}</small>
              </span>
              <span
                v-if="trackMetaOverflowing"
                class="track-summary__marquee-content"
                aria-hidden="true"
              >
                <strong class="track-summary__marquee-title">{{ currentTrack.name }}</strong>
                <span class="track-summary__separator" aria-hidden="true">-</span>
                <small class="track-summary__marquee-artist">{{ currentTrack.artist }}</small>
              </span>
            </span>
          </span>
        </div>
        <div class="track-summary__actions">
          <button
            class="track-action-button"
            type="button"
            :class="{ active: currentTrackLiked }"
            :aria-label="currentTrackLiked ? '取消喜欢' : '喜欢'"
            @click="toggleCurrentTrackLike"
          >
            <Heart :size="25" :fill="currentTrackLiked ? 'currentColor' : 'none'" />
          </button>
          <button
            class="track-action-button track-action-button--comment"
            type="button"
            aria-label="评论"
            @click="openSongCommentsModal"
          >
            <MessageCircleMore :size="25" />
            <span v-if="displaySongCommentTotal">
              {{ formatCommentBadge(displaySongCommentTotal) }}
            </span>
          </button>
          <button class="track-action-button" type="button" aria-label="更多">
            <Ellipsis :size="25" />
          </button>
        </div>
      </div>
    </div>

    <div class="player-center">
      <div class="play-controls">
        <div class="control-popover-wrap">
          <button
            class="mode-button"
            type="button"
            :aria-label="activePlayMode.label"
            :class="{ active: modeMenuOpen }"
            @click="toggleModeMenu"
          >
            <component :is="activePlayMode.icon" :size="19" />
          </button>
          <div v-if="modeMenuOpen" class="player-popover mode-popover">
            <button
              v-for="mode in playModes"
              :key="mode.value"
              class="mode-option"
              type="button"
              :class="{ active: playMode === mode.value }"
              @click="selectPlayMode(mode.value)"
            >
              <component :is="mode.icon" :size="22" />
              <span>{{ mode.label }}</span>
            </button>
          </div>
        </div>
        <button type="button" aria-label="上一首" @click="playPreviousTrack"><SkipBack :size="19" /></button>
        <button
          class="play-button"
          type="button"
          :class="{ 'play-button--loading': player.state.isLoading }"
          :aria-label="player.state.isLoading ? '音乐加载中' : player.state.isPlaying ? '暂停' : '播放'"
          :aria-busy="player.state.isLoading"
          :disabled="player.state.isLoading"
          @click="player.togglePlay"
        >
          <Loader2
            v-if="player.state.isLoading"
            class="play-button__loading-icon"
            :size="22"
          />
          <Pause v-else-if="player.state.isPlaying" :size="22" fill="currentColor" />
          <Play v-else :size="22" fill="currentColor" />
        </button>
        <button type="button" aria-label="下一首" @click="playNextTrack"><SkipForward :size="19" /></button>
        <div class="control-popover-wrap">
          <button
            class="volume-button"
            type="button"
            aria-label="音量"
            :class="{ active: volumeMenuOpen }"
            @click="toggleVolumeMenu"
          >
            <component :is="currentVolumeIcon" :size="20" />
          </button>
          <div v-if="volumeMenuOpen" class="player-popover volume-popover">
            <div class="volume-control">
              <span class="volume-rail" aria-hidden="true">
                <span class="volume-fill" :style="{ height: `${volume}%` }" />
              </span>
              <button class="volume-step-button" type="button" aria-label="提高音量" @click="increaseVolume">
                <Plus :size="12" />
              </button>
              <input
                v-model="volume"
                class="volume-slider"
                type="range"
                min="0"
                max="100"
                aria-label="音量大小"
              />
            </div>
            <div class="volume-value-row">
              <strong>{{ volume }}%</strong>
            </div>
            <span class="volume-divider" />
            <button class="volume-mute-button" type="button" :aria-label="volume > 0 ? '静音' : '恢复音量'" @click="toggleMute">
              <component :is="currentVolumeIcon" :size="22" />
            </button>
          </div>
        </div>
      </div>
      <div class="progress-row">
        <span>{{ formatTime(displayProgressTime) }}</span>
        <div
          ref="progressBar"
          class="player-progress"
          role="slider"
          tabindex="0"
          :aria-valuemin="0"
          :aria-valuemax="progressAriaMax"
          :aria-valuenow="progressAriaNow"
          @pointerdown="startProgressDrag"
          @pointermove="handleProgressPointerMove"
          @pointerup="stopProgressDrag"
          @pointercancel="cancelProgressDrag"
          @pointerleave="hideProgressPreview"
          @keydown="handleProgressKeydown"
        >
          <span class="player-progress__rail" aria-hidden="true">
            <span class="player-progress__fill" :style="{ width: `${displayProgressPercentage}%` }" />
            <span class="player-progress__thumb" :style="{ left: `${displayProgressPercentage}%` }" />
          </span>
          <span
            v-if="progressPreviewVisible"
            class="player-progress__tooltip"
            :style="{ left: `${progressTooltipPercent}%` }"
          >
            <strong>{{ progressPreviewLyric }}</strong>
            <small>{{ formatTime(progressPreviewTime) }}</small>
          </span>
        </div>
        <span>{{ currentTrack.duration }}</span>
      </div>
    </div>

    <div class="player-tools">
      <button
        v-if="fullPlayerOpen"
        class="icon-button"
        type="button"
        :aria-label="danmakuEnabled ? '关闭弹幕' : '开启弹幕'"
        :title="danmakuEnabled ? '关闭弹幕' : '开启弹幕'"
        :class="{ active: danmakuEnabled }"
        @click="toggleDanmaku"
      >
        <Radio :size="18" />
      </button>
      <div v-if="fullPlayerOpen" class="control-popover-wrap visualizer-popover-wrap">
        <button
          class="icon-button"
          type="button"
          :aria-label="`频谱效果：${activeVisualizerMode.label}`"
          :title="`频谱效果：${activeVisualizerMode.label}`"
          :aria-pressed="visualizerMenuOpen"
          :class="{ active: visualizerMenuOpen }"
          @click="toggleVisualizerMenu"
        >
          <Settings2 :size="18" />
        </button>
        <div v-if="visualizerMenuOpen" class="player-popover visualizer-popover">
          <button
            v-for="mode in visualizerModes"
            :key="mode.value"
            class="visualizer-option"
            type="button"
            :aria-pressed="fullPlayerVisualizerMode === mode.value"
            :class="{ active: fullPlayerVisualizerMode === mode.value }"
            @click="selectVisualizerMode(mode.value)"
          >
            <component :is="mode.icon" :size="18" />
            <span>{{ mode.label }}</span>
          </button>
        </div>
      </div>
      <button class="icon-button" type="button" aria-label="麦克风"><Mic2 :size="17" /></button>
      <button
        v-if="desktopLyricsAvailable"
        class="icon-button"
        type="button"
        :aria-label="desktopLyricsButtonLabel"
        :aria-pressed="desktopLyricsWindowOpen"
        :title="desktopLyricsButtonLabel"
        :class="{ active: desktopLyricsWindowOpen, locked: desktopLyricsLocked }"
        @click="toggleDesktopLyrics"
      >
        <Captions :size="18" />
      </button>
      <div class="control-popover-wrap queue-popover-wrap">
        <button
          class="icon-button with-dot"
          type="button"
          aria-label="播放列表"
          :class="{ active: queueMenuOpen }"
          @click="toggleQueueMenu"
        >
          <ListMusic :size="18" />
        </button>
        <Transition :name="`queue-${theme.state.queueTransition}`">
          <div v-if="queueMenuOpen" class="player-popover queue-popover">
            <header class="queue-popover__head">
              <div>
                <strong>播放列表</strong>
                <small>{{ queueTracks.length }} 首歌曲</small>
              </div>
              <button type="button">清空</button>
            </header>
            <div class="queue-popover__list">
              <SongListRow
                v-for="track in queueTracks"
                :key="track.queueKey"
                :track="track"
                compact
                :show-vip-playback-warning="false"
                @play="playQueueTrack"
              />
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </footer>

  <CommentModal
    v-if="songCommentsModalMounted"
    v-model:show="songCommentsModalVisible"
    title="歌曲评论"
    :subtitle="`${currentTrack.name} - ${currentTrack.artist}`"
    :total="displaySongCommentTotal"
    :hot-comments="songHotComments"
    :comments="songComments"
    :loading="songCommentsLoading"
    :error="songCommentsError"
    :has-more="songCommentsHasMore"
    @load-more="loadMoreSongComments"
  />
</template>

<script setup>
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { AudioLines, Captions, Ellipsis, Gauge, Heart, ListMusic, Loader2, Maximize2, MessageCircleMore, Mic2, Minimize2, Orbit, Pause, Play, Plus, Radio, Repeat, Repeat1, Repeat2, Settings2, Shuffle, SkipBack, SkipForward, Sparkles, Volume2, VolumeX, Waves } from 'lucide-vue-next'
import { useMessage } from 'naive-ui'
import SongListRow from './SongListRow.vue'
import { STORAGE_KEYS } from '../config/app'
import { useThemeStore } from '../stores/theme'
import { usePlayerStore } from '../stores/player'
import { useLibraryStore } from '../stores/library'
import { useAuthStore } from '../stores/auth'
import { getSongCommentsData, getSongInteractionStatsData, getTrackLyricData, updateSongLikeStateData } from '../services/netease'
import { useSongComments } from '../composables/useSongComments'
import { readStorage, writeStorage } from '../utils/storage'
import { formatTime } from '../utils/time'
import {
  createLyricPlaceholder,
  findCurrentLyricIndex
} from '../utils/lyrics'
import '../styles/player.css'

const CommentModal = defineAsyncComponent(() => import('./CommentModal.vue'))
const FullScreenPlayer = defineAsyncComponent(() => import('./FullScreenPlayer.vue'))
const theme = useThemeStore()
const player = usePlayerStore()
const library = useLibraryStore()
const auth = useAuthStore()
const message = useMessage()
const fallbackFullPlayerVisualizerMode = 'halo'
const validFullPlayerVisualizerModes = new Set(['halo', 'breath', 'trails', 'needle', 'particles'])
const modeMenuOpen = ref(false)
const volumeMenuOpen = ref(false)
const queueMenuOpen = ref(false)
const visualizerMenuOpen = ref(false)
const fullPlayerOpen = ref(false)
const fullPlayerMounted = ref(false)
const fullPlayerCoverRect = ref(null)
const albumArtButton = ref(null)
const playerBar = ref(null)
const progressBar = ref(null)
const trackMetaViewport = ref(null)
const trackMetaMeasure = ref(null)
const albumArtHidden = ref(false)
const trackMetaOverflowing = ref(false)
const lastAlbumArtToggleAt = ref(0)
const playerBarHeight = ref(92)
const playMode = ref('list')
const volume = ref(100)
const lastAudibleVolume = ref(100)
const progressDragging = ref(false)
const progressPreviewVisible = ref(false)
const progressPreviewPercent = ref(0)
const progressPreviewTime = ref(0)
const pendingProgressTime = ref(0)
const progressLyricLines = ref([])
const desktopLyricsAvailable = computed(() =>
  Boolean(
    typeof window !== 'undefined' &&
      window.mappicDesktop?.desktopLyrics
  )
)
const desktopLyricsWindowOpen = ref(false)
const desktopLyricsLocked = ref(false)
const desktopLyricLines = ref(createLyricPlaceholder('Play a song to show lyrics'))
const desktopLyricsLoading = ref(false)
const desktopLyricsButtonLabel = computed(() => {
  if (desktopLyricsWindowOpen.value && desktopLyricsLocked.value) {
    return 'Unlock desktop lyrics'
  }

  return desktopLyricsWindowOpen.value ? 'Close desktop lyrics' : 'Desktop lyrics'
})
const danmakuEnabled = ref(true)
const fullPlayerVisualizerMode = ref(readFullPlayerVisualizerMode())
const songCommentsModalVisible = ref(false)
const songCommentsModalMounted = ref(false)
const fullPlayerDanmakuState = reactive({
  trackId: '',
  loading: false,
  error: '',
  hotComments: [],
  comments: [],
  total: 0,
  more: false,
  offset: 0
})
const fullPlayerDanmakuCommentLimit = 80
const fullPlayerDanmakuPrefetchThreshold = 12
const fullPlayerDanmakuMaxItems = 36
const fullPlayerDanmakuActivationDelay = 520
const fullPlayerDanmakuLoadDelay = 560
let progressLyricRequestId = 0
let progressLyricLoadedTrackId = ''
let progressLyricLoadingTrackId = ''
let desktopLyricRequestId = 0
let desktopLyricsPublishFrame = 0
let desktopLyricsClockFrame = 0
let songCommentStatsRequestId = 0
let fullPlayerDanmakuRequestId = 0
let fullPlayerDanmakuLoadTimer = 0
let removeTrackEndedListener = null
let removeDesktopLyricsWindowStateListener = null
let removeDesktopLyricsCommandListener = null
let playerBarResizeObserver = null
let trackMarqueeResizeObserver = null
let trackMarqueeMeasureFrame = 0
let lastQueueTrackKey = ''
let lastQueueTrackRequestedAt = 0

const fallbackCoverPalette = {
  primary: '#213245',
  secondary: '#8bbad5',
  tertiary: '#e7a976'
}

const playModes = [
  { value: 'shuffle', label: '随机播放', icon: Shuffle },
  { value: 'order', label: '顺序播放', icon: Repeat },
  { value: 'single', label: '单曲循环', icon: Repeat1 },
  { value: 'list', label: '列表循环', icon: Repeat2 }
]

const visualizerModes = [
  { value: 'halo', label: '黑胶日冕', icon: Orbit },
  { value: 'breath', label: '歌词呼吸', icon: Waves },
  { value: 'trails', label: '评论星云', icon: AudioLines },
  { value: 'needle', label: '唱针星图', icon: Gauge },
  { value: 'particles', label: '空间粒子', icon: Sparkles }
]

const activePlayMode = computed(() => playModes.find((mode) => mode.value === playMode.value) ?? playModes[3])
const activeVisualizerMode = computed(() =>
  visualizerModes.find((mode) => mode.value === fullPlayerVisualizerMode.value) ?? visualizerModes[0]
)
const currentTrack = computed(() => player.state.currentTrack)
const currentTrackLiked = computed(() => library.isTrackLiked(currentTrack.value))
const songCommentState = useSongComments({
  track: currentTrack,
  getFallbackTotal: (track) => Number(track?.commentCount) || 0,
  onLoaded: ({ trackId, data }) => {
    if (String(currentTrack.value.id) === String(trackId)) {
      currentTrack.value.commentCount = data.total
    }
  }
})
const songHotComments = songCommentState.hotComments
const songComments = songCommentState.comments
const songCommentsHasMore = songCommentState.hasMore
const songCommentsLoading = songCommentState.loading
const songCommentsError = songCommentState.error
const displaySongCommentTotal = songCommentState.displayTotal
const currentVolumeIcon = computed(() => Number(volume.value) > 0 ? Volume2 : VolumeX)
const currentTrackCoverStyle = computed(() => {
  const palette = currentTrack.value.coverPalette ?? fallbackCoverPalette

  return {
    '--cover-primary': palette.primary ?? fallbackCoverPalette.primary,
    '--cover-secondary': palette.secondary ?? fallbackCoverPalette.secondary,
    '--cover-tertiary': palette.tertiary ?? fallbackCoverPalette.tertiary,
    '--cover-image': currentTrack.value.coverUrl ? `url("${currentTrack.value.coverUrl}")` : 'none'
  }
})
const playerStyle = computed(() => ({
  ...currentTrackCoverStyle.value,
  '--player-bar-actual-height': `${playerBarHeight.value}px`
}))
const progressPercentage = computed(() => {
  if (!player.state.duration) {
    return 0
  }

  return Math.min(100, (player.state.currentTime / player.state.duration) * 100)
})
const displayProgressTime = computed(() =>
  progressDragging.value ? pendingProgressTime.value : player.state.currentTime
)
const displayProgressPercentage = computed(() => {
  if (!player.state.duration) {
    return 0
  }

  return Math.min(100, (displayProgressTime.value / player.state.duration) * 100)
})
const progressAriaMax = computed(() => Math.floor(player.state.duration || 0))
const progressAriaNow = computed(() => Math.floor(displayProgressTime.value || 0))
const progressPreviewLyric = computed(() => {
  const line = findLyricLineAt(progressPreviewTime.value)

  return line?.text || '暂无歌词'
})
const progressTooltipPercent = computed(() =>
  Math.min(92, Math.max(8, progressPreviewPercent.value))
)
const queueTracks = computed(() => player.state.queue.map((song, index) => ({
  ...song,
  id: song.id ?? `queue-${index + 1}`,
  queueKey: `${song.id ?? 'queue'}-${index}`,
  rank: String(index + 1).padStart(2, '0'),
  to: `/playlist/new-${String(index + 1).padStart(2, '0')}`,
  vip: Boolean(song.vip),
  hasVideo: song.hasVideo ?? index % 3 !== 1
})))

watch(volume, (value) => {
  const nextVolume = Math.min(100, Math.max(0, Number(value)))
  volume.value = nextVolume

  if (nextVolume > 0) {
    lastAudibleVolume.value = nextVolume
  }

  player.setVolume(nextVolume / 100)
})

watch(
  () => currentTrack.value.id,
  () => {
    resetProgressLyrics()
    loadDesktopLyrics(currentTrack.value)
    refreshCurrentTrackCommentTotal(currentTrack.value)
    resetFullPlayerDanmakuStream(currentTrack.value)

    if (fullPlayerOpen.value && danmakuEnabled.value) {
      scheduleFullPlayerDanmakuLoad()
    }

    if (songCommentsModalVisible.value) {
      songCommentState.open(currentTrack.value)
    }
  },
  { immediate: true }
)

watch(
  () => [currentTrack.value.name, currentTrack.value.artist],
  scheduleTrackMarqueeMeasure,
  { immediate: true }
)

watch(fullPlayerOpen, (open) => {
  if (open && danmakuEnabled.value) {
    songCommentState.preload(currentTrack.value)
    scheduleFullPlayerDanmakuLoad()
    return
  }

  clearFullPlayerDanmakuLoadTimer()
})

watch(fullPlayerVisualizerMode, (mode) => {
  persistFullPlayerVisualizerMode(mode)
})

watch(
  () => [
    currentTrack.value.id,
    currentTrack.value.name,
    currentTrack.value.artist,
    currentTrack.value.coverUrl,
    player.state.currentTime,
    player.state.duration,
    player.state.isPlaying,
    desktopLyricLines.value,
    desktopLyricsLoading.value,
  ],
  scheduleDesktopLyricsPublish,
  { immediate: true }
)

watch(
  () => [
    desktopLyricsWindowOpen.value,
    player.state.isPlaying,
    currentTrack.value.id,
  ],
  syncDesktopLyricsClock,
  { immediate: true }
)

function toggleModeMenu() {
  modeMenuOpen.value = !modeMenuOpen.value
  volumeMenuOpen.value = false
  queueMenuOpen.value = false
  visualizerMenuOpen.value = false
}

function toggleVolumeMenu() {
  volumeMenuOpen.value = !volumeMenuOpen.value
  modeMenuOpen.value = false
  queueMenuOpen.value = false
  visualizerMenuOpen.value = false
}

function toggleQueueMenu() {
  syncPlayerBarHeight()
  queueMenuOpen.value = !queueMenuOpen.value
  modeMenuOpen.value = false
  volumeMenuOpen.value = false
  visualizerMenuOpen.value = false
}

function toggleVisualizerMenu() {
  visualizerMenuOpen.value = !visualizerMenuOpen.value
  modeMenuOpen.value = false
  volumeMenuOpen.value = false
  queueMenuOpen.value = false
}

function selectPlayMode(value) {
  playMode.value = value
  modeMenuOpen.value = false
}

function selectVisualizerMode(value) {
  if (!isValidVisualizerMode(value)) {
    return
  }

  fullPlayerVisualizerMode.value = value
  visualizerMenuOpen.value = false
}

function readFullPlayerVisualizerMode() {
  const storedMode = readStorage(
    STORAGE_KEYS.fullPlayerVisualizerMode,
    fallbackFullPlayerVisualizerMode
  )

  return isValidVisualizerMode(storedMode) ? storedMode : fallbackFullPlayerVisualizerMode
}

function persistFullPlayerVisualizerMode(value) {
  if (!isValidVisualizerMode(value)) {
    return
  }

  if (!writeStorage(STORAGE_KEYS.fullPlayerVisualizerMode, value)) {
    console.warn('Failed to persist full player visualizer mode')
  }
}

function isValidVisualizerMode(value) {
  return validFullPlayerVisualizerModes.has(String(value ?? ''))
}

async function toggleDesktopLyrics() {
  if (!desktopLyricsAvailable.value) {
    return
  }

  try {
    if (desktopLyricsWindowOpen.value && desktopLyricsLocked.value) {
      window.mappicDesktop.desktopLyrics.setLocked(false)
      updateDesktopLyricsWindowState({ open: true, locked: false })
      publishDesktopLyricsState()
      return
    }

    const state = await window.mappicDesktop.desktopLyrics.toggle()
    updateDesktopLyricsWindowState(state)
    publishDesktopLyricsState()
  } catch (error) {
    console.warn('Failed to toggle desktop lyrics:', error)
    message.error('Desktop lyrics failed to open')
  }
}

async function loadDesktopLyrics(track) {
  const trackId = String(track?.id ?? track ?? '')
  desktopLyricRequestId += 1
  const requestId = desktopLyricRequestId
  desktopLyricsLoading.value = Boolean(trackId)
  desktopLyricLines.value = createLyricPlaceholder(
    trackId ? 'Loading lyrics...' : 'Play a song to show lyrics'
  )

  if (!isNeteaseTrackId(trackId)) {
    desktopLyricsLoading.value = false
    desktopLyricLines.value = createLyricPlaceholder(
      trackId ? 'No lyrics' : 'Play a song to show lyrics'
    )
    return
  }

  try {
    const lines = await getTrackLyricData(track && typeof track === 'object' ? track : trackId)

    if (requestId !== desktopLyricRequestId) {
      return
    }

    desktopLyricLines.value = lines?.length
      ? lines
      : createLyricPlaceholder('No lyrics')
  } catch (error) {
    if (requestId !== desktopLyricRequestId) {
      return
    }

    console.warn('Failed to load desktop lyrics:', error)
    desktopLyricLines.value = createLyricPlaceholder('Lyrics failed to load')
  } finally {
    if (requestId === desktopLyricRequestId) {
      desktopLyricsLoading.value = false
    }
  }
}

function scheduleDesktopLyricsPublish() {
  if (!desktopLyricsAvailable.value) {
    return
  }

  if (desktopLyricsPublishFrame) {
    return
  }

  desktopLyricsPublishFrame = window.requestAnimationFrame(() => {
    desktopLyricsPublishFrame = 0
    publishDesktopLyricsState()
  })
}

function publishDesktopLyricsState() {
  if (!desktopLyricsAvailable.value) {
    return
  }

  window.mappicDesktop.desktopLyrics.publishState(createDesktopLyricsPayload())
}

function createDesktopLyricsPayload() {
  const lines = normalizeDesktopLyricLines(desktopLyricLines.value)
  const currentTime = getDesktopLyricsCurrentTime()
  const activeIndex = findCurrentLyricIndex(lines, currentTime)
  const activeLine = lines[activeIndex] ?? lines[0] ?? createLyricPlaceholder('No lyrics')[0]
  const nextLine = lines[activeIndex + 1] ?? null
  const progress = getDesktopLyricProgress(activeLine, nextLine, currentTime)

  return {
    track: {
      id: currentTrack.value.id,
      name: currentTrack.value.name,
      artist: currentTrack.value.artist,
      coverUrl: currentTrack.value.coverUrl,
      coverPalette: normalizeDesktopLyricsPalette(currentTrack.value.coverPalette),
    },
    playback: {
      currentTime,
      duration: player.state.duration,
      isPlaying: player.state.isPlaying,
    },
    lyrics: {
      lines,
      activeIndex,
      activeLine,
      nextLine,
      progress,
      loading: desktopLyricsLoading.value,
    },
  }
}

function normalizeDesktopLyricLines(lines = []) {
  const normalizedLines = (Array.isArray(lines) && lines.length
    ? lines
    : createLyricPlaceholder('No lyrics')
  ).map((line, index) => ({
    index,
    time: line.time || '--:--',
    text: line.text || '...',
    translation: line.translation || '',
    seconds: Number(line.seconds) || 0,
    duration: Number(line.duration) || 0,
    placeholder: Boolean(line.placeholder),
    words: Array.isArray(line.words)
      ? line.words.map((word) => ({
          text: word.text || '',
          seconds: Number(word.seconds) || 0,
          duration: Number(word.duration) || 0,
        }))
      : [],
  }))

  return normalizedLines.length
    ? normalizedLines
    : createLyricPlaceholder('No lyrics')
}

function normalizeDesktopLyricsPalette(palette = {}) {
  return {
    primary: palette.primary || fallbackCoverPalette.primary,
    secondary: palette.secondary || fallbackCoverPalette.secondary,
    tertiary: palette.tertiary || fallbackCoverPalette.tertiary,
  }
}

function syncDesktopLyricsClock() {
  if (desktopLyricsWindowOpen.value && player.state.isPlaying) {
    startDesktopLyricsClock()
    return
  }

  stopDesktopLyricsClock()
}

function startDesktopLyricsClock() {
  if (!desktopLyricsAvailable.value || desktopLyricsClockFrame) {
    return
  }

  const tick = () => {
    desktopLyricsClockFrame = 0

    if (!desktopLyricsWindowOpen.value || !player.state.isPlaying) {
      return
    }

    publishDesktopLyricsState()
    desktopLyricsClockFrame = window.requestAnimationFrame(tick)
  }

  desktopLyricsClockFrame = window.requestAnimationFrame(tick)
}

function stopDesktopLyricsClock() {
  if (!desktopLyricsClockFrame) {
    return
  }

  window.cancelAnimationFrame(desktopLyricsClockFrame)
  desktopLyricsClockFrame = 0
}

function getDesktopLyricsCurrentTime() {
  const currentTime = typeof player.getCurrentTime === 'function'
    ? player.getCurrentTime()
    : player.state.currentTime

  return Math.max(0, Number(currentTime) || 0)
}

function getDesktopLyricProgress(line, nextLine, currentTime) {
  if (line?.placeholder) {
    return 0
  }

  const wordProgress = getDesktopLyricWordProgress(line, currentTime)

  if (wordProgress !== null) {
    return wordProgress
  }

  const lineDuration = getDesktopLyricLineDuration(line, nextLine)

  return clampDesktopLyricProgress((currentTime - line.seconds) / lineDuration)
}

function getDesktopLyricWordProgress(line, currentTime) {
  const words = Array.isArray(line?.words)
    ? line.words.filter((word) => word.text && Number.isFinite(Number(word.seconds)))
    : []

  if (!words.length) {
    return null
  }

  const textLength = Math.max(1, words.reduce((total, word) => total + getLyricTextWeight(word.text), 0))
  let consumedLength = 0

  for (const word of words) {
    const wordLength = getLyricTextWeight(word.text)
    const start = Number(word.seconds) || 0
    const duration = Math.max(0.08, Number(word.duration) || 0)
    const end = start + duration

    if (currentTime >= end) {
      consumedLength += wordLength
      continue
    }

    if (currentTime <= start) {
      return clampDesktopLyricProgress(consumedLength / textLength)
    }

    consumedLength += wordLength * ((currentTime - start) / duration)
    return clampDesktopLyricProgress(consumedLength / textLength)
  }

  return 1
}

function getDesktopLyricLineDuration(line, nextLine) {
  if (line?.duration) {
    return Math.max(0.08, Number(line.duration) || 0.08)
  }

  if (nextLine && Number(nextLine.seconds) > Number(line?.seconds)) {
    return Math.max(0.08, Number(nextLine.seconds) - Number(line.seconds))
  }

  return 4.2
}

function getLyricTextWeight(text = '') {
  return Math.max(1, Array.from(String(text)).length)
}

function clampDesktopLyricProgress(value) {
  return Math.min(1, Math.max(0, Number(value) || 0))
}

function updateDesktopLyricsWindowState(state = {}) {
  desktopLyricsWindowOpen.value = Boolean(state.open)
  desktopLyricsLocked.value = Boolean(state.locked)
}

async function handleDesktopLyricsCommand(command) {
  const action = typeof command === 'string' ? command : command?.action

  if (action === 'toggle-play') {
    const toggled = await player.togglePlay()
    showPlaybackError(toggled)
    return
  }

  if (action === 'previous') {
    await playPreviousTrack()
    return
  }

  if (action === 'next') {
    await playNextTrack()
    return
  }

  if (action === 'hide') {
    desktopLyricsWindowOpen.value = false
  }
}

function toggleFullPlayer() {
  const now = performance.now()

  if (now - lastAlbumArtToggleAt.value < 500) {
    return
  }

  lastAlbumArtToggleAt.value = now
  const willOpen = !fullPlayerOpen.value

  if (willOpen) {
    fullPlayerMounted.value = true
  }

  fullPlayerCoverRect.value = getAlbumArtRect()
  albumArtHidden.value = true
  fullPlayerOpen.value = willOpen
  closePlayerPopovers()
}

function closeFullPlayer() {
  fullPlayerCoverRect.value = getAlbumArtRect()
  albumArtHidden.value = true
  fullPlayerOpen.value = false
  closePlayerPopovers()
}

function handleCoverFlightEnd(direction) {
  if (direction === 'leave') {
    albumArtHidden.value = false
  }
}

function getAlbumArtRect() {
  const rect = albumArtButton.value?.getBoundingClientRect()

  if (!rect) {
    return null
  }

  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  }
}

function toggleMute() {
  if (Number(volume.value) > 0) {
    lastAudibleVolume.value = Number(volume.value)
    volume.value = 0
    return
  }

  volume.value = lastAudibleVolume.value || 80
}

function increaseVolume() {
  volume.value = Math.min(100, Number(volume.value) + 5)
}

function closePlayerPopovers() {
  modeMenuOpen.value = false
  volumeMenuOpen.value = false
  queueMenuOpen.value = false
  visualizerMenuOpen.value = false
}

function resetProgressLyrics() {
  progressLyricRequestId += 1
  progressLyricLoadedTrackId = ''
  progressLyricLoadingTrackId = ''
  progressLyricLines.value = []
}

async function loadProgressLyrics(track) {
  const normalizedTrackId = String(track?.id ?? track ?? '')

  if (
    !normalizedTrackId ||
    progressLyricLoadedTrackId === normalizedTrackId ||
    progressLyricLoadingTrackId === normalizedTrackId
  ) {
    return
  }

  progressLyricRequestId += 1
  const requestId = progressLyricRequestId
  progressLyricLoadingTrackId = normalizedTrackId
  progressLyricLines.value = []

  if (!isNeteaseTrackId(normalizedTrackId)) {
    progressLyricLoadedTrackId = normalizedTrackId
    progressLyricLoadingTrackId = ''
    return
  }

  try {
    const lines = await getTrackLyricData(track && typeof track === 'object' ? track : normalizedTrackId)

    if (requestId !== progressLyricRequestId) {
      return
    }

    progressLyricLines.value = lines.filter((line) => !line.placeholder)
    progressLyricLoadedTrackId = normalizedTrackId
  } catch (error) {
    if (requestId !== progressLyricRequestId) {
      return
    }

    console.warn('Failed to load progress lyrics:', error)
    progressLyricLines.value = []
  } finally {
    if (requestId === progressLyricRequestId) {
      progressLyricLoadingTrackId = ''
    }
  }
}

async function openSongCommentsModal() {
  songCommentsModalMounted.value = true
  songCommentsModalVisible.value = true
  closePlayerPopovers()
  await songCommentState.open(currentTrack.value)
}

async function refreshCurrentTrackCommentTotal(track = currentTrack.value) {
  const id = String(track?.id ?? '')
  const requestId = ++songCommentStatsRequestId

  songCommentState.reset()

  if (!isNeteaseNumericTrackId(id)) {
    return
  }

  try {
    const stats = await getSongInteractionStatsData(id)

    if (requestId !== songCommentStatsRequestId || id !== String(currentTrack.value.id ?? '')) {
      return
    }

    currentTrack.value.commentCount = Number(stats.commentCount) || 0
    currentTrack.value.commentCountLabel = stats.commentCountLabel || ''
  } catch (error) {
    if (requestId === songCommentStatsRequestId) {
      console.warn('Failed to load current track comment count:', error)
    }
  }
}

async function toggleCurrentTrackLike() {
  if (!currentTrack.value?.id) {
    return
  }

  const liked = library.toggleLikedTrack(currentTrack.value)

  if (auth.userId.value && isNeteaseTrackId(currentTrack.value.id)) {
    try {
      await updateSongLikeStateData({
        id: currentTrack.value.id,
        uid: auth.userId.value,
        like: liked
      })
    } catch (error) {
      console.warn('Failed to sync current track like state:', error)
      message.warning('云端喜欢状态同步失败，已保留本地记录')
    }
  }

  message.success(liked ? '已添加到我喜欢的音乐' : '已取消喜欢')
}

function loadMoreSongComments() {
  songCommentState.loadMore(currentTrack.value)
}

function resetFullPlayerDanmakuStream(track = currentTrack.value) {
  fullPlayerDanmakuRequestId += 1
  fullPlayerDanmakuState.trackId = String(track?.id ?? '')
  fullPlayerDanmakuState.loading = false
  fullPlayerDanmakuState.error = ''
  fullPlayerDanmakuState.hotComments = []
  fullPlayerDanmakuState.comments = []
  fullPlayerDanmakuState.total = 0
  fullPlayerDanmakuState.offset = 0
  fullPlayerDanmakuState.more = Boolean(isNeteaseTrackId(fullPlayerDanmakuState.trackId))
}

function scheduleFullPlayerDanmakuLoad(delay = fullPlayerDanmakuLoadDelay) {
  clearFullPlayerDanmakuLoadTimer()

  if (!fullPlayerOpen.value || !danmakuEnabled.value) {
    return
  }

  fullPlayerDanmakuLoadTimer = window.setTimeout(() => {
    fullPlayerDanmakuLoadTimer = 0
    loadMoreFullPlayerDanmaku()
  }, Math.max(0, Number(delay) || 0))
}

function clearFullPlayerDanmakuLoadTimer() {
  if (fullPlayerDanmakuLoadTimer) {
    window.clearTimeout(fullPlayerDanmakuLoadTimer)
    fullPlayerDanmakuLoadTimer = 0
  }
}

async function loadMoreFullPlayerDanmaku(track = currentTrack.value) {
  clearFullPlayerDanmakuLoadTimer()

  const id = String(track?.id ?? fullPlayerDanmakuState.trackId ?? '')

  if (
    !fullPlayerOpen.value ||
    !danmakuEnabled.value ||
    !isNeteaseTrackId(id) ||
    fullPlayerDanmakuState.loading ||
    !fullPlayerDanmakuState.more
  ) {
    return
  }

  const requestId = ++fullPlayerDanmakuRequestId
  fullPlayerDanmakuState.loading = true
  fullPlayerDanmakuState.error = ''

  try {
    const data = await getSongCommentsData({
      id,
      limit: fullPlayerDanmakuCommentLimit,
      offset: fullPlayerDanmakuState.offset
    })

    if (requestId !== fullPlayerDanmakuRequestId || id !== String(currentTrack.value.id ?? '')) {
      return
    }

    fullPlayerDanmakuState.trackId = id
    fullPlayerDanmakuState.hotComments = fullPlayerDanmakuState.offset === 0 ? data.hotComments : []
    fullPlayerDanmakuState.comments = data.comments
    fullPlayerDanmakuState.total = data.total
    fullPlayerDanmakuState.offset += data.comments.length
    fullPlayerDanmakuState.more = Boolean(data.more && data.comments.length)
    currentTrack.value.commentCount = data.total
  } catch (error) {
    if (requestId === fullPlayerDanmakuRequestId) {
      console.warn('Failed to load full player danmaku comments:', error)
      fullPlayerDanmakuState.error = error?.message || '弹幕评论加载失败'
      fullPlayerDanmakuState.more = false
    }
  } finally {
    if (requestId === fullPlayerDanmakuRequestId) {
      fullPlayerDanmakuState.loading = false
    }
  }
}

function toggleDanmaku() {
  danmakuEnabled.value = !danmakuEnabled.value

  if (danmakuEnabled.value) {
    scheduleFullPlayerDanmakuLoad(180)
    return
  }

  clearFullPlayerDanmakuLoadTimer()
}

function formatCommentBadge(value = 0) {
  const count = Number(value) || 0

  if (count >= 100000) {
    return '10w+'
  }

  if (count >= 10000) {
    return '1w+'
  }

  if (count >= 1000) {
    return '999+'
  }

  return String(count)
}

function startProgressDrag(event) {
  if (!player.state.duration) {
    return
  }

  progressDragging.value = true
  updateProgressPreview(event)
  pendingProgressTime.value = progressPreviewTime.value
  event.currentTarget.setPointerCapture?.(event.pointerId)
}

function handleProgressPointerMove(event) {
  if (!player.state.duration) {
    return
  }

  updateProgressPreview(event)

  if (progressDragging.value) {
    pendingProgressTime.value = progressPreviewTime.value
  }
}

function stopProgressDrag(event) {
  if (!progressDragging.value) {
    hideProgressPreview()
    return
  }

  updateProgressPreview(event)
  pendingProgressTime.value = progressPreviewTime.value
  player.seekTo(pendingProgressTime.value)
  progressDragging.value = false
  progressPreviewVisible.value = false
  event.currentTarget.releasePointerCapture?.(event.pointerId)
}

function cancelProgressDrag(event) {
  progressDragging.value = false
  event.currentTarget.releasePointerCapture?.(event.pointerId)
  hideProgressPreview()
}

function hideProgressPreview() {
  if (progressDragging.value) {
    return
  }

  progressPreviewVisible.value = false
}

function updateProgressPreview(event) {
  const progress = getProgressPoint(event)

  if (!progress) {
    return
  }

  loadProgressLyrics(currentTrack.value)
  progressPreviewVisible.value = true
  progressPreviewPercent.value = progress.percent
  progressPreviewTime.value = progress.time
}

function getProgressPoint(event) {
  const bar = progressBar.value
  const duration = player.state.duration

  if (!bar || !duration) {
    return null
  }

  const rect = bar.getBoundingClientRect()

  if (rect.width <= 0) {
    return null
  }

  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  const time = ratio * duration

  return {
    percent: ratio * 100,
    time
  }
}

function handleProgressKeydown(event) {
  if (!player.state.duration) {
    return
  }

  const step = event.shiftKey ? 10 : 5

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    player.seekTo(player.state.currentTime - step)
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    player.seekTo(player.state.currentTime + step)
  }
}

function findLyricLineAt(time) {
  const lines = progressLyricLines.value

  if (!lines.length) {
    return null
  }

  let low = 0
  let high = lines.length - 1
  let currentIndex = 0

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)

    if (lines[middle].seconds <= time + 0.16) {
      currentIndex = middle
      low = middle + 1
      continue
    }

    high = middle - 1
  }

  return lines[currentIndex]
}

function isNeteaseTrackId(trackId) {
  return /^\d+$/.test(String(trackId ?? '')) || /^[a-f0-9]{32}$/i.test(String(trackId ?? ''))
}

function isNeteaseNumericTrackId(trackId) {
  return /^\d+$/.test(String(trackId ?? ''))
}

async function playPreviousTrack() {
  await playQueueRelative(-1)
}

async function playNextTrack() {
  await playQueueRelative(1)
}

async function handleTrackEnded() {
  if (playMode.value === 'single') {
    const restarted = await player.restartCurrentTrack()
    showPlaybackError(restarted)
    return
  }

  await playQueueRelative(1)
}

async function playQueueRelative(direction) {
  const queue = player.state.queue

  if (!queue.length) {
    return
  }

  const currentIndex = queue.findIndex((track) => String(track.id) === String(player.state.currentTrack.id))
  const targetTrack = getRelativeQueueTrack(queue, currentIndex, direction)

  if (!targetTrack) {
    return
  }

  await playTrackFromControls(targetTrack)
}

function getRelativeQueueTrack(queue, currentIndex, direction) {
  if (playMode.value === 'shuffle') {
    return getRandomQueueTrack(queue, currentIndex)
  }

  if (playMode.value === 'single' && currentIndex >= 0) {
    return queue[currentIndex]
  }

  const fallbackIndex = direction > 0 ? 0 : queue.length - 1
  const baseIndex = currentIndex >= 0 ? currentIndex : fallbackIndex - direction
  const nextIndex = baseIndex + direction

  if (playMode.value === 'order' && (nextIndex < 0 || nextIndex >= queue.length)) {
    return null
  }

  return queue[(nextIndex + queue.length) % queue.length]
}

function getRandomQueueTrack(queue, currentIndex) {
  if (queue.length <= 1) {
    return queue[0]
  }

  let nextIndex = currentIndex

  while (nextIndex === currentIndex) {
    nextIndex = Math.floor(Math.random() * queue.length)
  }

  return queue[nextIndex]
}

async function playTrackFromControls(track, options = {}) {
  const { showVipWarning = true } = options

  if (showVipWarning && track.vip) {
    message.warning('当前歌曲为 VIP 歌曲，将尝试播放试听')
  }

  const played = await player.playTrack(track)
  showPlaybackError(played)
}

async function playQueueTrack(track) {
  if (shouldIgnoreQueueTrackRequest(track)) {
    return
  }

  if (player.state.currentTrack.id === track.id) {
    const toggled = await player.togglePlay()
    showPlaybackError(toggled)
    return
  }

  await playTrackFromControls(track, { showVipWarning: false })
}

function shouldIgnoreQueueTrackRequest(track) {
  const key = String(track?.queueKey ?? track?.id ?? '')
  const now = performance.now()

  if (key && key === lastQueueTrackKey && now - lastQueueTrackRequestedAt < 450) {
    return true
  }

  lastQueueTrackKey = key
  lastQueueTrackRequestedAt = now
  return false
}

function showPlaybackError(success) {
  if (success) {
    return
  }

  message.error(player.state.error?.message || '当前歌曲暂无可播放链接')
}

function handleOutsideClick(event) {
  const target = event.target

  if (!(target instanceof Element)) {
    return
  }

  if (target.closest('.player-popover') || target.closest('.control-popover-wrap')) {
    return
  }

  closePlayerPopovers()
}

function syncPlayerBarHeight() {
  const height = playerBar.value?.getBoundingClientRect?.().height

  if (Number.isFinite(height) && height > 0) {
    playerBarHeight.value = Math.ceil(height)
  }
}

function scheduleTrackMarqueeMeasure() {
  if (typeof window === 'undefined' || trackMarqueeMeasureFrame) {
    return
  }

  trackMarqueeMeasureFrame = window.requestAnimationFrame(async () => {
    trackMarqueeMeasureFrame = 0
    await nextTick()
    measureTrackMarqueeOverflow()
  })
}

function measureTrackMarqueeOverflow() {
  trackMetaOverflowing.value = isTrackTextOverflowing(
    trackMetaViewport.value,
    trackMetaMeasure.value
  )
}

function isTrackTextOverflowing(viewport, content) {
  if (!viewport || !content) {
    return false
  }

  const style = window.getComputedStyle(viewport)
  const titleWidth = parseFloat(style.getPropertyValue('--track-title-width')) || 0
  const artistWidth = parseFloat(style.getPropertyValue('--track-artist-width')) || 0
  const title = content.querySelector('.track-summary__marquee-title')
  const artist = content.querySelector('.track-summary__marquee-artist')

  return (
    content.scrollWidth > viewport.clientWidth + 1 ||
    (title && title.scrollWidth > titleWidth + 1) ||
    (artist && artist.scrollWidth > artistWidth + 1)
  )
}

onMounted(() => {
  syncPlayerBarHeight()
  window.addEventListener('resize', syncPlayerBarHeight)
  window.addEventListener('resize', scheduleTrackMarqueeMeasure)
  if (typeof ResizeObserver !== 'undefined' && playerBar.value) {
    playerBarResizeObserver = new ResizeObserver(syncPlayerBarHeight)
    playerBarResizeObserver.observe(playerBar.value)
  }
  if (typeof ResizeObserver !== 'undefined') {
    trackMarqueeResizeObserver = new ResizeObserver(scheduleTrackMarqueeMeasure)
    ;[
      trackMetaViewport.value
    ]
      .filter(Boolean)
      .forEach((element) => trackMarqueeResizeObserver.observe(element))
  }
  scheduleTrackMarqueeMeasure()

  document.addEventListener('pointerdown', handleOutsideClick)
  removeTrackEndedListener = player.onTrackEnded(handleTrackEnded)

  if (desktopLyricsAvailable.value) {
    removeDesktopLyricsWindowStateListener =
      window.mappicDesktop.desktopLyrics.onWindowState(updateDesktopLyricsWindowState)
    removeDesktopLyricsCommandListener =
      window.mappicDesktop.desktopLyrics.onCommand(handleDesktopLyricsCommand)

    window.mappicDesktop.desktopLyrics
      .getWindowState()
      .then(updateDesktopLyricsWindowState)
      .catch((error) => {
        console.warn('Failed to read desktop lyrics window state:', error)
      })
    publishDesktopLyricsState()
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', syncPlayerBarHeight)
  window.removeEventListener('resize', scheduleTrackMarqueeMeasure)
  document.removeEventListener('pointerdown', handleOutsideClick)
  playerBarResizeObserver?.disconnect()
  playerBarResizeObserver = null
  trackMarqueeResizeObserver?.disconnect()
  trackMarqueeResizeObserver = null
  if (trackMarqueeMeasureFrame) {
    window.cancelAnimationFrame(trackMarqueeMeasureFrame)
    trackMarqueeMeasureFrame = 0
  }
  clearFullPlayerDanmakuLoadTimer()
  if (desktopLyricsPublishFrame) {
    window.cancelAnimationFrame(desktopLyricsPublishFrame)
    desktopLyricsPublishFrame = 0
  }
  stopDesktopLyricsClock()
  removeTrackEndedListener?.()
  removeTrackEndedListener = null
  removeDesktopLyricsWindowStateListener?.()
  removeDesktopLyricsWindowStateListener = null
  removeDesktopLyricsCommandListener?.()
  removeDesktopLyricsCommandListener = null
})
</script>
