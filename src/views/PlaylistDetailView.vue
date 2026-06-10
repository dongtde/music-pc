<template>
  <div class="view playlist-detail">
    <section
      v-if="isLoading"
      class="playlist-detail-skeleton"
      aria-busy="true"
      aria-label="歌单详情加载中"
    >
      <section class="playlist-detail-skeleton__hero">
        <span class="playlist-detail-skeleton__cover" />

        <div class="playlist-detail-skeleton__content">
          <span class="playlist-detail-skeleton__line playlist-detail-skeleton__line--title" />
          <span class="playlist-detail-skeleton__line playlist-detail-skeleton__line--description" />
          <span class="playlist-detail-skeleton__line playlist-detail-skeleton__line--description-short" />

          <div class="playlist-detail-skeleton__meta">
            <span class="playlist-detail-skeleton__avatar" />
            <span
              v-for="item in 5"
              :key="`playlist-meta-skeleton-${item}`"
              class="playlist-detail-skeleton__pill"
            />
          </div>

          <div class="playlist-detail-skeleton__actions">
            <span class="playlist-detail-skeleton__button playlist-detail-skeleton__button--primary" />
            <span class="playlist-detail-skeleton__button" />
          </div>
        </div>
      </section>

      <section class="playlist-detail-skeleton__table" aria-hidden="true">
        <header class="playlist-table__head">
          <span>标题</span>
          <span>专辑</span>
          <span>时长</span>
        </header>

        <div class="playlist-detail-skeleton__rows">
          <article
            v-for="item in 10"
            :key="`playlist-track-skeleton-${item}`"
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

    <template v-else>
      <section class="playlist-hero">
        <div class="playlist-cover" :class="`playlist-cover--${playlist.type}`">
          <img
            v-if="playlist.coverUrl"
            class="playlist-cover__image"
            :src="playlist.coverUrl"
            :alt="playlist.title"
            loading="lazy"
            decoding="async"
          />
        </div>

        <div class="playlist-hero__content">
          <!-- <span class="tag">歌单</span> -->
          <h1>{{ playlist.title }}</h1>
          <p>{{ playlist.description }}</p>

          <div class="playlist-meta">
            <span class="playlist-avatar">
              <img
                v-if="playlist.creatorAvatarUrl"
                :src="playlist.creatorAvatarUrl"
                :alt="playlist.creator"
                loading="lazy"
                decoding="async"
              />
              <template v-else>{{ creatorInitial }}</template>
            </span>
            <strong>{{ playlist.creator }}</strong>
            <span>{{ playlist.updated }}</span>
            <span>{{ playlist.trackCount }} 首歌</span>
            <span>{{ playlist.listeners }} 次播放</span>
            <span v-if="playlist.tags?.length">{{
              playlist.tags.join(' / ')
            }}</span>
          </div>

          <div class="playlist-actions">
            <button
              class="playlist-action playlist-action--primary"
              type="button"
              :disabled="!playlistTracks.length"
              @click="playAllTracks"
            >
              <Play v-if="!isPlaying" :size="18" fill="currentColor" />
              <Pause v-else :size="18" fill="currentColor" />
              <span>{{ isPlaying ? '暂停播放' : '播放全部' }}</span>
            </button>
            <button
              class="playlist-action"
              type="button"
              :disabled="commentsLoading && !comments.length"
              @click="openCommentsModal"
            >
              <MessageCircle :size="17" />
              <span>评论 {{ commentTotal || '' }}</span>
            </button>
          </div>
        </div>
      </section>

      <div v-if="errorMessage" class="playlist-state playlist-state--error">
        {{ errorMessage }}
      </div>

      <section class="playlist-table" aria-label="歌单歌曲列表">
        <header class="playlist-table__head">
          <span>标题</span>
          <span>专辑</span>
          <span>时长</span>
        </header>

        <SongListRow
          v-for="track in playlistTracks"
          :key="track.id"
          :track="track"
          @play="playPlaylistTrack"
        />
      </section>
    </template>

    <CommentModal
      v-model:show="commentsModalVisible"
      title="歌单评论"
      :subtitle="playlist.title"
      :total="commentTotal"
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
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { MessageCircle, Pause, Play } from 'lucide-vue-next';
import { useMessage } from 'naive-ui';
import CommentModal from '../components/CommentModal.vue';
import SongListRow from '../components/SongListRow.vue';
import {
  getPlaylistCommentsData,
  getPlaylistDetailData,
} from '../services/netease';
import { SKELETON_MIN_MS } from '../config/app';
import { usePaginatedComments } from '../composables/usePaginatedComments';
import { useQueuePlayback } from '../composables/useQueuePlayback';
import { waitForMinimumDelay } from '../utils/time';
import '../styles/playlist.css';

const route = useRoute();
const message = useMessage();

const remotePlaylist = ref(null);
const remoteTracks = ref([]);
const isLoading = ref(false);
const errorMessage = ref('');

const playlist = computed(
  () =>
    remotePlaylist.value || {
      id: route.params.id,
      title: '歌单详情',
      description: '当前歌单暂无本地回退数据',
      creator: '网易云音乐用户',
      creatorAvatarUrl: '',
      updated: '',
      trackCount: 0,
      listeners: '0',
      tags: [],
      type: 'sunset',
      coverUrl: '',
    },
);

const playlistTracks = computed(() =>
  remoteTracks.value.map((track, index) => ({
    ...track,
    rank: String(index + 1).padStart(2, '0'),
  })),
);

const creatorInitial = computed(
  () => playlist.value.creator?.slice(0, 1) || '云',
);
const commentState = usePaginatedComments({
  resourceId: computed(() => route.params.id),
  loader: getPlaylistCommentsData,
  getFallbackTotal: () => playlist.value.commentCount,
  errorMessage: '评论加载失败',
  warnPrefix: 'Failed to load playlist comments:',
});
const commentsModalVisible = commentState.visible;
const hotComments = commentState.hotComments;
const comments = commentState.comments;
const commentTotal = commentState.displayTotal;
const commentsHasMore = commentState.hasMore;
const commentsLoading = commentState.loading;
const commentsError = commentState.error;

const {
  isPlaying,
  playAll: playAllTracks,
  playTrack: playPlaylistTrack,
} = useQueuePlayback({
  queue: playlistTracks,
  message,
  emptyMessage: '当前歌单暂无可播放歌曲',
  errorMessage: '当前歌曲暂无可播放链接',
});
watch(
  () => route.params.id,
  (id) => {
    loadPlaylistDetail(id);
    commentState.load(id, { reset: true });
  },
  { immediate: true },
);

async function loadPlaylistDetail(id) {
  const startedAt = Date.now();

  remotePlaylist.value = null;
  remoteTracks.value = [];
  errorMessage.value = '';

  if (!/^\d+$/.test(String(id ?? ''))) {
    errorMessage.value = '歌单 ID 不正确';
    return;
  }

  isLoading.value = true;

  try {
    const data = await getPlaylistDetailData(id);
    remotePlaylist.value = data.playlist;
    remoteTracks.value = data.tracks;
  } catch (error) {
    console.warn('Failed to load playlist detail:', error);
    errorMessage.value = '歌单详情加载失败';
  } finally {
    await waitForMinimumDelay(startedAt, SKELETON_MIN_MS);
    isLoading.value = false;
  }
}


function loadMoreComments() {
  commentState.loadMore(route.params.id);
}

function openCommentsModal() {
  return commentState.open(route.params.id);
}

</script>
