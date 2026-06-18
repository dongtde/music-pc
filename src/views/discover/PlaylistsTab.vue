<template>
  <section class="discover-page playlists-page">
    <div class="playlist-category-board" aria-label="歌单分类">
      <header class="playlist-category-picker__summary">
        <div class="playlist-category-picker__current">
          <span>
            <Tags :size="15" />
            歌单分类
          </span>
          <strong>{{ activeCategory.name }}歌单</strong>
          <small>{{ activeCategoryOwnerGroup?.name || '全部分类' }}</small>
        </div>
        <div class="playlist-category-picker__actions">
          <button
            v-if="!isActiveCategory(defaultCategory)"
            class="playlist-category-reset"
            type="button"
            aria-label="回到全部分类"
            title="回到全部分类"
            @click="selectCategory(defaultCategory)"
          >
            <RotateCcw :size="15" />
          </button>
          <button
            class="playlist-category-toggle"
            type="button"
            :aria-expanded="categoryPanelOpen"
            @click="toggleCategoryPanel"
          >
            <ListFilter :size="16" />
            <span>{{ categoryPanelOpen ? '收起分类' : '切换分类' }}</span>
            <ChevronDown :size="15" :class="{ open: categoryPanelOpen }" />
          </button>
        </div>
      </header>

      <Transition name="playlist-category-panel">
        <div v-if="categoryPanelOpen" class="playlist-category-panel">
          <nav class="playlist-category-groups" aria-label="歌单大分类">
            <button
              v-for="group in visibleCategoryGroups"
              :key="group.id"
              type="button"
              :aria-label="categoryGroupAriaLabel(group)"
              :class="{
                active: isActiveCategoryGroup(group),
                'contains-active': groupContainsActiveCategory(group)
              }"
              @click="selectCategoryGroup(group)"
            >
              <span class="playlist-category-group__mark" aria-hidden="true" />
              <span>{{ group.name }}</span>
              <small>{{ group.tags.length }}</small>
            </button>
          </nav>

          <div class="playlist-category-options">
            <header>
              <strong>{{ activeCategoryGroup?.name || '全部分类' }}</strong>
              <small>{{ activeCategoryGroup?.tags.length || 0 }} 个分类</small>
            </header>
            <div>
              <button
                v-for="category in activeCategoryGroupTags"
                :key="categoryKey(category)"
                type="button"
                :aria-label="`选择${category.name}歌单`"
                :class="{ active: isActiveCategory(category) }"
                @click="selectCategory(category)"
              >
                {{ category.name }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
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
import { ChevronDown, ListFilter, RotateCcw, Tags } from 'lucide-vue-next'
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
const activeGroupId = ref('')
const categoryPanelOpen = ref(true)
const playlists = ref([])
const playlistsOffset = ref(0)
const hasMore = ref(true)
const loadMoreTrigger = ref(null)
let playlistRequestId = 0

const visibleCategoryGroups = computed(() => categoryGroups.value.length
  ? categoryGroups.value
  : [{
      id: 'default',
      name: '全部分类',
      tags: [defaultCategory]
    }]
)
const activeCategoryOwnerGroup = computed(() =>
  isActiveCategory(defaultCategory) ? null : findCategoryGroup(activeCategory.value) || null
)
const activeCategoryGroup = computed(() =>
  visibleCategoryGroups.value.find((group) => String(group.id) === String(activeGroupId.value)) ||
    activeCategoryOwnerGroup.value ||
    visibleCategoryGroups.value[0]
)
const activeCategoryGroupTags = computed(() => activeCategoryGroup.value?.tags ?? [defaultCategory])
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

function toggleCategoryPanel() {
  categoryPanelOpen.value = !categoryPanelOpen.value
}

function selectCategoryGroup(group) {
  activeGroupId.value = group.id
}

function selectCategory(category) {
  const nextCategory = normalizeCategory(category)

  if (categoryKey(activeCategory.value) === categoryKey(nextCategory)) {
    return
  }

  activeCategory.value = nextCategory
  const ownerGroup = findCategoryGroup(nextCategory)

  if (ownerGroup) {
    activeGroupId.value = ownerGroup.id
  }

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
    syncActiveGroup()
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

function isActiveCategoryGroup(group) {
  return String(activeCategoryGroup.value?.id) === String(group.id)
}

function groupContainsActiveCategory(group) {
  return Boolean(group?.tags?.some((category) => isActiveCategory(category)))
}

function findCategoryGroup(category) {
  const key = categoryKey(category)

  return visibleCategoryGroups.value.find((group) =>
    group.tags.some((tag) => categoryKey(tag) === key)
  )
}

function syncActiveGroup() {
  const ownerGroup = findCategoryGroup(activeCategory.value)

  if (!ownerGroup) {
    activeGroupId.value = visibleCategoryGroups.value[0]?.id ?? ''
    return
  }

  if (!activeGroupId.value || ownerGroup.tags.some((tag) => isActiveCategory(tag))) {
    activeGroupId.value = ownerGroup.id
  }
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
      const groupCategory = normalizeCategory({
        id: group.id,
        name: groupName ? `全部${groupName}` : '全部'
      })
      const tags = uniqueCategories([groupCategory, ...groupTags])

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

function categoryGroupAriaLabel(group) {
  return group?.name?.endsWith('分类')
    ? `切换到${group.name}`
    : `切换到${group.name}分类`
}

</script>
