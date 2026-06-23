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
import { useLoadMoreTrigger } from '../../composables/useLoadMoreTrigger'
import { getAlbumsDiscoveryData } from '../../services/netease'
import { createLruCache } from '../../utils/lruCache'
import { isAbortError } from '../../utils/request'

const ALBUM_LIMIT = 24
const ALBUM_SKELETON_COUNT = 12
const ALBUM_RANK_SKELETON_COUNT = 10
const ALBUM_LOAD_MORE_SKELETON_COUNT = 6
const ALBUM_AREA_CACHE_SIZE = 12
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
const albumAreaCache = createLruCache(ALBUM_AREA_CACHE_SIZE)
let albumRequestId = 0
let albumRequestController = null
const loadMoreController = useLoadMoreTrigger({
  trigger: loadMoreTrigger,
  canLoad: () =>
    !loading.value &&
    !loadingMore.value &&
    hasMore.value &&
    !(error.value && albums.value.length),
  loadMore,
  getRoot: getScrollRoot,
  rootMargin: '360px 0px 360px',
  scrollThreshold: 360,
  threshold: 0
})

const activeAreaLabel = computed(() =>
  albumAreas.find((area) => area.value === activeArea.value)?.label || '全部'
)

onMounted(() => {
  loadData({ reset: true })
})

onBeforeUnmount(() => {
  cancelAlbumRequest()
})

function selectArea(area) {
  if (activeArea.value === area) {
    return
  }

  activeArea.value = area
  loadData({ reset: true })
}

function reload() {
  loadData({ reset: true, force: true })
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

function cancelAlbumRequest() {
  albumRequestId += 1

  if (!albumRequestController) {
    return
  }

  albumRequestController.abort()
  albumRequestController = null
}

function restoreAlbumAreaCache(area) {
  const cached = albumAreaCache.get(getAlbumAreaCacheKey(area))

  if (!cached) {
    return false
  }

  loadMoreController.cleanup()
  topAlbums.value = Array.isArray(cached.topAlbums) ? cached.topAlbums.slice() : []
  albums.value = Array.isArray(cached.albums) ? cached.albums.slice() : []
  total.value = Number(cached.total) || 0
  albumOffset.value = Number(cached.offset) || albums.value.length
  hasMore.value = Boolean(cached.hasMore)
  loading.value = false
  loadingMore.value = false
  error.value = null
  nextTick(loadMoreController.setup)
  return true
}

function saveAlbumAreaCache(area) {
  albumAreaCache.set(getAlbumAreaCacheKey(area), {
    topAlbums: topAlbums.value.slice(),
    albums: albums.value.slice(),
    total: total.value,
    offset: albumOffset.value,
    hasMore: hasMore.value
  })
}

function getAlbumAreaCacheKey(area) {
  return `albums:${area}`
}

async function loadData({ reset = true, force = false } = {}) {
  const areaSnapshot = activeArea.value
  cancelAlbumRequest()

  if (reset && !force && restoreAlbumAreaCache(areaSnapshot)) {
    return
  }

  const requestId = ++albumRequestId
  const controller = new AbortController()
  albumRequestController = controller

  if (reset) {
    loadMoreController.cleanup()
    loading.value = true
    loadingMore.value = false
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
      area: areaSnapshot,
      limit: ALBUM_LIMIT,
      offset
    }, {
      signal: controller.signal
    })

    if (requestId !== albumRequestId || controller.signal.aborted) {
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
    saveAlbumAreaCache(areaSnapshot)
  } catch (loadError) {
    if (isAbortError(loadError) || requestId !== albumRequestId) {
      return
    }

    console.warn('Failed to load albums:', loadError)
    error.value = loadError
  } finally {
    if (requestId === albumRequestId && !controller.signal.aborted) {
      loading.value = false
      loadingMore.value = false
      nextTick(loadMoreController.setup)
    }

    if (albumRequestController === controller) {
      albumRequestController = null
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

function getScrollRoot() {
  return loadMoreTrigger.value?.closest('.view') || pageRoot.value?.closest('.view') || null
}
</script>
