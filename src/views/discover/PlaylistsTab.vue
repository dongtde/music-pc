<template>
  <section class="discover-page playlists-page">
    <nav class="playlist-category-strip" aria-label="歌单分类">
      <button
        class="playlist-category-chip playlist-category-chip--all"
        type="button"
        :aria-current="isActiveCategory(defaultCategory) ? 'page' : undefined"
        :class="{ active: isActiveCategory(defaultCategory) }"
        @click="selectCategory(defaultCategory)"
      >
        全部
      </button>
      <button
        v-for="category in featuredCategories"
        :key="categoryKey(category)"
        class="playlist-category-chip"
        type="button"
        :aria-current="isActiveCategory(category) ? 'page' : undefined"
        :class="{ active: isActiveCategory(category) }"
        @click="selectCategory(category)"
      >
        {{ category.name }}
      </button>
      <button
        class="playlist-category-chip playlist-category-chip--more"
        type="button"
        :aria-expanded="categoryModalOpen"
        :class="{ active: categoryModalOpen || moreCategoryActive }"
        @click="openCategoryModal"
      >
        <ListFilter :size="16" />
        <span>更多分类</span>
        <ChevronDown :size="15" :class="{ open: categoryModalOpen }" />
      </button>
    </nav>

    <Teleport to="body">
      <Transition name="playlist-category-modal">
        <div
          v-if="categoryModalOpen"
          class="playlist-category-modal__overlay"
          @click.self="closeCategoryModal"
        >
          <section
            class="playlist-category-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="playlist-category-modal-title"
          >
            <header class="playlist-category-modal__head">
              <div>
                <span>歌单分类</span>
                <strong id="playlist-category-modal-title">更多分类</strong>
              </div>
              <button
                class="playlist-category-modal__close"
                type="button"
                aria-label="关闭分类弹窗"
                @click="closeCategoryModal"
              >
                <X :size="18" />
              </button>
            </header>

            <div class="playlist-category-modal__body">
              <section
                v-for="group in visibleCategoryGroups"
                :key="group.id"
                class="playlist-category-modal__group"
              >
                <header>
                  <strong>{{ group.name }}</strong>
                  <small>{{ group.tags.length }} 个分类</small>
                </header>
                <div>
                  <button
                    v-for="category in group.tags"
                    :key="categoryKey(category)"
                    type="button"
                    :aria-current="isActiveCategory(category) ? 'page' : undefined"
                    :class="{ active: isActiveCategory(category) }"
                    @click="selectCategory(category, { closeModal: true })"
                  >
                    {{ category.name }}
                  </button>
                </div>
              </section>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>

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
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ChevronDown, ListFilter, X } from 'lucide-vue-next'
import PlaylistCard from '../../components/PlaylistCard.vue'
import SectionTitle from '../../components/SectionTitle.vue'
import { useLoadMoreTrigger } from '../../composables/useLoadMoreTrigger'
import { getPlaylistDiscoveryData } from '../../services/netease'
import { createLruCache } from '../../utils/lruCache'
import { isAbortError } from '../../utils/request'
import { waitForMinimumDelay } from '../../utils/time'

const PLAYLIST_LIMIT = 30
const PLAYLIST_SKELETON_COUNT = 24
const PLAYLIST_SKELETON_MIN_MS = 420
const PLAYLIST_CATEGORY_CACHE_SIZE = 24
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
const categoryModalOpen = ref(false)
const playlists = ref([])
const playlistsOffset = ref(0)
const hasMore = ref(true)
const loadMoreTrigger = ref(null)
const playlistCategoryCache = createLruCache(PLAYLIST_CATEGORY_CACHE_SIZE)
let playlistRequestId = 0
let playlistRequestController = null

const visibleCategoryGroups = computed(() => categoryGroups.value.length
  ? categoryGroups.value
  : [{
      id: 'default',
      name: '全部分类',
      tags: [defaultCategory]
    }]
)
const featuredCategories = computed(() =>
  uniqueCategories(
    visibleCategoryGroups.value
      .map((group) => getFeaturedCategory(group))
      .filter(Boolean)
  )
)
const activeCategoryVisibleInStrip = computed(() =>
  isActiveCategory(defaultCategory) ||
    featuredCategories.value.some((category) => isActiveCategory(category))
)
const moreCategoryActive = computed(() =>
  !isActiveCategory(defaultCategory) && !activeCategoryVisibleInStrip.value
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

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleCategoryModalKeydown)
  }
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleCategoryModalKeydown)
  }

  cancelPlaylistRequest()
})

function openCategoryModal() {
  categoryModalOpen.value = true
}

function closeCategoryModal() {
  categoryModalOpen.value = false
}

function handleCategoryModalKeydown(event) {
  if (event.key === 'Escape' && categoryModalOpen.value) {
    closeCategoryModal()
  }
}

function selectCategory(category, { closeModal = false } = {}) {
  const nextCategory = normalizeCategory(category)

  if (categoryKey(activeCategory.value) === categoryKey(nextCategory)) {
    if (closeModal) {
      closeCategoryModal()
    }

    return
  }

  activeCategory.value = nextCategory

  if (closeModal) {
    closeCategoryModal()
  }

  loadData({ reset: true })
}

function reload() {
  loadData({ reset: true, force: true })
}

function loadMore({ force = false } = {}) {
  if (loading.value || loadingMore.value || !hasMore.value || (error.value && !force)) {
    return
  }

  loadData({ reset: false })
}

function cancelPlaylistRequest() {
  playlistRequestId += 1

  if (!playlistRequestController) {
    return
  }

  playlistRequestController.abort()
  playlistRequestController = null
}

function restorePlaylistCategoryCache(category) {
  const cached = playlistCategoryCache.get(getPlaylistCategoryCacheKey(category))

  if (!cached) {
    return false
  }

  loadMoreController.cleanup()
  activeCategory.value = normalizeCategory(cached.activeCategory ?? category)
  categoryGroups.value = cloneCategoryGroups(cached.categoryGroups)
  playlists.value = Array.isArray(cached.playlists) ? cached.playlists.slice() : []
  playlistsOffset.value = Number(cached.offset) || playlists.value.length
  hasMore.value = Boolean(cached.hasMore)
  loading.value = false
  loadingMore.value = false
  skeletonVisible.value = false
  error.value = null
  nextTick(loadMoreController.setup)
  return true
}

function savePlaylistCategoryCache(category) {
  playlistCategoryCache.set(getPlaylistCategoryCacheKey(category), {
    activeCategory: { ...activeCategory.value },
    categoryGroups: cloneCategoryGroups(categoryGroups.value),
    playlists: playlists.value.slice(),
    offset: playlistsOffset.value,
    hasMore: hasMore.value
  })
}

function getPlaylistCategoryCacheKey(category) {
  return `playlists:${categoryKey(category)}`
}

async function loadData({ reset = false, force = false } = {}) {
  const startedAt = Date.now()
  const categorySnapshot = normalizeCategory(activeCategory.value)
  cancelPlaylistRequest()

  if (reset && !force && restorePlaylistCategoryCache(categorySnapshot)) {
    return
  }

  const requestId = ++playlistRequestId
  const controller = new AbortController()
  playlistRequestController = controller

  if (reset) {
    loadMoreController.cleanup()
    loading.value = true
    loadingMore.value = false
    skeletonVisible.value = true
    playlists.value = []
    playlistsOffset.value = 0
    hasMore.value = true
  } else {
    loadingMore.value = true
  }

  error.value = null
  const offset = reset ? 0 : playlistsOffset.value

  try {
    const data = await getPlaylistDiscoveryData(activeCategory.value, {
      limit: PLAYLIST_LIMIT,
      offset
    }, {
      signal: controller.signal
    })

    if (requestId !== playlistRequestId || controller.signal.aborted) {
      return
    }

    categoryGroups.value = normalizeCategoryGroups(data.categoryGroups)
    const previousPlaylistCount = playlists.value.length

    playlists.value = reset ? data.playlists : mergePlaylists(playlists.value, data.playlists)
    playlistsOffset.value = playlists.value.length
    hasMore.value = Boolean(
      data.more &&
      data.playlists.length &&
      (reset || playlists.value.length > previousPlaylistCount)
    )
    activeCategory.value = normalizeCategory({
      id: data.activeCategoryId ?? activeCategory.value.id,
      name: data.activeCategory || activeCategory.value.name
    })
    savePlaylistCategoryCache(categorySnapshot)
  } catch (loadError) {
    if (isAbortError(loadError) || requestId !== playlistRequestId) {
      return
    }

    console.warn('Failed to load playlist discovery:', loadError)
    error.value = loadError
  } finally {
    if (requestId === playlistRequestId && !controller.signal.aborted) {
      if (reset) {
        await waitForMinimumDelay(startedAt, PLAYLIST_SKELETON_MIN_MS)

        if (requestId !== playlistRequestId || controller.signal.aborted) {
          return
        }

        skeletonVisible.value = false
      }

      loading.value = false
      loadingMore.value = false
      nextTick(loadMoreController.setup)
    }

    if (playlistRequestController === controller) {
      playlistRequestController = null
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
      const groupTags = Array.isArray(group.tags) ? group.tags.map(normalizeCategory) : []
      const groupName = getCategoryGroupName(group, groupTags, index)
      const tags = uniqueCategories(groupTags)

      return {
        id: group.id ?? `group-${index}`,
        name: groupName,
        tags
      }
    })
    .filter((group) => group.tags.length)

  return normalizedGroups.length
    ? normalizedGroups
    : [{
        id: 'default',
        name: '全部分类',
        tags: [defaultCategory]
      }]
}

function cloneCategoryGroups(groups = []) {
  return (Array.isArray(groups) ? groups : []).map((group, index) => ({
    id: group.id ?? `group-${index}`,
    name: group.name ?? '',
    tags: Array.isArray(group.tags) ? group.tags.map(normalizeCategory) : []
  }))
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

function getCategoryGroupName(group, tags, index) {
  const rawName = String(group.name || '').trim()

  if (rawName && !/^分类\s*\d+$/i.test(rawName)) {
    return rawName
  }

  const tagNames = tags.map((tag) => tag.name)

  if (hasAnyTag(tagNames, ['学习', '工作', '通勤', '运动', '校园', '旅途', '睡前', '派对', '宅家', '车载'])) {
    return '场景'
  }

  if (hasAnyTag(tagNames, ['国语', '英语', '粤语', '日语', '韩语', '闽南语', '小语种', '法语'])) {
    return '语种'
  }

  if (hasAnyTag(tagNames, ['流行', '古风', '电子', '民谣', '摇滚', '说唱', '后摇', 'R&B', '爵士', '布鲁斯'])) {
    return '风格'
  }

  if (hasAnyTag(tagNames, ['怀旧', '伤感', '安静', '兴奋', '轻松', '治愈', '快乐', '寂寞', '感动', '小清新'])) {
    return '心情'
  }

  if (hasAnyTag(tagNames, ['70后', '80后', '90后', '00后'])) {
    return '年代'
  }

  if (hasAnyTag(tagNames, ['精选', '经典', '网络', '游戏', 'DJ热碟', 'KTV', 'ACG', 'BGM', '官方歌单'])) {
    return '主题'
  }

  return `分类 ${index + 1}`
}

function hasAnyTag(tags, candidates) {
  return candidates.some((candidate) => tags.includes(candidate))
}

function getFeaturedCategory(group) {
  return group?.tags?.find((category) => !isDefaultCategory(category)) || null
}

function isDefaultCategory(category) {
  return categoryKey(category) === categoryKey(defaultCategory)
}

</script>
