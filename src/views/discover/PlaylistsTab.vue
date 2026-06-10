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

    <section
      v-if="skeletonVisible"
      class="playlists-skeleton"
      aria-busy="true"
      aria-label="正在加载歌单"
    >
      <span class="skeleton-title skeleton-title--small" />
      <div class="playlist-grid playlist-grid--dense">
        <article
          v-for="item in PLAYLIST_SKELETON_COUNT"
          :key="`playlist-skeleton-${item}`"
          class="skeleton-playlist-card"
        >
          <span class="skeleton-cover" />
          <span class="skeleton-line skeleton-line--playlist" />
          <span class="skeleton-line skeleton-line--playlist-short" />
        </article>
      </div>
    </section>
    <div v-else-if="error && !playlists.length" class="discover-error">
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
      <div ref="loadMoreTrigger" class="playlist-load-more" aria-live="polite">
        <span v-if="loadingMore">正在加载更多歌单...</span>
        <button v-else-if="error && playlists.length" type="button" @click="loadMore({ force: true })">加载失败，重试</button>
        <span v-else-if="!hasMore && playlists.length">没有更多歌单了</span>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import PlaylistCard from '../../components/PlaylistCard.vue'
import SectionTitle from '../../components/SectionTitle.vue'
import { useLoadMoreTrigger } from '../../composables/useLoadMoreTrigger'
import { getPlaylistDiscoveryData } from '../../services/netease'
import { waitForMinimumDelay } from '../../utils/time'

const PLAYLIST_LIMIT = 50
const PLAYLIST_SKELETON_COUNT = 24
const PLAYLIST_SKELETON_MIN_MS = 420

const activeCategory = ref('全部')
const loading = ref(false)
const loadingMore = ref(false)
const skeletonVisible = ref(false)
const error = ref(null)
const hotCategories = ref(['全部'])
const categoryGroups = ref([])
const playlists = ref([])
const categoryPanelOpen = ref(false)
const playlistsOffset = ref(0)
const hasMore = ref(true)
const loadMoreTrigger = ref(null)
let playlistRequestId = 0

const visibleCategories = computed(() => ['全部', ...hotCategories.value.filter((item) => item !== '全部')])
const loadMoreController = useLoadMoreTrigger({
  trigger: loadMoreTrigger,
  canLoad: () => !loading.value && !loadingMore.value && hasMore.value && !error.value,
  loadMore,
  rootMargin: '360px 0px 360px',
  threshold: 0
})

onMounted(() => {
  loadData({ reset: true })
})


function selectCategory(category) {
  categoryPanelOpen.value = false

  if (activeCategory.value === category) {
    return
  }

  activeCategory.value = category
  loadData({ reset: true })
}

function reload() {
  loadData({ reset: true })
}

function loadMore({ force = false } = {}) {
  if (loading.value || loadingMore.value || !hasMore.value || (error.value && !force)) {
    return
  }

  loadData({ reset: false })
}

async function loadData({ reset = false } = {}) {
  const startedAt = Date.now()

  if (reset) {
    loadMoreController.cleanup()
    loading.value = true
    skeletonVisible.value = true
    playlists.value = []
    playlistsOffset.value = 0
    hasMore.value = true
  } else {
    loadingMore.value = true
  }

  error.value = null
  const requestId = ++playlistRequestId
  const offset = reset ? 0 : playlistsOffset.value

  try {
    const data = await getPlaylistDiscoveryData(activeCategory.value, {
      limit: PLAYLIST_LIMIT,
      offset
    })

    if (requestId !== playlistRequestId) {
      return
    }

    hotCategories.value = data.hotCategories.length ? data.hotCategories : hotCategories.value
    categoryGroups.value = data.categoryGroups
    playlists.value = reset ? data.playlists : mergePlaylists(playlists.value, data.playlists)
    playlistsOffset.value = offset + data.playlists.length
    hasMore.value = Boolean(data.playlists.length && (data.more || playlistsOffset.value < data.total))
    activeCategory.value = data.activeCategory || activeCategory.value
  } catch (loadError) {
    if (requestId !== playlistRequestId) {
      return
    }

    console.warn('Failed to load playlist discovery:', loadError)
    error.value = loadError
  } finally {
    if (requestId === playlistRequestId) {
      if (reset) {
        await waitForMinimumDelay(startedAt, PLAYLIST_SKELETON_MIN_MS)

        if (requestId !== playlistRequestId) {
          return
        }

        skeletonVisible.value = false
      }

      loading.value = false
      loadingMore.value = false
      nextTick(loadMoreController.setup)
    }
  }
}


function mergePlaylists(currentPlaylists, nextPlaylists) {
  const seenIds = new Set(currentPlaylists.map((playlist) => playlist.id))

  return [
    ...currentPlaylists,
    ...nextPlaylists.filter((playlist) => {
      if (seenIds.has(playlist.id)) {
        return false
      }

      seenIds.add(playlist.id)
      return true
    })
  ]
}

</script>
