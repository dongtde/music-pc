<template>
  <div ref="pageRoot" class="view podcast-detail-view" @scroll.passive="scheduleProgramRangeUpdate">
    <section
      v-if="loading && !podcast"
      class="podcast-detail-skeleton"
      aria-busy="true"
      aria-label="正在加载电台详情"
    >
      <section class="podcast-detail-skeleton__hero">
        <span class="podcast-detail-skeleton__cover" />
        <div class="podcast-detail-skeleton__content">
          <span class="podcast-detail-skeleton__line podcast-detail-skeleton__line--title" />
          <span class="podcast-detail-skeleton__line podcast-detail-skeleton__line--description" />
          <span class="podcast-detail-skeleton__line podcast-detail-skeleton__line--description-short" />
          <div class="podcast-detail-skeleton__meta">
            <span
              v-for="item in 5"
              :key="`podcast-detail-meta-${item}`"
              class="podcast-detail-skeleton__pill"
            />
          </div>
        </div>
      </section>

      <section class="podcast-detail-skeleton__table" aria-hidden="true">
        <header class="podcast-detail-table__head">
          <span>标题</span>
          <span>电台</span>
          <span>时长</span>
        </header>
        <div class="podcast-detail-skeleton__rows">
          <article
            v-for="item in 10"
            :key="`podcast-program-skeleton-${item}`"
            class="podcast-detail-skeleton__row"
          >
            <span class="podcast-detail-skeleton__song-main">
              <span class="podcast-detail-skeleton__thumb" />
              <span class="podcast-detail-skeleton__song-lines">
                <span class="podcast-detail-skeleton__line podcast-detail-skeleton__line--song" />
                <span class="podcast-detail-skeleton__line podcast-detail-skeleton__line--artist" />
              </span>
            </span>
            <span class="podcast-detail-skeleton__line podcast-detail-skeleton__line--album" />
            <span class="podcast-detail-skeleton__line podcast-detail-skeleton__line--duration" />
          </article>
        </div>
      </section>
    </section>

    <template v-else-if="podcast">
      <section class="podcast-detail-hero">
        <div class="podcast-detail-cover" :class="`podcast-detail-cover--${podcast.type}`">
          <img
            v-if="podcast.coverUrl"
            class="podcast-detail-cover__image"
            :src="podcast.coverUrl"
            :alt="podcast.title"
            loading="lazy"
            decoding="async"
          />
          <span class="podcast-detail-cover__badge">
            <RadioTower :size="22" />
          </span>
        </div>

        <div class="podcast-detail-content">
          <h1>{{ podcast.title }}</h1>
          <p>{{ podcast.description }}</p>

          <div class="podcast-detail-meta">
            <span>
              <ListMusic :size="14" />
              {{ podcast.programCountLabel || `${total} 首歌曲` }}
            </span>
            <span>
              <RadioTower :size="14" />
              FM {{ podcast.id }}
            </span>
            <span>
              <Headphones :size="14" />
              {{ podcast.playCountLabel || '连续播放' }}
            </span>
            <span v-if="podcast.lastUpdated">
              <RefreshCw :size="14" />
              更新于 {{ podcast.lastUpdated }}
            </span>
          </div>

          <div class="podcast-detail-actions">
            <button
              class="podcast-action podcast-action--primary"
              type="button"
              :disabled="!programs.length"
              @click="playAll"
            >
              <Play :size="18" fill="currentColor" />
              <span>播放全部</span>
            </button>
          </div>
        </div>
      </section>

      <div v-if="errorMessage" class="podcast-state podcast-state--error">
        {{ errorMessage }}
      </div>

      <section class="podcast-detail-layout">
        <article class="podcast-detail-main">
          <section v-if="programs.length" class="podcast-detail-table" aria-label="电台歌曲列表">
            <header class="podcast-detail-table__head">
              <span>标题</span>
              <span>电台</span>
              <span>时长</span>
            </header>
            <div class="podcast-detail-programs">
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
                    @play="playProgram(track)"
                  />
                </div>
              </div>
            </div>
          </section>

          <div v-else class="podcast-state">暂无歌曲。</div>

          <button
            v-if="more"
            ref="programLoadMoreTrigger"
            class="podcast-load-more"
            type="button"
            :disabled="programLoading"
            @click="loadMorePrograms"
          >
            <LoaderCircle v-if="programLoading" :size="16" class="podcast-spin" />
            <span>加载更多歌曲</span>
          </button>
        </article>
      </section>
    </template>

    <section v-else-if="errorMessage" class="podcast-state podcast-state--error">
      {{ errorMessage }}
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMessage } from 'naive-ui'
import {
  Headphones,
  ListMusic,
  LoaderCircle,
  Play,
  RadioTower,
  RefreshCw,
} from 'lucide-vue-next'
import SongListRow from '../components/SongListRow.vue'
import { useLoadMoreTrigger } from '../composables/useLoadMoreTrigger'
import { useVirtualRows } from '../composables/useVirtualRows'
import {
  getPodcastDetailData,
  getPodcastProgramsData
} from '../services/netease'
import { usePlayerStore } from '../stores/player'
import { getPlaybackErrorDisplay } from '../utils/playbackError'
import { isAbortError } from '../utils/request'
import '../styles/podcast.css'
import '../styles/playlist.css'

const PROGRAM_LIMIT = 40
const PROGRAM_ROW_HEIGHT = 58

const route = useRoute()
const player = usePlayerStore()
const message = useMessage()
const pageRoot = ref(null)
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
  rowHeight: PROGRAM_ROW_HEIGHT
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

onMounted(() => {
  loadDetail()
})

onUnmounted(() => {
  cancelDetailRequest()
  cancelProgramRequest()
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
