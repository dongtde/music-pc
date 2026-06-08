<template>
  <section class="discover-page">
    <section
      v-if="isHomeLoading"
      class="home-skeleton"
      aria-busy="true"
      aria-label="Loading home content"
    >
      <div class="skeleton-hero">
        <span class="skeleton-pill skeleton-line--tag" />
        <span class="skeleton-line skeleton-line--hero-title" />
        <span class="skeleton-line skeleton-line--hero-copy" />
        <span class="skeleton-line skeleton-line--hero-copy skeleton-line--hero-copy-short" />
        <span class="skeleton-button" />
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
            v-for="item in 4"
            :key="`radio-skeleton-${item}`"
            class="skeleton-radio-card"
          >
            <span class="skeleton-radio-icon" />
            <span class="skeleton-radio-lines">
              <span class="skeleton-line skeleton-line--song" />
              <span class="skeleton-line skeleton-line--meta" />
              <span class="skeleton-line skeleton-line--meta skeleton-line--radio-count" />
            </span>
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
            v-for="slide in page"
            :key="slide.id"
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
          :to="{ name: 'video', query: { mvId: mv.id } }"
          class="mv-card"
        >
          <div class="mv-cover" :class="`cover--${mv.type}`">
            <img
              v-if="mv.coverUrl"
              class="mv-cover__image"
              :src="mv.coverUrl"
              :alt="mv.title"
              loading="lazy"
              decoding="async"
            />
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
      <SectionTitle title="推荐电台" />
      <div class="radio-grid">
        <router-link
          v-for="radio in recommendedRadios"
          :key="radio.id"
          :to="`/playlist/radio-${radio.id}`"
          class="radio-card"
        >
          <span class="radio-card__icon">
            <Radio :size="24" />
          </span>
          <strong>{{ radio.title }}</strong>
          <small>{{ radio.desc }}</small>
          <em>{{ radio.listeners }}</em>
        </router-link>
      </div>
    </section>
    </template>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import {
  ChevronLeft,
  ChevronRight,
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
import { getHomeDiscoverData } from '../../services/netease';
import { usePlayerStore } from '../../stores/player';

const HOME_SKELETON_MIN_MS = 360;
const RECOMMENDED_SINGLE_DISPLAY_LIMIT = 12;
const HERO_SLIDES_PER_PAGE = 3;
const RECOMMEND_CAROUSEL_ROWS = 2;
const LATEST_CAROUSEL_ROWS = 1;
const PLAYLIST_CAROUSEL_SMALL_QUERY = '(max-width: 1400px)';

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
const isHomeLoading = ref(true);
const playlistCarouselColumns = ref(6);
const recommendCarouselPageIndex = ref(0);
const latestCarouselPageIndex = ref(0);
const recommendPlaylistTrack = ref(null);
const latestPlaylistTrack = ref(null);
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
let heroTimer;
let playlistCarouselMediaQuery;

function chunkItems(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
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

  if (heroLastIndex.value <= 0) {
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

  const queue = [
    track,
    ...homeRecommendedSingles.value.filter(
      (song) => String(song.id) !== String(track.id)
    ),
  ];

  player.setQueue(queue);

  if (String(player.state.currentTrack.id) === String(track.id)) {
    await player.togglePlay();
    return;
  }

  heroActionLoadingId.value = slide.id;

  try {
    const played = await player.playTrack(track);

    if (!played) {
      message.error(player.state.error?.message || '当前歌曲暂时无法播放');
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
  });
}

function syncPlaylistCarouselColumns(event) {
  const matches =
    event?.matches ??
    playlistCarouselMediaQuery?.matches ??
    window.matchMedia(PLAYLIST_CAROUSEL_SMALL_QUERY).matches;

  playlistCarouselColumns.value = matches ? 5 : 6;
  clampPlaylistCarouselPages();
  syncPlaylistCarouselScrollPositions();
}

function setupPlaylistCarouselColumns() {
  playlistCarouselMediaQuery = window.matchMedia(PLAYLIST_CAROUSEL_SMALL_QUERY);
  syncPlaylistCarouselColumns();
  playlistCarouselMediaQuery.addEventListener('change', syncPlaylistCarouselColumns);
}

function teardownPlaylistCarouselColumns() {
  playlistCarouselMediaQuery?.removeEventListener('change', syncPlaylistCarouselColumns);
  playlistCarouselMediaQuery = undefined;
}

async function loadHomeData() {
  const startedAt = Date.now();

  isHomeLoading.value = true;

  try {
    const data = await getHomeDiscoverData();
    heroSlides.value = data.heroSlides.length
      ? data.heroSlides
      : fallbackHeroSlides;
    recommendPlaylists.value = data.recommendPlaylists.length
      ? data.recommendPlaylists
      : fallbackRecommendPlaylists;
    latestPlaylistCards.value = data.latestPlaylistCards.length
      ? data.latestPlaylistCards
      : fallbackLatestPlaylistCards;
    homeRecommendedSingles.value = data.recommendedSingles.length
      ? data.recommendedSingles
      : recommendedSingles;
    homeRecommendedMvs.value = data.recommendedMvs.length
      ? data.recommendedMvs
      : recommendedMvs;
    activeHeroIndex.value = 0;
    clampPlaylistCarouselPages();
  } catch (error) {
    console.warn('Failed to load home data from Netease API:', error);
  } finally {
    player.setQueue(homeRecommendedSingles.value);
    await waitForSkeleton(startedAt);
    isHomeLoading.value = false;
    syncPlaylistCarouselScrollPositions();
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
  player.setQueue(homeRecommendedSingles.value);

  if (player.state.currentTrack.id === song.id) {
    player.togglePlay();
    return;
  }

  player.playTrack(song);
}

onMounted(() => {
  setupPlaylistCarouselColumns();
  startHeroAutoplay();
  loadHomeData();
});
onUnmounted(() => {
  stopHeroAutoplay();
  teardownPlaylistCarouselColumns();
});
</script>
