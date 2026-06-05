<template>
  <div class="view home-view">
    <section class="soda-feed" aria-label="主页推荐听歌">
      <nav class="soda-feed__tabs" aria-label="推荐口味">
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
        tabindex="0"
        @scroll="handleFeedScroll"
        @keydown="handleFeedKeydown"
      >
        <article
          v-for="(song, index) in recommendationQueue"
          :key="song.id"
          class="soda-slide"
          :class="{ active: index === activeIndex }"
          :style="getSlideStyle(song)"
          :aria-label="`${song.name} - ${song.artist}`"
        >
          <div class="soda-slide__backdrop" aria-hidden="true">
            <img
              v-if="song.coverUrl"
              :src="song.coverUrl"
              :alt="song.name"
              loading="lazy"
              decoding="async"
            />
            <span v-else class="soda-slide__fallback" :class="`cover--${song.type}`" />
          </div>

          <div class="soda-slide__visual" aria-hidden="true">
            <span class="soda-slide__disc" :class="{ 'soda-slide__disc--playing': isSongPlaying(song) }" />
            <span class="soda-slide__cover" :class="`cover--${song.type}`">
              <img
                v-if="song.coverUrl"
                :src="song.coverUrl"
                :alt="song.name"
                loading="lazy"
                decoding="async"
              />
            </span>
          </div>

          <section class="soda-slide__caption">
            <span class="soda-slide__kicker">
              <AudioLines :size="16" />
              {{ getMoodSignal(index) }}
            </span>
            <h1>{{ song.name }}</h1>
            <p>{{ song.artist }}<span v-if="song.album"> · {{ song.album }}</span></p>
            <div class="soda-slide__tags">
              <span>{{ song.time || song.duration || '推荐' }}</span>
              <span>{{ song.vip ? 'VIP 试听' : '完整播放' }}</span>
              <span>{{ song.hasVideo ? '有视频' : '纯音频' }}</span>
            </div>
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
          </section>

          <section
            v-if="index === activeIndex"
            class="soda-lyrics-panel"
            aria-label="歌词"
          >
            <header>
              <span>歌词</span>
              <strong>{{ isLyricLoading ? '加载中' : getActiveLyricTitle() }}</strong>
            </header>
            <div class="soda-lyrics-list">
              <button
                v-for="line in visibleLyricLines"
                :key="`${line.index}-${line.time}`"
                type="button"
                :class="{
                  active: line.index === activeLyricIndex,
                  placeholder: line.placeholder
                }"
                :disabled="line.placeholder"
                @click="seekToLyric(line)"
              >
                <span>{{ line.text }}</span>
                <small v-if="line.translation">{{ line.translation }}</small>
              </button>
            </div>
          </section>

          <aside class="soda-action-rail" aria-label="歌曲操作">
            <button
              type="button"
              :aria-label="isLiked(song) ? '取消喜欢' : '喜欢'"
              :title="isLiked(song) ? '取消喜欢' : '喜欢'"
              :class="{ active: isLiked(song) }"
              @click.stop="toggleLike(song)"
            >
              <Heart :size="24" :fill="isLiked(song) ? 'currentColor' : 'none'" />
              <span>{{ isLiked(song) ? '已喜欢' : '喜欢' }}</span>
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
              <span>{{ isSongPlaying(song) ? '暂停' : '播放' }}</span>
            </button>
            <button type="button" aria-label="评论" title="评论" @click.stop="showCommentHint">
              <MessageCircleMore :size="24" />
              <span>评论</span>
            </button>
            <button type="button" aria-label="下一首" title="下一首" @click.stop="goNextFromGesture">
              <SkipForward :size="24" />
              <span>下一首</span>
            </button>
          </aside>
        </article>
      </div>

      <div class="soda-feed__position" aria-hidden="true">
        <ChevronUp :size="16" />
        <span>{{ displayIndex }} / {{ recommendationQueue.length }}</span>
        <ChevronDown :size="16" />
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
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
  SkipForward
} from 'lucide-vue-next'
import { recommendedSingles } from '../data/music'
import { getMusicFeedData, getTrackLyricData } from '../services/netease'
import { usePlayerStore } from '../stores/player'
import '../styles/home.css'

const player = usePlayerStore()
const message = useMessage()
const feedScroller = ref(null)
const activeMood = ref('daily')
const activeIndex = ref(0)
const autoPlayAfterGesture = ref(false)
const likedIds = ref(new Set())
const allSongs = ref(prepareQueue(recommendedSingles))
const recommendationQueue = ref(applyMoodQueue(allSongs.value, activeMood.value))
const lyricLines = ref(createLyricPlaceholder('点击播放后显示歌词'))
const isLyricLoading = ref(false)
let scrollFrame = 0
let autoPlayTimer = 0
let removeTrackEndedListener = null
let lyricRequestId = 0

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
const displayIndex = computed(() => String(activeIndex.value + 1).padStart(2, '0'))
const activeLyricIndex = computed(() => findCurrentLyricIndex(lyricLines.value, player.state.currentTime))
const visibleLyricLines = computed(() => {
  const lines = lyricLines.value.length
    ? lyricLines.value
    : createLyricPlaceholder('暂无歌词')
  const activeLineIndex = activeLyricIndex.value
  const start = Math.max(0, Math.min(activeLineIndex - 2, Math.max(lines.length - 6, 0)))

  return lines.slice(start, start + 6).map((line, index) => ({
    ...line,
    index: start + index
  }))
})

watch(
  () => player.state.currentTrack.id,
  (trackId) => {
    const nextIndex = recommendationQueue.value.findIndex((song) => String(song.id) === String(trackId))

    if (nextIndex >= 0 && nextIndex !== activeIndex.value) {
      activeIndex.value = nextIndex
      scrollToIndex(nextIndex, 'smooth')
    }
  }
)

watch(
  () => activeSong.value?.id,
  (trackId) => {
    loadActiveLyrics(trackId)
  },
  { immediate: true }
)

onMounted(() => {
  player.setQueue(recommendationQueue.value)
  removeTrackEndedListener = player.onTrackEnded(handleTrackEnded)
  loadRecommendations()
})

onUnmounted(() => {
  window.cancelAnimationFrame(scrollFrame)
  window.clearTimeout(autoPlayTimer)
  removeTrackEndedListener?.()
  removeTrackEndedListener = null
})

async function loadRecommendations() {
  try {
    const data = await getMusicFeedData()
    const songs = data.songs.length ? data.songs : recommendedSingles
    allSongs.value = prepareQueue(songs)
    recommendationQueue.value = applyMoodQueue(allSongs.value, activeMood.value)
    activeIndex.value = 0
    player.setQueue(recommendationQueue.value)
    await nextTick()
    scrollToIndex(0, 'auto')
  } catch (error) {
    console.warn('Failed to load home recommendations:', error)
  }
}

function prepareQueue(songs) {
  return songs.map((song, index) => ({
    ...song,
    id: song.id ?? `home-${index + 1}`,
    rank: String(index + 1).padStart(2, '0'),
    type: song.type ?? getCoverType(index)
  }))
}

function applyMoodQueue(songs, mood) {
  const queue = [...songs]
  const sorters = {
    daily: (items) => items,
    hot: (items) => items.sort((current, next) => Number(next.hasVideo) - Number(current.hasVideo)),
    new: (items) => items.reverse(),
    chill: (items) => items.sort((current, next) => getChillWeight(next) - getChillWeight(current))
  }
  const sortedQueue = (sorters[mood] ?? sorters.daily)(queue)

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
  activeMood.value = value
  const ordered = applyMoodQueue(allSongs.value, value)

  recommendationQueue.value = ordered.map((song, index) => ({
    ...song,
    rank: String(index + 1).padStart(2, '0')
  }))
  activeIndex.value = 0
  player.setQueue(recommendationQueue.value)
  nextTick(() => scrollToIndex(0, 'smooth'))

  if (autoPlayAfterGesture.value) {
    scheduleAutoPlay()
  }
}

function handleFeedScroll() {
  if (scrollFrame) {
    return
  }

  scrollFrame = window.requestAnimationFrame(() => {
    scrollFrame = 0
    const scroller = feedScroller.value

    if (!scroller?.clientHeight) {
      return
    }

    const nextIndex = Math.min(
      recommendationQueue.value.length - 1,
      Math.max(0, Math.round(scroller.scrollTop / scroller.clientHeight))
    )

    if (nextIndex === activeIndex.value) {
      return
    }

    activeIndex.value = nextIndex
    player.setQueue(recommendationQueue.value)

    if (autoPlayAfterGesture.value) {
      scheduleAutoPlay()
    }
  })
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

  if (!scroller) {
    return
  }

  const nextIndex = Math.min(
    recommendationQueue.value.length - 1,
    Math.max(0, index)
  )

  scroller.scrollTo({
    top: nextIndex * scroller.clientHeight,
    behavior
  })
}

function scheduleAutoPlay() {
  window.clearTimeout(autoPlayTimer)
  autoPlayTimer = window.setTimeout(() => {
    playActiveSong({ auto: true })
  }, 180)
}

async function playSongFromGesture(index) {
  autoPlayAfterGesture.value = true
  activeIndex.value = index
  await nextTick()
  scrollToIndex(index, 'smooth')
  await playActiveSong()
}

async function goNextFromGesture() {
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
  await playActiveSong({ auto: true })
}

async function loadActiveLyrics(trackId) {
  lyricRequestId += 1
  const requestId = lyricRequestId
  isLyricLoading.value = false
  lyricLines.value = createLyricPlaceholder(trackId ? '歌词加载中...' : '暂无歌词')

  if (!isNeteaseTrackId(trackId)) {
    lyricLines.value = createLyricPlaceholder('在线歌曲播放后显示歌词')
    return
  }

  isLyricLoading.value = true

  try {
    const lines = await getTrackLyricData(trackId)

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
}

async function playActiveSong(options = {}) {
  const song = recommendationQueue.value[activeIndex.value]

  if (!song) {
    return
  }

  player.setQueue(recommendationQueue.value)

  if (String(player.state.currentTrack.id) === String(song.id)) {
    if (options.auto && player.state.isPlaying) {
      return
    }

    const toggled = await player.togglePlay()
    showPlaybackError(toggled)
    return
  }

  const played = await player.playTrack(song)
  showPlaybackError(played)
}

function toggleLike(song) {
  const nextLikedIds = new Set(likedIds.value)
  const id = String(song.id)

  if (nextLikedIds.has(id)) {
    nextLikedIds.delete(id)
  } else {
    nextLikedIds.add(id)
  }

  likedIds.value = nextLikedIds
}

function showCommentHint() {
  message.info('评论入口已在底部播放器中接入，播放后可从评论按钮打开')
}

function isLiked(song) {
  return likedIds.value.has(String(song.id))
}

function isActiveSong(song) {
  return String(recommendationQueue.value[activeIndex.value]?.id) === String(song.id)
}

function isSongPlaying(song) {
  return Boolean(
    song?.id &&
    String(player.state.currentTrack.id) === String(song.id) &&
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

function seekToLyric(line) {
  if (!line || line.placeholder) {
    return
  }

  player.seekTo(line.seconds)
}

function getActiveLyricTitle() {
  if (!lyricLines.value.length || lyricLines.value[0]?.placeholder) {
    return '暂无同步歌词'
  }

  return '同步歌词'
}

function createLyricPlaceholder(text) {
  return [{ time: '--:--', text, seconds: 0, placeholder: true }]
}

function findCurrentLyricIndex(lines, currentTime) {
  if (!lines.length || lines[0]?.placeholder) {
    return 0
  }

  let currentIndex = 0

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].seconds <= currentTime + 0.16) {
      currentIndex = index
      continue
    }

    break
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

function getSlideStyle(song) {
  return {
    '--soda-cover-image': song.coverUrl ? `url("${song.coverUrl}")` : 'none'
  }
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
