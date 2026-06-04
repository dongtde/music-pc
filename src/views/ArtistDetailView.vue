<template>
  <div class="view artist-detail">
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

          <div class="artist-detail-meta">
            <span>
              <Music :size="14" />
              {{ formatStat(artist.musicSize) }} 首歌
            </span>
            <span>
              <Disc3 :size="14" />
              {{ formatStat(artist.albumSize) }} 张专辑
            </span>
            <span>
              <Video :size="14" />
              {{ formatStat(artist.videoCount || artist.mvSize) }} 个视频
            </span>
            <span v-if="artist.rank">
              <BadgeCheck :size="14" />
              榜单第 {{ artist.rank }}
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
                <SongListRow
                  v-for="track in artistSongs"
                  :key="track.id"
                  :track="track"
                  @play="playSongTrack"
                />
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
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  BadgeCheck,
  Disc3,
  Music,
  Video
} from 'lucide-vue-next'
import { useMessage } from 'naive-ui'
import ArtistVideoCard from '../components/ArtistVideoCard.vue'
import SongListRow from '../components/SongListRow.vue'
import {
  getArtistAlbumsData,
  getArtistDetailData,
  getArtistIntroData,
  getArtistSongsData,
  getArtistVideosData
} from '../services/netease'
import { usePlayerStore } from '../stores/player'
import '../styles/artist.css'

const ARTIST_DETAIL_TRACK_SKELETON_COUNT = 10
const ARTIST_SONG_PAGE_SIZE = 30
const ARTIST_ALBUM_PAGE_SIZE = 24
const ARTIST_VIDEO_PAGE_SIZE = 24
const ARTIST_TAB_SKELETON_MIN_MS = 360

const route = useRoute()
const player = usePlayerStore()
const message = useMessage()

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
const artistSongsHasMore = ref(false)
const artistAlbumsHasMore = ref(false)
const artistVideosHasMore = ref(false)
let artistRequestId = 0
let loadMoreObserver

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

const artistTracks = computed(() =>
  remoteTracks.value.map((track, index) => ({
    ...track,
    rank: String(index + 1).padStart(2, '0')
  }))
)

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
    nextTick(observeLoadMoreTrigger)
  },
  { flush: 'post' }
)

onMounted(() => {
  setupLoadMoreObserver()
  nextTick(observeLoadMoreTrigger)
})

onBeforeUnmount(() => {
  loadMoreObserver?.disconnect()
})

function resetArtistTabs() {
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

async function loadArtistDetail(id) {
  const requestId = ++artistRequestId
  remoteArtist.value = null
  remoteTracks.value = []
  errorMessage.value = ''

  if (!/^\d+$/.test(String(id ?? ''))) {
    errorMessage.value = '歌手 ID 不正确'
    return
  }

  isLoading.value = true

  try {
    const data = await getArtistDetailData(id)

    if (requestId !== artistRequestId) {
      return
    }

    remoteArtist.value = data.artist
    remoteTracks.value = data.tracks
    loadFeaturedPreviews()
  } catch (error) {
    if (requestId !== artistRequestId) {
      return
    }

    console.warn('Failed to load artist detail:', error)
    errorMessage.value = '歌手详情加载失败'
  } finally {
    if (requestId === artistRequestId) {
      isLoading.value = false
    }
  }
}

function loadFeaturedPreviews() {
  loadArtistAlbums({ reset: true, silent: true })
  loadArtistVideos({ reset: true, silent: true })
  loadArtistIntro({ silent: true })
}

function selectArtistTab(tab) {
  activeTab.value = tab
  ensureArtistTabData(tab)
  nextTick(observeLoadMoreTrigger)
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

  if (tabLoading.songs || !/^\d+$/.test(String(id ?? ''))) {
    return
  }

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
      order: artistSongOrder.value
    })

    artistSongs.value = reset ? data.tracks : [...artistSongs.value, ...data.tracks]
    artistSongTotal.value = data.total
    artistSongsHasMore.value = data.more
    loaded = true
  } catch (error) {
    console.warn('Failed to load artist songs:', error)
    tabErrors.songs = '歌曲加载失败'
  } finally {
    if (shouldHoldSkeleton) {
      await waitForTabSkeleton(startedAt)
    }

    if (loaded) {
      tabLoaded.songs = true
    }

    tabLoading.songs = false
  }
}

async function loadArtistAlbums({ reset = false, silent = false } = {}) {
  const startedAt = Date.now()
  const id = route.params.id

  if (tabLoading.albums || !/^\d+$/.test(String(id ?? ''))) {
    return
  }

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
    })

    artistAlbums.value = reset ? data.albums : [...artistAlbums.value, ...data.albums]
    artistAlbumsHasMore.value = data.more
    loaded = true
  } catch (error) {
    console.warn('Failed to load artist albums:', error)
    if (!silent) {
      tabErrors.albums = '专辑加载失败'
    }
  } finally {
    if (shouldHoldSkeleton) {
      await waitForTabSkeleton(startedAt)
    }

    if (loaded) {
      tabLoaded.albums = true
    }

    tabLoading.albums = false
  }
}

async function loadArtistVideos({ reset = false, silent = false } = {}) {
  const startedAt = Date.now()
  const id = route.params.id

  if (tabLoading.videos || !/^\d+$/.test(String(id ?? ''))) {
    return
  }

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
    })

    artistVideos.value = reset ? data.videos : [...artistVideos.value, ...data.videos]
    artistVideosCursor.value = data.cursor
    artistVideosHasMore.value = data.more
    loaded = true
  } catch (error) {
    console.warn('Failed to load artist videos:', error)
    if (!silent) {
      tabErrors.videos = '视频加载失败'
    }
  } finally {
    if (shouldHoldSkeleton) {
      await waitForTabSkeleton(startedAt)
    }

    if (loaded) {
      tabLoaded.videos = true
    }

    tabLoading.videos = false
  }
}

async function loadArtistIntro({ silent = false } = {}) {
  const startedAt = Date.now()
  const id = route.params.id

  if (tabLoading.details || !/^\d+$/.test(String(id ?? ''))) {
    return
  }

  tabLoading.details = true
  tabErrors.details = ''
  const shouldHoldSkeleton = !tabLoaded.details
  let loaded = false

  try {
    artistIntro.value = await getArtistIntroData(id)
    loaded = true
  } catch (error) {
    console.warn('Failed to load artist intro:', error)
    if (!silent) {
      tabErrors.details = '详情加载失败'
    }
  } finally {
    if (shouldHoldSkeleton) {
      await waitForTabSkeleton(startedAt)
    }

    if (loaded) {
      tabLoaded.details = true
    }

    tabLoading.details = false
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
  artistSongsHasMore.value = false
  tabLoaded.songs = false
  loadArtistSongs({ reset: true })
}

function setupLoadMoreObserver() {
  if (typeof IntersectionObserver === 'undefined') {
    return
  }

  loadMoreObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        loadMoreForActiveTab()
      }
    },
    { rootMargin: '260px 0px' }
  )
}

function observeLoadMoreTrigger() {
  if (!loadMoreObserver) {
    return
  }

  loadMoreObserver.disconnect()

  if (loadMoreTrigger.value && activeTabHasMore.value) {
    loadMoreObserver.observe(loadMoreTrigger.value)
  }
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
  playArtistTrack(track, artistTracks.value)
}

function playSongTrack(track) {
  playArtistTrack(track, artistSongs.value)
}

async function playArtistTrack(track, queue) {
  player.setQueue(queue)

  if (String(player.state.currentTrack.id) === String(track.id)) {
    await player.togglePlay()
    return
  }

  const played = await player.playTrack(track)
  if (!played) {
    message.error(player.state.error?.message || '当前歌曲暂无可播放链接')
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

function trimNumber(number) {
  return Number(number.toFixed(1)).toString()
}
</script>
