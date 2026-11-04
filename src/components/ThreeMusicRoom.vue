<template>
  <section class="music-room" aria-label="可行走的 3D 声场实验室">
    <canvas
      :key="canvasKey" ref="canvas" class="music-room__canvas" tabindex="0"
      aria-label="3D 音乐房间。WASD 行走，拖动环顾，方向键转动视角，E 与附近装置交互，Home 返回入口。"
      @pointerdown="started = true"
    />
    <header class="music-room__identity">
      <span>LANYIN / SOUND FIELD</span>
      <h2>声场实验室<span>音乐，可以走进去。</span></h2>
    </header>

    <div v-if="ready" class="music-room__destination" aria-live="off">
      <Monitor :size="14" /><span>音乐主屏</span><b>{{ status.distance.toFixed(1) }} <small>m</small></b>
    </div>
    <span v-if="ready && started" class="music-room__crosshair" aria-hidden="true" />

    <div v-if="!ready || failed" class="music-room__loading" role="status">
      <AudioLines :size="40" :stroke-width="1" />
      <strong>{{ failed ? '暂时无法进入声场' : '正在构建你的音乐空间' }}</strong>
      <p>{{ failed ? '重试进入，或切回歌词页面继续听歌。' : '准备房间、灯光与音乐大屏…' }}</p>
      <button v-if="failed" type="button" @click="initializeScene">重新进入</button>
    </div>

    <div v-if="ready && !started" class="music-room__welcome">
      <span class="music-room__welcome-label"><Headphones :size="15" />你的私人音乐空间</span>
      <h3>走近声音的中心。</h3>
      <p>沿光带走向音乐主屏，让两侧舞台灯随音乐点亮整个空间。</p>
      <button class="music-room__enter" type="button" @click="startWalking"><Footprints :size="17" />开始漫游<ArrowUpRight :size="17" /></button>
      <span class="music-room__keys"><kbd>W A S D</kbd> 行走<span>·</span>拖动环顾<span>·</span><kbd>E</kbd> 交互</span>
    </div>

    <div v-if="ready && started && !consoleOpen && status.near" class="music-room__interaction">
      <button type="button" @click="interact"><kbd>E</kbd>操作音乐主屏<ArrowUpRight :size="14" /></button>
    </div>

    <div v-if="notice && started" class="music-room__notice" role="status">{{ notice }}</div>

    <nav v-if="ready" class="music-room__navigation" aria-label="房间导航">
      <button type="button" @click="goTo('screen')"><Monitor :size="15" />前往大屏</button>
      <button type="button" aria-label="返回房间入口" @click="goTo('entrance')"><DoorOpen :size="16" /></button>
      <span class="music-room__nav-divider" />
      <button type="button" @click="scene?.setTheme()"><Lightbulb :size="15" />{{ status.theme }}</button>
    </nav>

    <div v-if="ready" class="music-room__telemetry">
      <div class="music-room__mini-map" aria-hidden="true">
        <span class="music-room__map-screen" /><span class="music-room__map-lights" />
        <i :style="{ left: `${(status.x + 9) / 18 * 100}%`, top: `${(status.z + 12) / 25 * 100}%` }" />
      </div>
      <div><span>{{ status.navigating ? '正在行走' : status.near === 'screen' ? '音乐主屏' : '自由漫游' }}</span><small>{{ playing ? status.live ? '灯光 · 节奏同步' : '灯光 · 常亮' : '舞台灯已熄灭' }}</small></div>
    </div>

    <div v-if="ready && started" class="music-room__touch" aria-label="触屏移动控制">
      <button v-for="control in touchControls" :key="control.code" type="button" :class="control.class" :aria-label="control.label"
        @pointerdown.prevent="pressTouch($event, control.code)" @pointerup="releaseTouch($event, control.code)" @pointercancel="releaseTouch($event, control.code)" @lostpointercapture="scene?.setKey(control.code, false)">
        <component :is="control.icon" :size="20" />
      </button>
    </div>

    <section v-if="consoleOpen" ref="consolePanel" class="music-room__console" aria-label="音乐大屏控制" @keydown.esc.stop="closeConsole">
      <header><span><Monitor :size="16" />音乐主屏</span><button type="button" aria-label="关闭大屏控制" @click="closeConsole"><X :size="17" /></button></header>
      <strong>{{ track.id ? track.name : '先选择一首音乐' }}</strong>
      <p>{{ currentLine?.text || track.artist }}</p>
      <div class="music-room__transport">
        <button type="button" aria-label="上一首" :disabled="!queueAvailable || loading" @click="emit('previous')"><SkipBack :size="20" /></button>
        <button class="music-room__play" type="button" :aria-label="playing ? '暂停音乐' : '播放音乐'" :disabled="!track.id || loading" @click="emit('toggle-play')"><Loader2 v-if="loading" :size="24" /><Pause v-else-if="playing" :size="24" fill="currentColor" /><Play v-else :size="24" fill="currentColor" /></button>
        <button type="button" aria-label="下一首" :disabled="!queueAvailable || loading" @click="emit('next')"><SkipForward :size="20" /></button>
      </div>
      <label class="music-room__seek"><span>{{ formatTime(currentTime) }}</span><input aria-label="歌曲播放进度" type="range" min="0" :max="duration || 1" step="0.1" :value="currentTime" :disabled="!duration" @change="emit('seek', { seconds: Number($event.target.value) })" /><span>{{ formatTime(duration) }}</span></label>
    </section>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, AudioLines, DoorOpen, Footprints, Headphones, Lightbulb, Loader2, Monitor, Pause, Play, SkipBack, SkipForward, X } from 'lucide-vue-next'
import { usePlayerStore } from '../stores/player'
import { formatTime } from '../utils/time'
import { createMusicRoomScene } from './music-room/createMusicRoomScene'
import { createAudioSampler } from './music-room/createAudioSampler'
import '../styles/music-room.css'

const props = defineProps({
  active: { type: Boolean, default: true }, track: { type: Object, required: true },
  playing: { type: Boolean, default: false }, loading: { type: Boolean, default: false },
  currentTime: { type: Number, default: 0 }, duration: { type: Number, default: 0 },
  lines: { type: Array, default: () => [] }, activeIndex: { type: Number, default: 0 },
  queueAvailable: { type: Boolean, default: false },
})
const emit = defineEmits(['seek', 'toggle-play', 'previous', 'next'])
const player = usePlayerStore()
const canvas = ref(null), canvasKey = ref(0), ready = ref(false), failed = ref(false)
const started = ref(false), notice = ref(''), consoleOpen = ref(false), consolePanel = ref(null)
const reducedMotion = ref(false)
const status = reactive({ x: 0, z: 9.8, near: '', distance: 20.95, navigating: false, live: false, theme: '极光' })
const currentLine = computed(() => props.lines[props.activeIndex])
const touchControls = [
  { code: 'KeyW', label: '向前行走', class: 'is-forward', icon: ArrowUp },
  { code: 'KeyA', label: '向左行走', class: 'is-left', icon: ArrowLeft },
  { code: 'KeyS', label: '向后行走', class: 'is-back', icon: ArrowDown },
  { code: 'KeyD', label: '向右行走', class: 'is-right', icon: ArrowRight },
]
let scene = null, sampler = null, mediaQuery = null, initializationId = 0, noticeTimer = 0

function showNotice(value) {
  notice.value = value
  window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => { notice.value = '' }, 4000)
}
function syncPlayback() {
  if (props.playing && props.active && !document.hidden && !failed.value && !reducedMotion.value) sampler?.start()
  else sampler?.stop()
  scene?.setPlayback({ playing: props.playing, loading: props.loading, reducedMotion: reducedMotion.value,
    track: props.track, currentTime: props.currentTime, duration: props.duration,
    line: currentLine.value, nextLine: props.lines[props.activeIndex + 1] })
}
async function handleAction(action, payload) {
  if (action === 'console') {
    scene?.clearMovement(); consoleOpen.value = true
    await nextTick(); consolePanel.value?.querySelector('button')?.focus()
    return
  }
  if (!props.track.id || props.loading) return
  if (action === 'toggle') emit('toggle-play')
  if (action === 'previous' && props.queueAvailable) emit('previous')
  if (action === 'next' && props.queueAvailable) emit('next')
  if (action === 'progress' && props.duration > 0) emit('seek', { seconds: payload * props.duration })
  if (action === 'lyric' && Number.isFinite(payload)) emit('seek', { seconds: payload })
}
async function initializeScene() {
  const request = ++initializationId
  scene?.dispose(); sampler?.dispose(); scene = sampler = null
  ready.value = false; failed.value = false; consoleOpen.value = false
  canvasKey.value += 1
  await nextTick()
  if (request !== initializationId) return
  try {
    sampler = createAudioSampler(player.getAudioElement())
    scene = createMusicRoomScene(canvas.value, {
      onError: () => { failed.value = true; ready.value = false; consoleOpen.value = false; sampler?.stop() },
      onStatus: (value) => { Object.assign(status, value); if (!value.near) consoleOpen.value = false },
      onNotice: showNotice, onAction: handleAction, sampleAudio: () => sampler?.sample(),
    })
    scene.setActive(props.active)
    syncPlayback()
    ready.value = true
  } catch (error) { failed.value = true; console.warn('Unable to initialize music room:', error) }
}
function startWalking() { started.value = true; canvas.value?.focus({ preventScroll: true }); syncPlayback() }
function goTo(station) { startWalking(); consoleOpen.value = false; scene?.navigate(station) }
function interact() { started.value = true; scene?.interact() }
function closeConsole() { consoleOpen.value = false; canvas.value?.focus({ preventScroll: true }) }
function pressTouch(event, code) { event.currentTarget.setPointerCapture(event.pointerId); scene?.setKey(code, true) }
function releaseTouch(event, code) { scene?.setKey(code, false); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }
function syncMotion() { reducedMotion.value = Boolean(mediaQuery?.matches) }
watch(() => [props.playing, props.loading, props.currentTime, props.duration, props.track.id, props.track.coverUrl, props.track.name, currentLine.value, reducedMotion.value], syncPlayback)
watch(() => props.active, (active) => { scene?.setActive(active); if (!active) { consoleOpen.value = false; sampler?.stop() } else syncPlayback() })
onMounted(() => {
  mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  syncMotion(); mediaQuery.addEventListener('change', syncMotion)
  document.addEventListener('visibilitychange', syncPlayback)
  initializeScene()
})
onBeforeUnmount(() => {
  initializationId += 1; window.clearTimeout(noticeTimer)
  mediaQuery?.removeEventListener('change', syncMotion)
  document.removeEventListener('visibilitychange', syncPlayback)
  scene?.dispose(); sampler?.dispose(); scene = sampler = null
})
</script>
