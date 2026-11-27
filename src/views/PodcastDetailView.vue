<template>
  <div
    ref="pageRoot"
    class="view playlist-detail podcast-detail-view"
    @scroll.passive="handlePageScroll"
  >
    <section
      v-if="loading || podcast"
      class="playlist-hero"
      :class="{ 'detail-hero--loading': loading }"
      :aria-busy="loading"
      :aria-hidden="loading || undefined"
      :inert="loading"
    >
      <div class="playlist-cover" :class="`playlist-cover--${podcast?.type || podcastPreview?.coverType || 'stage'}`">
        <img
          v-if="podcast?.coverUrl || podcastPreview?.coverUrl"
          class="playlist-cover__image"
          :src="podcast?.coverUrl || podcastPreview?.coverUrl"
          :alt="podcast?.title || podcastPreview?.title || '电台详情'"
          loading="eager"
          decoding="async"
          fetchpriority="high"
        />
      </div>

      <div class="playlist-hero__content">
        <h1 ref="heroTitle" class="playlist-title">
          <OverflowMarquee :text="podcast?.title || podcastPreview?.title || '电台详情'" :enabled="isMobile2D" :active="!loading && !mobileHeaderVisible" />
        </h1>
        <div class="playlist-description">
          <DetailDescription
            :text="podcast?.description || (loading && !podcast ? '\u00a0' : '')"
            title="电台简介"
            :subtitle="podcast?.title || podcastPreview?.title || '电台详情'"
          />
        </div>

        <div class="playlist-meta">
          <span class="playlist-avatar">
            <img
              v-if="podcast?.creatorAvatarUrl"
              :src="podcast.creatorAvatarUrl"
              :alt="podcast.creator"
              loading="lazy"
              decoding="async"
            />
            <RadioTower v-else :size="14" />
          </span>
          <strong class="playlist-meta__creator">{{ podcast?.creator || '音乐电台' }}</strong>
          <span v-if="podcast?.lastUpdated" class="playlist-meta__updated">更新于 {{ podcast.lastUpdated }}</span>
          <span class="playlist-meta__count">{{ podcast?.programCountLabel || `${total} 首歌曲` }}</span>
          <span class="playlist-meta__listeners">{{ podcast?.playCountLabel || '连续播放' }}</span>
          <span class="playlist-meta__tags">{{ podcast?.category ? `${podcast.category} / ` : '' }}FM {{ podcast?.id || route.params.id }}</span>
        </div>

        <div class="playlist-actions">
          <button
            class="playlist-action playlist-action--primary"
            type="button"
            :disabled="loading || !programs.length"
            @click="playAll"
          >
            <Play :size="18" fill="currentColor" />
            <span>播放</span>
          </button>
        </div>
      </div>
    </section>

    <section
      v-if="loading && !podcast"
      class="playlist-detail-skeleton"
      aria-busy="true"
      aria-label="正在加载电台详情"
    >
      <section class="playlist-detail-skeleton__table" aria-hidden="true">
        <header class="playlist-table__head">
          <span>标题</span>
          <span>电台</span>
          <span>时长</span>
        </header>
        <div class="playlist-detail-skeleton__rows">
          <article
            v-for="item in 10"
            :key="`podcast-program-skeleton-${item}`"
            class="playlist-detail-skeleton__row"
          >
            <span class="playlist-detail-skeleton__song-main">
              <span class="playlist-detail-skeleton__thumb" />
              <span class="playlist-detail-skeleton__song-lines">
                <span class="playlist-detail-skeleton__line playlist-detail-skeleton__line--song" />
                <span class="playlist-detail-skeleton__line playlist-detail-skeleton__line--artist" />
              </span>
            </span>
            <span class="playlist-detail-skeleton__line playlist-detail-skeleton__line--album" />
            <span class="playlist-detail-skeleton__line playlist-detail-skeleton__line--duration" />
          </article>
        </div>
      </section>
    </section>

    <template v-else-if="podcast">

      <div v-if="errorMessage" class="playlist-state playlist-state--error">
        {{ errorMessage }}
      </div>

      <section class="playlist-table" aria-label="电台歌曲列表">
        <template v-if="programs.length">
          <header class="playlist-table__head">
            <span>标题</span>
            <span>电台</span>
            <span>时长</span>
          </header>
          <div
            ref="programVirtualList"
            class="playlist-virtual-list"
            :style="{ height: `${programVirtualTotalHeight}px` }"
          >
            <div
              class="playlist-virtual-window"
              :style="{ transform: `translateY(${programVirtualOffsetY}px)` }"
            >
              <SongListRow
                v-for="track in visiblePrograms"
                :key="track.programId || track.id"
                :track="track"
                :compact="isMobile2D"
                :queue-layout="isMobile2D"
                :show-play-icon="!isMobile2D"
                @play="playProgram(track)"
              />
            </div>
          </div>
        </template>
        <div v-else class="playlist-state">暂无歌曲。</div>

        <div v-if="more" ref="programLoadMoreTrigger" class="playlist-load-more" aria-live="polite">
          <span v-if="programLoading">正在加载更多歌曲...</span>
          <button v-else type="button" @click="loadMorePrograms">加载更多歌曲</button>
        </div>
      </section>
    </template>

    <section v-else-if="errorMessage" class="playlist-state playlist-state--error">
      {{ errorMessage }}
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMessage } from 'naive-ui'
import {
  Play,
  RadioTower,
} from 'lucide-vue-next'
import SongListRow from '../components/SongListRow.vue'
import OverflowMarquee from '../components/OverflowMarquee.vue'
import DetailDescription from '../components/DetailDescription.vue'
import { useLoadMoreTrigger } from '../composables/useLoadMoreTrigger'
import { useResponsiveLayout } from '../composables/useResponsiveLayout'
import { useVirtualRows } from '../composables/useVirtualRows'
import {
  getPodcastDetailData,
  getPodcastProgramsData
} from '../services/netease'
import { usePlayerStore } from '../stores/player'
import { getPlaybackErrorDisplay } from '../utils/playbackError'
import { isAbortError } from '../utils/request'
import { getPodcastPreview } from '../utils/podcastPreview'
import { getDetailHeaderProgress } from '../utils/detailHeaderProgress'
import '../styles/playlist.css'
import '../styles/mobile-playlist.css'

const PROGRAM_LIMIT = 40
const { isMobile2D, songRowHeight } = useResponsiveLayout()
const emit = defineEmits(['playlist-header-change'])

const route = useRoute()
const podcastPreview = computed(() => getPodcastPreview(route.params.id))
const player = usePlayerStore()
const message = useMessage()
const pageRoot = ref(null)
const heroTitle = ref(null)
const mobileHeaderProgress = ref(0)
const mobileHeaderVisible = computed(() => mobileHeaderProgress.value > 0)
let headerFrame = 0
let headerObserver = null
const programVirtualList = ref(null)
const programLoadMoreTrigger = ref(null)
const podcast = ref(null)
const programs = ref([])
const total = ref(0)
const offset = ref(0)
const more = ref(false)
const loading = ref(false)
const programLoading = ref(false)
const errorMessage = ref('')
let detailRequestId = 0
let detailController = null
let programRequestId = 0
let programController = null

const rankedPrograms = computed(() =>
  programs.value.map((track, index) => ({
    ...track,
    rank: String(index + 1).padStart(2, '0')
  }))
)
const {
  offsetY: programVirtualOffsetY,
  scheduleRangeUpdate: scheduleProgramRangeUpdate,
  totalHeight: programVirtualTotalHeight,
  updateRange: updateProgramVirtualRange,
  visibleItems: visiblePrograms
} = useVirtualRows(rankedPrograms, {
  root: pageRoot,
  list: programVirtualList,
  rowHeight: songRowHeight
})
const loadMoreController = useLoadMoreTrigger({
  trigger: programLoadMoreTrigger,
  canLoad: () =>
    Boolean(podcast.value) &&
    more.value &&
    !loading.value &&
    !programLoading.value,
  getRoot: () => pageRoot.value,
  loadMore: loadMorePrograms,
  rootMargin: '520px 0px',
  scrollThreshold: 720
})

function updateMobileHeader() {
  mobileHeaderProgress.value = !isMobile2D.value || loading.value
    ? 0
    : getDetailHeaderProgress(pageRoot.value, heroTitle.value)
}

function scheduleHeaderUpdate() {
  if (headerFrame) return
  headerFrame = window.requestAnimationFrame(() => {
    headerFrame = 0
    updateMobileHeader()
  })
}

function handlePageScroll() {
  scheduleProgramRangeUpdate()
  if (isMobile2D.value) scheduleHeaderUpdate()
}

watch([podcast, podcastPreview, mobileHeaderProgress], () => {
  emit('playlist-header-change', {
    path: route.path,
    coverUrl: podcast.value?.coverUrl || podcastPreview.value?.coverUrl || '',
    coverType: podcast.value?.type || podcastPreview.value?.coverType,
    title: podcast.value?.title || podcastPreview.value?.title || '电台详情',
    progress: mobileHeaderProgress.value,
    visible: mobileHeaderVisible.value,
    collapsed: mobileHeaderProgress.value === 1
  })
}, { immediate: true })

watch([loading, isMobile2D, heroTitle], async () => {
  await nextTick()
  headerObserver?.disconnect()
  if (isMobile2D.value) {
    [pageRoot.value, heroTitle.value].filter(Boolean).forEach((element) => headerObserver?.observe(element))
  }
  updateMobileHeader()
  updateProgramVirtualRange()
})

onMounted(() => {
  headerObserver = new ResizeObserver(scheduleHeaderUpdate)
  if (isMobile2D.value && pageRoot.value) headerObserver.observe(pageRoot.value)
  scheduleHeaderUpdate()
  loadDetail()
})

onUnmounted(() => {
  cancelDetailRequest()
  cancelProgramRequest()
  headerObserver?.disconnect()
  if (headerFrame) window.cancelAnimationFrame(headerFrame)
  loadMoreController.cleanup()
})

watch(
  () => route.params.id,
  () => {
    loadDetail()
  }
)

async function loadDetail() {
  const id = route.params.id

  if (!id) {
    return
  }

  cancelDetailRequest()
  cancelProgramRequest()
  loadMoreController.cleanup()
  const requestId = ++detailRequestId
  const controller = new AbortController()
  detailController = controller
  loading.value = true
  errorMessage.value = ''
  podcast.value = null
  programs.value = []
  offset.value = 0
  more.value = false
  total.value = 0
  mobileHeaderProgress.value = 0
  if (pageRoot.value) pageRoot.value.scrollTop = 0

  try {
    const data = await getPodcastDetailData({ id, limit: PROGRAM_LIMIT, offset: 0 }, {
      signal: controller.signal
    })

    if (requestId !== detailRequestId || controller.signal.aborted) {
      return
    }

    podcast.value = data.podcast
    programs.value = data.programs
    total.value = data.total
    offset.value = data.programs.length
    more.value = data.more
    nextTick(() => {
      updateProgramVirtualRange()
      loadMoreController.setup()
    })
  } catch (error) {
    if (isAbortError(error) || requestId !== detailRequestId) {
      return
    }

    console.warn('Failed to load radio detail:', error)
    errorMessage.value = error?.message || '电台详情加载失败'
    message.error(errorMessage.value)
  } finally {
    if (requestId === detailRequestId && !controller.signal.aborted) {
      loading.value = false
    }

    if (detailController === controller) {
      detailController = null
    }
  }
}

async function loadMorePrograms() {
  const id = route.params.id

  if (!id || programLoading.value || (!more.value && programs.value.length)) {
    return
  }

  cancelProgramRequest()
  const requestId = ++programRequestId
  const controller = new AbortController()
  programController = controller
  programLoading.value = true

  try {
    const data = await getPodcastProgramsData({
      id,
      limit: PROGRAM_LIMIT,
      offset: offset.value
    }, {
      signal: controller.signal
    })

    if (requestId !== programRequestId || controller.signal.aborted || String(route.params.id) !== String(id)) {
      return
    }

    const previousProgramCount = programs.value.length

    programs.value = dedupeTracks([...programs.value, ...data.programs])
    total.value = data.total
    offset.value = programs.value.length
    more.value = Boolean(data.more && data.programs.length && programs.value.length > previousProgramCount)
    nextTick(() => {
      updateProgramVirtualRange()
      loadMoreController.setup()
    })
  } catch (error) {
    if (isAbortError(error) || requestId !== programRequestId) {
      return
    }

    console.warn('Failed to load radio songs:', error)
    message.error(error?.message || '歌曲加载失败')
  } finally {
    if (requestId === programRequestId && !controller.signal.aborted) {
      programLoading.value = false
    }

    if (programController === controller) {
      programController = null
    }
  }
}

async function playAll() {
  if (!rankedPrograms.value.length) {
    return
  }

  const track = rankedPrograms.value[0]

  player.setQueue(rankedPrograms.value, { type: 'podcast-detail', id: route.params.id })
  const played = await player.playTrack(track)

  if (!played) {
    message.error(getPlaybackErrorDisplay(player.state.error, '当前歌曲暂无可播放链接'))
  }
}

async function playProgram(track) {
  const played = await player.playTrack(track)
  if (played) {
    player.appendToQueue(track, { type: 'podcast-detail', id: route.params.id })
  }

  if (!played) {
    message.error(getPlaybackErrorDisplay(player.state.error, '当前歌曲暂无可播放链接'))
  }
}

function dedupeTracks(items = []) {
  const seenIds = new Set()

  return items.filter((item) => {
    const id = String(item?.programId || item?.id || '')

    if (!id || seenIds.has(id)) {
      return false
    }

    seenIds.add(id)
    return true
  })
}

function cancelDetailRequest() {
  detailRequestId += 1

  if (!detailController) {
    return
  }

  detailController.abort()
  detailController = null
}

function cancelProgramRequest() {
  programRequestId += 1

  if (!programController) {
    return
  }

  programController.abort()
  programController = null
  programLoading.value = false
}
</script>
