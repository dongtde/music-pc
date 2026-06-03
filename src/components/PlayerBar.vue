<template>
  <FullScreenPlayer
    :open="fullPlayerOpen"
    :track="currentTrack"
    :source-rect="fullPlayerCoverRect"
    @close="closeFullPlayer"
    @cover-flight-end="handleCoverFlightEnd"
  />

  <footer class="player" :class="{ 'player--full-screen': fullPlayerOpen }" :style="currentTrackCoverStyle">
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
          <strong>{{ currentTrack.name }}</strong>
          <small>{{ currentTrack.artist }}</small>
        </div>
        <div class="track-summary__actions">
          <button class="track-action-button" type="button" aria-label="喜欢">
            <Heart :size="25" />
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
        <button class="play-button" type="button" :aria-label="player.state.isPlaying ? '暂停' : '播放'" @click="player.togglePlay">
          <Pause v-if="player.state.isPlaying" :size="22" fill="currentColor" />
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
      <button class="icon-button" type="button" aria-label="麦克风"><Mic2 :size="17" /></button>
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
                :key="track.id"
                :track="track"
                compact
                @play="playQueueTrack"
              />
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </footer>

  <CommentModal
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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Ellipsis, Heart, ListMusic, Maximize2, MessageCircleMore, Mic2, Minimize2, Pause, Play, Plus, Repeat, Repeat1, Repeat2, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-vue-next'
import { useMessage } from 'naive-ui'
import CommentModal from './CommentModal.vue'
import FullScreenPlayer from './FullScreenPlayer.vue'
import SongListRow from './SongListRow.vue'
import { useThemeStore } from '../stores/theme'
import { usePlayerStore } from '../stores/player'
import { getSongCommentsData, getTrackLyricData } from '../services/netease'
import '../styles/player.css'

const COMMENT_LIMIT = 30

const theme = useThemeStore()
const player = usePlayerStore()
const message = useMessage()
const modeMenuOpen = ref(false)
const volumeMenuOpen = ref(false)
const queueMenuOpen = ref(false)
const fullPlayerOpen = ref(false)
const fullPlayerCoverRect = ref(null)
const albumArtButton = ref(null)
const progressBar = ref(null)
const albumArtHidden = ref(false)
const lastAlbumArtToggleAt = ref(0)
const playMode = ref('list')
const volume = ref(100)
const lastAudibleVolume = ref(100)
const progressDragging = ref(false)
const progressPreviewVisible = ref(false)
const progressPreviewPercent = ref(0)
const progressPreviewTime = ref(0)
const pendingProgressTime = ref(0)
const progressLyricLines = ref([])
const songCommentsModalVisible = ref(false)
const songHotComments = ref([])
const songComments = ref([])
const songCommentTotal = ref(0)
const songCommentsOffset = ref(0)
const songCommentsHasMore = ref(false)
const songCommentsLoading = ref(false)
const songCommentsError = ref('')
const songCommentTrackId = ref(null)
let progressLyricRequestId = 0
let songCommentsRequestId = 0
let removeTrackEndedListener = null

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

const activePlayMode = computed(() => playModes.find((mode) => mode.value === playMode.value) ?? playModes[3])
const currentTrack = computed(() => player.state.currentTrack)
const displaySongCommentTotal = computed(() =>
  songCommentTotal.value || Number(currentTrack.value.commentCount) || 0
)
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
const queueTracks = computed(() => player.state.queue.slice(0, 8).map((song, index) => ({
  ...song,
  id: song.id ?? `queue-${song.rank}`,
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
  (trackId) => {
    loadProgressLyrics(trackId)
    resetSongComments()

    if (isNeteaseTrackId(trackId)) {
      loadSongComments(trackId, true)
    }
  },
  { immediate: true }
)

function toggleModeMenu() {
  modeMenuOpen.value = !modeMenuOpen.value
  volumeMenuOpen.value = false
  queueMenuOpen.value = false
}

function toggleVolumeMenu() {
  volumeMenuOpen.value = !volumeMenuOpen.value
  modeMenuOpen.value = false
  queueMenuOpen.value = false
}

function toggleQueueMenu() {
  queueMenuOpen.value = !queueMenuOpen.value
  modeMenuOpen.value = false
  volumeMenuOpen.value = false
}

function selectPlayMode(value) {
  playMode.value = value
  modeMenuOpen.value = false
}

function toggleFullPlayer() {
  const now = performance.now()

  if (now - lastAlbumArtToggleAt.value < 500) {
    return
  }

  lastAlbumArtToggleAt.value = now
  fullPlayerCoverRect.value = getAlbumArtRect()
  albumArtHidden.value = true
  fullPlayerOpen.value = !fullPlayerOpen.value
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
}

async function loadProgressLyrics(trackId) {
  progressLyricRequestId += 1
  const requestId = progressLyricRequestId
  progressLyricLines.value = []

  if (!isNeteaseTrackId(trackId)) {
    return
  }

  try {
    const lines = await getTrackLyricData(trackId)

    if (requestId !== progressLyricRequestId) {
      return
    }

    progressLyricLines.value = lines.filter((line) => !line.placeholder)
  } catch (error) {
    if (requestId !== progressLyricRequestId) {
      return
    }

    console.warn('Failed to load progress lyrics:', error)
    progressLyricLines.value = []
  }
}

function resetSongComments() {
  songCommentsRequestId += 1
  songCommentTrackId.value = null
  songHotComments.value = []
  songComments.value = []
  songCommentTotal.value = 0
  songCommentsOffset.value = 0
  songCommentsHasMore.value = false
  songCommentsLoading.value = false
  songCommentsError.value = ''
}

async function loadSongComments(trackId = currentTrack.value.id, reset = false) {
  if (songCommentsLoading.value) {
    return
  }

  if (!isNeteaseTrackId(trackId)) {
    songCommentsError.value = '当前歌曲暂无评论数据'
    return
  }

  const requestId = ++songCommentsRequestId
  const offset = reset ? 0 : songCommentsOffset.value
  songCommentsLoading.value = true
  songCommentsError.value = ''

  try {
    const data = await getSongCommentsData({
      id: trackId,
      limit: COMMENT_LIMIT,
      offset
    })

    if (
      requestId !== songCommentsRequestId ||
      String(trackId) !== String(currentTrack.value.id)
    ) {
      return
    }

    if (reset) {
      songHotComments.value = data.hotComments
      songComments.value = data.comments
    } else {
      songComments.value = [...songComments.value, ...data.comments]
    }

    songCommentTrackId.value = trackId
    songCommentTotal.value = data.total
    songCommentsHasMore.value = data.more || songComments.value.length < data.total
    songCommentsOffset.value = songComments.value.length
    currentTrack.value.commentCount = data.total
  } catch (error) {
    if (requestId !== songCommentsRequestId) {
      return
    }

    console.warn('Failed to load song comments:', error)
    songCommentsError.value = '评论加载失败'
  } finally {
    if (requestId === songCommentsRequestId) {
      songCommentsLoading.value = false
    }
  }
}

async function openSongCommentsModal() {
  songCommentsModalVisible.value = true
  closePlayerPopovers()

  const trackId = currentTrack.value.id

  if (!isNeteaseTrackId(trackId)) {
    songCommentsError.value = '当前歌曲暂无评论数据'
    return
  }

  if (
    !songCommentsLoading.value &&
    (String(songCommentTrackId.value) !== String(trackId) || !songComments.value.length)
  ) {
    await loadSongComments(trackId, true)
  }
}

function loadMoreSongComments() {
  if (!songCommentsHasMore.value) {
    return
  }

  loadSongComments(currentTrack.value.id)
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

function formatTime(value = 0) {
  const totalSeconds = Math.max(0, Math.floor(value))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')

  return `${minutes}:${seconds}`
}

function isNeteaseTrackId(trackId) {
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

async function playTrackFromControls(track) {
  if (track.vip) {
    message.warning('当前歌曲为 VIP 歌曲，将尝试播放试听')
  }

  const played = await player.playTrack(track)
  showPlaybackError(played)
}

async function playQueueTrack(track) {
  if (player.state.currentTrack.id === track.id) {
    const toggled = await player.togglePlay()
    showPlaybackError(toggled)
    return
  }

  await playTrackFromControls(track)
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

onMounted(() => {
  document.addEventListener('pointerdown', handleOutsideClick)
  removeTrackEndedListener = player.onTrackEnded(handleTrackEnded)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', handleOutsideClick)
  removeTrackEndedListener?.()
  removeTrackEndedListener = null
})
</script>
