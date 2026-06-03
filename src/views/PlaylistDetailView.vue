<template>
  <div class="view playlist-detail">
    <section class="playlist-hero">
      <div class="playlist-cover" :class="`playlist-cover--${playlist.type}`">
        <img
          v-if="playlist.coverUrl"
          class="playlist-cover__image"
          :src="playlist.coverUrl"
          :alt="playlist.title"
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
            :disabled="isLoading || !playlistTracks.length"
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

    <div v-if="isLoading" class="playlist-state">歌单加载中...</div>
    <div v-else-if="errorMessage" class="playlist-state playlist-state--error">
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
import { usePlayerStore } from '../stores/player';
import '../styles/playlist.css';

const COMMENT_LIMIT = 30;

const route = useRoute();
const player = usePlayerStore();
const message = useMessage();

const remotePlaylist = ref(null);
const remoteTracks = ref([]);
const isLoading = ref(false);
const errorMessage = ref('');
const commentsModalVisible = ref(false);
const hotComments = ref([]);
const comments = ref([]);
const commentTotal = ref(0);
const commentsOffset = ref(0);
const commentsHasMore = ref(false);
const commentsLoading = ref(false);
const commentsError = ref('');

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
const isPlaying = computed(
  () =>
    playlistTracks.value.some(
      (track) => String(track.id) === String(player.state.currentTrack.id),
    ) && player.state.isPlaying,
);

watch(
  () => route.params.id,
  (id) => {
    loadPlaylistDetail(id);
    loadComments(id, true);
  },
  { immediate: true },
);

async function loadPlaylistDetail(id) {
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
    isLoading.value = false;
  }
}

async function loadComments(id, reset = false) {
  if (!/^\d+$/.test(String(id ?? ''))) {
    return;
  }

  commentsLoading.value = true;
  commentsError.value = '';

  const offset = reset ? 0 : commentsOffset.value;

  try {
    const data = await getPlaylistCommentsData({
      id,
      limit: COMMENT_LIMIT,
      offset,
    });

    if (reset) {
      hotComments.value = data.hotComments;
      comments.value = data.comments;
    } else {
      comments.value = [...comments.value, ...data.comments];
    }

    commentTotal.value = data.total;
    commentsHasMore.value = data.more || comments.value.length < data.total;
    commentsOffset.value = comments.value.length;
  } catch (error) {
    console.warn('Failed to load playlist comments:', error);
    commentsError.value = '评论加载失败';
  } finally {
    commentsLoading.value = false;
  }
}

function loadMoreComments() {
  loadComments(route.params.id);
}

async function openCommentsModal() {
  commentsModalVisible.value = true;

  if (!comments.length && !commentsLoading.value) {
    await loadComments(route.params.id, true);
  }
}

async function playAllTracks() {
  if (!playlistTracks.value.length) {
    message.warning('当前歌单暂无可播放歌曲');
    return;
  }

  player.setQueue(playlistTracks.value);
  const played = await player.playTrack(playlistTracks.value[0]);
  if (!played) {
    message.error(player.state.error?.message || '当前歌曲暂无可播放链接');
  }
}

async function playPlaylistTrack(track) {
  player.setQueue(playlistTracks.value);

  if (String(player.state.currentTrack.id) === String(track.id)) {
    await player.togglePlay();
    return;
  }

  const played = await player.playTrack(track);
  if (!played) {
    message.error(player.state.error?.message || '当前歌曲暂无可播放链接');
  }
}
</script>
