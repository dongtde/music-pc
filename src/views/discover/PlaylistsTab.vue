<template>
  <section class="discover-page">
    <section class="discover-banner discover-banner--playlists">
      <div>
        <span class="tag">精品歌单</span>
        <h1>把今天交给合适的歌单</h1>
        <p>从官方分类、热门标签和精品歌单池里挑选内容，按语种、风格、场景快速切换。</p>
      </div>
      <n-button round type="primary" :loading="loading" @click="reload">
        <template #icon>
          <Headphones :size="18" />
        </template>
        刷新推荐
      </n-button>
    </section>

    <div class="filter-row discover-filter-row" aria-label="热门歌单分类">
      <button
        v-for="category in visibleCategories"
        :key="category"
        type="button"
        :class="{ active: activeCategory === category }"
        @click="selectCategory(category)"
      >
        {{ category }}
      </button>
    </div>

    <div v-if="loading" class="discover-loading">正在加载歌单内容...</div>
    <div v-else-if="error" class="discover-error">
      <strong>歌单加载失败</strong>
      <button type="button" @click="reload">重试</button>
    </div>
    <template v-else>
      <section v-if="featuredPlaylist" class="playlist-feature">
        <router-link :to="`/playlist/${featuredPlaylist.id}`" class="playlist-feature__cover">
          <img :src="featuredPlaylist.coverUrl" :alt="featuredPlaylist.title" />
          <span><Play :size="22" fill="currentColor" /></span>
        </router-link>
        <div class="playlist-feature__body">
          <span class="tag">编辑精选</span>
          <h2>{{ featuredPlaylist.title }}</h2>
          <p>{{ featuredPlaylist.desc || `由 ${featuredPlaylist.creator || '网易云音乐'} 推荐，包含 ${featuredPlaylist.trackCount} 首歌曲。` }}</p>
          <div class="playlist-feature__meta">
            <span><Headphones :size="15" /> {{ featuredPlaylist.listeners }}</span>
            <span>{{ featuredPlaylist.trackCount }} 首歌</span>
            <span>{{ featuredPlaylist.creator || '优质歌单' }}</span>
          </div>
        </div>
      </section>

      <div v-if="categoryGroups.length" class="playlist-category-panel">
        <article v-for="group in categoryGroups" :key="group.id">
          <strong>{{ group.name }}</strong>
          <div>
            <button
              v-for="tagName in group.tags.slice(0, 12)"
              :key="tagName"
              type="button"
              :class="{ active: activeCategory === tagName }"
              @click="selectCategory(tagName)"
            >
              {{ tagName }}
            </button>
          </div>
        </article>
      </div>

      <SectionTitle :title="`${activeCategory}歌单`" />
      <div class="playlist-grid playlist-grid--dense">
        <PlaylistCard v-for="playlist in playlists" :key="playlist.id" :playlist="playlist" />
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Headphones, Play } from 'lucide-vue-next'
import PlaylistCard from '../../components/PlaylistCard.vue'
import SectionTitle from '../../components/SectionTitle.vue'
import { getPlaylistDiscoveryData } from '../../services/netease'

const activeCategory = ref('全部')
const loading = ref(false)
const error = ref(null)
const hotCategories = ref(['全部'])
const categoryGroups = ref([])
const highQualityPlaylists = ref([])
const playlists = ref([])

const visibleCategories = computed(() => ['全部', ...hotCategories.value.filter((item) => item !== '全部')].slice(0, 12))
const featuredPlaylist = computed(() => highQualityPlaylists.value[0] ?? playlists.value[0])

onMounted(() => {
  loadData()
})

function selectCategory(category) {
  if (activeCategory.value === category) {
    return
  }

  activeCategory.value = category
  loadData()
}

function reload() {
  loadData()
}

async function loadData() {
  loading.value = true
  error.value = null

  try {
    const data = await getPlaylistDiscoveryData(activeCategory.value)
    hotCategories.value = data.hotCategories.length ? data.hotCategories : hotCategories.value
    categoryGroups.value = data.categoryGroups
    highQualityPlaylists.value = data.highQualityPlaylists
    playlists.value = data.playlists
    activeCategory.value = data.activeCategory || activeCategory.value
  } catch (loadError) {
    console.warn('Failed to load playlist discovery:', loadError)
    error.value = loadError
  } finally {
    loading.value = false
  }
}
</script>
