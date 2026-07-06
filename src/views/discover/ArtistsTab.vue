<template>
  <section class="discover-page artists-page">
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
          @click="setFilter('initial', item.value)"
        >
          {{ item.label }}
        </button>
      </div>
    </div>

    <section
      v-if="skeletonVisible"
      class="artists-skeleton"
      aria-busy="true"
      aria-label="正在加载歌手"
    >
      <section class="skeleton-section skeleton-section--artist-rank">
        <span class="skeleton-title skeleton-title--small" />
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
    <template v-else>
      <section v-if="topArtists.length" class="artist-rank-panel">
        <h2 class="section-title compact artist-rank-title">热榜歌手</h2>
        <div class="artist-rank-list">
          <router-link
            v-for="artist in topArtists"
            :key="artist.id"
            :to="`/artist/${artist.id}`"
            class="artist-rank-row"
          >
            <span class="artist-rank-cover">
              <img
                v-if="artist.coverUrl"
                :src="artist.coverUrl"
                :alt="artist.name"
                loading="lazy"
                decoding="async"
              />
              <Mic2 v-else :size="26" />
              <em>{{ artist.rank }}</em>
            </span>
            <strong>{{ artist.name }}</strong>
          </router-link>
        </div>
      </section>

      <section class="artist-library-section">
        <header class="artist-library-head">
          <h2 class="section-title compact artist-library-title">分类歌手</h2>
          <small>{{ artists.length }} 位歌手</small>
        </header>
        <div class="artist-grid artist-grid--real">
          <router-link
            v-for="artist in artists"
            :key="artist.id"
            :to="`/artist/${artist.id}`"
            class="artist-card"
          >
            <span class="artist-avatar artist-avatar--image">
              <img
                v-if="artist.coverUrl"
                :src="artist.coverUrl"
                :alt="artist.name"
                loading="lazy"
                decoding="async"
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
            v-for="item in loadingMore ? ARTIST_LOAD_MORE_SKELETON_COUNT : 0"
            :key="`artist-load-more-skeleton-${item}`"
            class="skeleton-artist-card"
          >
            <span class="skeleton-artist-avatar" />
            <span class="skeleton-line skeleton-line--artist-name" />
            <span class="skeleton-line skeleton-line--artist-meta" />
          </article>
        </div>
        <div
          ref="loadMoreTrigger"
          class="artist-load-more"
          :class="{ 'artist-load-more--sentinel': loadingMore && !error }"
          aria-live="polite"
        >
          <span
            v-if="loadingMore"
            class="artist-load-more__status"
          >
            正在加载更多歌手...
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
    </template>
  </section>
</template>

<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from 'vue';
import { Mic2 } from 'lucide-vue-next';
import { useLoadMoreTrigger } from '../../composables/useLoadMoreTrigger';
import { getArtistsDiscoveryData } from '../../services/netease';
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
    .slice(0, 10)
    .map((letter) => ({ label: letter, value: letter.toLowerCase() })),
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
});

onBeforeUnmount(() => {
  cancelArtistRequest();
});

function setFilter(key, value) {
  if (filters[key] === value) {
    return;
  }

  filters[key] = value;
  loadData({ reset: true });
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
    skeletonVisible.value = true;
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
