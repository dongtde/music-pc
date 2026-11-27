<template>
  <section ref="artistsPage" class="discover-page artists-page">
    <section
      v-if="skeletonVisible"
      class="artists-skeleton"
      aria-busy="true"
      aria-label="正在加载歌手"
    >
      <section class="skeleton-section skeleton-section--artist-rank">
        <div class="artist-rank-list">
          <article
            v-for="item in ARTIST_RANK_SKELETON_COUNT"
            :key="`artist-rank-skeleton-${item}`"
            class="skeleton-artist-rank-card"
          >
            <span class="skeleton-artist-avatar skeleton-artist-avatar--rank" />
            <span class="skeleton-line skeleton-line--artist-name" />
          </article>
        </div>
      </section>

      <section class="skeleton-section">
        <span class="skeleton-title skeleton-title--small" />
        <div class="artist-grid artist-grid--real">
          <article
            v-for="item in ARTIST_SKELETON_COUNT"
            :key="`artist-skeleton-${item}`"
            class="skeleton-artist-card"
          >
            <span class="skeleton-artist-avatar" />
            <span class="skeleton-line skeleton-line--artist-name" />
            <span class="skeleton-line skeleton-line--artist-meta" />
          </article>
        </div>
      </section>
    </section>
    <div v-else-if="error && !hasArtistContent" class="discover-error">
      <strong>歌手加载失败</strong>
      <button type="button" @click="reload">重试</button>
    </div>
    <section v-else-if="topArtists.length" class="artist-rank-panel">
      <div class="artist-rank-list">
          <router-link
            v-for="artist in topArtists"
            :key="artist.id"
            :to="`/artist/${artist.id}`"
            class="artist-rank-row"
            @focus="prepareArtistCover(artist)"
            @pointerdown.capture="prepareArtistCover(artist)"
            @click.capture="prepareArtistCover(artist)"
          >
            <span class="artist-rank-cover">
              <img
                v-if="artist.coverUrl"
                :src="artist.coverUrl"
                :alt="artist.name"
                loading="lazy"
                decoding="async"
                @load="prepareArtistCover(artist)"
              />
              <Mic2 v-else :size="26" />
              <em>{{ artist.rank }}</em>
            </span>
            <strong>{{ artist.name }}</strong>
          </router-link>
        </div>
      </section>
      <div class="artist-filter-panel" aria-label="歌手筛选">
        <div>
          <strong>语种</strong>
          <button
            v-for="item in areaFilters"
            :key="item.value"
            type="button"
            :class="{ active: filters.area === item.value }"
            @click="setFilter('area', item.value)"
          >
            {{ item.label }}
          </button>
        </div>
        <div>
          <strong>分类</strong>
          <button
            v-for="item in typeFilters"
            :key="item.value"
            type="button"
            :class="{ active: filters.type === item.value }"
            @click="setFilter('type', item.value)"
          >
            {{ item.label }}
          </button>
        </div>
        <div>
          <strong>筛选</strong>
          <button
            v-for="item in initialFilters"
            :key="item.value"
            type="button"
            :class="{ active: filters.initial === item.value }"
            :aria-pressed="filters.initial === item.value"
            @click="setFilter('initial', item.value)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <section
        v-if="!skeletonVisible && !(error && !hasArtistContent)"
        class="artist-library-section"
        id="artist-library"
      >
        <header ref="artistLibraryHead" class="artist-library-head">
          <h2 class="section-title compact artist-library-title">分类歌手</h2>
          <small>{{ loading ? '加载中...' : `${artists.length} 位歌手` }}</small>
        </header>
        <div class="artist-grid artist-grid--real" :aria-busy="loading">
          <router-link
            v-for="artist in artists"
            :key="artist.id"
            :to="`/artist/${artist.id}`"
            class="artist-card"
            @focus="prepareArtistCover(artist)"
            @pointerdown.capture="prepareArtistCover(artist)"
            @click.capture="prepareArtistCover(artist)"
          >
            <span class="artist-avatar artist-avatar--image">
              <img
                v-if="artist.coverUrl"
                :src="artist.coverUrl"
                :alt="artist.name"
                loading="lazy"
                decoding="async"
                @load="prepareArtistCover(artist)"
              />
              <Mic2 v-else :size="34" />
            </span>
            <span class="artist-card__summary">
              <strong>{{ artist.name }}</strong>
              <em>{{ artist.followers }} 关注</em>
            </span>
            <span class="artist-card__details">
              <strong>{{ artist.name }}</strong>
              <small v-for="detail in getArtistDetails(artist)" :key="detail">
                {{ detail }}
              </small>
            </span>
          </router-link>
          <article
            v-for="item in loading ? ARTIST_SKELETON_COUNT : loadingMore ? ARTIST_LOAD_MORE_SKELETON_COUNT : 0"
            :key="`artist-load-more-skeleton-${item}`"
            class="skeleton-artist-card"
          >
            <span class="skeleton-artist-avatar" />
            <span class="skeleton-line skeleton-line--artist-name" />
            <span class="skeleton-line skeleton-line--artist-meta" />
          </article>
        </div>
        <p v-if="!loading && !artists.length && !error" class="artist-library-empty">
          暂无符合条件的歌手
        </p>
        <div
          ref="loadMoreTrigger"
          class="artist-load-more"
          :class="{ 'artist-load-more--sentinel': loadingMore && !error }"
          aria-live="polite"
        >
          <span
            v-if="loading || loadingMore"
            class="artist-load-more__status"
          >
            {{ loading ? '正在加载歌手...' : '正在加载更多歌手...' }}
          </span>
          <button
            v-else-if="error && artists.length"
            type="button"
            @click="loadMore({ force: true })"
          >
            加载失败，重试
          </button>
          <span v-else-if="!hasMore && artists.length">没有更多歌手了</span>
        </div>
      </section>
      <Teleport to="body">
        <nav
          v-if="initialIndexVisible"
          class="artist-initial-index"
          :style="initialIndexStyle"
          aria-label="按首字母筛选歌手"
        >
          <button
            v-for="item in initialFilters"
            :key="item.value"
            type="button"
            :class="{ active: filters.initial === item.value }"
            :aria-label="item.value === -1 ? '热门歌手' : item.value === '#' ? '其他首字母歌手' : `${item.label} 开头的歌手`"
            :aria-pressed="filters.initial === item.value"
            aria-controls="artist-library"
            @click="selectInitial(item.value)"
          >
            {{ item.value === -1 ? '热' : item.label }}
          </button>
        </nav>
      </Teleport>
  </section>
</template>

<script setup>
import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onMounted,
  onDeactivated,
  reactive,
  ref,
  watch,
} from 'vue';
import { Mic2 } from 'lucide-vue-next';
import { useLoadMoreTrigger } from '../../composables/useLoadMoreTrigger';
import { getArtistsDiscoveryData } from '../../services/netease';
import { prepareArtistCover } from '../../utils/artistPreview';
import { createLruCache } from '../../utils/lruCache';
import { isAbortError } from '../../utils/request';
import { waitForMinimumDelay } from '../../utils/time';

const ARTIST_LIMIT = 32;
const ARTIST_SKELETON_COUNT = 20;
const ARTIST_RANK_SKELETON_COUNT = 10;
const ARTIST_LOAD_MORE_SKELETON_COUNT = 8;
const ARTIST_SKELETON_MIN_MS = 360;
const ARTIST_FILTER_CACHE_SIZE = 24;

const areaFilters = [
  { label: '全部', value: -1 },
  { label: '华语', value: 7 },
  { label: '欧美', value: 96 },
  { label: '日本', value: 8 },
  { label: '韩国', value: 16 },
  { label: '其他', value: 0 },
];
const typeFilters = [
  { label: '全部', value: -1 },
  { label: '男歌手', value: 1 },
  { label: '女歌手', value: 2 },
  { label: '乐队组合', value: 3 },
];
const initialFilters = [
  { label: '热门', value: -1 },
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    .split('')
    .map((letter) => ({ label: letter, value: letter.toLowerCase() })),
  { label: '#', value: '#' },
];

const filters = reactive({
  area: -1,
  type: -1,
  initial: -1,
});
const loading = ref(false);
const loadingMore = ref(false);
const skeletonVisible = ref(false);
const error = ref(null);
const artists = ref([]);
const topArtists = ref([]);
const artistsOffset = ref(0);
const hasMore = ref(true);
const artistsPage = ref(null);
const artistLibraryHead = ref(null);
const initialIndexVisible = ref(false);
const initialIndexStyle = ref({});
let artistScrollRoot = null;
let initialIndexResizeObserver = null;
let initialIndexFrame = 0;
const loadMoreTrigger = ref(null);
const hasArtistContent = computed(() =>
  Boolean(artists.value.length || topArtists.value.length),
);
const artistFilterCache = createLruCache(ARTIST_FILTER_CACHE_SIZE);
let artistRequestId = 0;
let artistRequestController = null;
const loadMoreController = useLoadMoreTrigger({
  trigger: loadMoreTrigger,
  canLoad: () => !loading.value && !loadingMore.value && hasMore.value && !error.value,
  loadMore,
  rootMargin: '360px 0px 360px',
  threshold: 0,
});

onMounted(() => {
  loadData({ reset: true });
  setupInitialIndex();
});

onActivated(() => nextTick(setupInitialIndex));
onDeactivated(cleanupInitialIndex);
watch(artistLibraryHead, scheduleInitialIndexUpdate, { flush: 'post' });

onBeforeUnmount(() => {
  cancelArtistRequest();
  cleanupInitialIndex();
});

function setFilter(key, value) {
  if (filters[key] === value) {
    return;
  }

  filters[key] = value;
  loadData({ reset: true });
}

function setupInitialIndex() {
  cleanupInitialIndex();
  artistScrollRoot = artistsPage.value?.closest('.view.discover');

  if (!artistScrollRoot) {
    return;
  }

  artistScrollRoot.addEventListener('scroll', scheduleInitialIndexUpdate, { passive: true });
  window.addEventListener('resize', scheduleInitialIndexUpdate);
  initialIndexResizeObserver = new ResizeObserver(scheduleInitialIndexUpdate);
  initialIndexResizeObserver.observe(artistScrollRoot);
  initialIndexResizeObserver.observe(artistsPage.value);
  scheduleInitialIndexUpdate();
}

function cleanupInitialIndex() {
  artistScrollRoot?.removeEventListener('scroll', scheduleInitialIndexUpdate);
  window.removeEventListener('resize', scheduleInitialIndexUpdate);
  initialIndexResizeObserver?.disconnect();
  initialIndexResizeObserver = null;
  artistScrollRoot = null;
  window.cancelAnimationFrame(initialIndexFrame);
  initialIndexFrame = 0;
  initialIndexVisible.value = false;
}

function scheduleInitialIndexUpdate() {
  if (!initialIndexFrame && artistScrollRoot) {
    initialIndexFrame = window.requestAnimationFrame(updateInitialIndex);
  }
}

function getArtistLibraryTop() {
  const bounds = artistScrollRoot.getBoundingClientRect();
  const tabs = artistScrollRoot.querySelector(':scope > .tabs');
  return Math.max(bounds.top, tabs?.getBoundingClientRect().bottom ?? bounds.top) + 8;
}

function updateInitialIndex() {
  initialIndexFrame = 0;
  const layout = document.documentElement.dataset.layout;

  if (!artistScrollRoot || !artistLibraryHead.value || !['mobile-2d', 'compact-2d'].includes(layout)) {
    initialIndexVisible.value = false;
    return;
  }

  const bounds = artistScrollRoot.getBoundingClientRect();
  const top = getArtistLibraryTop();
  const bottomClearance = parseFloat(window.getComputedStyle(artistScrollRoot).paddingBottom) || 0;
  const availableHeight = Math.max(0, Math.min(bounds.bottom, window.innerHeight) - bottomClearance - top - 8);
  const height = Math.min(560, availableHeight);
  initialIndexVisible.value = artistLibraryHead.value.getBoundingClientRect().top <= top + 1 && height > 0;
  initialIndexStyle.value = {
    top: `${top + (availableHeight - height) / 2}px`,
    height: `${height}px`,
    '--artist-index-right': `${Math.max(4, window.innerWidth - bounds.right + 4)}px`,
  };
}

function selectInitial(value) {
  setFilter('initial', value);
  nextTick(() => {
    if (!artistScrollRoot || !artistLibraryHead.value) {
      return;
    }

    artistScrollRoot.scrollTo({
      top: artistScrollRoot.scrollTop + artistLibraryHead.value.getBoundingClientRect().top - getArtistLibraryTop(),
      behavior: 'instant',
    });
    scheduleInitialIndexUpdate();
  });
}

function reload() {
  loadData({ reset: true, force: true });
}

function loadMore({ force = false } = {}) {
  if (
    loading.value ||
    loadingMore.value ||
    !hasMore.value ||
    (error.value && !force)
  ) {
    return;
  }

  loadData({ reset: false });
}

function getArtistDetails(artist) {
  const details = artist.details?.length
    ? [...artist.details]
    : artist.tag
      ? artist.tag.split(' · ').filter(Boolean)
      : [];

  if (artist.score) {
    details.push(`热度 ${artist.score}`);
  }

  return details.length ? details.slice(0, 3) : ['暂无更多资料'];
}

function cancelArtistRequest() {
  artistRequestId += 1;

  if (!artistRequestController) {
    return;
  }

  artistRequestController.abort();
  artistRequestController = null;
}

function getFilterSnapshot() {
  return {
    area: filters.area,
    type: filters.type,
    initial: filters.initial,
  };
}

function getArtistFilterCacheKey(filterState) {
  return [
    'artists',
    filterState.area,
    filterState.type,
    filterState.initial,
  ].join(':');
}

function restoreArtistFilterCache(filterState) {
  const cached = artistFilterCache.get(getArtistFilterCacheKey(filterState));

  if (!cached) {
    return false;
  }

  loadMoreController.cleanup();
  artists.value = Array.isArray(cached.artists) ? cached.artists.slice() : [];
  topArtists.value = Array.isArray(cached.topArtists) ? cached.topArtists.slice() : [];
  artistsOffset.value = Number(cached.offset) || artists.value.length;
  hasMore.value = Boolean(cached.hasMore);
  loading.value = false;
  loadingMore.value = false;
  skeletonVisible.value = false;
  error.value = null;
  nextTick(loadMoreController.setup);
  return true;
}

function saveArtistFilterCache(filterState) {
  artistFilterCache.set(getArtistFilterCacheKey(filterState), {
    artists: artists.value.slice(),
    topArtists: topArtists.value.slice(),
    offset: artistsOffset.value,
    hasMore: hasMore.value,
  });
}

async function loadData({ reset = false, force = false } = {}) {
  const startedAt = Date.now();
  const filterSnapshot = getFilterSnapshot();
  cancelArtistRequest();

  if (reset && !force && restoreArtistFilterCache(filterSnapshot)) {
    return;
  }

  const requestId = ++artistRequestId;
  const controller = new AbortController();
  artistRequestController = controller;

  if (reset) {
    loadMoreController.cleanup();
    loading.value = true;
    loadingMore.value = false;
    skeletonVisible.value = !hasArtistContent.value;
    artists.value = [];
    artistsOffset.value = 0;
    hasMore.value = true;
  } else {
    loadingMore.value = true;
  }

  error.value = null;
  const offset = reset ? 0 : artistsOffset.value;

  try {
    const data = await getArtistsDiscoveryData({
      ...filterSnapshot,
      limit: ARTIST_LIMIT,
      offset,
    }, {
      signal: controller.signal,
    });

    if (requestId !== artistRequestId || controller.signal.aborted) {
      return;
    }

    artists.value = reset
      ? data.artists
      : mergeArtists(artists.value, data.artists);
    artistsOffset.value = offset + data.artists.length;
    hasMore.value = Boolean(data.artists.length && data.more);
    topArtists.value = data.topArtists.length
      ? data.topArtists
      : topArtists.value;
    saveArtistFilterCache(filterSnapshot);
  } catch (loadError) {
    if (isAbortError(loadError) || requestId !== artistRequestId) {
      return;
    }

    console.warn('Failed to load artists:', loadError);
    error.value = loadError;
  } finally {
    if (requestId === artistRequestId && !controller.signal.aborted) {
      if (reset) {
        await waitForMinimumDelay(startedAt, ARTIST_SKELETON_MIN_MS);

        if (requestId !== artistRequestId || controller.signal.aborted) {
          return;
        }

        skeletonVisible.value = false;
      }

      loading.value = false;
      loadingMore.value = false;
      nextTick(loadMoreController.setup);
    }

    if (artistRequestController === controller) {
      artistRequestController = null;
    }
  }
}

function mergeArtists(currentArtists, nextArtists) {
  const seenIds = new Set(currentArtists.map((artist) => artist.id));

  return [
    ...currentArtists,
    ...nextArtists.filter((artist) => {
      if (seenIds.has(artist.id)) {
        return false;
      }

      seenIds.add(artist.id);
      return true;
    }),
  ];
}

</script>
