<template>
  <main
    class="desktop-lyrics"
    :class="{
      'desktop-lyrics--locked': locked,
      'desktop-lyrics--playing': playback.isPlaying,
    }"
    :style="paletteStyle"
    @mouseenter="hovering = true"
    @mouseleave="hovering = false"
  >
    <div class="desktop-lyrics__drag-zone" />

    <section class="desktop-lyrics__line-wrap" aria-live="polite">
      <div class="desktop-lyrics__track">
        <span>{{ track.name || 'Mappic Music' }}</span>
        <small>{{ track.artist || 'Desktop lyrics' }}</small>
      </div>

      <p
        class="desktop-lyrics__line"
        :class="{ 'desktop-lyrics__line--placeholder': activeLine.placeholder }"
      >
        <span class="desktop-lyrics__line-base">
          {{ activeLine.text }}
        </span>
        <span
          class="desktop-lyrics__line-fill"
          :style="{ '--lyric-progress': lyricProgressWidth }"
          aria-hidden="true"
        >
          {{ activeLine.text }}
        </span>
      </p>

      <p
        v-if="activeLine.translation || nextLineText"
        class="desktop-lyrics__subline"
      >
        {{ activeLine.translation || nextLineText }}
      </p>
    </section>

    <Transition name="desktop-lyrics-toolbar">
      <nav
        v-if="toolbarVisible"
        class="desktop-lyrics__toolbar"
        aria-label="Desktop lyrics controls"
      >
        <button type="button" title="Previous" aria-label="Previous" @click="sendCommand('previous')">
          <SkipBack :size="16" />
        </button>
        <button type="button" :title="playTitle" :aria-label="playTitle" @click="sendCommand('toggle-play')">
          <Pause v-if="playback.isPlaying" :size="16" fill="currentColor" />
          <Play v-else :size="16" fill="currentColor" />
        </button>
        <button type="button" title="Next" aria-label="Next" @click="sendCommand('next')">
          <SkipForward :size="16" />
        </button>
        <button
          type="button"
          :title="locked ? 'Unlock lyrics' : 'Lock lyrics'"
          :aria-label="locked ? 'Unlock lyrics' : 'Lock lyrics'"
          :class="{ active: locked }"
          @click="toggleLocked"
        >
          <Lock v-if="locked" :size="16" />
          <Unlock v-else :size="16" />
        </button>
        <button type="button" title="Close" aria-label="Close" @click="hide">
          <X :size="17" />
        </button>
      </nav>
    </Transition>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { Lock, Pause, Play, SkipBack, SkipForward, Unlock, X } from 'lucide-vue-next'
import '../styles/desktop-lyrics.css'

const fallbackPalette = {
  primary: '#2c5364',
  secondary: '#ff3f73',
  tertiary: '#ffd166',
}

const hovering = ref(false)
const locked = ref(false)
const track = reactive({
  id: null,
  name: '',
  artist: '',
  coverUrl: '',
  coverPalette: fallbackPalette,
})
const playback = reactive({
  currentTime: 0,
  duration: 0,
  isPlaying: false,
})
const lyrics = reactive({
  activeLine: createPlaceholderLine('Play a song to show lyrics'),
  nextLine: null,
  progress: 0,
  loading: false,
})
let removeStateListener = null
let removeWindowStateListener = null

const activeLine = computed(() => lyrics.activeLine || createPlaceholderLine('No lyrics'))
const nextLineText = computed(() => {
  const text = lyrics.nextLine?.text || ''

  return lyrics.nextLine?.placeholder ? '' : text
})
const lyricProgressWidth = computed(() => `${Math.round((lyrics.progress || 0) * 1000) / 10}%`)
const toolbarVisible = computed(() => hovering.value || !locked.value)
const playTitle = computed(() => (playback.isPlaying ? 'Pause' : 'Play'))
const paletteStyle = computed(() => {
  const palette = track.coverPalette || fallbackPalette

  return {
    '--lyric-primary': palette.primary || fallbackPalette.primary,
    '--lyric-secondary': palette.secondary || fallbackPalette.secondary,
    '--lyric-tertiary': palette.tertiary || fallbackPalette.tertiary,
  }
})

onMounted(() => {
  const desktopLyrics = window.mappicDesktop?.desktopLyrics

  if (!desktopLyrics) {
    return
  }

  removeStateListener = desktopLyrics.onState(applyDesktopLyricsState)
  removeWindowStateListener = desktopLyrics.onWindowState((state) => {
    locked.value = Boolean(state?.locked)
  })
  desktopLyrics.ready()
  desktopLyrics
    .getWindowState()
    .then((state) => {
      locked.value = Boolean(state?.locked)
    })
    .catch((error) => {
      console.warn('Failed to read desktop lyrics window state:', error)
    })
})

onBeforeUnmount(() => {
  removeStateListener?.()
  removeWindowStateListener?.()
})

function applyDesktopLyricsState(payload = {}) {
  Object.assign(track, {
    id: payload.track?.id ?? null,
    name: payload.track?.name || '',
    artist: payload.track?.artist || '',
    coverUrl: payload.track?.coverUrl || '',
    coverPalette: payload.track?.coverPalette || fallbackPalette,
  })
  Object.assign(playback, {
    currentTime: Number(payload.playback?.currentTime) || 0,
    duration: Number(payload.playback?.duration) || 0,
    isPlaying: Boolean(payload.playback?.isPlaying),
  })
  Object.assign(lyrics, {
    activeLine: payload.lyrics?.activeLine || createPlaceholderLine('No lyrics'),
    nextLine: payload.lyrics?.nextLine || null,
    progress: Number(payload.lyrics?.progress) || 0,
    loading: Boolean(payload.lyrics?.loading),
  })
}

function toggleLocked() {
  const nextLocked = !locked.value
  locked.value = nextLocked
  window.mappicDesktop?.desktopLyrics?.setLocked(nextLocked)
}

function sendCommand(action) {
  window.mappicDesktop?.desktopLyrics?.sendCommand({ action })
}

function hide() {
  sendCommand('hide')
  window.mappicDesktop?.desktopLyrics?.hide()
}

function createPlaceholderLine(text) {
  return {
    index: 0,
    time: '--:--',
    text,
    translation: '',
    seconds: 0,
    duration: 0,
    placeholder: true,
    words: [],
  }
}
</script>
