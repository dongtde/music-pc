<template>
  <section
    ref="recommendPage"
    class="discover-page recommend-page"
    :style="playlistCarouselStyle"
  >
    <section
      v-if="isHomeLoading"
      class="home-skeleton"
      aria-busy="true"
      aria-label="Loading home content"
    >
      <div class="skeleton-hero">
        <article
          v-for="item in 2"
          :key="`hero-skeleton-${item}`"
          class="skeleton-hero-card"
        >
          <span class="skeleton-hero-card__tag" />
        </article>
      </div>

      <section class="skeleton-section">
        <div class="section-head recommend-carousel-head">
          <span class="skeleton-title" />
          <span
            v-if="recommendSkeletonCarouselNeeded"
            class="recommend-carousel-actions recommend-carousel-actions--skeleton"
          >
            <span class="skeleton-carousel-button" />
          </span>
        </div>
        <div class="recommend-carousel recommend-carousel--skeleton">
          <div class="recommend-carousel__skeleton-track">
            <article
              v-for="item in 12"
              :key="`recommend-skeleton-${item}`"
              class="skeleton-playlist-card"
            >
              <span class="skeleton-cover" />
              <span class="skeleton-line skeleton-line--playlist" />
              <span class="skeleton-line skeleton-line--playlist-short" />
            </article>
          </div>
        </div>
      </section>

      <section class="skeleton-section">
        <div class="section-head recommend-carousel-head">
          <span class="skeleton-title skeleton-title--small" />
          <span
            v-if="latestSkeletonCarouselNeeded"
            class="recommend-carousel-actions recommend-carousel-actions--skeleton"
          >
            <span class="skeleton-carousel-button" />
          </span>
        </div>
        <div class="recommend-carousel recommend-carousel--skeleton">
          <div class="recommend-carousel__skeleton-track recommend-carousel__skeleton-track--latest">
            <article
              v-for="item in 6"
              :key="`latest-skeleton-${item}`"
              class="skeleton-playlist-card"
            >
              <span class="skeleton-cover" />
              <span class="skeleton-line skeleton-line--playlist" />
            </article>
          </div>
        </div>
      </section>

      <section class="skeleton-section">
        <span class="skeleton-title skeleton-title--small" />
        <div class="media-grid">
          <article
            v-for="item in 5"
            :key="`mv-skeleton-${item}`"
            class="skeleton-mv-card"
          >
            <span class="skeleton-mv-cover" />
            <span class="skeleton-line skeleton-line--playlist" />
            <span class="skeleton-line skeleton-line--meta" />
          </article>
        </div>
      </section>

      <section class="skeleton-section">
        <div class="section-head">
          <span class="skeleton-title skeleton-title--small" />
          <span class="skeleton-tabs" />
        </div>
        <div class="song-list song-list--recommend">
          <article
            v-for="item in 12"
            :key="`song-skeleton-${item}`"
            class="skeleton-song-row"
          >
            <span class="skeleton-song-thumb" />
            <span class="skeleton-song-lines">
              <span class="skeleton-line skeleton-line--song" />
              <span class="skeleton-line skeleton-line--meta" />
            </span>
            <span class="skeleton-line skeleton-line--duration" />
          </article>
        </div>
      </section>

      <section class="skeleton-section">
        <span class="skeleton-title skeleton-title--small" />
        <div class="radio-grid">
          <article
            v-for="item in visibleRecommendedRadioLimit"
            :key="`radio-skeleton-${item}`"
            class="skeleton-radio-card"
          >
            <span class="skeleton-radio-cover" />
            <span class="skeleton-line skeleton-line--playlist" />
            <span class="skeleton-line skeleton-line--meta" />
          </article>
        </div>
      </section>
    </section>

    <template v-else>
    <section
      class="hero"
      @mouseenter="stopHeroAutoplay"
      @mouseleave="startHeroAutoplay"
    >
      <div
        class="hero__track"
        :style="{ transform: `translateX(-${activeHeroIndex * 100}%)` }"
      >
        <div
          v-for="(page, pageIndex) in heroPages"
          :key="`hero-page-${pageIndex}`"
          class="hero__page"
        >
          <article
            v-for="(slide, slideIndex) in page"
            :key="`${slide.id}-${pageIndex}-${slideIndex}`"
            class="hero__slide"
            :class="`hero__slide--${slide.tone}`"
            role="button"
            tabindex="0"
            @click="handleHeroSlideClick(slide)"
            @keydown.enter.prevent="handleHeroSlideClick(slide)"
            @keydown.space.prevent="handleHeroSlideClick(slide)"
          >
            <img
              v-if="slide.imageUrl"
              class="hero__image"
              :src="slide.imageUrl"
              :alt="slide.title"
              loading="lazy"
              decoding="async"
            />
            <div v-if="!slide.imageUrl" class="hero__visual" aria-hidden="true">
              <span class="hero__disc" />
              <span class="hero__ring hero__ring--one" />
              <span class="hero__ring hero__ring--two" />
            </div>
            <div class="hero__content">
              <span class="tag">{{ slide.tag }}</span>
            </div>
          </article>
        </div>
      </div>

      <button
        class="hero__arrow hero__arrow--prev"
        type="button"
        aria-label="上一张"
        @click="prevHeroSlide"
      >
        <ChevronLeft :size="22" />
      </button>
      <button
        class="hero__arrow hero__arrow--next"
        type="button"
        aria-label="下一张"
        @click="nextHeroSlide"
      >
        <ChevronRight :size="22" />
      </button>

      <div class="hero__dots" aria-label="轮播图切换">
        <button
          v-for="(page, index) in heroPages"
          :key="`hero-dot-${index}`"
          type="button"
          :class="{ active: activeHeroIndex === index }"
          :aria-label="`切换到第 ${index + 1} 页`"
          @click="setHeroSlide(index)"
        />
      </div>
    </section>

    <div class="section-head recommend-carousel-head">
      <SectionTitle title="推荐歌单" compact />
      <div
        v-if="recommendCarouselNeeded"
        class="recommend-carousel-actions"
        aria-label="推荐歌单翻页"
      >
        <button
          v-if="recommendCarouselPageIndex > 0"
          class="recommend-carousel-button"
          type="button"
          aria-label="上一组推荐歌单"
          @click="moveRecommendCarousel(-1)"
        >
          <ChevronLeft :size="18" />
        </button>
        <button
          v-if="recommendCarouselPageIndex < recommendCarouselLastPage"
          class="recommend-carousel-button"
          type="button"
          aria-label="下一组推荐歌单"
          @click="moveRecommendCarousel(1)"
        >
          <ChevronRight :size="18" />
        </button>
      </div>
    </div>
    <div class="recommend-carousel">
      <div
        ref="recommendPlaylistTrack"
        class="recommend-carousel__track"
        aria-label="推荐歌单列表"
      >
        <PlaylistCard
          v-for="playlist in recommendPlaylists"
          :key="playlist.id"
          :playlist="playlist"
        />
      </div>
    </div>

    <section class="latest-section">
      <div class="section-head recommend-carousel-head">
        <SectionTitle title="最新歌单" compact />
        <div
          v-if="latestCarouselNeeded"
          class="recommend-carousel-actions"
          aria-label="最新歌单翻页"
        >
          <button
            v-if="latestCarouselPageIndex > 0"
            class="recommend-carousel-button"
            type="button"
            aria-label="上一组最新歌单"
            @click="moveLatestCarousel(-1)"
          >
            <ChevronLeft :size="18" />
          </button>
          <button
            v-if="latestCarouselPageIndex < latestCarouselLastPage"
            class="recommend-carousel-button"
            type="button"
            aria-label="下一组最新歌单"
            @click="moveLatestCarousel(1)"
          >
            <ChevronRight :size="18" />
          </button>
        </div>
      </div>
      <div class="recommend-carousel">
        <div
          ref="latestPlaylistTrack"
          class="recommend-carousel__track recommend-carousel__track--latest"
          aria-label="最新歌单列表"
        >
          <PlaylistCard
            v-for="playlist in latestPlaylistCards"
            :key="playlist.id"
            :playlist="playlist"
          />
        </div>
      </div>
    </section>

    <section class="latest-section">
      <SectionTitle title="推荐 MV" />
      <div class="media-grid">
        <router-link
          v-for="mv in homeRecommendedMvs"
          :key="mv.id"
          :to="getRecommendedMvRouteTarget(mv)"
          class="mv-card"
          @pointerdown="stopRecommendedMvPreview(mv)"
          @click="stopRecommendedMvPreview(mv)"
          @mouseenter="queueRecommendedMvPreview(mv)"
          @mouseleave="stopRecommendedMvPreview(mv)"
        >
          <div
            class="mv-cover"
            :class="[
              `cover--${mv.type}`,
              getRecommendedMvPreviewCoverClass(mv)
            ]"
          >
            <img
              v-if="mv.coverUrl"
              class="mv-cover__image"
              :src="mv.coverUrl"
              :alt="mv.title"
              loading="lazy"
              decoding="async"
            />
            <video
              v-if="isRecommendedMvPreviewActive(mv) && recommendedMvPreviewState.url"
              ref="recommendedMvPreviewVideo"
              class="mv-cover__preview"
              :class="{ 'is-ready': isRecommendedMvPreviewReady(mv) }"
              :src="recommendedMvPreviewState.url"
              muted
              autoplay
              loop
              playsinline
              preload="auto"
              disablepictureinpicture
              @loadeddata="handleRecommendedMvPreviewReady(mv, $event)"
              @canplay="handleRecommendedMvPreviewReady(mv, $event)"
              @error="handleRecommendedMvPreviewError(mv, $event)"
            />
            <span
              v-if="isRecommendedMvPreviewLoading(mv)"
              class="mv-preview-loading"
              aria-hidden="true"
            >
              <LoaderCircle :size="18" class="mv-preview-spin" />
            </span>
            <span class="mv-hover-bg" aria-hidden="true" />
            <span class="mv-play">
              <Play :size="18" fill="currentColor" />
            </span>
            <em>{{ mv.duration }}</em>
          </div>
          <strong>{{ mv.title }}</strong>
          <small>{{ mv.artist }}</small>
        </router-link>
      </div>
    </section>

    <section class="latest-section">
      <div class="section-head">
        <SectionTitle title="推荐单曲" compact />
      </div>
      <div class="song-list song-list--recommend">
        <SongListRow
          v-for="song in visibleRecommendedSingles"
          :key="song.id ?? song.rank"
          :track="song"
          compact
          @play="playRecommendedSong"
        />
      </div>
    </section>

    <section class="latest-section">
      <div class="section-head recommend-carousel-head">
        <SectionTitle title="推荐电台" compact />
        <div
          v-if="radioCarouselNeeded"
          class="recommend-carousel-actions"
          aria-label="推荐电台翻页"
        >
          <button
            v-if="radioCarouselPageIndex > 0"
            class="recommend-carousel-button"
            type="button"
            aria-label="上一组推荐电台"
            @click="moveRadioCarousel(-1)"
          >
            <ChevronLeft :size="18" />
          </button>
          <button
            v-if="radioCarouselPageIndex < radioCarouselLastPage"
            class="recommend-carousel-button"
            type="button"
            aria-label="下一组推荐电台"
            @click="moveRadioCarousel(1)"
          >
            <ChevronRight :size="18" />
          </button>
        </div>
      </div>
      <div class="radio-carousel">
        <div
          ref="recommendedRadioTrack"
          class="radio-grid radio-grid--carousel"
          aria-label="推荐电台列表"
        >
          <router-link
            v-for="radio in homeRecommendedRadios"
            :key="radio.id"
            :to="radio.to || `/podcast/${radio.id}`"
            class="radio-card"
          >
            <span class="radio-cover" :class="`cover--${radio.type}`">
              <img
                v-if="radio.coverUrl"
                class="radio-cover__image"
                :src="radio.coverUrl"
                :alt="radio.title"
                loading="lazy"
                decoding="async"
              />
              <span v-else class="radio-cover__fallback" aria-hidden="true">
                <Radio :size="28" />
              </span>
              <span class="radio-hover-bg" aria-hidden="true" />
              <span class="radio-play">
                <Play :size="18" fill="currentColor" />
              </span>
            </span>
            <strong>{{ radio.title }}</strong>
            <small>{{ radio.description || radio.desc }}</small>
          </router-link>
        </div>
      </div>
    </section>
    </template>
  </section>
</template>

<script setup>
import {
  computed,
  nextTick,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  ref
} from 'vue';
import { useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Play,
  Radio,
} from 'lucide-vue-next';
import PlaylistCard from '../../components/PlaylistCard.vue';
import SectionTitle from '../../components/SectionTitle.vue';
import SongListRow from '../../components/SongListRow.vue';
import {
  curatedPlaylists,
  playlists,
  recommendedMvs,
  recommendedRadios,
  recommendedSingles,
} from '../../data/music';
import { getHomeDiscoverData, getMvPlaybackUrlData } from '../../services/netease';
import { usePlayerStore } from '../../stores/player';
import { createLruCache } from '../../utils/lruCache';
import { createMvRouteQuery } from '../../utils/mv';
import { getPlaybackErrorDisplay } from '../../utils/playbackError';
import { isAbortError } from '../../utils/request';

const HOME_SKELETON_MIN_MS = 360;
const HOME_PARTIAL_RETRY_DELAY_MS = 900;
const HOME_PARTIAL_RETRY_TIMEOUT_MS = 12000;
const HOME_PARTIAL_RETRY_LIMIT = 2;
const RECOMMENDED_SINGLE_DISPLAY_LIMIT = 12;
const HERO_SLIDES_PER_PAGE = 2;
const RECOMMEND_CAROUSEL_ROWS = 2;
const LATEST_CAROUSEL_ROWS = 1;
const PLAYLIST_CAROUSEL_COMPACT_WIDTH = 1180;
const PLAYLIST_CAROUSEL_COMPACT_COLUMNS = 5;
const PLAYLIST_CAROUSEL_WIDE_COLUMNS = 6;
const PLAYLIST_CAROUSEL_COMPACT_GAP = 16;
const PLAYLIST_CAROUSEL_WIDE_GAP = 22;

const player = usePlayerStore();
const router = useRouter();
const message = useMessage();
const fallbackRecommendPlaylists = [
  ...playlists,
  ...curatedPlaylists.slice(playlists.length),
].slice(0, 12);
const fallbackLatestPlaylistCards = curatedPlaylists.slice(-6);
const recommendPlaylists = ref(fallbackRecommendPlaylists);
const latestPlaylistCards = ref(fallbackLatestPlaylistCards);
const homeRecommendedSingles = ref(recommendedSingles);
const visibleRecommendedSingles = computed(() =>
  homeRecommendedSingles.value.slice(0, RECOMMENDED_SINGLE_DISPLAY_LIMIT)
);
const homeRecommendedMvs = ref(recommendedMvs);
const homeRecommendedRadios = ref(recommendedRadios);
const recommendPage = ref(null);
const recommendedMvPreviewVideo = ref(null);
const isHomeLoading = ref(true);
const playlistCarouselColumns = ref(6);
const playlistCarouselGap = computed(() =>
  playlistCarouselColumns.value >= PLAYLIST_CAROUSEL_WIDE_COLUMNS
    ? PLAYLIST_CAROUSEL_WIDE_GAP
    : PLAYLIST_CAROUSEL_COMPACT_GAP
);
const playlistCarouselStyle = computed(() => {
  const columns = playlistCarouselColumns.value;
  const gap = playlistCarouselGap.value;
  const gapOffset = (gap * (columns - 1)) / columns;

  return {
    '--recommend-carousel-column-width': `calc(${(100 / columns).toFixed(4)}% - ${gapOffset.toFixed(3)}px)`,
    '--recommend-carousel-column-gap': `${gap}px`
  };
});
const visibleRecommendedRadioLimit = computed(() => playlistCarouselColumns.value);
const recommendCarouselPageIndex = ref(0);
const latestCarouselPageIndex = ref(0);
const radioCarouselPageIndex = ref(0);
const recommendPlaylistTrack = ref(null);
const latestPlaylistTrack = ref(null);
const recommendedRadioTrack = ref(null);
const fallbackHeroSlides = [
  {
    id: 'exclusive',
    tag: '独家首发',
    title: '探索无限音乐宇宙',
    desc: '每周更新，为你定制专属听觉盛宴',
    action: '立即播放',
    link: '/playlist/1',
    tone: 'neon',
  },
  {
    id: 'daily',
    tag: '每日推荐',
    title: '今天从一首好歌开始',
    desc: '根据你的偏好挑选旋律，通勤、工作、夜晚都刚刚好',
    action: '查看歌单',
    link: '/playlist/2',
    tone: 'sunset',
  },
  {
    id: 'live',
    tag: '现场精选',
    title: '把舞台灯光装进口袋',
    desc: '高能现场、氛围电音和乐队新声，一键进入沉浸模式',
    action: '去听现场',
    link: '/playlist/3',
    tone: 'stage',
  },
];
const heroSlides = ref(fallbackHeroSlides);
const activeHeroIndex = ref(0);
const heroActionLoadingId = ref('');
const heroPages = computed(() => chunkItems(heroSlides.value, HERO_SLIDES_PER_PAGE));
const heroLastIndex = computed(() => Math.max(heroPages.value.length - 1, 0));
const recommendCarouselPageStarts = computed(() =>
  getPlaylistCarouselPageStarts(
    recommendPlaylists.value.length,
    RECOMMEND_CAROUSEL_ROWS,
    playlistCarouselColumns.value
  )
);
const recommendCarouselLastPage = computed(() =>
  Math.max(recommendCarouselPageStarts.value.length - 1, 0)
);
const recommendCarouselNeeded = computed(() => recommendCarouselLastPage.value > 0);
const latestCarouselPageStarts = computed(() =>
  getPlaylistCarouselPageStarts(
    latestPlaylistCards.value.length,
    LATEST_CAROUSEL_ROWS,
    playlistCarouselColumns.value
  )
);
const latestCarouselLastPage = computed(() =>
  Math.max(latestCarouselPageStarts.value.length - 1, 0)
);
const latestCarouselNeeded = computed(() => latestCarouselLastPage.value > 0);
const radioCarouselPageStarts = computed(() =>
  getPlaylistCarouselPageStarts(
    homeRecommendedRadios.value.length,
    LATEST_CAROUSEL_ROWS,
    playlistCarouselColumns.value
  )
);
const radioCarouselLastPage = computed(() =>
  Math.max(radioCarouselPageStarts.value.length - 1, 0)
);
const radioCarouselNeeded = computed(() => radioCarouselLastPage.value > 0);
const recommendSkeletonCarouselNeeded = computed(
  () =>
    getPlaylistCarouselPageStarts(12, RECOMMEND_CAROUSEL_ROWS, playlistCarouselColumns.value)
      .length > 1
);
const latestSkeletonCarouselNeeded = computed(
  () =>
    getPlaylistCarouselPageStarts(6, LATEST_CAROUSEL_ROWS, playlistCarouselColumns.value)
      .length > 1
);
const recommendedMvPreviewState = ref({
  id: '',
  key: '',
  url: '',
  loading: false,
  ready: false,
  error: ''
});
let heroTimer;
let playlistCarouselResizeObserver;
let playlistCarouselResizeFrame = 0;
let recommendedMvPreviewTimer = 0;
let recommendedMvPreviewController = null;
let recommendedMvPreviewElement = null;
let isRecommendTabActive = false;
let hasAppliedHomeData = false;
let homeDataLoadSequence = 0;
let partialHomeRetryTimer = 0;
let partialHomeRetryCount = 0;
const recommendedMvPreviewCache = createLruCache(18);
const RECOMMENDED_MV_PREVIEW_DELAY_MS = 420;
const RECOMMENDED_MV_PREVIEW_QUALITY = 720;

function chunkItems(items, size) {
  const sourceItems = items.filter(Boolean);
  const chunks = [];

  for (let index = 0; index < sourceItems.length; index += size) {
    const page = sourceItems.slice(index, index + size);

    for (let fillIndex = 0; page.length < size; fillIndex += 1) {
      page.push(sourceItems[fillIndex % sourceItems.length]);
    }

    chunks.push(page);
  }

  return chunks.length ? chunks : [[]];
}

function setHeroSlide(index) {
  activeHeroIndex.value = Math.min(Math.max(index, 0), heroLastIndex.value);
  startHeroAutoplay();
}

function nextHeroSlide() {
  activeHeroIndex.value =
    activeHeroIndex.value === heroLastIndex.value
      ? 0
      : activeHeroIndex.value + 1;
  startHeroAutoplay();
}

function prevHeroSlide() {
  activeHeroIndex.value =
    activeHeroIndex.value === 0
      ? heroLastIndex.value
      : activeHeroIndex.value - 1;
  startHeroAutoplay();
}

function startHeroAutoplay() {
  stopHeroAutoplay();

  if (!isRecommendTabActive || heroLastIndex.value <= 0) {
    return;
  }

  heroTimer = window.setInterval(() => {
    activeHeroIndex.value =
      activeHeroIndex.value === heroLastIndex.value
        ? 0
        : activeHeroIndex.value + 1;
  }, 4800);
}

function stopHeroAutoplay() {
  if (heroTimer) {
    window.clearInterval(heroTimer);
    heroTimer = undefined;
  }
}

async function handleHeroSlideClick(slide) {
  if (!slide) {
    return;
  }

  if (slide.targetKind === 'song') {
    await playHeroSong(slide);
    startHeroAutoplay();
    return;
  }

  if (slide.link) {
    router.push(slide.link);
    return;
  }

  if (slide.externalUrl) {
    window.open(slide.externalUrl, '_blank', 'noopener');
    return;
  }

  message.info('这条推荐暂时无法打开');
}

async function playHeroSong(slide) {
  if (heroActionLoadingId.value) {
    return;
  }

  const track = slide.target ?? createHeroTrack(slide);

  if (!track?.id) {
    message.error('这条推荐暂时无法播放');
    return;
  }

  if (String(player.state.currentTrack.id) === String(track.id)) {
    await player.togglePlay();
    return;
  }

  heroActionLoadingId.value = slide.id;

  try {
    const played = await player.playTrack(track);
    if (played) {
      player.appendToQueue(track, { type: 'discover-hero', id: slide.id });
    }

    if (!played) {
      message.error(getPlaybackErrorDisplay(player.state.error, '当前歌曲暂时无法播放'));
    }
  } finally {
    heroActionLoadingId.value = '';
  }
}

function createHeroTrack(slide) {
  return {
    id: slide.targetId,
    name: slide.title,
    artist: slide.desc,
    album: slide.tag,
    rank: '01',
    type: slide.tone,
    coverUrl: slide.imageUrl,
    time: '0:00',
    duration: '0:00'
  };
}

function getRecommendedMvRouteTarget(mv = {}) {
  const query = createMvRouteQuery(
    {
      mvId: mv.id,
      mvHash: mv.mvHash || mv.hash
    },
    mv
  );

  return query ? { name: 'video', query } : { name: 'video' };
}

function getRecommendedMvPreviewKey(mv = {}) {
  const id = String(mv?.id ?? mv?.mvId ?? mv?.mvid ?? mv?.vid ?? mv?.hash ?? mv?.mvHash ?? '');
  const hash = String(mv?.hash ?? mv?.mvHash ?? '');

  return id ? `${id}:${hash || 'auto'}:${RECOMMENDED_MV_PREVIEW_QUALITY}` : '';
}

function canPreviewRecommendedMv(mv = {}) {
  return Boolean(mv?.coverUrl && getRecommendedMvPreviewKey(mv));
}

function getRecommendedMvPreviewCoverClass(mv = {}) {
  return {
    'is-previewing': isRecommendedMvPreviewActive(mv),
    'is-preview-loading': isRecommendedMvPreviewLoading(mv),
    'is-preview-ready': isRecommendedMvPreviewReady(mv)
  };
}

function isRecommendedMvPreviewActive(mv = {}) {
  const key = getRecommendedMvPreviewKey(mv);

  return Boolean(key && recommendedMvPreviewState.value.key === key);
}

function isRecommendedMvPreviewLoading(mv = {}) {
  return isRecommendedMvPreviewActive(mv) && recommendedMvPreviewState.value.loading;
}

function isRecommendedMvPreviewReady(mv = {}) {
  return isRecommendedMvPreviewActive(mv) && recommendedMvPreviewState.value.ready;
}

function queueRecommendedMvPreview(mv = {}) {
  if (typeof window === 'undefined' || !canPreviewRecommendedMv(mv)) {
    return;
  }

  const key = getRecommendedMvPreviewKey(mv);

  if (
    recommendedMvPreviewState.value.key === key &&
    (recommendedMvPreviewState.value.loading || recommendedMvPreviewState.value.url)
  ) {
    return;
  }

  stopRecommendedMvPreview();

  recommendedMvPreviewState.value = {
    id: String(mv.id ?? mv.hash ?? ''),
    key,
    url: '',
    loading: true,
    ready: false,
    error: ''
  };

  const cachedPlaybackUrl = recommendedMvPreviewCache.get(key);

  if (cachedPlaybackUrl?.url) {
    applyRecommendedMvPreviewUrl(cachedPlaybackUrl, key);
    return;
  }

  recommendedMvPreviewTimer = window.setTimeout(() => {
    recommendedMvPreviewTimer = 0;
    loadRecommendedMvPreview(mv, key);
  }, RECOMMENDED_MV_PREVIEW_DELAY_MS);
}

async function loadRecommendedMvPreview(mv = {}, key = getRecommendedMvPreviewKey(mv)) {
  if (!key || recommendedMvPreviewState.value.key !== key) {
    return;
  }

  const controller = new AbortController();
  recommendedMvPreviewController = controller;

  try {
    const playbackUrl = await getMvPlaybackUrlData(
      mv.id,
      RECOMMENDED_MV_PREVIEW_QUALITY,
      mv,
      { signal: controller.signal }
    );

    if (controller.signal.aborted || recommendedMvPreviewState.value.key !== key) {
      return;
    }

    if (playbackUrl?.url) {
      recommendedMvPreviewCache.set(key, playbackUrl);
      applyRecommendedMvPreviewUrl(playbackUrl, key);
    } else {
      markRecommendedMvPreviewError(key);
    }
  } catch (error) {
    if (!isAbortError(error)) {
      console.debug('Failed to load recommend MV preview:', error);
      markRecommendedMvPreviewError(key);
    }
  } finally {
    if (recommendedMvPreviewController === controller) {
      recommendedMvPreviewController = null;
    }
  }
}

function applyRecommendedMvPreviewUrl(playbackUrl, key) {
  if (recommendedMvPreviewState.value.key !== key) {
    return;
  }

  const url = normalizePreviewVideoUrl(playbackUrl?.url);

  if (!url) {
    markRecommendedMvPreviewError(key);
    return;
  }

  recommendedMvPreviewState.value = {
    ...recommendedMvPreviewState.value,
    url,
    loading: true,
    ready: false,
    error: ''
  };
  nextTick(() => playRecommendedMvPreviewVideo(key));
}

function handleRecommendedMvPreviewReady(mv = {}, event) {
  if (!isRecommendedMvPreviewActive(mv)) {
    return;
  }

  recommendedMvPreviewElement = event?.target ?? recommendedMvPreviewElement;
  recommendedMvPreviewState.value = {
    ...recommendedMvPreviewState.value,
    loading: false,
    ready: true,
    error: ''
  };
  playRecommendedMvPreviewVideo(recommendedMvPreviewState.value.key);
}

function handleRecommendedMvPreviewError(mv = {}, event) {
  const video = event?.target;

  if (video && !video.currentSrc && !video.src) {
    return;
  }

  if (isRecommendedMvPreviewActive(mv)) {
    markRecommendedMvPreviewError(recommendedMvPreviewState.value.key);
  }
}

async function playRecommendedMvPreviewVideo(key) {
  await nextTick();

  if (recommendedMvPreviewState.value.key !== key || !recommendedMvPreviewState.value.url) {
    return;
  }

  const video = getRecommendedMvPreviewVideoElement();

  if (!video) {
    return;
  }

  recommendedMvPreviewElement = video;
  video.muted = true;
  video.volume = 0;

  try {
    await video.play();
  } catch (error) {
    if (recommendedMvPreviewState.value.key === key) {
      recommendedMvPreviewState.value = {
        ...recommendedMvPreviewState.value,
        loading: false
      };
    }
  }
}

function getRecommendedMvPreviewVideoElement() {
  return Array.isArray(recommendedMvPreviewVideo.value)
    ? recommendedMvPreviewVideo.value.find(Boolean) ?? null
    : recommendedMvPreviewVideo.value;
}

function markRecommendedMvPreviewError(key) {
  if (recommendedMvPreviewState.value.key !== key) {
    return;
  }

  recommendedMvPreviewState.value = {
    ...recommendedMvPreviewState.value,
    loading: false,
    ready: false,
    error: 'preview-failed'
  };
}

function stopRecommendedMvPreview(mv = null) {
  if (mv && !isRecommendedMvPreviewActive(mv)) {
    return;
  }

  cancelRecommendedMvPreviewTimer();

  if (recommendedMvPreviewController) {
    recommendedMvPreviewController.abort();
    recommendedMvPreviewController = null;
  }

  releaseRecommendedMvPreviewVideo();
  resetRecommendedMvPreviewState();
}

function cancelRecommendedMvPreviewTimer() {
  if (recommendedMvPreviewTimer && typeof window !== 'undefined') {
    window.clearTimeout(recommendedMvPreviewTimer);
    recommendedMvPreviewTimer = 0;
  }
}

function releaseRecommendedMvPreviewVideo() {
  const video = recommendedMvPreviewElement ?? getRecommendedMvPreviewVideoElement();

  if (!video) {
    recommendedMvPreviewElement = null;
    return;
  }

  try {
    if (!video.paused) {
      video.pause();
    }

    video.removeAttribute('src');
    video.load();
  } catch (error) {
    console.debug('Failed to release recommend MV preview:', error);
  } finally {
    recommendedMvPreviewElement = null;
  }
}

function resetRecommendedMvPreviewState() {
  recommendedMvPreviewState.value = {
    id: '',
    key: '',
    url: '',
    loading: false,
    ready: false,
    error: ''
  };
}

function normalizePreviewVideoUrl(url) {
  if (typeof url !== 'string') {
    return '';
  }

  const value = url.trim();

  if (!value) {
    return '';
  }

  return value.startsWith('//') ? `https:${value}` : value;
}

function getPlaylistCarouselPageStarts(itemCount, rows, visibleColumns) {
  const totalColumns = Math.ceil(itemCount / rows);
  const maxStartColumn = Math.max(totalColumns - visibleColumns, 0);
  const starts = [];

  for (
    let startColumn = 0;
    startColumn <= maxStartColumn;
    startColumn += visibleColumns
  ) {
    starts.push(startColumn);
  }

  if (!starts.length) {
    return [0];
  }

  if (starts[starts.length - 1] !== maxStartColumn) {
    starts.push(maxStartColumn);
  }

  return starts;
}

function clampPlaylistCarouselPages() {
  recommendCarouselPageIndex.value = Math.min(
    recommendCarouselPageIndex.value,
    recommendCarouselLastPage.value
  );
  latestCarouselPageIndex.value = Math.min(
    latestCarouselPageIndex.value,
    latestCarouselLastPage.value
  );
  radioCarouselPageIndex.value = Math.min(
    radioCarouselPageIndex.value,
    radioCarouselLastPage.value
  );
}

function moveRecommendCarousel(direction) {
  recommendCarouselPageIndex.value = Math.min(
    Math.max(recommendCarouselPageIndex.value + direction, 0),
    recommendCarouselLastPage.value
  );
  scrollPlaylistCarouselToPage(
    recommendPlaylistTrack.value,
    recommendCarouselPageStarts.value,
    recommendCarouselPageIndex.value,
    true
  );
}

function moveLatestCarousel(direction) {
  latestCarouselPageIndex.value = Math.min(
    Math.max(latestCarouselPageIndex.value + direction, 0),
    latestCarouselLastPage.value
  );
  scrollPlaylistCarouselToPage(
    latestPlaylistTrack.value,
    latestCarouselPageStarts.value,
    latestCarouselPageIndex.value,
    true
  );
}

function moveRadioCarousel(direction) {
  radioCarouselPageIndex.value = Math.min(
    Math.max(radioCarouselPageIndex.value + direction, 0),
    radioCarouselLastPage.value
  );
  scrollPlaylistCarouselToPage(
    recommendedRadioTrack.value,
    radioCarouselPageStarts.value,
    radioCarouselPageIndex.value,
    true
  );
}

function getPlaylistCarouselScrollLeft(track, startColumn) {
  const styles = window.getComputedStyle(track);
  const columnGap = Number.parseFloat(styles.columnGap) || 0;
  const columnWidth =
    (track.clientWidth - columnGap * (playlistCarouselColumns.value - 1)) /
    playlistCarouselColumns.value;

  return startColumn * (columnWidth + columnGap);
}

function scrollPlaylistCarouselToPage(track, pageStarts, pageIndex, smooth = false) {
  if (!track) {
    return;
  }

  track.scrollTo({
    left: getPlaylistCarouselScrollLeft(track, pageStarts[pageIndex] ?? 0),
    behavior: smooth ? 'smooth' : 'auto',
  });
}

function syncPlaylistCarouselScrollPositions(smooth = false) {
  nextTick(() => {
    scrollPlaylistCarouselToPage(
      recommendPlaylistTrack.value,
      recommendCarouselPageStarts.value,
      recommendCarouselPageIndex.value,
      smooth
    );
    scrollPlaylistCarouselToPage(
      latestPlaylistTrack.value,
      latestCarouselPageStarts.value,
      latestCarouselPageIndex.value,
      smooth
    );
    scrollPlaylistCarouselToPage(
      recommendedRadioTrack.value,
      radioCarouselPageStarts.value,
      radioCarouselPageIndex.value,
      smooth
    );
  });
}

function syncPlaylistCarouselColumns(width = getPlaylistCarouselContainerWidth()) {
  const nextColumns = width < PLAYLIST_CAROUSEL_COMPACT_WIDTH
    ? PLAYLIST_CAROUSEL_COMPACT_COLUMNS
    : PLAYLIST_CAROUSEL_WIDE_COLUMNS;

  if (playlistCarouselColumns.value === nextColumns) {
    syncPlaylistCarouselScrollPositions();
    return;
  }

  playlistCarouselColumns.value = nextColumns;
  clampPlaylistCarouselPages();
  syncPlaylistCarouselScrollPositions();
}

function setupPlaylistCarouselColumns() {
  syncPlaylistCarouselColumns();

  if (typeof ResizeObserver === 'undefined' || !recommendPage.value) {
    window.addEventListener('resize', handlePlaylistCarouselResize);
    return;
  }

  playlistCarouselResizeObserver = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect?.width ?? getPlaylistCarouselContainerWidth();

    schedulePlaylistCarouselColumnSync(width);
  });
  playlistCarouselResizeObserver.observe(recommendPage.value);
}

function teardownPlaylistCarouselColumns() {
  playlistCarouselResizeObserver?.disconnect();
  playlistCarouselResizeObserver = undefined;
  window.removeEventListener('resize', handlePlaylistCarouselResize);

  if (playlistCarouselResizeFrame) {
    window.cancelAnimationFrame(playlistCarouselResizeFrame);
    playlistCarouselResizeFrame = 0;
  }
}

function getPlaylistCarouselContainerWidth() {
  return recommendPage.value?.clientWidth || window.innerWidth || PLAYLIST_CAROUSEL_COMPACT_WIDTH;
}

function handlePlaylistCarouselResize() {
  schedulePlaylistCarouselColumnSync();
}

function schedulePlaylistCarouselColumnSync(width = getPlaylistCarouselContainerWidth()) {
  if (playlistCarouselResizeFrame) {
    window.cancelAnimationFrame(playlistCarouselResizeFrame);
  }

  playlistCarouselResizeFrame = window.requestAnimationFrame(() => {
    playlistCarouselResizeFrame = 0;
    syncPlaylistCarouselColumns(width);
  });
}

async function loadHomeData(options = {}) {
  const loadSequence = ++homeDataLoadSequence;
  const startedAt = Date.now();
  const preserveExisting = options.preserveExisting ?? hasAppliedHomeData;

  clearPartialHomeDataRetry();
  stopRecommendedMvPreview();

  if (!preserveExisting) {
    isHomeLoading.value = true;
  }

  try {
    const data = await getHomeDiscoverData({ timeoutMs: options.timeoutMs });

    if (loadSequence !== homeDataLoadSequence) {
      return;
    }

    applyHomeData(data, { preserveExisting });
    hasAppliedHomeData = true;

    if (data.partial) {
      schedulePartialHomeDataRetry();
    } else {
      partialHomeRetryCount = 0;
    }
  } catch (error) {
    console.warn('Failed to load home data from Netease API:', error);
  } finally {
    if (loadSequence !== homeDataLoadSequence) {
      return;
    }

    if (!preserveExisting) {
      await waitForSkeleton(startedAt);
    }

    isHomeLoading.value = false;
    syncPlaylistCarouselScrollPositions();
  }
}

function applyHomeData(data = {}, { preserveExisting = false } = {}) {
  const hasIncomingHeroSlides = data.heroSlides?.length;

  heroSlides.value = pickHomeDataSection(
    data.heroSlides,
    fallbackHeroSlides,
    heroSlides.value,
    preserveExisting
  );
  recommendPlaylists.value = pickHomeDataSection(
    data.recommendPlaylists,
    fallbackRecommendPlaylists,
    recommendPlaylists.value,
    preserveExisting
  );
  latestPlaylistCards.value = pickHomeDataSection(
    data.latestPlaylistCards,
    fallbackLatestPlaylistCards,
    latestPlaylistCards.value,
    preserveExisting
  );
  homeRecommendedSingles.value = pickHomeDataSection(
    data.recommendedSingles,
    recommendedSingles,
    homeRecommendedSingles.value,
    preserveExisting
  );
  homeRecommendedMvs.value = pickHomeDataSection(
    data.recommendedMvs,
    recommendedMvs,
    homeRecommendedMvs.value,
    preserveExisting
  );
  homeRecommendedRadios.value = pickHomeDataSection(
    data.recommendedRadios,
    recommendedRadios,
    homeRecommendedRadios.value,
    preserveExisting
  );

  if (!preserveExisting || hasIncomingHeroSlides) {
    activeHeroIndex.value = 0;
  }

  clampPlaylistCarouselPages();
}

function pickHomeDataSection(incomingItems, fallbackItems, currentItems, preserveExisting) {
  if (Array.isArray(incomingItems) && incomingItems.length) {
    return incomingItems;
  }

  if (preserveExisting && Array.isArray(currentItems) && currentItems.length) {
    return currentItems;
  }

  return fallbackItems;
}

function schedulePartialHomeDataRetry() {
  if (
    typeof window === 'undefined' ||
    !isRecommendTabActive ||
    partialHomeRetryCount >= HOME_PARTIAL_RETRY_LIMIT
  ) {
    return;
  }

  partialHomeRetryCount += 1;
  partialHomeRetryTimer = window.setTimeout(() => {
    partialHomeRetryTimer = 0;
    loadHomeData({
      preserveExisting: true,
      timeoutMs: HOME_PARTIAL_RETRY_TIMEOUT_MS
    });
  }, HOME_PARTIAL_RETRY_DELAY_MS);
}

function clearPartialHomeDataRetry() {
  if (partialHomeRetryTimer && typeof window !== 'undefined') {
    window.clearTimeout(partialHomeRetryTimer);
    partialHomeRetryTimer = 0;
  }
}

function waitForSkeleton(startedAt) {
  const remaining = HOME_SKELETON_MIN_MS - (Date.now() - startedAt);

  if (remaining <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    window.setTimeout(resolve, remaining);
  });
}

function playRecommendedSong(song) {
  player.setQueue(homeRecommendedSingles.value, { type: 'discover-recommend', id: 'singles' });

  if (player.state.currentTrack.id === song.id) {
    player.togglePlay();
    return;
  }

  player.playTrack(song);
}

function activateRecommendTab() {
  isRecommendTabActive = true;
  startHeroAutoplay();
  syncPlaylistCarouselScrollPositions();
}

function deactivateRecommendTab() {
  isRecommendTabActive = false;
  stopHeroAutoplay();
  stopRecommendedMvPreview();
  clearPartialHomeDataRetry();
}

onMounted(() => {
  isRecommendTabActive = true;
  setupPlaylistCarouselColumns();
  activateRecommendTab();
  loadHomeData();
});
onActivated(() => {
  activateRecommendTab();
});
onDeactivated(() => {
  deactivateRecommendTab();
});
onUnmounted(() => {
  homeDataLoadSequence += 1;
  deactivateRecommendTab();
  teardownPlaylistCarouselColumns();
});
</script>
