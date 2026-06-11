<template>
  <div ref="pageRoot" class="view playlist-detail" @scroll.passive="scheduleVirtualRangeUpdate">
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
            loading="eager"
            decoding="async"
            fetchpriority="high"
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
              :disabled="!playlistTracks.length || playAllLoading"
              @click="playAllPlaylistTracks"
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

        <div
          ref="trackVirtualList"
          class="playlist-virtual-list"
          :style="{ height: `${virtualTotalHeight}px` }"
        >
          <div
            class="playlist-virtual-window"
            :style="{ transform: `translateY(${virtualOffsetY}px)` }"
          >
            <SongListRow
              v-for="track in visiblePlaylistTracks"
              :key="track.id"
              :track="track"
              @play="playPlaylistTrack"
            />
          </div>
        </div>

        <div
          v-if="showTrackLoadMore"
          ref="trackLoadMoreTrigger"
          class="playlist-load-more"
          aria-live="polite"
        >
          <span v-if="trackLoading">正在加载更多歌曲...</span>
          <button
            v-else-if="trackError"
            type="button"
            @click="loadMoreTracks({ force: true })"
          >
            {{ trackError }}，重试
          </button>
          <span v-else>继续浏览更多歌曲</span>
        </div>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { MessageCircle, Pause, Play } from 'lucide-vue-next';
import { useMessage } from 'naive-ui';
import CommentModal from '../components/CommentModal.vue';
import SongListRow from '../components/SongListRow.vue';
import {
  getPlaylistCommentsData,
  getPlaylistOverviewData,
  getPlaylistTracksData,
} from '../services/netease';
import { SKELETON_MIN_MS } from '../config/app';
import { useLoadMoreTrigger } from '../composables/useLoadMoreTrigger';
import { usePaginatedComments } from '../composables/usePaginatedComments';
import { useQueuePlayback } from '../composables/useQueuePlayback';
import { waitForMinimumDelay } from '../utils/time';
import '../styles/playlist.css';

const PLAYLIST_INITIAL_TRACK_LIMIT = 60;
const PLAYLIST_TRACK_PAGE_SIZE = 100;
const TRACK_ROW_HEIGHT = 58;
const VIRTUAL_OVERSCAN_ROWS = 8;

const route = useRoute();
const message = useMessage();

const pageRoot = ref(null);
const remotePlaylist = ref(null);
const remoteTracks = ref([]);
const isLoading = ref(false);
const errorMessage = ref('');
const trackVirtualList = ref(null);
const trackLoadMoreTrigger = ref(null);
const trackLoading = ref(false);
const trackError = ref('');
const trackHasMore = ref(false);
const playAllLoading = ref(false);
const virtualStartIndex = ref(0);
const virtualEndIndex = ref(0);
let playlistLoadToken = 0;
let activeTrackRequest = null;
let virtualFrame = 0;

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
      commentCount: 0,
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
const virtualTotalHeight = computed(() => playlistTracks.value.length * TRACK_ROW_HEIGHT);
const virtualOffsetY = computed(() => virtualStartIndex.value * TRACK_ROW_HEIGHT);
const visiblePlaylistTracks = computed(() =>
  playlistTracks.value.slice(virtualStartIndex.value, virtualEndIndex.value),
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
const showTrackLoadMore = computed(
  () => trackHasMore.value || trackLoading.value || Boolean(trackError.value),
);

const {
  isPlaying,
  playAll: playLoadedTracks,
  playTrack: playPlaylistTrack,
} = useQueuePlayback({
  queue: playlistTracks,
  message,
  emptyMessage: '当前歌单暂无可播放歌曲',
  errorMessage: '当前歌曲暂无可播放链接',
});

const loadMoreController = useLoadMoreTrigger({
  trigger: trackLoadMoreTrigger,
  canLoad: () =>
    trackHasMore.value &&
    !trackLoading.value &&
    !trackError.value &&
    !isLoading.value,
  loadMore: loadMoreTracks,
  rootMargin: '520px 0px',
  scrollThreshold: 720,
});

onMounted(() => {
  window.addEventListener('resize', scheduleVirtualRangeUpdate, { passive: true });
  nextTick(updateVirtualRange);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', scheduleVirtualRangeUpdate);
  if (virtualFrame) {
    window.cancelAnimationFrame(virtualFrame);
  }
});

watch(
  () => route.params.id,
  (id) => {
    loadPlaylistDetail(id);
    commentState.reset();
    if (commentsModalVisible.value) {
      commentState.load(id, { reset: true });
    }
  },
  { immediate: true },
);

watch(
  () => playlistTracks.value.length,
  () => {
    nextTick(() => {
      updateVirtualRange();
      loadMoreController.setup();
    });
  },
);

async function loadPlaylistDetail(id) {
  const loadToken = ++playlistLoadToken;
  const startedAt = Date.now();

  loadMoreController.cleanup();
  remotePlaylist.value = null;
  remoteTracks.value = [];
  errorMessage.value = '';
  resetTrackLoadingState();

  if (!/^\d+$/.test(String(id ?? ''))) {
    errorMessage.value = '歌单 ID 不正确';
    isLoading.value = false;
    return;
  }

  isLoading.value = true;

  try {
    const data = await getPlaylistOverviewData(id, {
      trackLimit: PLAYLIST_INITIAL_TRACK_LIMIT,
    });

    if (loadToken !== playlistLoadToken) {
      return;
    }

    remotePlaylist.value = data.playlist;
    remoteTracks.value = getUniqueTracks(data.tracks);
    syncTrackHasMore();
    updateVirtualRange();

    if (!remoteTracks.value.length && trackHasMore.value) {
      await loadMoreTracks({ force: true, token: loadToken });
    }
  } catch (error) {
    if (loadToken !== playlistLoadToken) {
      return;
    }

    console.warn('Failed to load playlist detail:', error);
    errorMessage.value = '歌单详情加载失败';
  } finally {
    await waitForMinimumDelay(startedAt, SKELETON_MIN_MS);

    if (loadToken === playlistLoadToken) {
      isLoading.value = false;
      nextTick(() => {
        updateVirtualRange();
        loadMoreController.setup();
      });
    }
  }
}

async function loadMoreTracks({ force = false, token = playlistLoadToken } = {}) {
  if (activeTrackRequest) {
    return activeTrackRequest;
  }

  const request = runLoadMoreTracks({ force, token }).finally(() => {
    if (activeTrackRequest === request) {
      activeTrackRequest = null;
    }
  });

  activeTrackRequest = request;

  return request;
}

async function runLoadMoreTracks({ force = false, token = playlistLoadToken } = {}) {
  const id = String(route.params.id ?? '');

  if (!/^\d+$/.test(id) || token !== playlistLoadToken) {
    return null;
  }

  if (!force && (!trackHasMore.value || trackError.value || trackLoading.value)) {
    return null;
  }

  trackLoading.value = true;
  trackError.value = '';

  try {
    const data = await getPlaylistTracksData({
      id,
      limit: PLAYLIST_TRACK_PAGE_SIZE,
      offset: remoteTracks.value.length,
    });

    if (token !== playlistLoadToken) {
      return null;
    }

    appendUniqueTracks(data.tracks);
    syncTrackHasMore(data.more);

    if (trackHasMore.value && !data.tracks?.length) {
      trackHasMore.value = false;
      trackError.value = '歌曲加载失败';
    }

    return data;
  } catch (error) {
    if (token === playlistLoadToken) {
      console.warn('Failed to load playlist tracks:', error);
      trackError.value = '歌曲加载失败';
      syncTrackHasMore();
    }

    return null;
  } finally {
    if (token === playlistLoadToken) {
      trackLoading.value = false;
    }
  }
}

async function playAllPlaylistTracks() {
  if (playAllLoading.value) {
    return false;
  }

  playAllLoading.value = true;

  try {
    await loadAllRemainingTracks();
    return playLoadedTracks();
  } finally {
    playAllLoading.value = false;
  }
}

async function loadAllRemainingTracks() {
  await activeTrackRequest;

  const id = String(route.params.id ?? '');
  const total = Number(playlist.value.trackCount) || 0;

  if (trackHasMore.value && /^\d+$/.test(id) && total > remoteTracks.value.length) {
    trackLoading.value = true;
    trackError.value = '';

    try {
      const data = await getPlaylistTracksData({
        id,
        limit: total,
        offset: 0,
      });

      remoteTracks.value = getUniqueTracks(data.tracks);
      syncTrackHasMore();
      return;
    } catch (error) {
      console.warn('Failed to load full playlist tracks:', error);
      trackError.value = '歌曲加载失败';
      syncTrackHasMore();
    } finally {
      trackLoading.value = false;
    }
  }

  while (trackHasMore.value && !trackError.value) {
    const loadedCount = remoteTracks.value.length;
    await loadMoreTracks({ force: true });

    if (remoteTracks.value.length <= loadedCount) {
      break;
    }
  }
}

function appendUniqueTracks(tracks = []) {
  remoteTracks.value = getUniqueTracks([...remoteTracks.value, ...tracks]);
}

function getUniqueTracks(tracks = []) {
  const seen = new Set();
  const uniqueTracks = [];

  for (const track of tracks) {
    const trackId = String(track?.id ?? '');

    if (!trackId || seen.has(trackId)) {
      continue;
    }

    seen.add(trackId);
    uniqueTracks.push(track);
  }

  return uniqueTracks;
}

function resetTrackLoadingState() {
  trackLoading.value = false;
  trackError.value = '';
  trackHasMore.value = false;
  playAllLoading.value = false;
  activeTrackRequest = null;
}

function syncTrackHasMore(apiHasMore = false) {
  const total = Number(playlist.value.trackCount) || 0;

  trackHasMore.value = total
    ? remoteTracks.value.length < total
    : Boolean(apiHasMore);
}

function scheduleVirtualRangeUpdate() {
  if (virtualFrame) {
    return;
  }

  virtualFrame = window.requestAnimationFrame(() => {
    virtualFrame = 0;
    updateVirtualRange();
  });
}

function updateVirtualRange() {
  const total = playlistTracks.value.length;

  if (!total) {
    virtualStartIndex.value = 0;
    virtualEndIndex.value = 0;
    return;
  }

  const root = pageRoot.value;
  const list = trackVirtualList.value;

  if (!root || !list) {
    virtualStartIndex.value = 0;
    virtualEndIndex.value = Math.min(total, 40);
    return;
  }

  const scrollTop = root.scrollTop;
  const viewportHeight = root.clientHeight;
  const listTop = list.offsetTop;
  const visibleTop = Math.max(0, scrollTop - listTop);
  const visibleBottom = Math.max(0, scrollTop + viewportHeight - listTop);
  const nextStart = Math.max(
    0,
    Math.floor(visibleTop / TRACK_ROW_HEIGHT) - VIRTUAL_OVERSCAN_ROWS,
  );
  const nextEnd = Math.min(
    total,
    Math.ceil(visibleBottom / TRACK_ROW_HEIGHT) + VIRTUAL_OVERSCAN_ROWS,
  );

  virtualStartIndex.value = nextStart;
  virtualEndIndex.value = Math.max(nextEnd, nextStart + 1);
}

function loadMoreComments() {
  commentState.loadMore(route.params.id);
}

function openCommentsModal() {
  return commentState.open(route.params.id);
}

</script>
