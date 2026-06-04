<template>
  <section class="discover-page playlists-page">
    <div v-if="!categoryPanelOpen" class="filter-row discover-filter-row" aria-label="热门歌单分类">
      <button
        v-for="category in visibleCategories"
        :key="category"
        type="button"
        :class="{ active: activeCategory === category }"
        @click="selectCategory(category)"
      >
        {{ category }}
      </button>
      <button
        class="discover-filter-more"
        type="button"
        :aria-expanded="String(categoryPanelOpen)"
        @click="categoryPanelOpen = true"
      >
        更多分类
      </button>
    </div>

    <div v-if="loading" class="discover-loading">正在加载歌单内容...</div>
    <div v-else-if="error" class="discover-error">
      <strong>歌单加载失败</strong>
      <button type="button" @click="reload">重试</button>
    </div>
    <template v-else>
      <div v-if="categoryPanelOpen && categoryGroups.length" class="playlist-category-panel">
        <header class="playlist-category-panel__head">
          <strong>全部分类</strong>
          <div>
            <button
              type="button"
              :class="{ active: activeCategory === '全部' }"
              @click="selectCategory('全部')"
            >
              全部
            </button>
            <button type="button" @click="categoryPanelOpen = false">收起分类</button>
          </div>
        </header>
        <article v-for="group in categoryGroups" :key="group.id">
          <strong>{{ group.name }}</strong>
          <div>
            <button
              v-for="tagName in group.tags"
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
import PlaylistCard from '../../components/PlaylistCard.vue'
import SectionTitle from '../../components/SectionTitle.vue'
import { getPlaylistDiscoveryData } from '../../services/netease'

const activeCategory = ref('全部')
const loading = ref(false)
const error = ref(null)
const hotCategories = ref(['全部'])
const categoryGroups = ref([])
const playlists = ref([])
const categoryPanelOpen = ref(false)

const visibleCategories = computed(() => ['全部', ...hotCategories.value.filter((item) => item !== '全部')])

onMounted(() => {
  loadData()
})

function selectCategory(category) {
  categoryPanelOpen.value = false

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
