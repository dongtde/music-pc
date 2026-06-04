<template>
  <div class="view album-detail">
    <section class="album-hero">
      <div class="album-cover" :class="`album-cover--${album.type}`">
        <img
          v-if="album.coverUrl"
          class="album-cover__image"
          :src="album.coverUrl"
          :alt="album.title"
          loading="lazy"
          decoding="async"
        />
      </div>

      <div class="album-hero__content">
        <span class="tag">专辑</span>
        <h1>{{ album.title }}</h1>
        <p>{{ album.description }}</p>

        <div class="album-meta">
          <span>{{ album.artist }}</span>
          <span>{{ album.publishTime }}</span>
          <span>{{ album.company || '网易云音乐' }}</span>
          <span>{{ album.size }} 首歌</span>
        </div>

        <div v-if="hasAlbumStats" class="album-stats" aria-label="专辑动态">
          <span>
            <Heart :size="14" />
            {{ formatStat(album.subCount) }} 收藏
          </span>
          <span>
            <MessageCircle :size="14" />
            {{ formatStat(displayCommentTotal) }} 评论
          </span>
          <span>
            <Share2 :size="14" />
            {{ formatStat(album.shareCount) }} 分享
          </span>
        </div>

        <div class="album-actions">
          <button
            class="album-action album-action--primary"
            type="button"
            :disabled="isLoading || !albumTracks.length"
            @click="playAllTracks"
          >
            <Play v-if="!isPlaying" :size="18" fill="currentColor" />
            <Pause v-else :size="18" fill="currentColor" />
            <span>{{ isPlaying ? '暂停播放' : '播放全部' }}</span>
          </button>
          <button
            class="album-action"
            type="button"
            :disabled="commentsLoading && !comments.length"
            @click="openCommentsModal"
          >
            <MessageCircle :size="17" />
            <span>评论 {{ displayCommentTotal || '' }}</span>
          </button>
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

      <SongListRow
        v-for="track in albumTracks"
        :key="track.id"
        :track="track"
        @play="playAlbumTrack"
      />
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
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  Heart,
  MessageCircle,
  Pause,
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
import { usePlayerStore } from '../stores/player'
import '../styles/album.css'

const COMMENT_LIMIT = 30

const route = useRoute()
const player = usePlayerStore()
const message = useMessage()

const remoteAlbum = ref(null)
const remoteTracks = ref([])
const isLoading = ref(false)
const errorMessage = ref('')
const commentsModalVisible = ref(false)
const hotComments = ref([])
const comments = ref([])
const commentTotal = ref(0)
const commentsOffset = ref(0)
const commentsHasMore = ref(false)
const commentsLoading = ref(false)
const commentsError = ref('')

const album = computed(() =>
  remoteAlbum.value || {
    id: route.params.id,
    title: '专辑详情',
    description: '当前专辑暂无本地回退数据',
    artist: '网易云音乐',
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

const displayCommentTotal = computed(
  () => commentTotal.value || album.value.commentCount || 0
)

const hasAlbumStats = computed(() =>
  [album.value.subCount, displayCommentTotal.value, album.value.shareCount].some(
    (count) => Number(count) > 0
  )
)

const isPlaying = computed(() =>
  albumTracks.value.some((track) => String(track.id) === String(player.state.currentTrack.id)) && player.state.isPlaying
)

watch(
  () => route.params.id,
  (id) => {
    loadAlbumDetail(id)
    loadComments(id, true)
  },
  { immediate: true }
)

async function loadAlbumDetail(id) {
  remoteAlbum.value = null
  remoteTracks.value = []
  errorMessage.value = ''

  if (!/^\d+$/.test(String(id ?? ''))) {
    errorMessage.value = '专辑 ID 不正确'
    return
  }

  isLoading.value = true

  try {
    const data = await getAlbumDetailData(id)
    remoteAlbum.value = data.album
    remoteTracks.value = data.tracks
  } catch (error) {
    console.warn('Failed to load album detail:', error)
    errorMessage.value = '专辑详情加载失败'
  } finally {
    isLoading.value = false
  }
}

async function loadComments(id, reset = false) {
  if (!/^\d+$/.test(String(id ?? ''))) {
    return
  }

  commentsLoading.value = true
  commentsError.value = ''

  const offset = reset ? 0 : commentsOffset.value

  try {
    const data = await getAlbumCommentsData({
      id,
      limit: COMMENT_LIMIT,
      offset
    })

    if (reset) {
      hotComments.value = data.hotComments
      comments.value = data.comments
    } else {
      comments.value = [...comments.value, ...data.comments]
    }

    commentTotal.value = data.total
    commentsHasMore.value = data.more || comments.value.length < data.total
    commentsOffset.value = comments.value.length
  } catch (error) {
    console.warn('Failed to load album comments:', error)
    commentsError.value = '评论加载失败'
  } finally {
    commentsLoading.value = false
  }
}

function loadMoreComments() {
  loadComments(route.params.id)
}

async function openCommentsModal() {
  commentsModalVisible.value = true

  if (!comments.value.length && !commentsLoading.value) {
    await loadComments(route.params.id, true)
  }
}

async function playAllTracks() {
  if (!albumTracks.value.length) {
    message.warning('当前专辑暂无可播放歌曲')
    return
  }

  player.setQueue(albumTracks.value)
  const played = await player.playTrack(albumTracks.value[0])
  if (!played) {
    message.error(player.state.error?.message || '当前歌曲暂无可播放链接')
  }
}

async function playAlbumTrack(track) {
  player.setQueue(albumTracks.value)

  if (String(player.state.currentTrack.id) === String(track.id)) {
    await player.togglePlay()
    return
  }

  const played = await player.playTrack(track)
  if (!played) {
    message.error(player.state.error?.message || '当前歌曲暂无可播放链接')
  }
}

function formatStat(value = 0) {
  const count = Number(value) || 0

  if (count >= 100000000) {
    return `${trimNumber(count / 100000000)}亿`
  }

  if (count >= 10000) {
    return `${trimNumber(count / 10000)}万`
  }

  return String(count)
}

function trimNumber(number) {
  return Number(number.toFixed(1)).toString()
}
</script>
