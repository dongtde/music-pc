<template>
  <div ref="pageRoot" class="view album-detail" @scroll.passive="scheduleAlbumRangeUpdate">
    <section class="album-hero">
      <div class="album-cover" :class="`album-cover--${album.type}`">
        <img
          v-if="album.coverUrl"
          class="album-cover__image"
          :src="album.coverUrl"
          :alt="album.title"
          loading="eager"
          decoding="async"
          fetchpriority="high"
        />
      </div>

      <div class="album-hero__content">
        <h1>{{ album.title }}</h1>
        <n-tooltip
          trigger="hover"
          placement="bottom-start"
          :disabled="!album.description"
          class="album-description-tooltip"
        >
          <template #trigger>
            <p class="album-description">{{ album.description }}</p>
          </template>
          {{ album.description }}
        </n-tooltip>

        <div class="album-meta">
          <span>{{ album.artist }}</span>
          <span>{{ album.publishTime }}</span>
          <span>{{ album.company || '酷狗音乐' }}</span>
          <span>{{ album.size }} 首歌</span>
        </div>

        <div class="album-actions">
          <button
            class="album-action album-action--primary"
            type="button"
            :disabled="isLoading || !albumTracks.length"
            @click="playAllTracks"
          >
            <Play :size="18" fill="currentColor" />
            <span>播放全部</span>
          </button>
          <div v-if="hasAlbumStats" class="album-stats" aria-label="专辑动态">
            <span>
              <Heart :size="14" />
              {{ formatStat(album.subCount) }} 收藏
            </span>
            <button
              type="button"
              :disabled="commentsLoading && !comments.length"
              @click="openCommentsModal"
            >
              <MessageCircle :size="14" />
              {{ formatStat(displayCommentTotal) }} 评论
            </button>
            <span>
              <Share2 :size="14" />
              {{ formatStat(album.shareCount) }} 分享
            </span>
          </div>
        </div>
      </div>
    </section>

    <div v-if="isLoading" class="album-state">专辑加载中...</div>
    <div v-else-if="errorMessage" class="album-state album-state--error">
      {{ errorMessage }}
    </div>

    <section class="playlist-table album-track-table" aria-label="专辑曲目列表">
      <header class="playlist-table__head">
        <span>标题</span>
        <span>专辑</span>
        <span>时长</span>
      </header>

      <div
        ref="trackVirtualList"
        class="playlist-virtual-list"
        :style="{ height: `${albumVirtualTotalHeight}px` }"
      >
        <div
          class="playlist-virtual-window"
          :style="{ transform: `translateY(${albumVirtualOffsetY}px)` }"
        >
          <SongListRow
            v-for="track in visibleAlbumTracks"
            :key="track.id"
            :track="track"
            @play="playAlbumTrack"
          />
        </div>
      </div>
    </section>

    <CommentModal
      v-model:show="commentsModalVisible"
      title="专辑评论"
      :subtitle="album.title"
      :total="displayCommentTotal"
      :hot-comments="hotComments"
      :comments="comments"
      :loading="commentsLoading"
      :error="commentsError"
      :has-more="commentsHasMore"
      @load-more="loadMoreComments"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  Heart,
  MessageCircle,
  Play,
  Share2
} from 'lucide-vue-next'
import { useMessage } from 'naive-ui'
import CommentModal from '../components/CommentModal.vue'
import SongListRow from '../components/SongListRow.vue'
import {
  getAlbumCommentsData,
  getAlbumDetailData
} from '../services/netease'
import { usePaginatedComments } from '../composables/usePaginatedComments'
import { useQueuePlayback } from '../composables/useQueuePlayback'
import { useVirtualRows } from '../composables/useVirtualRows'
import { formatCompactCount } from '../utils/number'
import { isAbortError } from '../utils/request'
import '../styles/album.css'
import '../styles/playlist.css'

const TRACK_ROW_HEIGHT = 58

const route = useRoute()
const message = useMessage()

const pageRoot = ref(null)
const trackVirtualList = ref(null)
const remoteAlbum = ref(null)
const remoteTracks = ref([])
const isLoading = ref(false)
const errorMessage = ref('')
let albumRequestId = 0
let albumController = null

const album = computed(() =>
  remoteAlbum.value || {
    id: route.params.id,
    title: '专辑详情',
    description: '当前专辑暂无本地回退数据',
    artist: '酷狗音乐',
    publishTime: '',
    company: '',
    size: 0,
    type: 'sunset',
    coverUrl: '',
    subCount: 0,
    commentCount: 0,
    shareCount: 0
  }
)

const albumTracks = computed(() =>
  remoteTracks.value.map((track, index) => ({
    ...track,
    rank: String(index + 1).padStart(2, '0')
  }))
)
const {
  offsetY: albumVirtualOffsetY,
  scheduleRangeUpdate: scheduleAlbumRangeUpdate,
  totalHeight: albumVirtualTotalHeight,
  updateRange: updateAlbumVirtualRange,
  visibleItems: visibleAlbumTracks
} = useVirtualRows(albumTracks, {
  root: pageRoot,
  list: trackVirtualList,
  rowHeight: TRACK_ROW_HEIGHT
})

const commentState = usePaginatedComments({
  resourceId: computed(() => route.params.id),
  loader: getAlbumCommentsData,
  getFallbackTotal: () => album.value.commentCount,
  errorMessage: '评论加载失败',
  warnPrefix: 'Failed to load album comments:'
})
const commentsModalVisible = commentState.visible
const hotComments = commentState.hotComments
const comments = commentState.comments
const displayCommentTotal = commentState.displayTotal
const commentsHasMore = commentState.hasMore
const commentsLoading = commentState.loading
const commentsError = commentState.error

const hasAlbumStats = computed(() =>
  [album.value.subCount, displayCommentTotal.value, album.value.shareCount].some(
    (count) => Number(count) > 0
  )
)

const {
  playAll: playAllTracks,
  playTrack: playAlbumTrack
} = useQueuePlayback({
  queue: albumTracks,
  queueSource: () => ({ type: 'album', id: route.params.id }),
  message,
  emptyMessage: '当前专辑暂无可播放歌曲',
  errorMessage: '当前歌曲暂无可播放链接'
})

watch(
  () => route.params.id,
  (id) => {
    loadAlbumDetail(id)
    commentState.reset()

    if (commentsModalVisible.value) {
      commentState.load(id, { reset: true })
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  cancelAlbumRequest()
})

async function loadAlbumDetail(id) {
  cancelAlbumRequest()
  remoteAlbum.value = null
  remoteTracks.value = []
  errorMessage.value = ''

  if (!/^\d+$/.test(String(id ?? ''))) {
    errorMessage.value = '专辑 ID 不正确'
    isLoading.value = false
    return
  }

  const requestId = ++albumRequestId
  const controller = new AbortController()
  albumController = controller
  isLoading.value = true

  try {
    const data = await getAlbumDetailData(id, {
      signal: controller.signal
    })

    if (requestId !== albumRequestId || controller.signal.aborted) {
      return
    }

    remoteAlbum.value = data.album
    remoteTracks.value = data.tracks
    nextTick(updateAlbumVirtualRange)
  } catch (error) {
    if (isAbortError(error) || requestId !== albumRequestId) {
      return
    }

    console.warn('Failed to load album detail:', error)
    errorMessage.value = '专辑详情加载失败'
  } finally {
    if (requestId === albumRequestId && !controller.signal.aborted) {
      isLoading.value = false
    }

    if (albumController === controller) {
      albumController = null
    }
  }
}

function loadMoreComments() {
  commentState.loadMore(route.params.id)
}

function openCommentsModal() {
  return commentState.open(route.params.id)
}

function formatStat(value = 0) {
  return formatCompactCount(value)
}

function cancelAlbumRequest() {
  albumRequestId += 1

  if (!albumController) {
    return
  }

  albumController.abort()
  albumController = null
}
</script>
