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
      <div>
        <strong>{{ currentTrack.name }}</strong>
        <small>{{ currentTrack.artist }}</small>
      </div>
      <button class="icon-button" type="button" aria-label="喜欢"><Heart :size="18" /></button>
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
        <button type="button" aria-label="上一首"><SkipBack :size="19" /></button>
        <button class="play-button" type="button" :aria-label="player.state.isPlaying ? '暂停' : '播放'" @click="player.togglePlay">
          <Pause v-if="player.state.isPlaying" :size="22" fill="currentColor" />
          <Play v-else :size="22" fill="currentColor" />
        </button>
        <button type="button" aria-label="下一首"><SkipForward :size="19" /></button>
        <div class="control-popover-wrap">
          <button
            class="volume-button"
            type="button"
            aria-label="音量"
            :class="{ active: volumeMenuOpen }"
            @click="toggleVolumeMenu"
          >
            <Volume2 :size="20" />
          </button>
          <div v-if="volumeMenuOpen" class="player-popover volume-popover">
            <div class="volume-control">
              <span class="volume-rail" aria-hidden="true">
                <span class="volume-fill" :style="{ height: `${volume}%` }" />
              </span>
              <button class="volume-plus" type="button" aria-label="提高音量" @click="increaseVolume" />
              <input
                v-model="volume"
                class="volume-slider"
                type="range"
                min="0"
                max="100"
                aria-label="音量大小"
              />
            </div>
            <strong>{{ volume }}%</strong>
            <span class="volume-divider" />
            <Volume2 :size="24" />
          </div>
        </div>
      </div>
      <div class="progress-row">
        <span>{{ currentTrack.elapsed }}</span>
        <n-progress type="line" :percentage="progressPercentage" :height="4" :show-indicator="false" color="var(--accent)" rail-color="#516071" />
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
                @click.prevent="playQueueTrack(track)"
              />
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Heart, ListMusic, Maximize2, Mic2, Minimize2, Pause, Play, Repeat, Repeat1, Repeat2, Shuffle, SkipBack, SkipForward, Volume2 } from 'lucide-vue-next'
import FullScreenPlayer from './FullScreenPlayer.vue'
import SongListRow from './SongListRow.vue'
import { useThemeStore } from '../stores/theme'
import { usePlayerStore } from '../stores/player'

const theme = useThemeStore()
const player = usePlayerStore()
const modeMenuOpen = ref(false)
const volumeMenuOpen = ref(false)
const queueMenuOpen = ref(false)
const fullPlayerOpen = ref(false)
const fullPlayerCoverRect = ref(null)
const albumArtButton = ref(null)
const albumArtHidden = ref(false)
const lastAlbumArtToggleAt = ref(0)
const playMode = ref('list')
const volume = ref(100)

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
const queueTracks = computed(() => player.state.queue.slice(0, 8).map((song, index) => ({
  ...song,
  id: song.id ?? `queue-${song.rank}`,
  rank: String(index + 1).padStart(2, '0'),
  to: `/playlist/new-${String(index + 1).padStart(2, '0')}`,
  vip: index % 2 === 0,
  hasVideo: index % 3 !== 1
})))

watch(volume, (value) => {
  player.setVolume(Number(value) / 100)
})

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

function increaseVolume() {
  volume.value = Math.min(100, Number(volume.value) + 5)
}

function closePlayerPopovers() {
  modeMenuOpen.value = false
  volumeMenuOpen.value = false
  queueMenuOpen.value = false
}

function playQueueTrack(track) {
  if (player.state.currentTrack.id === track.id) {
    player.togglePlay()
    return
  }

  player.playTrack(track)
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
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', handleOutsideClick)
})
</script>
