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
              v-if="isRemotePlaylist"
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
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { MessageCircle, Pause, Play } from 'lucide-vue-next';
import { useMessage } from 'naive-ui';
import CommentModal from '../components/CommentModal.vue';
import SongListRow from '../components/SongListRow.vue';
import {
  getPlaylistCommentsData,
  getPlaylistOverviewData,
  getPlaylistTracksData,
  isRemotePlaylistId,
} from '../services/netease';
import { SKELETON_MIN_MS } from '../config/app';
import { useLoadMoreTrigger } from '../composables/useLoadMoreTrigger';
import { usePaginatedComments } from '../composables/usePaginatedComments';
import { useQueuePlayback } from '../composables/useQueuePlayback';
import { useVirtualRows } from '../composables/useVirtualRows';
import { useLibraryStore } from '../stores/library';
import { isAbortError } from '../utils/request';
import { waitForMinimumDelay } from '../utils/time';
import '../styles/playlist.css';

const PLAYLIST_INITIAL_TRACK_LIMIT = 60;
const PLAYLIST_TRACK_PAGE_SIZE = 100;
const TRACK_ROW_HEIGHT = 58;

const route = useRoute();
const message = useMessage();
const library = useLibraryStore();

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
let playlistLoadToken = 0;
let activeTrackRequest = null;
let detailController = null;
let trackController = null;

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
const {
  offsetY: virtualOffsetY,
  scheduleRangeUpdate: scheduleVirtualRangeUpdate,
  totalHeight: virtualTotalHeight,
  updateRange: updateVirtualRange,
  visibleItems: visiblePlaylistTracks,
} = useVirtualRows(playlistTracks, {
  root: pageRoot,
  list: trackVirtualList,
  rowHeight: TRACK_ROW_HEIGHT,
});

const creatorInitial = computed(
  () => playlist.value.creator?.slice(0, 1) || '云',
);
const playlistRequestMeta = computed(() => getPlaylistRequestMeta(route.params.id));
const commentResourceId = computed(() => playlistRequestMeta.value.remoteId);
const commentState = usePaginatedComments({
  resourceId: commentResourceId,
  loader: getPlaylistCommentsData,
  isValidId: isPlaylistCommentId,
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
const isRemotePlaylist = computed(() => playlistRequestMeta.value.remote);
const showTrackLoadMore = computed(
  () => isRemotePlaylist.value && (trackHasMore.value || trackLoading.value || Boolean(trackError.value)),
);

const {
  isPlaying,
  playAll: playLoadedTracks,
  playTrack: playPlaylistTrack,
} = useQueuePlayback({
  queue: playlistTracks,
  queueSource: () => ({ type: 'playlist', id: route.params.id }),
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

watch(
  () => route.params.id,
  (id) => {
    loadPlaylistDetail(id);
    commentState.reset();
    const meta = getPlaylistRequestMeta(id);

    if (commentsModalVisible.value && meta.remote) {
      commentState.load(meta.remoteId, { reset: true });
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  playlistLoadToken += 1;
  abortDetailRequest();
  abortTrackRequest();
  loadMoreController.cleanup();
});

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

  abortDetailRequest();
  abortTrackRequest();
  loadMoreController.cleanup();
  remotePlaylist.value = null;
  remoteTracks.value = [];
  errorMessage.value = '';
  resetTrackLoadingState();

  isLoading.value = true;
  const controller = new AbortController();
  detailController = controller;

  try {
    const meta = getPlaylistRequestMeta(id);

    if (!meta.remote) {
      loadLocalPlaylist(id);
      return;
    }

    const data = await getPlaylistOverviewData(meta.remoteId, {
      trackLimit: PLAYLIST_INITIAL_TRACK_LIMIT,
      listid: meta.listid,
      fallbackPlaylist: meta.fallbackPlaylist,
    }, {
      signal: controller.signal,
    });

    if (loadToken !== playlistLoadToken || controller.signal.aborted) {
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
    if (isAbortError(error) || loadToken !== playlistLoadToken) {
      return;
    }

    console.warn('Failed to load playlist detail:', error);
    errorMessage.value = '歌单详情加载失败';
  } finally {
    await waitForMinimumDelay(startedAt, SKELETON_MIN_MS);

    if (loadToken === playlistLoadToken && !controller.signal.aborted) {
      isLoading.value = false;
      nextTick(() => {
        updateVirtualRange();
        loadMoreController.setup();
      });
    }

    if (detailController === controller) {
      detailController = null;
    }
  }
}

function loadLocalPlaylist(id) {
  const localPlaylist = library.getPlaylist(id);

  if (!localPlaylist) {
    errorMessage.value = '歌单不存在';
    remotePlaylist.value = {
      id,
      title: '歌单不存在',
      description: '没有找到这个本地歌单',
      creator: '本地资料库',
      creatorAvatarUrl: '',
      updated: '',
      trackCount: 0,
      listeners: '0',
      commentCount: 0,
      tags: [],
      type: 'sunset',
      coverUrl: ''
    };
    remoteTracks.value = [];
    return;
  }

  remotePlaylist.value = {
    id: localPlaylist.id,
    title: localPlaylist.title,
    description: localPlaylist.description || '本地创建或收藏的歌单',
    creator: localPlaylist.collectedAt ? '收藏的歌单' : '本地创建',
    creatorAvatarUrl: '',
    updated: formatLocalDate(localPlaylist.updatedAt),
    trackCount: localPlaylist.tracks.length,
    listeners: '0',
    commentCount: 0,
    tags: localPlaylist.collectedAt ? ['收藏'] : ['创建'],
    type: 'lofi',
    coverUrl: ''
  };
  remoteTracks.value = getUniqueTracks(localPlaylist.tracks);
  syncTrackHasMore();
  nextTick(updateVirtualRange);
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
  const meta = playlistRequestMeta.value;

  if (!meta.remote || token !== playlistLoadToken) {
    return null;
  }

  if (!force && (!trackHasMore.value || trackError.value || trackLoading.value)) {
    return null;
  }

  const controller = new AbortController();
  trackController = controller;
  trackLoading.value = true;
  trackError.value = '';

  try {
    const data = await getPlaylistTracksData({
      id: meta.remoteId,
      listid: meta.listid,
      limit: PLAYLIST_TRACK_PAGE_SIZE,
      offset: remoteTracks.value.length,
    }, {
      signal: controller.signal,
    });

    if (token !== playlistLoadToken || controller.signal.aborted || String(route.params.id ?? '') !== id) {
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
    if (isAbortError(error) || token !== playlistLoadToken) {
      return null;
    }

    if (token === playlistLoadToken) {
      console.warn('Failed to load playlist tracks:', error);
      trackError.value = '歌曲加载失败';
      syncTrackHasMore();
    }

    return null;
  } finally {
    if (token === playlistLoadToken && !controller.signal.aborted) {
      trackLoading.value = false;
    }

    if (trackController === controller) {
      trackController = null;
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

  const meta = playlistRequestMeta.value;
  const token = playlistLoadToken;

  if (!meta.remote) {
    return;
  }

  while (token === playlistLoadToken && trackHasMore.value && !trackError.value) {
    const loadedCount = remoteTracks.value.length;
    const data = await loadMoreTracks({ force: true, token });

    if (!data || remoteTracks.value.length <= loadedCount) {
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

function abortDetailRequest() {
  if (!detailController) {
    return;
  }

  detailController.abort();
  detailController = null;
}

function abortTrackRequest() {
  if (!trackController) {
    return;
  }

  trackController.abort();
  trackController = null;
  activeTrackRequest = null;
  trackLoading.value = false;
}

function syncTrackHasMore(apiHasMore = false) {
  const total = Number(playlist.value.trackCount) || 0;

  trackHasMore.value = total
    ? remoteTracks.value.length < total
    : Boolean(apiHasMore);
}

function loadMoreComments() {
  commentState.loadMore(commentResourceId.value);
}

function openCommentsModal() {
  if (!isRemotePlaylist.value) {
    return null;
  }

  return commentState.open(commentResourceId.value);
}

function isPlaylistCommentId(id) {
  return isRemotePlaylistId(id);
}

function getPlaylistRequestMeta(routeId) {
  const routePlaylistId = String(routeId ?? '');
  const localPlaylist = library.getPlaylist(routePlaylistId);
  const remoteId = localPlaylist?.globalCollectionId || routePlaylistId;
  const listid = localPlaylist?.listid || '';

  return {
    remote: isRemotePlaylistId(remoteId) || Boolean(localPlaylist?.remote && (localPlaylist.globalCollectionId || localPlaylist.listid)),
    remoteId,
    listid,
    fallbackPlaylist: localPlaylist
      ? {
          id: localPlaylist.globalCollectionId || localPlaylist.id,
          globalCollectionId: localPlaylist.globalCollectionId,
          listid: localPlaylist.listid,
          name: localPlaylist.title,
          description: localPlaylist.description,
          coverImgUrl: localPlaylist.coverUrl,
          trackCount: localPlaylist.trackCount || localPlaylist.tracks.length,
          updateTime: localPlaylist.updatedAt,
          subscribed: Boolean(localPlaylist.collectedAt),
          creator: {
            nickname: localPlaylist.collectedAt ? '收藏的歌单' : '本地创建',
            avatarUrl: '',
          },
          tracks: localPlaylist.tracks,
        }
      : null,
  };
}

function formatLocalDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

</script>
