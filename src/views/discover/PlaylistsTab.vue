<template>
  <section class="discover-page playlists-page">
    <div class="playlist-category-board" aria-label="歌单分类">
      <div
        v-for="group in visibleCategoryGroups"
        :key="group.id"
        class="playlist-category-row"
      >
        <strong>{{ group.name }}</strong>
        <div>
          <button
            v-for="category in group.tags"
            :key="categoryKey(category)"
            type="button"
            :class="{ active: isActiveCategory(category) }"
            @click="selectCategory(category)"
          >
            {{ category.name }}
          </button>
        </div>
      </div>
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
      <SectionTitle :title="`${activeCategory.name}歌单`" />
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
const defaultCategory = {
  id: 0,
  name: '全部'
}

const activeCategory = ref(defaultCategory)
const loading = ref(false)
const loadingMore = ref(false)
const skeletonVisible = ref(false)
const error = ref(null)
const categoryGroups = ref([])
const playlists = ref([])
const playlistsOffset = ref(0)
const hasMore = ref(true)
const loadMoreTrigger = ref(null)
let playlistRequestId = 0

const visibleCategoryGroups = computed(() => categoryGroups.value.length
  ? categoryGroups.value
  : [{
      id: 'default',
      name: '分类',
      tags: [defaultCategory]
    }]
)
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
  const nextCategory = normalizeCategory(category)

  if (categoryKey(activeCategory.value) === categoryKey(nextCategory)) {
    return
  }

  activeCategory.value = nextCategory
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

    categoryGroups.value = normalizeCategoryGroups(data.categoryGroups)
    playlists.value = reset ? data.playlists : mergePlaylists(playlists.value, data.playlists)
    playlistsOffset.value = offset + data.playlists.length
    hasMore.value = Boolean(data.playlists.length && (data.more || playlistsOffset.value < data.total))
    activeCategory.value = normalizeCategory({
      id: data.activeCategoryId ?? activeCategory.value.id,
      name: data.activeCategory || activeCategory.value.name
    })
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

function normalizeCategory(category) {
  if (category && typeof category === 'object') {
    return {
      id: category.id ?? category.categoryId ?? category.tagId ?? category.tag_id ?? '',
      name: category.name ?? category.title ?? category.tagName ?? category.tag_name ?? '全部'
    }
  }

  return {
    id: category === '全部' ? 0 : '',
    name: String(category || '全部')
  }
}

function isActiveCategory(category) {
  return categoryKey(activeCategory.value) === categoryKey(category)
}

function categoryKey(category) {
  const normalized = normalizeCategory(category)

  return normalized.id !== '' && normalized.id !== undefined && normalized.id !== null
    ? `id:${normalized.id}`
    : `name:${normalized.name}`
}

function normalizeCategoryGroups(groups = []) {
  const normalizedGroups = (Array.isArray(groups) ? groups : [])
    .map((group, index) => {
      const groupCategory = normalizeCategory({
        id: group.id,
        name: '全部'
      })
      const groupTags = Array.isArray(group.tags) ? group.tags.map(normalizeCategory) : []
      const tags = uniqueCategories([groupCategory, ...groupTags])

      return {
        id: group.id ?? `group-${index}`,
        name: group.name || `分类 ${index + 1}`,
        tags
      }
    })
    .filter((group) => group.tags.length)

  return normalizedGroups.length
    ? normalizedGroups
    : [{
        id: 'default',
        name: '分类',
        tags: [defaultCategory]
      }]
}

function uniqueCategories(categories = []) {
  const seen = new Set()

  return categories.filter((category) => {
    const key = categoryKey(category)

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

</script>
