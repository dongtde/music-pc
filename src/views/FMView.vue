<template>
  <div class="view fm-view">
    <section class="fm-hero">
      <div class="fm-hero__copy">
        <span class="fm-kicker"><Radio :size="15" /> 私人 FM</span>
        <h1>{{ activeTrack?.name || '把今天交给推荐算法' }}</h1>
        <p>
          {{
            activeTrack
              ? `${activeTrack.artist} · ${activeTrack.album}`
              : '从默认、熟悉、探索和场景模式里挑一个，系统会持续为你续播。'
          }}
        </p>
      </div>

      <div class="fm-mode-panel">
        <button
          v-for="item in modes"
          :key="item.value"
          class="fm-mode"
          :class="{ 'is-active': mode === item.value }"
          type="button"
          @click="switchMode(item.value)"
        >
          <component :is="item.icon" :size="16" />
          <span>{{ item.label }}</span>
        </button>
      </div>
    </section>

    <section v-if="mode === 'SCENE_RCMD'" class="fm-submodes" aria-label="私人 FM 场景">
      <button
        v-for="item in sceneModes"
        :key="item.value"
        :class="{ 'is-active': submode === item.value }"
        type="button"
        @click="switchSubmode(item.value)"
      >
        <component :is="item.icon" :size="15" />
        <span>{{ item.label }}</span>
      </button>
    </section>

    <section v-if="!auth.state.isLoggedIn" class="fm-login-panel">
      <LockKeyhole :size="28" />
      <div>
        <strong>私人 FM 需要登录网易云账号</strong>
        <small>登录后可获取推荐、切换模式、喜欢歌曲以及把不想听的歌移入垃圾桶。</small>
      </div>
      <button class="fm-action fm-action--primary" type="button" @click="auth.openLoginModal">
        <LogIn :size="17" />
        <span>去登录</span>
      </button>
    </section>

    <template v-else>
      <section v-if="isLoading && !tracks.length" class="fm-loading">
        <LoaderCircle :size="26" />
        <span>正在调频...</span>
      </section>

      <section v-else class="fm-player-layout">
        <article class="fm-now">
          <div class="fm-cover" :class="`fm-cover--${activeTrack?.type || 'sunset'}`">
            <img
              v-if="activeTrack?.coverUrl"
              :src="activeTrack.coverUrl"
              :alt="activeTrack.name"
              loading="lazy"
              decoding="async"
            />
            <div class="fm-cover__pulse">
              <AudioLines v-if="isCurrentTrackPlaying" :size="52" />
              <Radio v-else :size="52" />
            </div>
          </div>

          <div class="fm-now__meta">
            <span>{{ modeLabel }}{{ submodeLabel ? ` · ${submodeLabel}` : '' }}</span>
            <h2>{{ activeTrack?.name || '暂无推荐歌曲' }}</h2>
            <p>{{ activeTrack ? `${activeTrack.artist} / ${activeTrack.album}` : errorMessage || '点击刷新重新获取私人 FM' }}</p>
            <small v-if="activeTrack?.reason">{{ activeTrack.reason }}</small>
          </div>

          <div class="fm-actions">
            <button class="fm-action fm-action--primary" type="button" :disabled="!activeTrack || player.state.isLoading" @click="toggleCurrentTrack">
              <Pause v-if="isCurrentTrackPlaying" :size="18" fill="currentColor" />
              <Play v-else :size="18" fill="currentColor" />
              <span>{{ isCurrentTrackPlaying ? '暂停' : '播放' }}</span>
            </button>
            <button class="fm-action" type="button" :disabled="!activeTrack || likeLoading" @click="toggleLike">
              <Heart :size="18" :fill="isActiveLiked ? 'currentColor' : 'none'" />
              <span>{{ isActiveLiked ? '已喜欢' : '喜欢' }}</span>
            </button>
            <button class="fm-action" type="button" :disabled="!activeTrack || trashLoading" @click="trashCurrentTrack">
              <Trash2 :size="18" />
              <span>不想听</span>
            </button>
            <button class="fm-action" type="button" :disabled="!tracks.length" @click="skipToNext">
              <SkipForward :size="18" />
              <span>下一首</span>
            </button>
            <button class="fm-action" type="button" :disabled="isLoading" @click="refreshFm">
              <RefreshCw :size="18" :class="{ 'fm-spin': isLoading }" />
              <span>刷新</span>
            </button>
          </div>
        </article>

        <aside class="fm-queue">
          <header>
            <div>
              <strong>待播列表</strong>
              <small>{{ tracks.length }} 首推荐</small>
            </div>
            <button type="button" :disabled="isLoading" @click="loadMore">
              <Plus :size="16" />
            </button>
          </header>

          <div v-if="errorMessage" class="fm-state fm-state--error">{{ errorMessage }}</div>

          <div v-if="tracks.length" class="fm-queue__list">
            <SongListRow
              v-for="track in tracks"
              :key="track.id"
              :track="track"
              compact
              @play="playTrack"
            />
          </div>
          <div v-else class="fm-state">暂无推荐，试试刷新 FM。</div>
        </aside>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import {
  AudioLines,
  Compass,
  Heart,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  Moon,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Repeat,
  Rocket,
  SkipForward,
  Sparkles,
  Trash2,
  Zap
} from 'lucide-vue-next'
import SongListRow from '../components/SongListRow.vue'
import {
  getPersonalFmData,
  getSongLikeStateData,
  movePersonalFmSongToTrash,
  updateSongLikeStateData
} from '../services/netease'
import { useAuthStore } from '../stores/auth'
import { usePlayerStore } from '../stores/player'
import '../styles/fm.css'

const LOW_QUEUE_WATERMARK = 2
const FM_FETCH_LIMIT = 3

const modes = [
  { value: 'DEFAULT', label: '默认', icon: Radio },
  { value: 'FAMILIAR', label: '熟悉', icon: Repeat },
  { value: 'EXPLORE', label: '探索', icon: Compass },
  { value: 'SCENE_RCMD', label: '场景', icon: Sparkles },
  { value: 'aidj', label: 'AI DJ', icon: Zap }
]
const sceneModes = [
  { value: 'EXERCISE', label: '运动', icon: Rocket },
  { value: 'FOCUS', label: '专注', icon: Sparkles },
  { value: 'NIGHT_EMO', label: '夜晚', icon: Moon }
]

const auth = useAuthStore()
const player = usePlayerStore()
const message = useMessage()
const tracks = ref([])
const mode = ref('DEFAULT')
const submode = ref('EXERCISE')
const activeIndex = ref(0)
const isLoading = ref(false)
const likeLoading = ref(false)
const trashLoading = ref(false)
const errorMessage = ref('')
const likedIds = ref(new Set())
let removeEndedListener = null

const activeTrack = computed(() => tracks.value[activeIndex.value] ?? null)
const modeLabel = computed(() => modes.find((item) => item.value === mode.value)?.label || '默认')
const submodeLabel = computed(() =>
  mode.value === 'SCENE_RCMD'
    ? sceneModes.find((item) => item.value === submode.value)?.label || ''
    : ''
)
const isCurrentTrackPlaying = computed(() =>
  Boolean(
    activeTrack.value &&
      String(player.state.currentTrack.id) === String(activeTrack.value.id) &&
      player.state.isPlaying
  )
)
const isActiveLiked = computed(() =>
  Boolean(activeTrack.value && likedIds.value.has(String(activeTrack.value.id)))
)

onMounted(() => {
  removeEndedListener = player.onTrackEnded((track) => {
    if (track?.source === '私人 FM' || tracks.value.some((item) => String(item.id) === String(track?.id))) {
      skipToNext({ autoplay: true })
    }
  })

  if (auth.state.isLoggedIn) {
    refreshFm()
  }
})

onUnmounted(() => {
  removeEndedListener?.()
})

watch(
  () => auth.state.isLoggedIn,
  (loggedIn) => {
    if (loggedIn && !tracks.value.length) {
      refreshFm()
    }
  }
)

async function switchMode(value) {
  if (mode.value === value) {
    return
  }

  mode.value = value
  await refreshFm()
}

async function switchSubmode(value) {
  if (submode.value === value) {
    return
  }

  submode.value = value
  await refreshFm()
}

async function refreshFm() {
  tracks.value = []
  activeIndex.value = 0
  likedIds.value = new Set()
  await fetchFmTracks({ reset: true, autoplay: false })
}

async function loadMore() {
  await fetchFmTracks()
}

async function fetchFmTracks({ reset = false, autoplay = false } = {}) {
  if (!auth.state.isLoggedIn || isLoading.value) {
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const batches = await Promise.all(
      Array.from({ length: FM_FETCH_LIMIT }, (_, index) =>
        getPersonalFmData({
          mode: mode.value,
          submode: mode.value === 'SCENE_RCMD' ? submode.value : '',
          timestamp: Date.now() + index
        }).catch(() => ({ tracks: [] }))
      )
    )
    const nextTracks = uniqueTracks(batches.flatMap((batch) => batch.tracks))

    if (!nextTracks.length) {
      throw new Error('私人 FM 暂无推荐内容')
    }

    tracks.value = reset ? nextTracks : uniqueTracks([...tracks.value, ...nextTracks])
    player.setQueue(tracks.value)
    await loadLikeStates(nextTracks)

    if (autoplay && activeTrack.value) {
      await playTrack(activeTrack.value)
    }
  } catch (error) {
    console.warn('Failed to load personal FM:', error)
    errorMessage.value = error?.message || '私人 FM 加载失败'
    message.error(errorMessage.value)
  } finally {
    isLoading.value = false
  }
}

async function loadLikeStates(nextTracks) {
  try {
    const nextLikedIds = await getSongLikeStateData(nextTracks.map((track) => track.id))
    likedIds.value = new Set([...likedIds.value, ...nextLikedIds])
  } catch (error) {
    console.warn('Failed to load FM like states:', error)
  }
}

async function playTrack(track) {
  player.setQueue(tracks.value)

  if (String(player.state.currentTrack.id) === String(track.id)) {
    await player.togglePlay()
    return
  }

  activeIndex.value = Math.max(0, tracks.value.findIndex((item) => String(item.id) === String(track.id)))
  const played = await player.playTrack(track)
  if (!played) {
    message.error(player.state.error?.message || '当前歌曲暂无可播放链接')
  }
}

async function toggleCurrentTrack() {
  if (!activeTrack.value) {
    return
  }

  await playTrack(activeTrack.value)
}

async function skipToNext(options = {}) {
  if (!tracks.value.length) {
    return
  }

  const nextIndex = activeIndex.value + 1

  if (nextIndex >= tracks.value.length) {
    await fetchFmTracks({ autoplay: options.autoplay })
    if (tracks.value.length > activeIndex.value + 1) {
      activeIndex.value += 1
    }
  } else {
    activeIndex.value = nextIndex
  }

  if (tracks.value.length - activeIndex.value <= LOW_QUEUE_WATERMARK) {
    fetchFmTracks()
  }

  if (options.autoplay && activeTrack.value) {
    await playTrack(activeTrack.value)
  }
}

async function toggleLike() {
  if (!activeTrack.value) {
    return
  }

  if (!auth.userId.value) {
    message.warning('需要账号用户 ID 才能同步喜欢状态')
    return
  }

  likeLoading.value = true
  const id = String(activeTrack.value.id)
  const nextLiked = !likedIds.value.has(id)

  try {
    await updateSongLikeStateData({
      id,
      uid: auth.userId.value,
      like: nextLiked
    })
    const nextIds = new Set(likedIds.value)
    if (nextLiked) {
      nextIds.add(id)
    } else {
      nextIds.delete(id)
    }
    likedIds.value = nextIds
    message.success(nextLiked ? '已加入我喜欢的音乐' : '已取消喜欢')
  } catch (error) {
    console.warn('Failed to update like state:', error)
    message.error(error?.message || '喜欢状态同步失败')
  } finally {
    likeLoading.value = false
  }
}

async function trashCurrentTrack() {
  if (!activeTrack.value) {
    return
  }

  trashLoading.value = true

  try {
    const currentId = String(activeTrack.value.id)
    await movePersonalFmSongToTrash(currentId)
    tracks.value = tracks.value.filter((track) => String(track.id) !== currentId)
    if (activeIndex.value >= tracks.value.length) {
      activeIndex.value = Math.max(0, tracks.value.length - 1)
    }
    player.setQueue(tracks.value)
    message.success('已从私人 FM 移除')
    if (tracks.value.length) {
      await playTrack(activeTrack.value)
    } else {
      await fetchFmTracks({ reset: true, autoplay: true })
    }
  } catch (error) {
    console.warn('Failed to move FM song to trash:', error)
    message.error(error?.message || '移入垃圾桶失败')
  } finally {
    trashLoading.value = false
  }
}

function uniqueTracks(items = []) {
  const seenIds = new Set()

  return items.filter((item) => {
    const id = String(item?.id ?? '')

    if (!id || seenIds.has(id)) {
      return false
    }

    seenIds.add(id)
    return true
  })
}
</script>
