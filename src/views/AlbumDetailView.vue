<template>
  <div class="view album-detail">
    <section class="album-hero">
      <div class="album-cover" :class="`album-cover--${album.type}`">
        <img v-if="album.coverUrl" class="album-cover__image" :src="album.coverUrl" :alt="album.title" />
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

        <div class="album-actions">
          <button class="album-action album-action--primary" type="button" :disabled="isLoading || !albumTracks.length" @click="playAllTracks">
            <Play v-if="!isPlaying" :size="18" fill="currentColor" />
            <Pause v-else :size="18" fill="currentColor" />
            <span>{{ isPlaying ? '暂停播放' : '播放全部' }}</span>
          </button>
        </div>
      </div>
    </section>

    <div v-if="isLoading" class="album-state">专辑加载中...</div>
    <div v-else-if="errorMessage" class="album-state album-state--error">{{ errorMessage }}</div>

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
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Pause, Play } from 'lucide-vue-next'
import { useMessage } from 'naive-ui'
import SongListRow from '../components/SongListRow.vue'
import { getAlbumDetailData } from '../services/netease'
import { usePlayerStore } from '../stores/player'
import '../styles/album.css'

const route = useRoute()
const player = usePlayerStore()
const message = useMessage()
const remoteAlbum = ref(null)
const remoteTracks = ref([])
const isLoading = ref(false)
const errorMessage = ref('')

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
    coverUrl: ''
  }
)

const albumTracks = computed(() =>
  remoteTracks.value.map((track, index) => ({
    ...track,
    rank: String(index + 1).padStart(2, '0')
  }))
)

const isPlaying = computed(() =>
  albumTracks.value.some((track) => String(track.id) === String(player.state.currentTrack.id)) && player.state.isPlaying
)

watch(
  () => route.params.id,
  (id) => {
    loadAlbumDetail(id)
  },
  { immediate: true }
)

async function loadAlbumDetail(id) {
  remoteAlbum.value = null
  remoteTracks.value = []
  errorMessage.value = ''

  if (!/^\d+$/.test(String(id ?? ''))) {
    return
  }

  isLoading.value = true

  try {
    const data = await getAlbumDetailData(id)
    remoteAlbum.value = {
      ...data.album,
      type: 'sunset'
    }
    remoteTracks.value = data.tracks
  } catch (error) {
    console.warn('Failed to load album detail:', error)
    errorMessage.value = '专辑详情加载失败'
  } finally {
    isLoading.value = false
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
</script>
