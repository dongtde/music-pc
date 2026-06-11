<template>
  <div class="view library-view">
    <section class="library-head">
      <div>
        <span class="library-kicker">{{ activeMeta.kicker }}</span>
        <h1>{{ activeMeta.title }}</h1>
        <p>{{ activeMeta.description }}</p>
      </div>

      <div class="library-actions">
        <button
          v-if="isLocalView"
          class="library-action"
          type="button"
          @click="openLocalPicker"
        >
          <Upload :size="17" />
          <span>导入音频</span>
        </button>
        <button
          v-if="showDownloadSync"
          class="library-action"
          type="button"
          :disabled="downloadSyncLoading"
          @click="syncDownloadedSongs"
        >
          <RotateCw :size="17" :class="{ 'library-action__spin': downloadSyncLoading }" />
          <span>同步下载</span>
        </button>
        <button
          class="library-action library-action--primary"
          type="button"
          :disabled="!tracks.length"
          @click="playAllTracks"
        >
          <Play :size="17" fill="currentColor" />
          <span>播放全部</span>
        </button>
      </div>

      <input
        ref="fileInput"
        class="library-file-input"
        type="file"
        accept="audio/*"
        multiple
        @change="handleLocalFiles"
      />
    </section>

    <section class="library-stats" aria-label="资料库统计">
      <article>
        <strong>{{ tracks.length }}</strong>
        <span>歌曲</span>
      </article>
      <article>
        <strong>{{ library.state.createdPlaylists.length }}</strong>
        <span>创建歌单</span>
      </article>
      <article>
        <strong>{{ library.state.collectedPlaylists.length }}</strong>
        <span>收藏歌单</span>
      </article>
    </section>

    <section v-if="tracks.length" class="playlist-table library-table" aria-label="歌曲列表">
      <header class="playlist-table__head">
        <span>标题</span>
        <span>专辑</span>
        <span>时长</span>
      </header>

      <SongListRow
        v-for="track in rankedTracks"
        :key="track.id"
        :track="track"
        @play="playTrack"
      />
    </section>

    <section v-else class="library-empty">
      <component :is="activeMeta.icon" :size="42" />
      <strong>{{ activeMeta.emptyTitle }}</strong>
      <p>{{ activeMeta.emptyDescription }}</p>
      <button v-if="isLocalView" type="button" @click="openLocalPicker">选择音频文件</button>
    </section>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { CloudDownload, Heart, History, Play, RotateCw, Upload } from 'lucide-vue-next'
import { useMessage } from 'naive-ui'
import SongListRow from '../components/SongListRow.vue'
import { useQueuePlayback } from '../composables/useQueuePlayback'
import { useLibraryStore } from '../stores/library'
import { useAuthStore } from '../stores/auth'
import { getDownloadedSongsData } from '../services/netease'
import '../styles/library.css'
import '../styles/playlist.css'

const route = useRoute()
const message = useMessage()
const library = useLibraryStore()
const auth = useAuthStore()
const fileInput = ref(null)
const downloadSyncLoading = ref(false)

const viewType = computed(() => String(route.params.type || 'local'))
const isLocalView = computed(() => viewType.value === 'local')
const tracks = computed(() => {
  if (viewType.value === 'liked') {
    return library.state.likedTracks
  }

  if (viewType.value === 'recent') {
    return library.state.recentTracks
  }

  return library.state.localTracks
})
const rankedTracks = computed(() =>
  tracks.value.map((track, index) => ({
    ...track,
    rank: String(index + 1).padStart(2, '0')
  }))
)
const activeMeta = computed(() => {
  if (viewType.value === 'liked') {
    return {
      title: '我喜欢的音乐',
      kicker: '我的音乐',
      description: '收藏过的歌曲会聚合在这里，换设备前也能保留本地记录。',
      emptyTitle: '还没有喜欢的歌曲',
      emptyDescription: '在播放栏点击爱心后，歌曲会出现在这里。',
      icon: Heart
    }
  }

  if (viewType.value === 'recent') {
    return {
      title: '最近播放',
      kicker: '我的音乐',
      description: '按播放时间倒序记录最近听过的歌曲。',
      emptyTitle: '还没有播放记录',
      emptyDescription: '播放任意歌曲后，这里会自动更新。',
      icon: History
    }
  }

  return {
    title: '本地与下载',
    kicker: '我的音乐',
    description: '导入本地音频文件后可直接在播放器里播放。',
    emptyTitle: '还没有本地歌曲',
    emptyDescription: '选择电脑里的音频文件，立即加入本地列表。',
    icon: CloudDownload
  }
})
const showDownloadSync = computed(() => isLocalView.value && auth.state.isLoggedIn)

const { playAll: playAllTracks, playTrack } = useQueuePlayback({
  queue: rankedTracks,
  message,
  emptyMessage: '当前列表暂无可播放歌曲',
  errorMessage: '当前歌曲暂无可播放链接'
})

watch(
  () => [viewType.value, auth.state.isLoggedIn],
  ([type, loggedIn]) => {
    if (type === 'local' && loggedIn) {
      syncDownloadedSongs()
    }
  },
  { immediate: true }
)

function openLocalPicker() {
  fileInput.value?.click()
}

async function syncDownloadedSongs() {
  if (!showDownloadSync.value || downloadSyncLoading.value) {
    return
  }

  downloadSyncLoading.value = true

  try {
    const downloadedTracks = await getDownloadedSongsData({ limit: 100, offset: 0 })
    const addedTracks = library.addLocalTracks(
      downloadedTracks.map((track) => ({
        ...track,
        source: '下载记录'
      }))
    )

    if (addedTracks.length) {
      message.success(`已同步 ${addedTracks.length} 首下载歌曲`)
    }
  } catch (error) {
    console.warn('Failed to sync downloaded songs:', error)
    message.warning('下载歌曲同步失败')
  } finally {
    downloadSyncLoading.value = false
  }
}

function handleLocalFiles(event) {
  const addedTracks = library.addLocalFiles(event.target.files)

  if (addedTracks.length) {
    message.success(`已导入 ${addedTracks.length} 首本地歌曲`)
  } else {
    message.warning('没有可导入的音频文件')
  }

  event.target.value = ''
}
</script>
