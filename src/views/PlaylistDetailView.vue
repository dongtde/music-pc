<template>
  <div class="view playlist-detail">
    <section class="playlist-hero">
      <div class="playlist-cover" :class="`playlist-cover--${playlist.type}`">
        <img v-if="playlist.coverUrl" class="playlist-cover__image" :src="playlist.coverUrl" :alt="playlist.title" />
        <template v-else>
          <span v-if="playlist.type === 'sunset'" class="playlist-cover__sun" />
          <span v-if="playlist.type === 'neon'" class="playlist-cover__neon">Daily<br />Mix</span>
          <span v-if="playlist.type === 'lofi'" class="playlist-cover__desk" />
          <span v-if="playlist.type === 'stage'" class="playlist-cover__light playlist-cover__light--left" />
          <span v-if="playlist.type === 'stage'" class="playlist-cover__light playlist-cover__light--right" />
          <span v-if="playlist.type === 'piano'" class="playlist-cover__piano" />
        </template>
      </div>

      <div class="playlist-hero__content">
        <h1>{{ playlist.title }}</h1>
        <p>{{ playlist.description }}</p>

        <div class="playlist-meta">
          <span class="playlist-avatar">
            <img v-if="playlist.creatorAvatarUrl" :src="playlist.creatorAvatarUrl" :alt="playlist.creator" />
            <span v-else>{{ playlist.creatorInitial }}</span>
          </span>
          <strong>{{ playlist.creator }}</strong>
          <span>{{ playlist.updated }}</span>
          <span>{{ playlist.trackCount }} 首</span>
          <span>{{ playlist.listeners }} 播放</span>
        </div>

        <div class="playlist-actions">
          <button
            class="playlist-action playlist-action--primary"
            type="button"
            :disabled="isLoading || !playlistTracks.length"
            @click="playAllTracks"
          >
            <Pause v-if="isCurrentPlaylistPlaying" :size="18" fill="currentColor" />
            <Play v-else :size="18" fill="currentColor" />
            <span>{{ isCurrentPlaylistPlaying ? '暂停播放' : '播放全部' }}</span>
          </button>
          <button class="playlist-action" type="button">
            <Plus :size="17" />
            <span>收藏</span>
          </button>
          <button class="playlist-action" type="button">
            <Share2 :size="17" />
            <span>分享</span>
          </button>
          <button class="playlist-action playlist-action--icon" type="button" aria-label="更多">
            <MoreHorizontal :size="19" />
          </button>
        </div>
      </div>
    </section>

    <div v-if="isLoading" class="playlist-state">歌单加载中...</div>
    <div v-else-if="errorMessage" class="playlist-state playlist-state--error">{{ errorMessage }}</div>

    <section class="playlist-table" aria-label="歌曲列表">
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
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { MoreHorizontal, Pause, Play, Plus, Share2 } from 'lucide-vue-next'
import { useMessage } from 'naive-ui'
import SongListRow from '../components/SongListRow.vue'
import { curatedPlaylists, newSongs } from '../data/music'
import { getPlaylistDetailData } from '../services/netease'
import { usePlayerStore } from '../stores/player'
import '../styles/playlist.css'

const route = useRoute()
const player = usePlayerStore()
const message = useMessage()
const remotePlaylist = ref(null)
const remoteTracks = ref([])
const isLoading = ref(false)
const errorMessage = ref('')

const fallbackPlaylist = curatedPlaylists.find((item) => item.id === 'daily') ?? curatedPlaylists[0]

const playlist = computed(() => {
  if (remotePlaylist.value) {
    return withCreatorInitial(remotePlaylist.value)
  }

  const match = curatedPlaylists.find((item) => item.id === route.params.id) ?? fallbackPlaylist

  return withCreatorInitial({
    ...match,
    creator: match.id === 'daily' ? 'Mappic 音乐' : '编辑精选',
    updated: match.id === 'daily' ? '今天 06:00 更新' : '最近更新',
    trackCount: newSongs.length,
    tags: match.id === 'daily' ? ['每日推荐', '私人定制', '流行', '新歌'] : ['精选', '流行', '发现'],
    description:
      match.id === 'daily'
        ? '根据你的播放偏好、收藏记录和最近常听风格生成，每天刷新一批适合现在听的歌曲。'
        : match.desc
  })
})

const playlistTracks = computed(() => {
  if (remoteTracks.value.length) {
    return remoteTracks.value
  }

  const offset = playlist.value.id === 'daily' ? 0 : 2
  return newSongs.map((song, index) => ({
    ...song,
    id: `${playlist.value.id}-${song.rank}`,
    rank: String(index + 1).padStart(2, '0'),
    type: newSongs[(index + offset) % newSongs.length].type,
    to: `/playlist/new-${String(index + 1).padStart(2, '0')}`,
    vip: index % 2 === 0,
    hasVideo: index % 3 !== 1
  }))
})

const isCurrentPlaylistTrack = computed(() =>
  playlistTracks.value.some((track) => String(track.id) === String(player.state.currentTrack.id))
)
const isCurrentPlaylistPlaying = computed(() => isCurrentPlaylistTrack.value && player.state.isPlaying)

watch(
  () => route.params.id,
  (id) => {
    loadPlaylistDetail(id)
  },
  { immediate: true }
)

async function loadPlaylistDetail(id) {
  remotePlaylist.value = null
  remoteTracks.value = []
  errorMessage.value = ''

  if (!isNeteasePlaylistId(id)) {
    return
  }

  isLoading.value = true

  try {
    const data = await getPlaylistDetailData(id)
    remotePlaylist.value = data.playlist
    remoteTracks.value = data.tracks
  } catch (error) {
    console.warn('Failed to load playlist detail:', error)
    errorMessage.value = '歌单详情加载失败，已显示本地示例数据'
  } finally {
    isLoading.value = false
  }
}

function isNeteasePlaylistId(id) {
  return /^\d+$/.test(String(id ?? ''))
}

async function playAllTracks() {
  const tracks = buildPlayableQueue()

  if (!tracks.length) {
    message.warning('当前歌单暂无可播放歌曲')
    return
  }

  player.setQueue(tracks)

  if (isCurrentPlaylistTrack.value) {
    const toggled = await player.togglePlay()
    showPlaybackError(toggled)
    return
  }

  if (tracks[0].vip) {
    message.warning('当前歌曲为 VIP 歌曲，将尝试播放试听')
  }

  const played = await player.playTrack(tracks[0])
  showPlaybackError(played)
}

async function playPlaylistTrack(track) {
  const tracks = buildPlayableQueue()

  if (!tracks.length) {
    return
  }

  player.setQueue(tracks)

  if (String(player.state.currentTrack.id) === String(track.id)) {
    const toggled = await player.togglePlay()
    showPlaybackError(toggled)
    return
  }

  const played = await player.playTrack(track)
  showPlaybackError(played)
}

function buildPlayableQueue() {
  return playlistTracks.value.map((track, index) => ({
    ...track,
    rank: String(index + 1).padStart(2, '0')
  }))
}

function showPlaybackError(success) {
  if (success) {
    return
  }

  message.error(player.state.error?.message || '当前歌曲暂无可播放链接')
}

function withCreatorInitial(playlist) {
  return {
    ...playlist,
    creatorInitial: playlist.creator?.trim()?.slice(0, 1).toUpperCase() || 'M'
  }
}
</script>
