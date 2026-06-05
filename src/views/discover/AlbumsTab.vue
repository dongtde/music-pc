<template>
  <section ref="pageRoot" class="discover-page albums-page">
    <div class="filter-row album-filter-row" aria-label="专辑地区">
      <button
        v-for="area in albumAreas"
        :key="area.value"
        type="button"
        :class="{ active: activeArea === area.value }"
        @click="selectArea(area.value)"
      >
        {{ area.label }}
      </button>
    </div>

    <div v-if="loading" class="albums-skeleton" aria-busy="true" aria-label="正在加载专辑">
      <section class="skeleton-section skeleton-section--album-rank">
        <span class="skeleton-title skeleton-title--small" />
        <div class="album-rank-list">
          <article
            v-for="item in ALBUM_RANK_SKELETON_COUNT"
            :key="`album-rank-skeleton-${item}`"
            class="skeleton-album-rank-card"
          >
            <span class="skeleton-cover skeleton-cover--album-rank" />
            <span class="skeleton-line skeleton-line--artist-name" />
            <span class="skeleton-line skeleton-line--artist-meta" />
          </article>
        </div>
      </section>

      <span class="skeleton-title skeleton-title--small" />
      <div class="album-grid">
        <article
          v-for="item in ALBUM_SKELETON_COUNT"
          :key="`album-skeleton-${item}`"
          class="skeleton-playlist-card"
        >
          <span class="skeleton-cover" />
          <span class="skeleton-line skeleton-line--playlist" />
          <span class="skeleton-line skeleton-line--playlist-short" />
        </article>
      </div>
    </div>

    <div v-else-if="error && !albums.length" class="discover-error">
      <strong>专辑加载失败</strong>
      <button type="button" @click="reload">重试</button>
    </div>

    <template v-else>
      <section v-if="topAlbums.length" class="album-rank-panel">
        <h2 class="section-title compact album-rank-title">本周热碟</h2>
        <div class="album-rank-list">
          <router-link
            v-for="album in topAlbums"
            :key="album.id"
            :to="`/album/${album.id}`"
            class="album-rank-row"
          >
            <span class="album-rank-cover">
              <img
                v-if="album.coverUrl"
                :src="album.coverUrl"
                :alt="album.title"
                loading="lazy"
                decoding="async"
              />
              <Disc3 v-else :size="28" />
            </span>
            <strong>{{ album.title }}</strong>
            <small>{{ album.artist }}</small>
          </router-link>
        </div>
      </section>

      <header class="album-library-head">
        <SectionTitle :title="`${activeAreaLabel}新碟`" compact />
        <small v-if="total">共 {{ total }} 张</small>
      </header>

      <template v-if="albums.length">
        <div class="album-grid">
          <router-link
            v-for="album in albums"
            :key="album.id"
            :to="`/album/${album.id}`"
            class="album-card"
          >
            <div class="album-card__cover">
              <img
                v-if="album.coverUrl"
                :src="album.coverUrl"
                :alt="album.title"
                loading="lazy"
                decoding="async"
              />
              <div class="album-card__hover-meta">
                <span>{{ album.typeName }}</span>
                <strong>{{ album.artist }}</strong>
                <small v-if="album.publishTime">{{ album.publishTime }}</small>
                <small v-if="album.songCount">{{ album.songCount }} 首歌</small>
              </div>
              <span class="album-card__play"><Play :size="20" fill="currentColor" /></span>
            </div>
            <strong>{{ album.title }}</strong>
          </router-link>
          <article
            v-for="item in loadingMore ? ALBUM_LOAD_MORE_SKELETON_COUNT : 0"
            :key="`album-load-more-skeleton-${item}`"
            class="skeleton-playlist-card"
          >
            <span class="skeleton-cover" />
            <span class="skeleton-line skeleton-line--playlist" />
            <span class="skeleton-line skeleton-line--playlist-short" />
          </article>
        </div>
        <div
          ref="loadMoreTrigger"
          class="album-scroll-sentinel"
          aria-live="polite"
        >
          <button
            v-if="error && albums.length"
            type="button"
            @click="loadMore({ force: true })"
          >
            加载失败，重试
          </button>
        </div>
      </template>
      <div v-else class="album-empty">暂无专辑数据</div>
    </template>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Disc3, Play } from 'lucide-vue-next'
import SectionTitle from '../../components/SectionTitle.vue'
import { getAlbumsDiscoveryData } from '../../services/netease'

const ALBUM_LIMIT = 36
const ALBUM_SKELETON_COUNT = 18
const ALBUM_RANK_SKELETON_COUNT = 10
const ALBUM_LOAD_MORE_SKELETON_COUNT = 6
const albumAreas = [
  { label: '全部', value: 'ALL' },
  { label: '华语', value: 'ZH' },
  { label: '欧美', value: 'EA' },
  { label: '韩国', value: 'KR' },
  { label: '日本', value: 'JP' }
]

const activeArea = ref('ALL')
const loading = ref(false)
const loadingMore = ref(false)
const error = ref(null)
const topAlbums = ref([])
const albums = ref([])
const total = ref(0)
const hasMore = ref(false)
const albumOffset = ref(0)
const pageRoot = ref(null)
const loadMoreTrigger = ref(null)
let albumRequestId = 0
let loadMoreObserver = null
let loadMoreScrollRoot = null

const activeAreaLabel = computed(() =>
  albumAreas.find((area) => area.value === activeArea.value)?.label || '全部'
)

onMounted(() => {
  loadData({ reset: true })
})

onBeforeUnmount(() => {
  disconnectLoadMoreObserver()
})

function selectArea(area) {
  if (activeArea.value === area) {
    return
  }

  activeArea.value = area
  loadData({ reset: true })
}

function reload() {
  loadData({ reset: true })
}

function loadMore({ force = false } = {}) {
  if (
    loading.value ||
    loadingMore.value ||
    !hasMore.value ||
    (error.value && !force)
  ) {
    return
  }

  loadData({ reset: false })
}

async function loadData({ reset = true } = {}) {
  const requestId = ++albumRequestId

  if (reset) {
    disconnectLoadMoreObserver()
    loading.value = true
    albums.value = []
    albumOffset.value = 0
    hasMore.value = false
  } else {
    loadingMore.value = true
  }

  error.value = null
  const offset = reset ? 0 : albumOffset.value

  try {
    const data = await getAlbumsDiscoveryData({
      area: activeArea.value,
      limit: ALBUM_LIMIT,
      offset
    })

    if (requestId !== albumRequestId) {
      return
    }

    if (reset) {
      topAlbums.value = data.topAlbums
      albums.value = data.albums
    } else {
      albums.value = mergeAlbums(albums.value, data.albums)
    }

    total.value = data.total
    albumOffset.value = albums.value.length
    hasMore.value = data.more
  } catch (loadError) {
    if (requestId !== albumRequestId) {
      return
    }

    console.warn('Failed to load albums:', loadError)
    error.value = loadError
  } finally {
    if (requestId === albumRequestId) {
      loading.value = false
      loadingMore.value = false
      nextTick(setupLoadMoreObserver)
    }
  }
}

function mergeAlbums(currentAlbums, nextAlbums) {
  const seenIds = new Set(currentAlbums.map((album) => album.id))

  return [
    ...currentAlbums,
    ...nextAlbums.filter((album) => {
      if (seenIds.has(album.id)) {
        return false
      }

      seenIds.add(album.id)
      return true
    })
  ]
}

function setupLoadMoreObserver() {
  disconnectLoadMoreObserver()

  if (
    !hasMore.value ||
    (error.value && albums.value.length)
  ) {
    return
  }

  loadMoreScrollRoot = getScrollRoot()

  if (loadMoreScrollRoot) {
    loadMoreScrollRoot.addEventListener('scroll', handleLoadMoreScroll, { passive: true })
  }

  if (loadMoreTrigger.value && typeof IntersectionObserver !== 'undefined') {
    loadMoreObserver = new IntersectionObserver(handleLoadMoreIntersect, {
      root: loadMoreScrollRoot,
      rootMargin: '360px 0px 360px',
      threshold: 0
    })
    loadMoreObserver.observe(loadMoreTrigger.value)
  }

  handleLoadMoreScroll()
}

function handleLoadMoreIntersect(entries) {
  if (entries.some((entry) => entry.isIntersecting)) {
    loadMore()
  }
}

function handleLoadMoreScroll() {
  if (
    loading.value ||
    loadingMore.value ||
    !hasMore.value ||
    (error.value && albums.value.length)
  ) {
    return
  }

  const root = loadMoreScrollRoot || getScrollRoot()

  if (!root) {
    return
  }

  const distanceToBottom = root.scrollHeight - root.scrollTop - root.clientHeight

  if (distanceToBottom <= 360) {
    loadMore()
  }
}

function getScrollRoot() {
  return loadMoreTrigger.value?.closest('.view') || pageRoot.value?.closest('.view') || null
}

function disconnectLoadMoreObserver() {
  if (!loadMoreObserver) {
    if (loadMoreScrollRoot) {
      loadMoreScrollRoot.removeEventListener('scroll', handleLoadMoreScroll)
      loadMoreScrollRoot = null
    }

    return
  }

  loadMoreObserver.disconnect()
  loadMoreObserver = null

  if (loadMoreScrollRoot) {
    loadMoreScrollRoot.removeEventListener('scroll', handleLoadMoreScroll)
    loadMoreScrollRoot = null
  }
}
</script>
