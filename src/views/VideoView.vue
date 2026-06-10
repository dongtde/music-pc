<template>
  <div
    ref="viewRoot"
    class="view mv-view"
    :class="{ 'mv-view--watch': isWatchMode }"
    @scroll.passive="handleBrowseScroll"
  >
    <template v-if="isWatchMode">
      <section ref="playerSection" class="mv-watch">
        <div ref="playerStage" class="mv-watch__stage" @mousemove="showControls" @mouseleave="hideControlsSoon">
          <video
            v-if="activeVideoUrl"
            :key="`${activeMv.id}-${activeMv.urlQuality || 'auto'}-${activeVideoUrl}`"
            ref="videoElement"
            class="mv-watch__video"
            :src="activeVideoUrl"
            :poster="activeMv.coverUrl"
            playsinline
            preload="metadata"
            @loadedmetadata="handleVideoMetadata"
            @timeupdate="handleVideoTimeUpdate"
            @play="handleVideoPlay"
            @pause="handleVideoPause"
            @ended="handleVideoEnded"
            @error="handleVideoError"
            @click="toggleActivePlayback"
          />

          <button
            v-if="activeVideoUrl && !isVideoPlaying"
            class="mv-watch__play"
            type="button"
            :disabled="loading"
            @click="playActiveMv({ skipScroll: true })"
          >
            <Play :size="44" fill="currentColor" />
          </button>

          <button
            v-if="activeMv && !activeVideoUrl"
            class="mv-watch__poster"
            type="button"
            :disabled="loading"
            @click="reloadActiveMv({ autoplay: true })"
          >
            <img v-if="activeMv.coverUrl" :src="activeMv.coverUrl" :alt="activeMv.title" />
            <span>
              <RefreshCw v-if="loading" :size="34" class="mv-spin" />
              <Play v-else :size="38" fill="currentColor" />
            </span>
            <small>{{ loading ? '正在获取播放地址' : '播放地址加载失败，点击重试' }}</small>
          </button>

          <div v-if="!activeMv" class="mv-watch__empty">
            <Video :size="48" />
            <span>{{ loading ? '正在加载 MV' : '暂无可播放 MV' }}</span>
          </div>

          <DanmakuLayer
            class="mv-watch__danmaku"
            :enabled="danmakuEnabled"
            :song="{ id: activeMv?.id, name: activeMv?.title }"
            :hot-comments="danmakuCommentState.hotComments"
            :comments="danmakuCommentState.comments"
            :has-more="danmakuCommentState.more"
            :loading="danmakuCommentState.loading"
            @need-more="loadMoreDanmakuComments"
          />

          <div class="mv-watch__top">
            <button class="mv-video-icon" type="button" aria-label="返回视频首页" title="返回视频首页" @click="backToBrowse">
              <ChevronLeft :size="20" />
            </button>
            <span>{{ playbackStatusText }}</span>
          </div>

          <div class="mv-watch__controls" :class="{ 'is-visible': controlsVisible || !isVideoPlaying }">
            <button class="mv-watch__progress" type="button" aria-label="视频进度" @click="seekFromProgress">
              <span :style="{ width: `${progressPercent}%` }" />
            </button>

            <div class="mv-watch__control-row">
              <div class="mv-watch__control-group">
                <button class="mv-video-icon" type="button" :aria-label="isVideoPlaying ? '暂停' : '播放'" @click="toggleActivePlayback">
                  <Pause v-if="isVideoPlaying" :size="18" fill="currentColor" />
                  <Play v-else :size="18" fill="currentColor" />
                </button>
                <button class="mv-video-icon" type="button" aria-label="上一个 MV" title="上一个 MV" @click="playRelativeMv(-1)">
                  <SkipBack :size="17" fill="currentColor" />
                </button>
                <button class="mv-video-icon" type="button" aria-label="下一个 MV" title="下一个 MV" @click="playRelativeMv(1)">
                  <SkipForward :size="17" fill="currentColor" />
                </button>
                <span class="mv-watch__time">{{ formatVideoClock(videoState.currentTime) }}/{{ activeMv?.duration || videoState.durationText }}</span>
              </div>

              <div class="mv-watch__control-group mv-watch__control-group--right">
                <button class="mv-video-icon" type="button" :aria-label="videoState.muted ? '取消静音' : '静音'" @click="toggleMute">
                  <VolumeX v-if="videoState.muted || videoState.volume === 0" :size="17" />
                  <Volume2 v-else :size="17" />
                </button>
                <input
                  class="mv-volume"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  :value="videoState.volume"
                  aria-label="视频音量"
                  @input="setVolume"
                />
                <button
                  class="mv-video-pill"
                  type="button"
                  :class="{ active: danmakuEnabled }"
                  :aria-label="danmakuEnabled ? '关闭弹幕' : '开启弹幕'"
                  @click="toggleDanmaku"
                >
                  弹幕
                </button>
                <div class="mv-quality">
                  <button class="mv-video-pill" type="button" aria-label="切换清晰度" @click="qualityMenuVisible = !qualityMenuVisible">
                    {{ activeMv?.urlQuality ? `${activeMv.urlQuality}P` : '超清' }}
                  </button>
                  <div v-if="qualityMenuVisible" class="mv-quality__menu">
                    <button
                      v-for="quality in qualityOptions"
                      :key="quality"
                      type="button"
                      :class="{ active: Number(activeMv?.urlQuality) === Number(quality) }"
                      @click="selectQuality(quality)"
                    >
                      {{ quality }}P
                    </button>
                  </div>
                </div>
                <button class="mv-video-icon" type="button" aria-label="画中画" title="画中画" @click="togglePictureInPicture">
                  <PictureInPicture2 :size="17" />
                </button>
                <button class="mv-video-icon" type="button" aria-label="全屏" title="全屏" @click="toggleFullscreen">
                  <Maximize :size="17" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="mv-watch__info">
          <div class="mv-watch__title">
            <h1>{{ activeMv?.title || 'MV 播放' }}</h1>
            <p>
              演唱：{{ activeMv?.artist || '未知艺人' }}
              <span>{{ activeMv?.playCount || 0 }} 次观看</span>
              <span v-if="activeMv?.publishTime">发布时间：{{ activeMv.publishTime }}</span>
            </p>
          </div>

          <p v-if="activeMv?.description" class="mv-watch__desc">{{ activeMv.description }}</p>

          <div class="mv-watch__actions">
            <button class="mv-detail-action" type="button" :disabled="!activeMv || subscribeLoading" @click="toggleSubscribe">
              <Bookmark :size="18" :fill="activeMv?.subed ? 'currentColor' : 'none'" />
              <span>{{ activeMv?.subed ? '已收藏' : '收藏' }}</span>
            </button>
            <button class="mv-detail-action" type="button" :disabled="!activeVideoUrl" @click="downloadActiveMv">
              <Download :size="18" />
              <span>下载</span>
            </button>
            <button class="mv-detail-action" type="button" :disabled="!activeMv" @click="shareActiveMv">
              <Share2 :size="18" />
              <span>分享</span>
            </button>
            <button class="mv-detail-action" type="button" :disabled="!activeMv" @click="openComments">
              <MessageCircle :size="18" />
              <span>评论</span>
            </button>
            <button class="mv-detail-action" type="button" :disabled="!activeMv || likeLoading" @click="toggleLike">
              <Heart :size="18" :fill="activeMv?.stats?.liked ? 'currentColor' : 'none'" />
              <span>{{ formatCount(activeMv?.stats?.likedCount) }}</span>
            </button>
            <RouterLink v-if="activeMv?.artistId" class="mv-detail-action" :to="`/artist/${activeMv.artistId}`">
              <User :size="18" />
              <span>歌手</span>
            </RouterLink>
          </div>
        </div>
      </section>

      <section v-if="watchRelatedSections.length" class="mv-browse-section">
        <header class="mv-section-head">
          <h2>继续观看</h2>
          <button type="button" @click="backToBrowse">更多</button>
        </header>
        <div class="mv-card-row">
          <button
            v-for="mv in watchRelatedMvs"
            :key="`watch-${mv.id}`"
            class="mv-video-card"
            type="button"
            @click="selectMv(mv, { autoplay: true })"
          >
            <span class="mv-video-card__cover">
              <img v-if="mv.coverUrl" :src="mv.coverUrl" :alt="mv.title" loading="lazy" decoding="async" />
              <em>{{ mv.duration || '--:--' }}</em>
              <span class="mv-video-card__play"><Play :size="17" fill="currentColor" /></span>
            </span>
            <strong>{{ mv.title }}</strong>
            <small>{{ mv.artist }}</small>
          </button>
        </div>
      </section>
    </template>

    <template v-else>
      <header class="mv-page-head">
        <nav class="mv-tabs" aria-label="视频分类">
          <button
            v-for="tab in browseTabs"
            :key="tab.value"
            type="button"
            :class="{ active: activeBrowseTab === tab.value }"
            @click="activeBrowseTab = tab.value"
          >
            {{ tab.label }}
          </button>
        </nav>
      </header>

      <section
        v-if="browseSkeletonVisible"
        class="mv-skeleton"
        aria-busy="true"
        aria-label="正在加载视频内容"
      >
        <div class="mv-skeleton__hero-row">
          <article v-for="item in 3" :key="`mv-hero-skeleton-${item}`" class="mv-skeleton__hero-card">
            <span class="mv-skeleton__pill" />
            <span class="mv-skeleton__line mv-skeleton__line--hero-title" />
            <span class="mv-skeleton__line mv-skeleton__line--hero-meta" />
          </article>
        </div>

        <section v-for="section in 3" :key="`mv-section-skeleton-${section}`" class="mv-skeleton__section">
          <span class="mv-skeleton__title" />
          <div class="mv-card-row">
            <article v-for="item in 5" :key="`mv-card-skeleton-${section}-${item}`" class="mv-skeleton__card">
              <span class="mv-skeleton__cover" />
              <span class="mv-skeleton__line" />
              <span class="mv-skeleton__line mv-skeleton__line--short" />
            </article>
          </div>
        </section>
      </section>

      <template v-else>
        <section v-if="activeBrowseTab === 'recommend'" class="mv-hero-carousel">
          <button
            v-for="mv in heroMvs"
            :key="`hero-${mv.id}`"
            class="mv-hero-card"
            type="button"
            @click="selectMv(mv, { autoplay: true })"
          >
            <img v-if="mv.coverUrl" :src="mv.coverUrl" :alt="mv.title" loading="lazy" decoding="async" />
            <span class="mv-hero-card__shade" />
            <span class="mv-hero-card__label">视频</span>
            <span class="mv-hero-card__caption">
              <strong>{{ mv.title }}</strong>
              <small>{{ mv.artist }}</small>
            </span>
          </button>
        </section>

        <section v-if="errorMessage" class="mv-state mv-state--error">{{ errorMessage }}</section>

        <template v-if="activeBrowseTab === 'recommend'">
          <section v-for="section in browseSections" :key="section.id" class="mv-browse-section">
            <header class="mv-section-head">
              <h2>{{ section.title }}</h2>
              <button v-if="section.moreTarget" type="button" @click="openMore(section.moreTarget)">
                更多 <ChevronRight :size="15" />
              </button>
            </header>
            <div class="mv-card-row">
              <button
                v-for="mv in section.items"
                :key="`${section.id}-${mv.id}`"
                class="mv-video-card"
                type="button"
                @click="selectMv(mv, { autoplay: true })"
              >
                <span class="mv-video-card__cover">
                  <img v-if="mv.coverUrl" :src="mv.coverUrl" :alt="mv.title" loading="lazy" decoding="async" />
                  <span class="mv-video-card__count"><Video :size="12" />{{ mv.playCount }}</span>
                  <span class="mv-video-card__play"><Play :size="17" fill="currentColor" /></span>
                </span>
                <strong>{{ mv.title }}</strong>
                <small>{{ mv.artist }}</small>
              </button>
            </div>
          </section>
        </template>

        <section v-else class="mv-library">
        <div class="mv-filter-panel">
          <div class="mv-filter-group">
            <span>地区</span>
            <button v-for="item in areas" :key="item" type="button" :class="{ active: filters.area === item }" @click="setFilter('area', item)">
              {{ item }}
            </button>
          </div>
          <div class="mv-filter-group">
            <span>类型</span>
            <button v-for="item in types" :key="item" type="button" :class="{ active: filters.type === item }" @click="setFilter('type', item)">
              {{ item }}
            </button>
          </div>
          <div class="mv-filter-group">
            <span>排序</span>
            <button v-for="item in orders" :key="item" type="button" :class="{ active: filters.order === item }" @click="setFilter('order', item)">
              {{ item }}
            </button>
          </div>
        </div>

        <div v-if="filteredLoading && !filteredMvs.length" class="mv-grid mv-grid--skeleton">
          <span v-for="item in 12" :key="item" class="mv-card-skeleton" />
        </div>
        <div v-else-if="filteredMvs.length" class="mv-grid">
          <button
            v-for="mv in filteredMvs"
            :key="`all-${mv.id}`"
            class="mv-video-card"
            type="button"
            @click="selectMv(mv, { autoplay: true })"
          >
            <span class="mv-video-card__cover">
              <img v-if="mv.coverUrl" :src="mv.coverUrl" :alt="mv.title" loading="lazy" decoding="async" />
              <span class="mv-video-card__count"><Video :size="12" />{{ mv.playCount }}</span>
              <span class="mv-video-card__play"><Play :size="17" fill="currentColor" /></span>
            </span>
            <strong>{{ mv.title }}</strong>
            <small>{{ mv.artist }}</small>
          </button>
        </div>
        <div v-else class="mv-state">暂无 MV 数据，换个筛选条件试试。</div>

        <div v-if="filteredLoading && filteredMvs.length" class="mv-library__loading" role="status" aria-live="polite">
          <LoaderCircle :size="17" class="mv-spin" />
          <span>加载中</span>
        </div>
        <div v-else-if="filteredMore" class="mv-library__sentinel" aria-hidden="true" />
        </section>
      </template>
    </template>

    <CommentModal
      v-model:show="commentState.visible"
      :title="activeMv?.title || 'MV 评论'"
      :subtitle="activeMv?.artist || ''"
      :total="commentState.total"
      :hot-comments="commentState.hotComments"
      :comments="commentState.comments"
      :loading="commentState.loading"
      :error="commentState.error"
      :has-more="commentState.more"
      @load-more="loadMoreComments"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Download,
  Heart,
  LoaderCircle,
  Maximize,
  MessageCircle,
  Pause,
  PictureInPicture2,
  Play,
  RefreshCw,
  Share2,
  SkipBack,
  SkipForward,
  User,
  Video,
  Volume2,
  VolumeX
} from 'lucide-vue-next'
import CommentModal from '../components/CommentModal.vue'
import DanmakuLayer from '../components/DanmakuLayer.vue'
import {
  getFilteredMvsData,
  getMvCommentsData,
  getMvPlaybackData,
  getVideoCenterData,
  toggleMvLikeData,
  toggleMvSubscribeData
} from '../services/netease'
import { useAuthStore } from '../stores/auth'
import { usePlayerStore } from '../stores/player'
import { parseDuration } from '../utils/time'
import '../styles/mv.css'

const PAGE_SIZE = 24
const areas = ['全部', '内地', '港台', '欧美', '日本', '韩国']
const types = ['全部', '官方版', '原生', '现场版', '网易出品']
const orders = ['上升最快', '最热', '最新']
const browseTabs = [
  { label: '推荐', value: 'recommend' },
  { label: '视频库', value: 'library' }
]

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const player = usePlayerStore()
const message = useMessage()
const viewRoot = ref(null)
const playerSection = ref(null)
const playerStage = ref(null)
const videoElement = ref(null)
const activeBrowseTab = ref('recommend')
const loading = ref(false)
const filteredLoading = ref(false)
const likeLoading = ref(false)
const subscribeLoading = ref(false)
const errorMessage = ref('')
const shouldPlayAfterLoad = ref(false)
const controlsVisible = ref(true)
const qualityMenuVisible = ref(false)
const danmakuEnabled = ref(true)
const activePayload = ref(null)
const recommendedMvs = ref([])
const firstMvs = ref([])
const exclusiveMvs = ref([])
const topMvs = ref([])
const filteredMvs = ref([])
const subscribedMvs = ref([])
const followArtistNewMvs = ref([])
const similarMvs = ref([])
const artistMvs = ref([])
const filteredTotal = ref(0)
const filteredMore = ref(false)
const filteredOffset = ref(0)
const filters = reactive({
  area: '全部',
  type: '全部',
  order: '上升最快'
})
const videoState = reactive({
  isPlaying: false,
  isReady: false,
  currentTime: 0,
  duration: 0,
  durationText: '--:--',
  error: '',
  volume: 1,
  muted: false
})
const commentState = reactive({
  visible: false,
  loading: false,
  error: '',
  hotComments: [],
  comments: [],
  total: 0,
  more: false,
  offset: 0
})
const danmakuCommentState = reactive({
  trackId: '',
  loading: false,
  error: '',
  hotComments: [],
  comments: [],
  total: 0,
  more: false,
  offset: 0
})

let controlsTimer = null
let danmakuCommentRequestId = 0
const danmakuCommentLimit = 80

const activeMv = computed(() => activePayload.value?.mv ?? null)
const activeVideoUrl = computed(() => normalizePlayableUrl(activeMv.value?.url))
const isWatchMode = computed(() => Boolean(route.query.mvId))
const isVideoPlaying = computed(() => videoState.isPlaying)
const progressPercent = computed(() => {
  const duration = videoState.duration || parseDuration(activeMv.value?.duration)
  return duration ? Math.min(100, (videoState.currentTime / duration) * 100) : 0
})
const heroMvs = computed(() =>
  uniqueMvs([...recommendedMvs.value, ...topMvs.value, ...firstMvs.value, ...exclusiveMvs.value]).slice(0, 3)
)
const browseSections = computed(() => [
  { id: 'rank', title: '排行榜', items: topMvs.value },
  { id: 'latest', title: '最新', items: firstMvs.value.slice(0, 5), moreTarget: 'library' },
  { id: 'collection', title: '合集', items: exclusiveMvs.value.slice(0, 5), moreTarget: 'library' },
  { id: 'recommend', title: '推荐', items: recommendedMvs.value.slice(0, 5), moreTarget: 'library' }
].filter((section) => section.items.length))
const browseSkeletonVisible = computed(() =>
  !isWatchMode.value &&
  loading.value &&
  !heroMvs.value.length &&
  !browseSections.value.length &&
  !filteredMvs.value.length
)
const watchRelatedSections = computed(() => [
  ...similarMvs.value,
  ...artistMvs.value,
  ...topMvs.value,
  ...firstMvs.value
])
const watchRelatedMvs = computed(() =>
  uniqueMvs(watchRelatedSections.value).filter((mv) => String(mv.id) !== String(activeMv.value?.id)).slice(0, 5)
)
const playbackQueue = computed(() =>
  uniqueMvs([
    ...filteredMvs.value,
    ...topMvs.value,
    ...firstMvs.value,
    ...recommendedMvs.value,
    ...exclusiveMvs.value,
    ...similarMvs.value,
    ...artistMvs.value
  ])
)
const qualityOptions = computed(() => {
  const values = extractQualityValues(activeMv.value?.brs)
  const currentQuality = Number(activeMv.value?.urlQuality)

  if (Number.isFinite(currentQuality) && currentQuality > 0) {
    values.push(currentQuality)
  }

  return [...new Set(values.filter(Boolean))].sort((current, next) => next - current)
})
const playbackStatusText = computed(() => {
  if (loading.value) {
    return '加载播放信息'
  }
  if (videoState.error) {
    return videoState.error
  }
  if (videoState.isPlaying) {
    return '正在播放'
  }
  if (activeVideoUrl.value) {
    return videoState.isReady ? '已就绪' : '准备播放'
  }
  return activeMv.value ? '等待播放地址' : '等待 MV'
})

onMounted(() => {
  loadBootData()
})

onBeforeUnmount(() => {
  pauseActiveVideo()
  clearControlsTimer()
})

watch(
  () => route.query.mvId,
  (id) => {
    if (id && String(id) !== String(activeMv.value?.id ?? '')) {
      selectMv({ id }, { replace: true, autoplay: true })
      return
    }

    if (!id) {
      pauseActiveVideo()
      resetVideoState()
    }
  }
)

watch(activeBrowseTab, async (tab) => {
  if (tab !== 'library') {
    return
  }

  await nextTick()
  maybeLoadMoreFiltered()
})

async function loadBootData() {
  loading.value = true
  errorMessage.value = ''

  try {
    const data = await getVideoCenterData({
      area: filters.area,
      type: filters.type,
      order: filters.order,
      limit: PAGE_SIZE,
      offset: 0
    })

    recommendedMvs.value = data.recommended
    firstMvs.value = data.first
    exclusiveMvs.value = data.exclusive
    topMvs.value = data.top
    filteredMvs.value = data.all
    subscribedMvs.value = data.subscribed
    followArtistNewMvs.value = data.followArtistNew
    filteredTotal.value = data.total
    filteredMore.value = data.more
    filteredOffset.value = data.all.length

    const routeMvId = route.query.mvId
    if (routeMvId) {
      await selectMv({ id: routeMvId }, { replace: true, silent: true, autoplay: true })
    } else if (data.active?.mv) {
      setActivePayload(data.active)
    }
  } catch (error) {
    console.warn('Failed to load MV center:', error)
    errorMessage.value = error?.message || 'MV 内容加载失败'
    message.error(errorMessage.value)
  } finally {
    loading.value = false
  }
}

async function setFilter(key, value) {
  if (filters[key] === value) {
    return
  }

  filters[key] = value
  await reloadFiltered()
}

function openMore(tab) {
  activeBrowseTab.value = tab
}

async function reloadFiltered() {
  filteredOffset.value = 0
  filteredMvs.value = []
  await loadFiltered({ reset: true })
}

async function loadFiltered({ reset = false } = {}) {
  if (filteredLoading.value) {
    return
  }

  filteredLoading.value = true

  try {
    const data = await getFilteredMvsData({
      area: filters.area,
      type: filters.type,
      order: filters.order,
      limit: PAGE_SIZE,
      offset: reset ? 0 : filteredOffset.value
    })
    const requestOffset = reset ? 0 : filteredOffset.value
    filteredMvs.value = reset ? data.items : uniqueMvs([...filteredMvs.value, ...data.items])
    filteredTotal.value = data.total
    filteredMore.value = Boolean(data.more && data.items.length)
    filteredOffset.value = requestOffset + data.items.length
  } catch (error) {
    console.warn('Failed to load filtered MVs:', error)
    message.error(error?.message || '筛选 MV 加载失败')
  } finally {
    filteredLoading.value = false
  }

  if (activeBrowseTab.value === 'library') {
    await nextTick()
    maybeLoadMoreFiltered()
  }
}

function handleBrowseScroll(event) {
  if (activeBrowseTab.value !== 'library' || isWatchMode.value) {
    return
  }

  maybeLoadMoreFiltered(event.currentTarget)
}

function maybeLoadMoreFiltered(container = viewRoot.value) {
  if (!container || filteredLoading.value || !filteredMore.value) {
    return
  }

  const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight
  if (distanceToBottom <= 280) {
    loadFiltered()
  }
}

async function selectMv(mv, options = {}) {
  const id = mv?.id
  if (!id) {
    return
  }

  loading.value = true
  errorMessage.value = ''
  resetVideoState()
  pauseActiveVideo()
  shouldPlayAfterLoad.value = Boolean(options.autoplay)

  try {
    const data = await getMvPlaybackData(id, options.quality)
    setActivePayload(data)
    if (!options.replace) {
      router.replace({ name: 'video', query: { mvId: id } })
    }
    if (!options.silent) {
      scrollToPlayer()
    }
    await nextTick()
    applyVideoVolume()
    if (options.autoplay) {
      await playActiveMv({ skipScroll: true })
    }
  } catch (error) {
    console.warn('Failed to load MV playback:', error)
    errorMessage.value = error?.message || 'MV 播放信息加载失败'
    message.error(errorMessage.value)
  } finally {
    loading.value = false
  }
}

function setActivePayload(data) {
  activePayload.value = data
  similarMvs.value = data.similar ?? []
  artistMvs.value = data.artistMvs ?? []
  commentState.hotComments = data.comments?.hotComments ?? []
  commentState.comments = data.comments?.comments ?? []
  commentState.total = data.comments?.total ?? 0
  commentState.more = data.comments?.more ?? false
  commentState.offset = commentState.comments.length
  commentState.error = ''
  resetDanmakuCommentStream(data.mv?.id, data.comments)
}

async function toggleActivePlayback() {
  if (videoState.isPlaying) {
    pauseActiveVideo()
    return
  }

  await playActiveMv()
}

async function playActiveMv({ skipScroll = false } = {}) {
  if (!activeMv.value?.id) {
    return false
  }

  if (!skipScroll) {
    scrollToPlayer()
  }

  videoState.error = ''
  shouldPlayAfterLoad.value = true

  if (!activeVideoUrl.value) {
    await reloadActiveMv({ autoplay: true })
    return false
  }

  await nextTick()
  const video = videoElement.value
  if (!video) {
    return false
  }

  try {
    if (player.state.isPlaying) {
      await player.togglePlay()
    }
    applyVideoVolume()
    await video.play()
    shouldPlayAfterLoad.value = false
    showControls()
    return true
  } catch (error) {
    console.warn('Failed to play MV:', error)
    videoState.error = '浏览器阻止自动播放，请点击播放'
    return false
  }
}

async function reloadActiveMv(options = {}) {
  if (activeMv.value?.id) {
    await selectMv(activeMv.value, { replace: true, ...options })
  }
}

async function selectQuality(quality) {
  qualityMenuVisible.value = false
  if (!activeMv.value?.id || Number(activeMv.value.urlQuality) === Number(quality)) {
    return
  }

  const wasPlaying = videoState.isPlaying
  const resumeAt = videoState.currentTime
  await selectMv(activeMv.value, { replace: true, silent: true, autoplay: false, quality })
  await nextTick()

  if (videoElement.value && resumeAt > 0) {
    videoElement.value.currentTime = resumeAt
  }

  if (wasPlaying) {
    await playActiveMv({ skipScroll: true })
  }
}

function pauseActiveVideo() {
  const video = videoElement.value
  if (video && !video.paused) {
    video.pause()
  }
  videoState.isPlaying = false
}

function playRelativeMv(offset) {
  const queue = playbackQueue.value
  if (!queue.length) {
    return
  }

  const currentIndex = Math.max(0, queue.findIndex((mv) => String(mv.id) === String(activeMv.value?.id)))
  const nextIndex = (currentIndex + offset + queue.length) % queue.length
  selectMv(queue[nextIndex], { autoplay: true })
}

function handleVideoMetadata(event) {
  const video = event.target
  const duration = Number.isFinite(video.duration) ? video.duration : parseDuration(activeMv.value?.duration)
  videoState.isReady = true
  videoState.duration = duration
  videoState.durationText = formatVideoClock(duration)
  applyVideoVolume()

  if (shouldPlayAfterLoad.value) {
    playActiveMv({ skipScroll: true })
  }
}

function handleVideoTimeUpdate(event) {
  videoState.currentTime = Number.isFinite(event.target.currentTime) ? event.target.currentTime : 0
}

function handleVideoPlay() {
  videoState.isPlaying = true
  videoState.error = ''
  if (player.state.isPlaying) {
    player.togglePlay()
  }
  hideControlsSoon()
}

function handleVideoPause() {
  videoState.isPlaying = false
  showControls()
}

function handleVideoEnded() {
  videoState.isPlaying = false
  playRelativeMv(1)
}

function handleVideoError() {
  videoState.isPlaying = false
  videoState.error = '视频播放失败'
  showControls()
}

function seekFromProgress(event) {
  const video = videoElement.value
  const duration = videoState.duration || video?.duration || 0
  if (!video || !duration) {
    return
  }

  const rect = event.currentTarget.getBoundingClientRect()
  const percent = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  const nextTime = duration * percent
  video.currentTime = nextTime
  videoState.currentTime = nextTime
}

function setVolume(event) {
  videoState.volume = Number(event.target.value)
  videoState.muted = videoState.volume === 0
  applyVideoVolume()
}

function toggleMute() {
  videoState.muted = !videoState.muted
  applyVideoVolume()
}

function applyVideoVolume() {
  const video = videoElement.value
  if (!video) {
    return
  }

  video.volume = Math.min(1, Math.max(0, videoState.volume))
  video.muted = videoState.muted
}

function toggleDanmaku() {
  danmakuEnabled.value = !danmakuEnabled.value

  if (danmakuEnabled.value) {
    loadMoreDanmakuComments()
  }
}

async function togglePictureInPicture() {
  const video = videoElement.value
  if (!video || !document.pictureInPictureEnabled) {
    message.warning('当前浏览器不支持画中画')
    return
  }

  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture()
    } else {
      await video.requestPictureInPicture()
    }
  } catch (error) {
    console.warn('Failed to toggle picture in picture:', error)
    message.error('画中画打开失败')
  }
}

async function toggleFullscreen() {
  const target = playerStage.value
  if (!target) {
    return
  }

  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await target.requestFullscreen()
    }
  } catch (error) {
    console.warn('Failed to toggle fullscreen:', error)
    message.error('全屏打开失败')
  }
}

function showControls() {
  controlsVisible.value = true
  hideControlsSoon()
}

function hideControlsSoon() {
  clearControlsTimer()
  if (!videoState.isPlaying) {
    return
  }
  controlsTimer = window.setTimeout(() => {
    controlsVisible.value = false
  }, 2200)
}

function clearControlsTimer() {
  if (controlsTimer) {
    window.clearTimeout(controlsTimer)
    controlsTimer = null
  }
}

function backToBrowse() {
  pauseActiveVideo()
  router.replace({ name: 'video' })
}

async function toggleLike() {
  if (!activeMv.value) {
    return
  }

  if (!auth.state.isLoggedIn) {
    auth.openLoginModal()
    return
  }

  likeLoading.value = true
  const nextLiked = !activeMv.value.stats?.liked

  try {
    await toggleMvLikeData({ id: activeMv.value.id, like: nextLiked })
    activePayload.value = {
      ...activePayload.value,
      mv: {
        ...activeMv.value,
        stats: {
          ...(activeMv.value.stats ?? {}),
          liked: nextLiked,
          likedCount: Math.max(0, (activeMv.value.stats?.likedCount ?? 0) + (nextLiked ? 1 : -1))
        }
      }
    }
    message.success(nextLiked ? '已点赞 MV' : '已取消点赞')
  } catch (error) {
    console.warn('Failed to toggle MV like:', error)
    message.error(error?.message || '点赞状态同步失败')
  } finally {
    likeLoading.value = false
  }
}

async function toggleSubscribe() {
  if (!activeMv.value) {
    return
  }

  if (!auth.state.isLoggedIn) {
    auth.openLoginModal()
    return
  }

  subscribeLoading.value = true
  const nextSubed = !activeMv.value.subed

  try {
    await toggleMvSubscribeData({ id: activeMv.value.id, subscribe: nextSubed })
    activePayload.value = {
      ...activePayload.value,
      mv: {
        ...activeMv.value,
        subed: nextSubed
      }
    }
    message.success(nextSubed ? '已收藏 MV' : '已取消收藏')
  } catch (error) {
    console.warn('Failed to toggle MV subscription:', error)
    message.error(error?.message || '收藏状态同步失败')
  } finally {
    subscribeLoading.value = false
  }
}

function downloadActiveMv() {
  if (!activeVideoUrl.value) {
    return
  }

  const link = document.createElement('a')
  link.href = activeVideoUrl.value
  link.download = `${activeMv.value.title || 'mv'}.mp4`
  link.target = '_blank'
  link.rel = 'noopener'
  link.click()
}

async function shareActiveMv() {
  if (!activeMv.value) {
    return
  }

  try {
    await navigator.clipboard.writeText(window.location.href)
    message.success('MV 链接已复制')
  } catch {
    message.warning('复制失败，可以从地址栏手动复制')
  }
}

function openComments() {
  commentState.visible = true
}

async function loadMoreComments() {
  if (!activeMv.value || commentState.loading || !commentState.more) {
    return
  }

  commentState.loading = true
  commentState.error = ''

  try {
    const data = await getMvCommentsData({
      id: activeMv.value.id,
      limit: 20,
      offset: commentState.offset
    })
    commentState.comments = [...commentState.comments, ...data.comments]
    commentState.total = data.total
    commentState.more = data.more
    commentState.offset = commentState.comments.length
  } catch (error) {
    console.warn('Failed to load MV comments:', error)
    commentState.error = error?.message || '评论加载失败'
  } finally {
    commentState.loading = false
  }
}

function resetDanmakuCommentStream(trackId = activeMv.value?.id, data = null) {
  const id = String(trackId ?? '')

  danmakuCommentRequestId += 1
  danmakuCommentState.trackId = id
  danmakuCommentState.loading = false
  danmakuCommentState.error = ''
  danmakuCommentState.hotComments = data?.hotComments ?? []
  danmakuCommentState.comments = data?.comments ?? []
  danmakuCommentState.total = data?.total ?? 0
  danmakuCommentState.offset = data?.comments?.length ?? 0
  danmakuCommentState.more = Boolean(id && (data?.more ?? true))
}

async function loadMoreDanmakuComments() {
  const id = String(activeMv.value?.id ?? danmakuCommentState.trackId ?? '')

  if (
    !id ||
    !danmakuEnabled.value ||
    danmakuCommentState.loading ||
    !danmakuCommentState.more ||
    String(danmakuCommentState.trackId) !== id
  ) {
    return
  }

  const requestId = ++danmakuCommentRequestId
  danmakuCommentState.loading = true
  danmakuCommentState.error = ''

  try {
    const data = await getMvCommentsData({
      id,
      limit: danmakuCommentLimit,
      offset: danmakuCommentState.offset
    })

    if (requestId !== danmakuCommentRequestId || id !== String(activeMv.value?.id ?? '')) {
      return
    }

    danmakuCommentState.hotComments = danmakuCommentState.offset === 0 ? data.hotComments : []
    danmakuCommentState.comments = data.comments
    danmakuCommentState.total = data.total
    danmakuCommentState.offset += data.comments.length
    danmakuCommentState.more = Boolean(data.more && data.comments.length)
  } catch (error) {
    if (requestId === danmakuCommentRequestId) {
      console.warn('Failed to load MV danmaku comments:', error)
      danmakuCommentState.error = error?.message || '弹幕评论加载失败'
      danmakuCommentState.more = false
    }
  } finally {
    if (requestId === danmakuCommentRequestId) {
      danmakuCommentState.loading = false
    }
  }
}

function resetVideoState() {
  videoState.isPlaying = false
  videoState.isReady = false
  videoState.currentTime = 0
  videoState.duration = 0
  videoState.durationText = '--:--'
  videoState.error = ''
  controlsVisible.value = true
}

function scrollToPlayer() {
  nextTick(() => {
    playerSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function extractQualityValues(brs) {
  if (!brs) {
    return []
  }

  if (Array.isArray(brs)) {
    return brs
      .map((item) => Number(item?.br ?? item?.r ?? item?.quality ?? item))
      .filter((item) => Number.isFinite(item) && item > 0)
  }

  return Object.keys(brs)
    .map(Number)
    .filter((item) => Number.isFinite(item) && item > 0)
}

function normalizePlayableUrl(url) {
  if (typeof url !== 'string') {
    return ''
  }

  const value = url.trim()

  if (!value) {
    return ''
  }

  return value.startsWith('//') ? `https:${value}` : value
}

function uniqueMvs(items = []) {
  const seen = new Set()
  return items.filter((item) => {
    const id = String(item?.id ?? '')
    if (!id || seen.has(id)) {
      return false
    }
    seen.add(id)
    return true
  })
}

function formatCount(value = 0) {
  const count = Number(value) || 0
  if (count >= 100000000) {
    return `${Number((count / 100000000).toFixed(1))}亿`
  }
  if (count >= 10000) {
    return `${Number((count / 10000).toFixed(1))}万`
  }
  return String(count)
}

function formatVideoClock(value = 0) {
  const totalSeconds = Math.max(0, Math.floor(Number(value) || 0))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')

  return `${minutes}:${seconds}`
}
</script>
