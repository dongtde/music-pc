<template>
  <main
    class="desktop-lyrics"
    :class="{
      'desktop-lyrics--locked': locked,
      'desktop-lyrics--playing': playback.isPlaying,
      'desktop-lyrics--settings-open': settingsOpen,
    }"
    :style="paletteStyle"
    @mouseenter="hovering = true"
    @mouseleave="hovering = false"
  >
    <div class="desktop-lyrics__drag-zone" />

    <button
      v-if="locked"
      class="desktop-lyrics__unlock-button"
      type="button"
      title="Unlock lyrics"
      aria-label="Unlock lyrics"
      @click="setLocked(false)"
    >
      <Unlock :size="16" />
    </button>

    <section class="desktop-lyrics__line-wrap" aria-live="polite">
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
    </section>

    <Transition name="desktop-lyrics-settings">
      <div
        v-if="settingsOpen && !locked"
        class="desktop-lyrics__settings"
        @click.stop
        @pointerdown.stop
      >
        <button
          class="desktop-lyrics__settings-back"
          type="button"
          title="Back"
          aria-label="Back"
          @click="closeSettings"
        >
          <ChevronLeft :size="16" />
        </button>
        <div class="desktop-lyrics__settings-row">
          <button
            type="button"
            title="Smaller"
            aria-label="Smaller"
            @click="adjustFontSize(-2)"
          >
            <Minus :size="15" />
          </button>
          <input
            type="range"
            :min="fontSizeLimits.min"
            :max="fontSizeLimits.max"
            :step="1"
            :value="lyricSettings.fontSize"
            title="Font size"
            aria-label="Font size"
            @input="setFontSize($event.target.value)"
          >
          <button
            type="button"
            title="Larger"
            aria-label="Larger"
            @click="adjustFontSize(2)"
          >
            <Plus :size="15" />
          </button>
          <output>{{ lyricSettings.fontSize }}px</output>
        </div>
        <div class="desktop-lyrics__settings-row desktop-lyrics__settings-row--colors">
          <button
            v-for="color in colorPresets"
            :key="color"
            class="desktop-lyrics__swatch"
            type="button"
            title="Lyric color"
            aria-label="Lyric color"
            :class="{ active: isLyricColor(color) }"
            :style="{ '--swatch-color': color }"
            @click="setLyricColor(color)"
          ></button>
          <input
            class="desktop-lyrics__color-input"
            type="color"
            :value="lyricSettings.color"
            title="Custom color"
            aria-label="Custom color"
            @input="setLyricColor($event.target.value)"
          >
        </div>
      </div>
    </Transition>

    <Transition name="desktop-lyrics-toolbar">
      <nav
        v-if="toolbarVisible"
        class="desktop-lyrics__toolbar"
        aria-label="Desktop lyrics controls"
      >
        <button
          type="button"
          title="Settings"
          aria-label="Settings"
          :class="{ active: settingsOpen }"
          @click="toggleSettings"
        >
          <Settings2 :size="16" />
        </button>
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
import { ChevronLeft, Lock, Minus, Pause, Play, Plus, Settings2, SkipBack, SkipForward, Unlock, X } from 'lucide-vue-next'
import '../styles/desktop-lyrics.css'

const settingsStorageKey = 'mappic:desktop-lyrics:settings'
const fontSizeLimits = {
  min: 24,
  max: 58,
}
const fallbackSettings = {
  fontSize: 34,
  color: '#ffe16d',
}
const colorPresets = [
  '#ffe16d',
  '#5eead4',
  '#60a5fa',
  '#fb7185',
  '#ffffff',
]
const fallbackPalette = {
  primary: '#2c5364',
  secondary: '#ff3f73',
  tertiary: '#ffd166',
}

const hovering = ref(false)
const locked = ref(false)
const settingsOpen = ref(false)
const lyricSettings = reactive(readLyricSettings())
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
const lyricProgressWidth = computed(() => `${Math.round((lyrics.progress || 0) * 1000) / 10}%`)
const toolbarVisible = computed(() => !locked.value && !settingsOpen.value)
const playTitle = computed(() => (playback.isPlaying ? 'Pause' : 'Play'))
const paletteStyle = computed(() => {
  const palette = track.coverPalette || fallbackPalette

  return {
    '--lyric-primary': palette.primary || fallbackPalette.primary,
    '--lyric-secondary': palette.secondary || fallbackPalette.secondary,
    '--lyric-tertiary': palette.tertiary || fallbackPalette.tertiary,
    '--desktop-lyric-font-size': `${lyricSettings.fontSize}px`,
    '--desktop-lyric-color': lyricSettings.color,
  }
})

onMounted(() => {
  const desktopLyrics = window.mappicDesktop?.desktopLyrics

  if (!desktopLyrics) {
    return
  }

  removeStateListener = desktopLyrics.onState(applyDesktopLyricsState)
  removeWindowStateListener = desktopLyrics.onWindowState((state) => {
    applyWindowState(state)
  })
  desktopLyrics.ready()
  desktopLyrics
    .getWindowState()
    .then(applyWindowState)
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

function applyWindowState(state = {}) {
  locked.value = Boolean(state?.locked)

  if (locked.value) {
    settingsOpen.value = false
  }
}

function toggleLocked() {
  setLocked(!locked.value)
}

function setLocked(nextLocked) {
  locked.value = Boolean(nextLocked)

  if (locked.value) {
    settingsOpen.value = false
  }

  window.mappicDesktop?.desktopLyrics?.setLocked(locked.value)
}

function toggleSettings() {
  if (locked.value) {
    return
  }

  settingsOpen.value = !settingsOpen.value
}

function closeSettings() {
  settingsOpen.value = false
}

function adjustFontSize(delta) {
  setFontSize(lyricSettings.fontSize + delta)
}

function setFontSize(value) {
  lyricSettings.fontSize = clampNumber(
    Number(value),
    fontSizeLimits.min,
    fontSizeLimits.max,
    fallbackSettings.fontSize
  )
  persistLyricSettings()
}

function setLyricColor(value) {
  const nextColor = normalizeColor(value)

  if (!nextColor) {
    return
  }

  lyricSettings.color = nextColor
  persistLyricSettings()
}

function isLyricColor(color) {
  return lyricSettings.color.toLowerCase() === color.toLowerCase()
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

function readLyricSettings() {
  if (typeof window === 'undefined') {
    return { ...fallbackSettings }
  }

  try {
    const stored = JSON.parse(window.localStorage.getItem(settingsStorageKey) || '{}')
    return normalizeLyricSettings(stored)
  } catch {
    return { ...fallbackSettings }
  }
}

function normalizeLyricSettings(settings = {}) {
  return {
    fontSize: clampNumber(
      Number(settings.fontSize),
      fontSizeLimits.min,
      fontSizeLimits.max,
      fallbackSettings.fontSize
    ),
    color: normalizeColor(settings.color) || fallbackSettings.color,
  }
}

function persistLyricSettings() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      settingsStorageKey,
      JSON.stringify({
        fontSize: lyricSettings.fontSize,
        color: lyricSettings.color,
      })
    )
  } catch (error) {
    console.warn('Failed to persist desktop lyric settings:', error)
  }
}

function normalizeColor(value) {
  const color = String(value || '').trim()

  return /^#[0-9a-f]{6}$/i.test(color) ? color : ''
}

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, Math.round(value)))
}
</script>
