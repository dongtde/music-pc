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
    <PlayerTrackSummary
      ref="trackSummary"
      :track="currentTrack"
      :full-player-open="fullPlayerOpen"
      :album-art-hidden="albumArtHidden"
      :liked="currentTrackLiked"
      :comment-total="displaySongCommentTotal"
      @toggle-full-player="toggleFullPlayer"
      @toggle-like="toggleCurrentTrackLike"
      @open-comments="openSongCommentsModal"
    />

    <div class="player-center">
      <div class="play-controls">
        <PlayerModePopover
          :open="modeMenuOpen"
          :active-mode="activePlayMode"
          :active-value="playMode"
          :modes="playModes"
          @toggle="toggleModeMenu"
          @select="selectPlayMode"
        />
        <PlayerTransportControls
          :loading="player.state.isLoading"
          :playing="player.state.isPlaying"
          @previous="playPreviousTrack"
          @toggle-play="player.togglePlay()"
          @next="playNextTrack"
        />
        <PlayerVolumePopover
          v-model="volume"
          :open="volumeMenuOpen"
          :icon="currentVolumeIcon"
          @toggle="toggleVolumeMenu"
          @increase="increaseVolume"
          @toggle-mute="toggleMute"
        />
      </div>
      <PlayerProgressBar
        :current-label="formatTime(displayProgressTime)"
        :duration-label="currentTrack.duration"
        :percentage="displayProgressPercentage"
        :aria-max="progressAriaMax"
        :aria-now="progressAriaNow"
        :preview-visible="progressPreviewVisible"
        :preview-left="progressTooltipPercent"
        :preview-text="progressPreviewLyric"
        :preview-time-label="formatTime(progressPreviewTime)"
        @progress-pointer-down="startProgressDrag"
        @progress-pointer-move="handleProgressPointerMove"
        @progress-pointer-up="stopProgressDrag"
        @progress-pointer-cancel="cancelProgressDrag"
        @progress-pointer-leave="hideProgressPreview"
        @progress-keydown="handleProgressKeydown"
      />
    </div>

    <div class="player-tools">
      <PlayerDanmakuToggle
        :visible="fullPlayerOpen"
        :enabled="danmakuEnabled"
        @toggle="toggleDanmaku"
      />
      <PlayerVisualizerPopover
        :visible="fullPlayerOpen"
        :open="visualizerMenuOpen"
        :active-mode="activeVisualizerMode"
        :active-value="fullPlayerVisualizerMode"
        :modes="visualizerModes"
        @toggle="toggleVisualizerMenu"
        @select="selectVisualizerMode"
      />
      <PlayerQualityPopover
        :open="qualityMenuOpen"
        :button-label="qualityButtonLabel"
        :active-quality="activeAudioQuality"
        :active-value="activePlaybackQualityValue"
        :options="playbackQualityOptions"
        :loading="player.state.isLoading"
        @toggle="toggleQualityMenu"
        @select="selectPlaybackQuality"
      />
      <PlayerDesktopLyricsButton
        :available="desktopLyricsAvailable"
        :label="desktopLyricsButtonLabel"
        :open="desktopLyricsWindowOpen"
        :locked="desktopLyricsLocked"
        @toggle="toggleDesktopLyrics"
      />
      <PlayerQueuePopover
        :open="queueMenuOpen"
        :tracks="queueTracks"
        :transition-name="`queue-${theme.state.queueTransition}`"
        @toggle="toggleQueueMenu"
        @play-track="playQueueTrack"
      />
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
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { AudioLines, Gauge, Orbit, Repeat, Repeat1, Repeat2, Shuffle, Sparkles, Volume2, VolumeX, Waves } from 'lucide-vue-next'
import { useMessage } from 'naive-ui'
import PlayerDanmakuToggle from './PlayerDanmakuToggle.vue'
import PlayerDesktopLyricsButton from './PlayerDesktopLyricsButton.vue'
import PlayerModePopover from './PlayerModePopover.vue'
import PlayerProgressBar from './PlayerProgressBar.vue'
import PlayerQualityPopover from './PlayerQualityPopover.vue'
import PlayerQueuePopover from './PlayerQueuePopover.vue'
import PlayerTrackSummary from './PlayerTrackSummary.vue'
import PlayerTransportControls from './PlayerTransportControls.vue'
import PlayerVisualizerPopover from './PlayerVisualizerPopover.vue'
import PlayerVolumePopover from './PlayerVolumePopover.vue'
import { STORAGE_KEYS } from '../config/app'
import { useThemeStore } from '../stores/theme'
import { usePlayerStore } from '../stores/player'
import { useLibraryStore } from '../stores/library'
import { useAuthStore } from '../stores/auth'
import { updateSongLikeStateData } from '../services/netease'
import { useCurrentTrackComments } from '../composables/useCurrentTrackComments'
import { useDesktopLyricsBridge } from '../composables/useDesktopLyricsBridge'
import { useFullPlayerDanmakuComments } from '../composables/useFullPlayerDanmakuComments'
import { useProgressLyrics } from '../composables/useProgressLyrics'
import { useTaskbarControlsBridge } from '../composables/useTaskbarControlsBridge'
import { readStorage, writeStorage } from '../utils/storage'
import { formatTime } from '../utils/time'
import { getAudioQualityDefinition, getAudioQualityOptions } from '../utils/audioQuality'
import { getPlaybackErrorDisplay } from '../utils/playbackError'
import '../styles/player.css'

const loadFullScreenPlayer = () => import('./FullScreenPlayer.vue')
const CommentModal = defineAsyncComponent(() => import('./CommentModal.vue'))
const FullScreenPlayer = defineAsyncComponent(loadFullScreenPlayer)
const theme = useThemeStore()
const player = usePlayerStore()
const library = useLibraryStore()
const auth = useAuthStore()
const message = useMessage()
const hasAccountLogin = computed(() => auth.state.isLoggedIn && auth.state.loginType !== 'guest')
const fallbackFullPlayerVisualizerMode = 'halo'
const validFullPlayerVisualizerModes = new Set(['halo', 'breath', 'trails', 'needle', 'particles'])
const modeMenuOpen = ref(false)
const volumeMenuOpen = ref(false)
const queueMenuOpen = ref(false)
const qualityMenuOpen = ref(false)
const visualizerMenuOpen = ref(false)
const fullPlayerOpen = ref(false)
const fullPlayerMounted = ref(false)
const fullPlayerCoverRect = ref(null)
const trackSummary = ref(null)
const playerBar = ref(null)
const albumArtHidden = ref(false)
const lastAlbumArtToggleAt = ref(0)
const playerBarHeight = ref(92)
const lastAudibleVolume = ref(100)
const progressDragging = ref(false)
const progressPreviewVisible = ref(false)
const progressPreviewPercent = ref(0)
const progressPreviewTime = ref(0)
const pendingProgressTime = ref(0)
const danmakuEnabled = ref(true)
const fullPlayerVisualizerMode = ref(readFullPlayerVisualizerMode())
const fullPlayerDanmakuCommentLimit = 80
const fullPlayerDanmakuPrefetchThreshold = 12
const fullPlayerDanmakuMaxItems = 36
const fullPlayerDanmakuActivationDelay = 780
const fullPlayerDanmakuLoadDelay = 560
const fullPlayerBackgroundTaskDelay = 700
let removeTrackEndedListener = null
let playerBarResizeObserver = null
let fullPlayerPreloadPromise = null
let fullPlayerPreloadHandle = 0
let fullPlayerPreloadHandleType = ''
let fullPlayerBackgroundTaskTimer = 0
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

const playMode = computed(() => player.state.playMode)
const activePlayMode = computed(() => playModes.find((mode) => mode.value === playMode.value) ?? playModes[3])
const activeVisualizerMode = computed(() =>
  visualizerModes.find((mode) => mode.value === fullPlayerVisualizerMode.value) ?? visualizerModes[0]
)
const currentTrack = computed(() => player.state.currentTrack)
const currentTrackComments = useCurrentTrackComments({
  track: currentTrack,
  onBeforeOpen: closePlayerPopovers,
  onLoaded: ({ trackId, data }) => {
    if (String(currentTrack.value.id) === String(trackId)) {
      currentTrack.value.commentCount = data.total
    }
  }
})
const songCommentsModalVisible = currentTrackComments.modalVisible
const songCommentsModalMounted = currentTrackComments.modalMounted
const songHotComments = currentTrackComments.hotComments
const songComments = currentTrackComments.comments
const songCommentsHasMore = currentTrackComments.hasMore
const songCommentsLoading = currentTrackComments.loading
const songCommentsError = currentTrackComments.error
const displaySongCommentTotal = currentTrackComments.displayTotal
const openSongCommentsModal = currentTrackComments.openModal
const loadMoreSongComments = currentTrackComments.loadMore
const progressLyrics = useProgressLyrics({
  previewTime: progressPreviewTime
})
const fullPlayerDanmaku = useFullPlayerDanmakuComments({
  track: currentTrack,
  open: fullPlayerOpen,
  enabled: danmakuEnabled,
  limit: fullPlayerDanmakuCommentLimit,
  loadDelay: fullPlayerDanmakuLoadDelay,
  onLoaded: ({ trackId, data }) => {
    if (String(currentTrack.value.id) === String(trackId)) {
      currentTrack.value.commentCount = data.total
    }
  }
})
const fullPlayerDanmakuState = fullPlayerDanmaku.state
const loadMoreFullPlayerDanmaku = fullPlayerDanmaku.loadMore
const desktopLyricsBridge = useDesktopLyricsBridge({
  player,
  currentTrack,
  fallbackCoverPalette,
  playPreviousTrack,
  playNextTrack,
  onPlaybackError: showPlaybackError,
  onToggleError: () => message.error('Desktop lyrics failed to open')
})
const desktopLyricsAvailable = desktopLyricsBridge.available
const desktopLyricsWindowOpen = desktopLyricsBridge.windowOpen
const desktopLyricsLocked = desktopLyricsBridge.locked
const desktopLyricsButtonLabel = desktopLyricsBridge.buttonLabel
const toggleDesktopLyrics = desktopLyricsBridge.toggle
useTaskbarControlsBridge({
  player,
  currentTrack,
  playPreviousTrack,
  playNextTrack,
  getThumbnailClip: getAlbumArtRect,
  onPlaybackError: showPlaybackError
})
const playbackQualityOptions = computed(() =>
  getAudioQualityOptions(currentTrack.value, { selected: player.state.playbackQuality })
)
const activePlaybackQualityValue = computed(
  () =>
    playbackQualityOptions.value.find((option) => option.value === player.state.playbackQuality)?.value ??
    playbackQualityOptions.value[0]?.value ??
    player.state.playbackQuality
)
const activeAudioQuality = computed(() => getAudioQualityDefinition(activePlaybackQualityValue.value))
const qualityButtonLabel = computed(() => `音质：${activeAudioQuality.value.label}`)
const currentTrackLiked = computed(() => library.isTrackLiked(currentTrack.value))
const volume = computed({
  get: () => Math.round(player.state.volume * 100),
  set: (value) => {
    const rawVolume = Number(value)

    if (!Number.isFinite(rawVolume)) {
      return
    }

    const nextVolume = Math.min(100, Math.max(0, rawVolume))
    player.setVolume(nextVolume / 100)
  }
})
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
const progressPreviewLyric = progressLyrics.previewText
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

watch(
  () => player.state.volume,
  (value) => {
    const rawVolume = Number(value)

    if (!Number.isFinite(rawVolume)) {
      return
    }

    const nextVolume = Math.round(Math.min(1, Math.max(0, rawVolume)) * 100)

    if (nextVolume > 0) {
      lastAudibleVolume.value = nextVolume
    }
  },
  { immediate: true }
)

watch(
  () => currentTrack.value.id,
  () => {
    progressLyrics.reset()
    currentTrackComments.syncTrack(currentTrack.value)
    fullPlayerDanmaku.reset(currentTrack.value)

    if (fullPlayerOpen.value && danmakuEnabled.value) {
      scheduleFullPlayerBackgroundTasks(260)
    }
  },
  { immediate: true }
)

watch(fullPlayerOpen, (open) => {
  if (open && danmakuEnabled.value) {
    scheduleFullPlayerBackgroundTasks()
    return
  }

  clearFullPlayerBackgroundTasks()
})

watch(fullPlayerVisualizerMode, (mode) => {
  persistFullPlayerVisualizerMode(mode)
})

function toggleModeMenu() {
  modeMenuOpen.value = !modeMenuOpen.value
  volumeMenuOpen.value = false
  queueMenuOpen.value = false
  qualityMenuOpen.value = false
  visualizerMenuOpen.value = false
}

function toggleVolumeMenu() {
  volumeMenuOpen.value = !volumeMenuOpen.value
  modeMenuOpen.value = false
  queueMenuOpen.value = false
  qualityMenuOpen.value = false
  visualizerMenuOpen.value = false
}

function toggleQueueMenu() {
  syncPlayerBarHeight()
  queueMenuOpen.value = !queueMenuOpen.value
  modeMenuOpen.value = false
  volumeMenuOpen.value = false
  qualityMenuOpen.value = false
  visualizerMenuOpen.value = false
}

function toggleQualityMenu() {
  qualityMenuOpen.value = !qualityMenuOpen.value
  modeMenuOpen.value = false
  volumeMenuOpen.value = false
  queueMenuOpen.value = false
  visualizerMenuOpen.value = false
}

function toggleVisualizerMenu() {
  visualizerMenuOpen.value = !visualizerMenuOpen.value
  modeMenuOpen.value = false
  volumeMenuOpen.value = false
  queueMenuOpen.value = false
  qualityMenuOpen.value = false
}

function selectPlayMode(value) {
  player.setPlayMode(value)
  modeMenuOpen.value = false
}

function selectVisualizerMode(value) {
  if (!isValidVisualizerMode(value)) {
    return
  }

  fullPlayerVisualizerMode.value = value
  visualizerMenuOpen.value = false
}

async function selectPlaybackQuality(value) {
  qualityMenuOpen.value = false

  const switched = await player.setPlaybackQuality(value)

  if (!switched) {
    showPlaybackError(false)
  }
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

function toggleFullPlayer() {
  const now = performance.now()

  if (now - lastAlbumArtToggleAt.value < 500) {
    return
  }

  lastAlbumArtToggleAt.value = now
  const willOpen = !fullPlayerOpen.value

  if (willOpen) {
    preloadFullPlayer()
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
  return trackSummary.value?.getAlbumArtRect?.() ?? null
}

function preloadFullPlayer() {
  if (fullPlayerPreloadPromise) {
    return fullPlayerPreloadPromise
  }

  fullPlayerPreloadPromise = loadFullScreenPlayer().catch((error) => {
    fullPlayerPreloadPromise = null
    console.warn('Failed to preload full screen player:', error)
    return null
  })

  return fullPlayerPreloadPromise
}

function scheduleFullPlayerPreload() {
  if (typeof window === 'undefined' || fullPlayerPreloadHandle || fullPlayerPreloadPromise) {
    return
  }

  const runPreload = () => {
    fullPlayerPreloadHandle = 0
    fullPlayerPreloadHandleType = ''
    preloadFullPlayer()
  }

  if (typeof window.requestIdleCallback === 'function') {
    fullPlayerPreloadHandleType = 'idle'
    fullPlayerPreloadHandle = window.requestIdleCallback(runPreload, { timeout: 2200 })
    return
  }

  fullPlayerPreloadHandleType = 'timeout'
  fullPlayerPreloadHandle = window.setTimeout(runPreload, 900)
}

function cancelFullPlayerPreload() {
  if (!fullPlayerPreloadHandle || typeof window === 'undefined') {
    return
  }

  if (fullPlayerPreloadHandleType === 'idle') {
    window.cancelIdleCallback?.(fullPlayerPreloadHandle)
  } else {
    window.clearTimeout(fullPlayerPreloadHandle)
  }

  fullPlayerPreloadHandle = 0
  fullPlayerPreloadHandleType = ''
}

function scheduleFullPlayerBackgroundTasks(delay = fullPlayerBackgroundTaskDelay) {
  clearFullPlayerBackgroundTasks()

  if (!fullPlayerOpen.value || !danmakuEnabled.value || typeof window === 'undefined') {
    return
  }

  fullPlayerBackgroundTaskTimer = window.setTimeout(() => {
    fullPlayerBackgroundTaskTimer = 0

    if (!fullPlayerOpen.value || !danmakuEnabled.value) {
      return
    }

    currentTrackComments.preload(currentTrack.value)
    fullPlayerDanmaku.schedule(180)
  }, Math.max(0, Number(delay) || 0))
}

function clearFullPlayerBackgroundTasks() {
  if (fullPlayerBackgroundTaskTimer && typeof window !== 'undefined') {
    window.clearTimeout(fullPlayerBackgroundTaskTimer)
  }

  fullPlayerBackgroundTaskTimer = 0
  fullPlayerDanmaku.clearSchedule()
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
  qualityMenuOpen.value = false
  visualizerMenuOpen.value = false
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

function toggleDanmaku() {
  danmakuEnabled.value = !danmakuEnabled.value

  if (danmakuEnabled.value) {
    fullPlayerDanmaku.schedule(180)
    return
  }

  fullPlayerDanmaku.clearSchedule()
}

function startProgressDrag(payload) {
  if (!player.state.duration) {
    return
  }

  const { event, bar } = normalizeProgressPayload(payload)

  progressDragging.value = true
  updateProgressPreview(payload)
  pendingProgressTime.value = progressPreviewTime.value
  bar?.setPointerCapture?.(event.pointerId)
}

function handleProgressPointerMove(payload) {
  if (!player.state.duration) {
    return
  }

  updateProgressPreview(payload)

  if (progressDragging.value) {
    pendingProgressTime.value = progressPreviewTime.value
  }
}

function stopProgressDrag(payload) {
  const { event, bar } = normalizeProgressPayload(payload)

  if (!progressDragging.value) {
    hideProgressPreview()
    return
  }

  updateProgressPreview(payload)
  pendingProgressTime.value = progressPreviewTime.value
  player.seekTo(pendingProgressTime.value)
  progressDragging.value = false
  progressPreviewVisible.value = false
  bar?.releasePointerCapture?.(event.pointerId)
}

function cancelProgressDrag(payload) {
  const { event, bar } = normalizeProgressPayload(payload)

  progressDragging.value = false
  bar?.releasePointerCapture?.(event.pointerId)
  hideProgressPreview()
}

function hideProgressPreview() {
  if (progressDragging.value) {
    return
  }

  progressPreviewVisible.value = false
}

function updateProgressPreview(payload) {
  const progress = getProgressPoint(payload)

  if (!progress) {
    return
  }

  progressLyrics.load(currentTrack.value)
  progressPreviewVisible.value = true
  progressPreviewPercent.value = progress.percent
  progressPreviewTime.value = progress.time
}

function getProgressPoint(payload) {
  const { event, bar } = normalizeProgressPayload(payload)
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

function normalizeProgressPayload(payload) {
  if (payload?.event) {
    return {
      event: payload.event,
      bar: payload.bar
    }
  }

  return {
    event: payload,
    bar: payload?.currentTarget
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

function isNeteaseTrackId(trackId) {
  return /^\d+$/.test(String(trackId ?? '')) || /^[a-f0-9]{32}$/i.test(String(trackId ?? ''))
}

async function playPreviousTrack() {
  await playQueueRelative(-1)
}

async function playNextTrack() {
  await playQueueRelative(1)
}

async function handleTrackEnded() {
  if (player.shouldRestartCurrentTrackOnEnded()) {
    const restarted = await player.restartCurrentTrack()
    showPlaybackError(restarted)
    return
  }

  await playQueueRelative(1)
}

async function playQueueRelative(direction) {
  const targetTrack = player.getRelativeQueueTrack(direction)

  if (!targetTrack) {
    return
  }

  await playTrackFromControls(targetTrack)
}

async function playTrackFromControls(track, options = {}) {
  const { showVipWarning = true } = options

  if (showVipWarning && track.vip && !hasAccountLogin.value) {
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

  message.error(getPlaybackErrorDisplay(player.state.error, '当前歌曲暂无可播放链接'))
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

onMounted(() => {
  syncPlayerBarHeight()
  window.addEventListener('resize', syncPlayerBarHeight)
  if (typeof ResizeObserver !== 'undefined' && playerBar.value) {
    playerBarResizeObserver = new ResizeObserver(syncPlayerBarHeight)
    playerBarResizeObserver.observe(playerBar.value)
  }

  document.addEventListener('pointerdown', handleOutsideClick)
  removeTrackEndedListener = player.onTrackEnded(handleTrackEnded)
  scheduleFullPlayerPreload()
})

onUnmounted(() => {
  window.removeEventListener('resize', syncPlayerBarHeight)
  document.removeEventListener('pointerdown', handleOutsideClick)
  cancelFullPlayerPreload()
  clearFullPlayerBackgroundTasks()
  playerBarResizeObserver?.disconnect()
  playerBarResizeObserver = null
  removeTrackEndedListener?.()
  removeTrackEndedListener = null
})
</script>
