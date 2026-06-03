<template>
  <section class="discover-page">
    <section
      class="hero"
      @mouseenter="stopHeroAutoplay"
      @mouseleave="startHeroAutoplay"
    >
      <div
        class="hero__track"
        :style="{ transform: `translateX(-${activeHeroIndex * 100}%)` }"
      >
        <article
          v-for="slide in heroSlides"
          :key="slide.id"
          class="hero__slide"
          :class="`hero__slide--${slide.tone}`"
        >
          <img
            v-if="slide.imageUrl"
            class="hero__image"
            :src="slide.imageUrl"
            :alt="slide.title"
            loading="lazy"
          />
          <div v-if="!slide.imageUrl" class="hero__visual" aria-hidden="true">
            <span class="hero__disc" />
            <span class="hero__ring hero__ring--one" />
            <span class="hero__ring hero__ring--two" />
          </div>
          <div class="hero__content">
            <span class="tag">{{ slide.tag }}</span>
            <h1>{{ slide.title }}</h1>
            <p>{{ slide.desc }}</p>
            <router-link class="hero__play" :to="slide.link">
              <Play :size="18" fill="currentColor" />
              <span>{{ slide.action }}</span>
            </router-link>
          </div>
        </article>
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
          v-for="(slide, index) in heroSlides"
          :key="slide.id"
          type="button"
          :class="{ active: activeHeroIndex === index }"
          :aria-label="`切换到${slide.title}`"
          @click="setHeroSlide(index)"
        />
      </div>
    </section>

    <SectionTitle title="推荐歌单" />
    <div class="playlist-grid playlist-grid--recommend">
      <PlaylistCard
        v-for="playlist in recommendPlaylists"
        :key="playlist.id"
        :playlist="playlist"
      />
    </div>

    <section class="latest-section">
      <SectionTitle title="最新歌单" />
      <div class="playlist-grid playlist-grid--latest">
        <PlaylistCard
          v-for="playlist in latestPlaylistCards"
          :key="playlist.id"
          :playlist="playlist"
        />
      </div>
    </section>

    <section class="latest-section">
      <SectionTitle title="推荐 MV" />
      <div class="media-grid">
        <router-link
          v-for="mv in homeRecommendedMvs"
          :key="mv.id"
          :to="`/playlist/mv-${mv.id}`"
          class="mv-card"
        >
          <div class="mv-cover" :class="`cover--${mv.type}`">
            <img
              v-if="mv.coverUrl"
              class="mv-cover__image"
              :src="mv.coverUrl"
              :alt="mv.title"
              loading="lazy"
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
        <div class="genre-tabs">
          <button type="button">华语</button>
          <button type="button">欧美</button>
          <button type="button">日韩</button>
          <button type="button">摇滚</button>
        </div>
      </div>
      <div class="song-list song-list--recommend">
        <button
          v-for="song in homeRecommendedSingles"
          :key="song.rank"
          type="button"
          class="song-row song-row--recommend"
          :class="{ 'is-playing': isCurrentSong(song) }"
          @click="playRecommendedSong(song)"
        >
          <div class="song-thumb" :class="`cover--${song.type}`">
            <img
              v-if="song.coverUrl"
              class="song-thumb__image"
              :src="song.coverUrl"
              :alt="song.name"
              loading="lazy"
            />
            <span
              class="song-thumb-play"
              :class="{ 'song-thumb-play--playing': isCurrentSong(song) }"
              aria-label="播放单曲"
            >
              <AudioLines v-if="isCurrentSong(song)" :size="16" />
              <Play v-else :size="15" fill="currentColor" />
            </span>
          </div>
          <span class="song-main">
            <strong>{{ song.name }}</strong>
            <small>{{ song.artist }}</small>
          </span>
          <span class="song-meta">
            <small class="song-duration">{{ song.time }}</small>
          </span>
        </button>
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
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import {
  AudioLines,
  ChevronLeft,
  ChevronRight,
  Play,
  Radio,
} from 'lucide-vue-next';
import PlaylistCard from '../../components/PlaylistCard.vue';
import SectionTitle from '../../components/SectionTitle.vue';
import {
  curatedPlaylists,
  playlists,
  recommendedMvs,
  recommendedRadios,
  recommendedSingles,
} from '../../data/music';
import { getHomeDiscoverData } from '../../services/netease';
import { usePlayerStore } from '../../stores/player';

const player = usePlayerStore();
const fallbackRecommendPlaylists = [
  ...playlists,
  ...curatedPlaylists.slice(playlists.length),
].slice(0, 12);
const fallbackLatestPlaylistCards = curatedPlaylists.slice(-6);
const recommendPlaylists = ref(fallbackRecommendPlaylists);
const latestPlaylistCards = ref(fallbackLatestPlaylistCards);
const homeRecommendedSingles = ref(recommendedSingles);
const homeRecommendedMvs = ref(recommendedMvs);
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
const heroLastIndex = computed(() => heroSlides.value.length - 1);
let heroTimer;

function setHeroSlide(index) {
  activeHeroIndex.value = index;
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

async function loadHomeData() {
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
    player.setQueue(homeRecommendedSingles.value);
    activeHeroIndex.value = 0;
  } catch (error) {
    console.warn('Failed to load home data from Netease API:', error);
  }
}

function playRecommendedSong(song) {
  if (player.state.currentTrack.id === song.id) {
    player.togglePlay();
    return;
  }

  player.playTrack(song);
}

function isCurrentSong(song) {
  return player.state.currentTrack.id === song.id && player.state.isPlaying;
}

onMounted(() => {
  startHeroAutoplay();
  loadHomeData();
});
onUnmounted(stopHeroAutoplay);
</script>
