<template>
  <div ref="pageRoot" class="view artist-detail" @scroll.passive="scheduleArtistSongsRangeUpdate">
    <section
      v-if="isLoading"
      class="artist-detail-skeleton"
      aria-busy="true"
      aria-label="正在加载歌手详情"
    >
      <section class="artist-detail-skeleton__hero">
        <span class="artist-detail-skeleton__cover" />
        <div class="artist-detail-skeleton__content">
          <span class="artist-detail-skeleton__line artist-detail-skeleton__line--title" />
          <span class="artist-detail-skeleton__line artist-detail-skeleton__line--alias" />
          <span class="artist-detail-skeleton__line artist-detail-skeleton__line--description" />
          <div class="artist-detail-skeleton__chips">
            <span v-for="item in 4" :key="`artist-meta-skeleton-${item}`" />
          </div>
          <div class="artist-detail-skeleton__chips artist-detail-skeleton__chips--tags">
            <span v-for="item in 5" :key="`artist-tag-skeleton-${item}`" />
          </div>
        </div>
      </section>

      <section class="artist-detail-skeleton__table">
        <span class="artist-detail-skeleton__line artist-detail-skeleton__line--section" />
        <div class="artist-detail-skeleton__rows">
          <span
            v-for="item in ARTIST_DETAIL_TRACK_SKELETON_COUNT"
            :key="`artist-track-skeleton-${item}`"
          />
        </div>
      </section>
    </section>

    <template v-else>
      <section class="artist-detail-hero">
        <div class="artist-detail-cover" :class="`artist-detail-cover--${artist.type}`">
          <img
            v-if="artist.coverUrl || artist.avatarUrl"
            class="artist-detail-cover__image"
            :src="artist.coverUrl || artist.avatarUrl"
            :alt="artist.name"
            loading="lazy"
            decoding="async"
          />
        </div>

        <div class="artist-detail-hero__content">
          <h1>{{ artist.name }}</h1>
          <div v-if="artist.aliases.length" class="artist-detail-aliases">
            {{ artist.aliases.join(' / ') }}
          </div>

          <div
            v-if="artist.description"
            class="artist-detail-description-wrap"
            :data-full-text="artist.description"
          >
            <p class="artist-detail-description">{{ artist.description }}</p>
          </div>

          <div v-if="artistProfileItems.length" class="artist-detail-meta artist-detail-meta--profile">
            <span v-for="item in artistProfileItems" :key="item.key">
              <component :is="item.icon" :size="14" />
              {{ item.text }}
            </span>
          </div>

          <div v-if="artistTags.length" class="artist-detail-tags">
            <span v-for="tag in artistTags" :key="tag">{{ tag }}</span>
          </div>
        </div>
      </section>

      <div v-if="errorMessage" class="artist-detail-state artist-detail-state--error">
        {{ errorMessage }}
      </div>

      <div class="artist-tab-bar">
        <nav class="artist-detail-tabs" aria-label="歌手内容">
          <button
            v-for="tab in artistTabs"
            :key="tab.value"
            type="button"
            :class="{ active: activeTab === tab.value }"
            :aria-selected="activeTab === tab.value"
            @click="selectArtistTab(tab.value)"
          >
            {{ tab.label }}<template v-if="tab.count">{{ formatStat(tab.count) }}</template>
          </button>
        </nav>

        <div v-if="activeTab === 'songs'" class="artist-sort-tabs" aria-label="歌曲排序">
          <button
            type="button"
            :class="{ active: artistSongOrder === 'hot' }"
            @click="setArtistSongOrder('hot')"
          >
            热门
          </button>
          <button
            type="button"
            :class="{ active: artistSongOrder === 'time' }"
            @click="setArtistSongOrder('time')"
          >
            时间
          </button>
        </div>
      </div>

      <section class="artist-tab-panel">
        <template v-if="activeTab === 'featured'">
          <section class="artist-detail-section artist-detail-section--featured-tracks">
            <header class="artist-detail-section__head">
              <h2>热门歌曲</h2>
              <small>{{ artistTracks.length }} 首</small>
            </header>

            <section class="playlist-table artist-track-table" aria-label="歌手热门歌曲列表">
              <header class="playlist-table__head">
                <span>标题</span>
                <span>专辑</span>
                <span>时长</span>
              </header>

              <SongListRow
                v-for="track in artistTracks"
                :key="track.id"
                :track="track"
                @play="playFeaturedTrack"
              />
            </section>
          </section>

          <section v-if="tabLoading.albums && !tabLoaded.albums" class="artist-detail-section artist-detail-section--featured-albums">
            <header class="artist-detail-section__head">
              <h2>最新专辑</h2>
            </header>

            <div class="artist-album-grid artist-album-grid--featured artist-album-grid--skeleton">
              <article
                v-for="item in 6"
                :key="`featured-album-skeleton-${item}`"
                class="artist-tab-skeleton__media-card"
              >
                <span class="artist-tab-skeleton__cover artist-tab-skeleton__cover--album" />
                <span class="artist-tab-skeleton__line artist-tab-skeleton__line--card-title" />
                <span class="artist-tab-skeleton__line artist-tab-skeleton__line--card-meta" />
              </article>
            </div>
          </section>
          <section v-else-if="featuredAlbums.length" class="artist-detail-section artist-detail-section--featured-albums">
            <header class="artist-detail-section__head">
              <h2>最新专辑</h2>
              <small>{{ featuredAlbums.length }} 张</small>
            </header>

            <div class="artist-album-grid artist-album-grid--featured">
              <RouterLink
                v-for="album in featuredAlbums"
                :key="album.id"
                class="artist-album-card"
                :to="`/album/${album.id}`"
              >
                <span class="artist-album-card__cover" :class="`artist-album-card__cover--${album.type}`">
                  <img
                    v-if="album.coverUrl"
                    :src="album.coverUrl"
                    :alt="album.title"
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                <strong>{{ album.title }}</strong>
                <small>{{ album.desc || album.publishTime }}</small>
              </RouterLink>
            </div>
          </section>

          <section v-if="tabLoading.videos && !tabLoaded.videos" class="artist-detail-section">
            <header class="artist-detail-section__head">
              <h2>热门视频</h2>
            </header>

            <div class="artist-video-grid artist-video-grid--featured artist-video-grid--skeleton">
              <article
                v-for="item in 6"
                :key="`featured-video-skeleton-${item}`"
                class="artist-tab-skeleton__media-card"
              >
                <span class="artist-tab-skeleton__cover artist-tab-skeleton__cover--video" />
                <span class="artist-tab-skeleton__line artist-tab-skeleton__line--card-title" />
                <span class="artist-tab-skeleton__line artist-tab-skeleton__line--card-meta" />
              </article>
            </div>
          </section>
          <section v-else-if="featuredVideos.length" class="artist-detail-section">
            <header class="artist-detail-section__head">
              <h2>热门视频</h2>
              <small>{{ featuredVideos.length }} 个</small>
            </header>

            <div class="artist-video-grid artist-video-grid--featured">
              <ArtistVideoCard
                v-for="video in featuredVideos"
                :key="video.id"
                :video="video"
              />
            </div>
          </section>
        </template>

        <template v-else-if="activeTab === 'songs'">
          <section class="artist-detail-section">
            <section class="playlist-table artist-track-table" aria-label="歌手全部歌曲列表">
              <header class="playlist-table__head">
                <span>标题</span>
                <span>专辑</span>
                <span>时长</span>
              </header>

              <template v-if="tabLoaded.songs || !tabLoading.songs">
                <div
                  ref="artistSongsVirtualList"
                  class="playlist-virtual-list"
                  :style="{ height: `${artistSongsVirtualTotalHeight}px` }"
                >
                  <div
                    class="playlist-virtual-window"
                    :style="{ transform: `translateY(${artistSongsVirtualOffsetY}px)` }"
                  >
                    <SongListRow
                      v-for="track in visibleArtistSongs"
                      :key="track.id"
                      :track="track"
                      @play="playSongTrack"
                    />
                  </div>
                </div>
              </template>
            </section>

            <div v-if="tabErrors.songs" class="artist-detail-state artist-detail-state--error">
              {{ tabErrors.songs }}
            </div>
            <div v-else-if="tabLoading.songs && !tabLoaded.songs" class="artist-tab-skeleton artist-tab-skeleton--songs">
              <article
                v-for="item in 8"
                :key="`song-tab-skeleton-${item}`"
                class="artist-tab-skeleton__song-row"
              >
                <span class="artist-tab-skeleton__thumb" />
                <span class="artist-tab-skeleton__song-lines">
                  <span class="artist-tab-skeleton__line artist-tab-skeleton__line--song-title" />
                  <span class="artist-tab-skeleton__line artist-tab-skeleton__line--song-meta" />
                </span>
                <span class="artist-tab-skeleton__line artist-tab-skeleton__line--album" />
                <span class="artist-tab-skeleton__line artist-tab-skeleton__line--duration" />
              </article>
            </div>
            <div v-else-if="!tabLoading.songs && !artistSongs.length" class="artist-detail-state">
              暂无歌曲
            </div>
          </section>
        </template>

        <template v-else-if="activeTab === 'albums'">
          <section class="artist-detail-section">
            <div v-if="tabLoading.albums && !tabLoaded.albums" class="artist-album-grid artist-album-grid--skeleton">
              <article
                v-for="item in 12"
                :key="`album-tab-skeleton-${item}`"
                class="artist-tab-skeleton__media-card"
              >
                <span class="artist-tab-skeleton__cover artist-tab-skeleton__cover--album" />
                <span class="artist-tab-skeleton__line artist-tab-skeleton__line--card-title" />
                <span class="artist-tab-skeleton__line artist-tab-skeleton__line--card-meta" />
              </article>
            </div>
            <div v-else-if="artistAlbums.length" class="artist-album-grid">
              <RouterLink
                v-for="album in artistAlbums"
                :key="album.id"
                class="artist-album-card"
                :to="`/album/${album.id}`"
              >
                <span class="artist-album-card__cover" :class="`artist-album-card__cover--${album.type}`">
                  <img
                    v-if="album.coverUrl"
                    :src="album.coverUrl"
                    :alt="album.title"
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                <strong>{{ album.title }}</strong>
                <small>{{ album.desc || album.publishTime }}</small>
              </RouterLink>
            </div>

            <div v-if="tabErrors.albums" class="artist-detail-state artist-detail-state--error">
              {{ tabErrors.albums }}
            </div>
            <div v-else-if="!tabLoading.albums && !artistAlbums.length" class="artist-detail-state">
              暂无专辑
            </div>
          </section>
        </template>

        <template v-else-if="activeTab === 'videos'">
          <section class="artist-detail-section">
            <div v-if="tabLoading.videos && !tabLoaded.videos" class="artist-video-grid artist-video-grid--skeleton">
              <article
                v-for="item in 9"
                :key="`video-tab-skeleton-${item}`"
                class="artist-tab-skeleton__media-card"
              >
                <span class="artist-tab-skeleton__cover artist-tab-skeleton__cover--video" />
                <span class="artist-tab-skeleton__line artist-tab-skeleton__line--card-title" />
                <span class="artist-tab-skeleton__line artist-tab-skeleton__line--card-meta" />
              </article>
            </div>
            <div v-else-if="artistVideos.length" class="artist-video-grid">
              <ArtistVideoCard
                v-for="video in artistVideos"
                :key="video.id"
                :video="video"
              />
            </div>

            <div v-if="tabErrors.videos" class="artist-detail-state artist-detail-state--error">
              {{ tabErrors.videos }}
            </div>
            <div v-else-if="!tabLoading.videos && !artistVideos.length" class="artist-detail-state">
              暂无视频
            </div>
          </section>
        </template>

        <template v-else-if="activeTab === 'details'">
          <section class="artist-detail-section artist-intro-section">
            <div v-if="tabLoading.details && !tabLoaded.details" class="artist-intro-skeleton">
              <article
                v-for="item in 4"
                :key="`intro-tab-skeleton-${item}`"
                class="artist-intro-skeleton__card"
              >
                <span class="artist-tab-skeleton__line artist-tab-skeleton__line--intro-title" />
                <span class="artist-tab-skeleton__line artist-tab-skeleton__line--intro-copy" />
                <span class="artist-tab-skeleton__line artist-tab-skeleton__line--intro-copy" />
                <span class="artist-tab-skeleton__line artist-tab-skeleton__line--intro-copy-short" />
              </article>
            </div>
            <template v-else>
              <article v-if="artistIntro.briefDesc || artist.description" class="artist-intro-card">
                <h3>艺人介绍</h3>
                <p>{{ artistIntro.briefDesc || artist.description }}</p>
              </article>

              <article
                v-for="section in artistIntro.sections"
                :key="section.id"
                class="artist-intro-card"
              >
                <h3>{{ section.title }}</h3>
                <p>{{ section.text }}</p>
              </article>

              <div v-if="tabErrors.details" class="artist-detail-state artist-detail-state--error">
                {{ tabErrors.details }}
              </div>
              <div v-else-if="!hasArtistIntro" class="artist-detail-state">
                暂无详情
              </div>
            </template>
          </section>
        </template>

        <div
          v-if="activeTabHasMore"
          ref="loadMoreTrigger"
          class="artist-scroll-sentinel"
          aria-live="polite"
        >
          <span v-if="activeTabLoading">加载中...</span>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  BadgeCheck,
  CalendarDays,
  Flame,
  MapPin,
  Users
} from 'lucide-vue-next'
import { useMessage } from 'naive-ui'
import ArtistVideoCard from '../components/ArtistVideoCard.vue'
import SongListRow from '../components/SongListRow.vue'
import { useLoadMoreTrigger } from '../composables/useLoadMoreTrigger'
import { useVirtualRows } from '../composables/useVirtualRows'
import {
  getArtistAlbumsData,
  getArtistDetailData,
  getArtistIntroData,
  getArtistSongsData,
  getArtistVideosData
} from '../services/netease'
import { usePlayerStore } from '../stores/player'
import { createLruCache } from '../utils/lruCache'
import { getPlaybackErrorDisplay } from '../utils/playbackError'
import { isAbortError } from '../utils/request'
import '../styles/artist.css'
import '../styles/playlist.css'

const ARTIST_DETAIL_TRACK_SKELETON_COUNT = 10
const ARTIST_SONG_PAGE_SIZE = 30
const ARTIST_ALBUM_PAGE_SIZE = 24
const ARTIST_VIDEO_PAGE_SIZE = 24
const ARTIST_TAB_SKELETON_MIN_MS = 360
const ARTIST_FEATURED_PREVIEW_IDLE_TIMEOUT = 1200
const ARTIST_FEATURED_PREVIEW_FALLBACK_DELAY = 320
const ARTIST_TAB_CACHE_SIZE = 48
const TRACK_ROW_HEIGHT = 58

const route = useRoute()
const player = usePlayerStore()
const message = useMessage()

const pageRoot = ref(null)
const remoteArtist = ref(null)
const remoteTracks = ref([])
const artistSongs = ref([])
const artistAlbums = ref([])
const artistVideos = ref([])
const artistIntro = ref({
  briefDesc: '',
  sections: []
})
const artistSongTotal = ref(0)
const artistSongOrder = ref('hot')
const artistVideosCursor = ref(0)
const isLoading = ref(false)
const errorMessage = ref('')
const activeTab = ref('featured')
const loadMoreTrigger = ref(null)
const artistSongsVirtualList = ref(null)
const artistSongsHasMore = ref(false)
const artistAlbumsHasMore = ref(false)
const artistVideosHasMore = ref(false)
let artistRequestId = 0
let artistController = null
const tabRequestIds = {
  songs: 0,
  albums: 0,
  videos: 0,
  details: 0
}
const tabControllers = {
  songs: null,
  albums: null,
  videos: null,
  details: null
}
const artistTabCache = createLruCache(ARTIST_TAB_CACHE_SIZE)
let featuredPreviewSchedule = null

const tabLoading = reactive({
  songs: false,
  albums: false,
  videos: false,
  details: false
})
const tabLoaded = reactive({
  songs: false,
  albums: false,
  videos: false,
  details: false
})
const tabErrors = reactive({
  songs: '',
  albums: '',
  videos: '',
  details: ''
})

const artist = computed(() =>
  remoteArtist.value || {
    id: route.params.id,
    name: '歌手详情',
    aliases: [],
    identity: '',
    identities: [],
    description: '当前歌手暂无本地回退数据',
    coverUrl: '',
    avatarUrl: '',
    albumSize: 0,
    musicSize: 0,
    mvSize: 0,
    videoCount: 0,
    fansCount: 0,
    birthday: '',
    areaName: '',
    occupation: '',
    origin: '',
    score: 0,
    rank: 0,
    followed: false,
    type: 'sunset'
  }
)

const artistTabs = computed(() => [
  { value: 'featured', label: '精选' },
  { value: 'songs', label: '歌曲', count: artist.value.musicSize },
  { value: 'albums', label: '专辑', count: artist.value.albumSize },
  { value: 'videos', label: '视频', count: artist.value.videoCount || artist.value.mvSize },
  { value: 'details', label: '详情' }
])

const artistProfileItems = computed(() => {
  const info = artist.value
  const fansCount = Number(info.fansCount) || 0
  const score = Number(info.score) || 0
  const items = [
    fansCount
      ? { key: 'fans', icon: Users, text: `${formatStat(fansCount)} 粉丝` }
      : null,
    info.birthday
      ? { key: 'birthday', icon: CalendarDays, text: `生日 ${formatArtistDate(info.birthday)}` }
      : null,
    info.origin
      ? { key: 'origin', icon: MapPin, text: info.origin }
      : null,
    info.occupation
      ? { key: 'occupation', icon: BadgeCheck, text: info.occupation }
      : null,
    info.areaName
      ? { key: 'area', icon: MapPin, text: info.areaName }
      : null,
    score
      ? { key: 'score', icon: Flame, text: `${formatStat(score)} 热度` }
      : null,
    info.rank
      ? { key: 'rank', icon: BadgeCheck, text: `榜单第 ${info.rank}` }
      : null
  ].filter(Boolean)

  return items.slice(0, 6)
})

const artistTracks = computed(() =>
  remoteTracks.value.map((track, index) => ({
    ...track,
    rank: String(index + 1).padStart(2, '0')
  }))
)
const rankedArtistSongs = computed(() =>
  artistSongs.value.map((track, index) => ({
    ...track,
    rank: String(index + 1).padStart(2, '0')
  }))
)
const {
  offsetY: artistSongsVirtualOffsetY,
  scheduleRangeUpdate: scheduleArtistSongsRangeUpdate,
  totalHeight: artistSongsVirtualTotalHeight,
  updateRange: updateArtistSongsVirtualRange,
  visibleItems: visibleArtistSongs
} = useVirtualRows(rankedArtistSongs, {
  root: pageRoot,
  list: artistSongsVirtualList,
  rowHeight: TRACK_ROW_HEIGHT
})

const featuredAlbums = computed(() => artistAlbums.value.slice(0, 6))
const featuredVideos = computed(() => artistVideos.value.slice(0, 6))
const hasArtistIntro = computed(() =>
  Boolean(artistIntro.value.briefDesc || artistIntro.value.sections.length || artist.value.description)
)
const activeTabHasMore = computed(() => {
  if (activeTab.value === 'songs') {
    return artistSongsHasMore.value
  }

  if (activeTab.value === 'albums') {
    return artistAlbumsHasMore.value
  }

  if (activeTab.value === 'videos') {
    return artistVideosHasMore.value
  }

  return false
})
const activeTabLoading = computed(() => {
  if (activeTab.value === 'songs') {
    return tabLoading.songs
  }

  if (activeTab.value === 'albums') {
    return tabLoading.albums
  }

  if (activeTab.value === 'videos') {
    return tabLoading.videos
  }

  return false
})

const loadMoreController = useLoadMoreTrigger({
  trigger: loadMoreTrigger,
  canLoad: () => activeTabHasMore.value && !activeTabLoading.value,
  loadMore: loadMoreForActiveTab,
  rootMargin: '260px 0px'
})

const artistTags = computed(() => {
  const tags = [
    artist.value.identity,
    ...artist.value.identities
  ].filter(Boolean)

  return [...new Set(tags)].slice(0, 6)
})

watch(
  () => route.params.id,
  (id) => {
    resetArtistTabs()
    loadArtistDetail(id)
  },
  { immediate: true }
)

watch(
  () => [
    activeTab.value,
    activeTabHasMore.value,
    artistSongs.value.length,
    artistAlbums.value.length,
    artistVideos.value.length
  ],
  () => {
    nextTick(loadMoreController.setup)
    nextTick(updateArtistSongsVirtualRange)
  },
  { flush: 'post' }
)

onUnmounted(() => {
  cancelArtistRequest()
  cancelFeaturedPreviewSchedule()
  cancelAllTabRequests()
})

function resetArtistTabs() {
  cancelFeaturedPreviewSchedule()
  cancelAllTabRequests()
  activeTab.value = 'featured'
  artistSongs.value = []
  artistAlbums.value = []
  artistVideos.value = []
  artistIntro.value = {
    briefDesc: '',
    sections: []
  }
  artistSongTotal.value = 0
  artistSongOrder.value = 'hot'
  artistVideosCursor.value = 0
  artistSongsHasMore.value = false
  artistAlbumsHasMore.value = false
  artistVideosHasMore.value = false
  Object.keys(tabLoaded).forEach((key) => {
    tabLoaded[key] = false
  })
  Object.keys(tabLoading).forEach((key) => {
    tabLoading[key] = false
  })
  Object.keys(tabErrors).forEach((key) => {
    tabErrors[key] = ''
  })
}

function cancelArtistRequest() {
  artistRequestId += 1
  cancelFeaturedPreviewSchedule()

  if (!artistController) {
    return
  }

  artistController.abort()
  artistController = null
}

function cancelTabRequest(tab) {
  tabRequestIds[tab] += 1

  if (tabControllers[tab]) {
    tabControllers[tab].abort()
    tabControllers[tab] = null
  }

  tabLoading[tab] = false
}

function cancelAllTabRequests() {
  Object.keys(tabRequestIds).forEach(cancelTabRequest)
}

function startTabRequest(tab) {
  cancelTabRequest(tab)

  const requestId = ++tabRequestIds[tab]
  const controller = new AbortController()
  tabControllers[tab] = controller

  return { controller, requestId }
}

function isCurrentArtistRequest(id, requestId, controller) {
  return (
    requestId === artistRequestId &&
    !controller.signal.aborted &&
    String(route.params.id) === String(id)
  )
}

function isCurrentTabRequest(tab, id, requestId, controller) {
  return (
    requestId === tabRequestIds[tab] &&
    !controller.signal.aborted &&
    String(route.params.id) === String(id)
  )
}

async function loadArtistDetail(id) {
  cancelArtistRequest()
  remoteArtist.value = null
  remoteTracks.value = []
  errorMessage.value = ''

  if (!/^\d+$/.test(String(id ?? ''))) {
    errorMessage.value = '歌手 ID 不正确'
    isLoading.value = false
    return
  }

  const requestId = ++artistRequestId
  const controller = new AbortController()
  artistController = controller
  isLoading.value = true

  try {
    const data = await getArtistDetailData(id, {
      signal: controller.signal
    })

    if (!isCurrentArtistRequest(id, requestId, controller)) {
      return
    }

    remoteArtist.value = data.artist
    remoteTracks.value = data.tracks
    nextTick(() => scheduleFeaturedPreviews(id))
  } catch (error) {
    if (isAbortError(error) || requestId !== artistRequestId) {
      return
    }

    console.warn('Failed to load artist detail:', error)
    errorMessage.value = '歌手详情加载失败'
  } finally {
    if (isCurrentArtistRequest(id, requestId, controller)) {
      isLoading.value = false
    }

    if (artistController === controller) {
      artistController = null
    }
  }
}

function scheduleFeaturedPreviews(id) {
  cancelFeaturedPreviewSchedule()

  const preloadTabs = ['albums', 'videos', 'details']
  let index = 0

  function preloadNext() {
    featuredPreviewSchedule = null

    if (String(route.params.id) !== String(id)) {
      return
    }

    while (index < preloadTabs.length) {
      const tab = preloadTabs[index]
      index += 1

      if (preloadArtistTab(tab, id)) {
        break
      }
    }

    if (index < preloadTabs.length) {
      featuredPreviewSchedule = requestIdle(preloadNext)
    }
  }

  featuredPreviewSchedule = requestIdle(preloadNext)
}

function preloadArtistTab(tab, id) {
  if (String(route.params.id) !== String(id) || tabLoaded[tab] || tabLoading[tab]) {
    return false
  }

  if (tab === 'albums') {
    loadArtistAlbums({ reset: true, silent: true })
    return true
  }

  if (tab === 'videos') {
    loadArtistVideos({ reset: true, silent: true })
    return true
  }

  if (tab === 'details') {
    loadArtistIntro({ silent: true })
    return true
  }

  return false
}

function requestIdle(callback) {
  if (typeof window === 'undefined') {
    return null
  }

  if (typeof window.requestIdleCallback === 'function') {
    return {
      type: 'idle',
      id: window.requestIdleCallback(callback, {
        timeout: ARTIST_FEATURED_PREVIEW_IDLE_TIMEOUT
      })
    }
  }

  return {
    type: 'timeout',
    id: window.setTimeout(callback, ARTIST_FEATURED_PREVIEW_FALLBACK_DELAY)
  }
}

function cancelFeaturedPreviewSchedule() {
  if (!featuredPreviewSchedule || typeof window === 'undefined') {
    featuredPreviewSchedule = null
    return
  }

  if (featuredPreviewSchedule.type === 'idle' && typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(featuredPreviewSchedule.id)
  } else {
    window.clearTimeout(featuredPreviewSchedule.id)
  }

  featuredPreviewSchedule = null
}

function getArtistTabCacheKey(tab, id, filter = '') {
  return ['artist-tab', tab, String(id ?? ''), String(filter ?? '')].join(':')
}

function restoreArtistTabCache(tab, id, options = {}) {
  if (!/^\d+$/.test(String(id ?? ''))) {
    return false
  }

  if (tab === 'songs') {
    const cached = artistTabCache.get(getArtistTabCacheKey(tab, id, options.order || 'hot'))

    if (!cached) {
      return false
    }

    artistSongs.value = Array.isArray(cached.tracks) ? cached.tracks.slice() : []
    artistSongTotal.value = Number(cached.total) || artistSongs.value.length
    artistSongsHasMore.value = Boolean(cached.hasMore)
    tabLoaded.songs = true
    tabLoading.songs = false
    tabErrors.songs = ''
    nextTick(updateArtistSongsVirtualRange)
    return true
  }

  if (tab === 'albums') {
    const cached = artistTabCache.get(getArtistTabCacheKey(tab, id))

    if (!cached) {
      return false
    }

    artistAlbums.value = Array.isArray(cached.albums) ? cached.albums.slice() : []
    artistAlbumsHasMore.value = Boolean(cached.hasMore)
    tabLoaded.albums = true
    tabLoading.albums = false
    tabErrors.albums = ''
    return true
  }

  if (tab === 'videos') {
    const cached = artistTabCache.get(getArtistTabCacheKey(tab, id))

    if (!cached) {
      return false
    }

    artistVideos.value = Array.isArray(cached.videos) ? cached.videos.slice() : []
    artistVideosCursor.value = cached.cursor ?? 0
    artistVideosHasMore.value = Boolean(cached.hasMore)
    tabLoaded.videos = true
    tabLoading.videos = false
    tabErrors.videos = ''
    return true
  }

  if (tab === 'details') {
    const cached = artistTabCache.get(getArtistTabCacheKey(tab, id))

    if (!cached) {
      return false
    }

    artistIntro.value = cloneArtistIntro(cached.intro)
    tabLoaded.details = true
    tabLoading.details = false
    tabErrors.details = ''
    return true
  }

  return false
}

function saveArtistTabCache(tab, id, options = {}) {
  if (!/^\d+$/.test(String(id ?? ''))) {
    return
  }

  if (tab === 'songs') {
    artistTabCache.set(getArtistTabCacheKey(tab, id, options.order || 'hot'), {
      tracks: artistSongs.value.slice(),
      total: artistSongTotal.value,
      hasMore: artistSongsHasMore.value
    })
    return
  }

  if (tab === 'albums') {
    artistTabCache.set(getArtistTabCacheKey(tab, id), {
      albums: artistAlbums.value.slice(),
      hasMore: artistAlbumsHasMore.value
    })
    return
  }

  if (tab === 'videos') {
    artistTabCache.set(getArtistTabCacheKey(tab, id), {
      videos: artistVideos.value.slice(),
      cursor: artistVideosCursor.value,
      hasMore: artistVideosHasMore.value
    })
    return
  }

  if (tab === 'details') {
    artistTabCache.set(getArtistTabCacheKey(tab, id), {
      intro: cloneArtistIntro(artistIntro.value)
    })
  }
}

function cloneArtistIntro(intro = {}) {
  return {
    briefDesc: intro.briefDesc || '',
    sections: Array.isArray(intro.sections)
      ? intro.sections.map((section) => ({ ...section }))
      : []
  }
}

function selectArtistTab(tab) {
  activeTab.value = tab
  ensureArtistTabData(tab)
  nextTick(loadMoreController.setup)
}

function ensureArtistTabData(tab) {
  if (tab === 'songs' && !tabLoaded.songs) {
    loadArtistSongs({ reset: true })
  }

  if (tab === 'albums' && !tabLoaded.albums) {
    loadArtistAlbums({ reset: true })
  }

  if (tab === 'videos' && !tabLoaded.videos) {
    loadArtistVideos({ reset: true })
  }

  if (tab === 'details' && !tabLoaded.details) {
    loadArtistIntro()
  }
}

async function loadArtistSongs({ reset = false } = {}) {
  const startedAt = Date.now()
  const id = route.params.id

  if (!/^\d+$/.test(String(id ?? '')) || (tabLoading.songs && !reset)) {
    return
  }

  const order = artistSongOrder.value

  if (reset && restoreArtistTabCache('songs', id, { order })) {
    cancelTabRequest('songs')
    return
  }

  const { controller, requestId } = startTabRequest('songs')
  tabLoading.songs = true
  tabErrors.songs = ''

  const offset = reset ? 0 : artistSongs.value.length
  const shouldHoldSkeleton = reset || !tabLoaded.songs
  let loaded = false

  try {
    const data = await getArtistSongsData({
      id,
      limit: ARTIST_SONG_PAGE_SIZE,
      offset,
      order
    }, {
      signal: controller.signal
    })

    if (!isCurrentTabRequest('songs', id, requestId, controller) || artistSongOrder.value !== order) {
      return
    }

    artistSongs.value = reset ? data.tracks : [...artistSongs.value, ...data.tracks]
    artistSongTotal.value = data.total
    artistSongsHasMore.value = data.more
    saveArtistTabCache('songs', id, { order })
    loaded = true
  } catch (error) {
    if (isAbortError(error) || !isCurrentTabRequest('songs', id, requestId, controller)) {
      return
    }

    console.warn('Failed to load artist songs:', error)
    tabErrors.songs = '歌曲加载失败'
  } finally {
    if (shouldHoldSkeleton && isCurrentTabRequest('songs', id, requestId, controller)) {
      await waitForTabSkeleton(startedAt)
    }

    if (isCurrentTabRequest('songs', id, requestId, controller)) {
      if (loaded) {
        tabLoaded.songs = true
      }

      tabLoading.songs = false
    }

    if (tabControllers.songs === controller) {
      tabControllers.songs = null
    }
  }
}

async function loadArtistAlbums({ reset = false, silent = false } = {}) {
  const startedAt = Date.now()
  const id = route.params.id

  if (!/^\d+$/.test(String(id ?? '')) || (tabLoading.albums && !reset)) {
    return
  }

  if (reset && restoreArtistTabCache('albums', id)) {
    cancelTabRequest('albums')
    return
  }

  const { controller, requestId } = startTabRequest('albums')
  tabLoading.albums = true
  tabErrors.albums = ''

  const offset = reset ? 0 : artistAlbums.value.length
  const shouldHoldSkeleton = reset || !tabLoaded.albums
  let loaded = false

  try {
    const data = await getArtistAlbumsData({
      id,
      limit: ARTIST_ALBUM_PAGE_SIZE,
      offset
    }, {
      signal: controller.signal
    })

    if (!isCurrentTabRequest('albums', id, requestId, controller)) {
      return
    }

    artistAlbums.value = reset ? data.albums : [...artistAlbums.value, ...data.albums]
    artistAlbumsHasMore.value = data.more
    saveArtistTabCache('albums', id)
    loaded = true
  } catch (error) {
    if (isAbortError(error) || !isCurrentTabRequest('albums', id, requestId, controller)) {
      return
    }

    console.warn('Failed to load artist albums:', error)
    if (!silent) {
      tabErrors.albums = '专辑加载失败'
    }
  } finally {
    if (shouldHoldSkeleton && isCurrentTabRequest('albums', id, requestId, controller)) {
      await waitForTabSkeleton(startedAt)
    }

    if (isCurrentTabRequest('albums', id, requestId, controller)) {
      if (loaded) {
        tabLoaded.albums = true
      }

      tabLoading.albums = false
    }

    if (tabControllers.albums === controller) {
      tabControllers.albums = null
    }
  }
}

async function loadArtistVideos({ reset = false, silent = false } = {}) {
  const startedAt = Date.now()
  const id = route.params.id

  if (!/^\d+$/.test(String(id ?? '')) || (tabLoading.videos && !reset)) {
    return
  }

  if (reset && restoreArtistTabCache('videos', id)) {
    cancelTabRequest('videos')
    return
  }

  const { controller, requestId } = startTabRequest('videos')
  tabLoading.videos = true
  tabErrors.videos = ''
  const shouldHoldSkeleton = reset || !tabLoaded.videos
  let loaded = false

  try {
    const data = await getArtistVideosData({
      id,
      size: ARTIST_VIDEO_PAGE_SIZE,
      cursor: reset ? 0 : artistVideosCursor.value || 0,
      order: 0
    }, {
      signal: controller.signal
    })

    if (!isCurrentTabRequest('videos', id, requestId, controller)) {
      return
    }

    artistVideos.value = reset ? data.videos : [...artistVideos.value, ...data.videos]
    artistVideosCursor.value = data.cursor
    artistVideosHasMore.value = data.more
    saveArtistTabCache('videos', id)
    loaded = true
  } catch (error) {
    if (isAbortError(error) || !isCurrentTabRequest('videos', id, requestId, controller)) {
      return
    }

    console.warn('Failed to load artist videos:', error)
    if (!silent) {
      tabErrors.videos = '视频加载失败'
    }
  } finally {
    if (shouldHoldSkeleton && isCurrentTabRequest('videos', id, requestId, controller)) {
      await waitForTabSkeleton(startedAt)
    }

    if (isCurrentTabRequest('videos', id, requestId, controller)) {
      if (loaded) {
        tabLoaded.videos = true
      }

      tabLoading.videos = false
    }

    if (tabControllers.videos === controller) {
      tabControllers.videos = null
    }
  }
}

async function loadArtistIntro({ silent = false } = {}) {
  const startedAt = Date.now()
  const id = route.params.id

  if (!/^\d+$/.test(String(id ?? '')) || (tabLoading.details && silent)) {
    return
  }

  if (restoreArtistTabCache('details', id)) {
    cancelTabRequest('details')
    return
  }

  const { controller, requestId } = startTabRequest('details')
  tabLoading.details = true
  tabErrors.details = ''
  const shouldHoldSkeleton = !tabLoaded.details
  let loaded = false

  try {
    const data = await getArtistIntroData(id, {
      signal: controller.signal
    })

    if (!isCurrentTabRequest('details', id, requestId, controller)) {
      return
    }

    artistIntro.value = data
    saveArtistTabCache('details', id)
    loaded = true
  } catch (error) {
    if (isAbortError(error) || !isCurrentTabRequest('details', id, requestId, controller)) {
      return
    }

    console.warn('Failed to load artist intro:', error)
    if (!silent) {
      tabErrors.details = '详情加载失败'
    }
  } finally {
    if (shouldHoldSkeleton && isCurrentTabRequest('details', id, requestId, controller)) {
      await waitForTabSkeleton(startedAt)
    }

    if (isCurrentTabRequest('details', id, requestId, controller)) {
      if (loaded) {
        tabLoaded.details = true
      }

      tabLoading.details = false
    }

    if (tabControllers.details === controller) {
      tabControllers.details = null
    }
  }
}

function waitForTabSkeleton(startedAt) {
  const remaining = ARTIST_TAB_SKELETON_MIN_MS - (Date.now() - startedAt)

  if (remaining <= 0) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    window.setTimeout(resolve, remaining)
  })
}

function setArtistSongOrder(order) {
  if (artistSongOrder.value === order) {
    return
  }

  artistSongOrder.value = order
  artistSongs.value = []
  artistSongTotal.value = 0
  artistSongsHasMore.value = false
  tabLoaded.songs = false
  loadArtistSongs({ reset: true })
}

function loadMoreForActiveTab() {
  if (!activeTabHasMore.value || activeTabLoading.value) {
    return
  }

  if (activeTab.value === 'songs') {
    loadArtistSongs()
  }

  if (activeTab.value === 'albums') {
    loadArtistAlbums()
  }

  if (activeTab.value === 'videos') {
    loadArtistVideos()
  }
}

function playFeaturedTrack(track) {
  playArtistTrack(track, { type: 'artist-featured', id: route.params.id })
}

function playSongTrack(track) {
  playArtistTrack(track, { type: 'artist-songs', id: route.params.id })
}

async function playArtistTrack(track, source) {
  if (String(player.state.currentTrack.id) === String(track.id)) {
    await player.togglePlay()
    return
  }

  const played = await player.playTrack(track)
  if (played) {
    player.appendToQueue(track, source)
  }

  if (!played) {
    message.error(getPlaybackErrorDisplay(player.state.error, '当前歌曲暂无可播放链接'))
  }
}

function formatStat(value = 0) {
  const count = Number(value) || 0

  if (count >= 100000000) {
    return `${trimNumber(count / 100000000)}亿`
  }

  if (count >= 10000) {
    return `${trimNumber(count / 10000)}万`
  }

  return String(count)
}

function formatArtistDate(value = '') {
  if (typeof value === 'string' && /^\d{4}-\d{1,2}-\d{1,2}/.test(value)) {
    return value.slice(0, 10)
  }

  return value
}

function trimNumber(number) {
  return Number(number.toFixed(1)).toString()
}
</script>
