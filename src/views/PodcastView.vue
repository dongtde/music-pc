<template>
  <div class="view podcast-view">
    <nav class="podcast-page-tabs" aria-label="播客页面">
      <RouterLink
        v-for="page in podcastPages"
        :key="page.name"
        :to="{ name: page.name }"
        class="podcast-page-tab"
        :class="{ active: activePage.name === page.name }"
      >
        <span>{{ page.label }}</span>
      </RouterLink>
    </nav>

    <section
      v-if="isOverviewPage && skeletonVisible"
      class="podcast-showcase podcast-showcase--skeleton"
      aria-busy="true"
      aria-label="播客内容加载中"
    >
      <article class="podcast-showcase__panel">
        <div class="podcast-skeleton-spotlight">
          <span class="podcast-skeleton podcast-skeleton--showcase-cover" />
          <span class="podcast-skeleton-stack">
            <span class="podcast-skeleton podcast-skeleton--kicker" />
            <span class="podcast-skeleton podcast-skeleton--title" />
            <span class="podcast-skeleton podcast-skeleton--text" />
            <span class="podcast-skeleton podcast-skeleton--text-short" />
          </span>
        </div>
      </article>
      <article v-for="panel in 2" :key="`podcast-showcase-skeleton-${panel}`" class="podcast-showcase__panel">
        <div class="podcast-skeleton-panel-head">
          <span class="podcast-skeleton podcast-skeleton--heading" />
          <span class="podcast-skeleton podcast-skeleton--mini" />
        </div>
        <div class="podcast-skeleton-top-list">
          <span v-for="item in 4" :key="`podcast-top-skeleton-${panel}-${item}`" class="podcast-skeleton-top-item">
            <span class="podcast-skeleton podcast-skeleton--top-cover" />
            <span class="podcast-skeleton podcast-skeleton--top-line" />
          </span>
        </div>
      </article>
    </section>

    <section v-else-if="isOverviewPage" class="podcast-showcase">
      <article class="podcast-showcase__panel podcast-showcase__panel--fm">
        <RouterLink
          v-if="spotlightPodcast || heroBanner"
          class="podcast-spotlight"
          :to="spotlightPodcast ? getPodcastTo(spotlightPodcast) : '/podcast'"
        >
          <span class="podcast-spotlight__cover">
            <img
              v-if="spotlightCoverUrl"
              :src="spotlightCoverUrl"
              :alt="heroTitle"
              loading="lazy"
              decoding="async"
            />
          </span>
          <span class="podcast-spotlight__copy">
            <small><Radio :size="14" /> 随心听FM</small>
            <strong>{{ heroTitle }}</strong>
            <em>{{ heroDescription }}</em>
          </span>
          <span class="podcast-showcase__signal">
            <MicVocal :size="22" />
          </span>
        </RouterLink>
      </article>

      <article class="podcast-showcase__panel podcast-showcase__panel--green">
        <div class="podcast-showcase__head">
          <strong>高分必听</strong>
          <RouterLink to="/podcast/rank">查看全部</RouterLink>
        </div>
        <div class="podcast-top-list">
          <RouterLink
            v-for="(item, index) in highScorePodcasts"
            :key="`high-score-${item.id}`"
            class="podcast-top-item"
            :to="getPodcastTo(item)"
          >
            <span>{{ index + 1 }}</span>
            <img v-if="item.coverUrl" :src="item.coverUrl" :alt="item.title" loading="lazy" decoding="async" />
            <strong>{{ item.title }}</strong>
          </RouterLink>
        </div>
      </article>

      <article class="podcast-showcase__panel podcast-showcase__panel--red">
        <div class="podcast-showcase__head">
          <strong>今日最热</strong>
          <RouterLink to="/podcast/rank">查看全部</RouterLink>
        </div>
        <div class="podcast-top-list">
          <RouterLink
            v-for="(item, index) in hotTopPodcasts"
            :key="`hot-top-${item.id}`"
            class="podcast-top-item"
            :to="getPodcastTo(item)"
          >
            <span>{{ index + 1 }}</span>
            <img v-if="item.coverUrl" :src="item.coverUrl" :alt="item.title" loading="lazy" decoding="async" />
            <strong>{{ item.title }}</strong>
          </RouterLink>
        </div>
      </article>
    </section>

    <section v-if="errorMessage && !skeletonVisible" class="podcast-state podcast-state--error">
      {{ errorMessage }}
    </section>

    <template v-if="skeletonVisible">
      <template v-if="isOverviewPage">
        <section class="podcast-category-strip podcast-category-strip--skeleton" aria-hidden="true">
          <div class="podcast-filter-options">
            <span v-for="item in 9" :key="`podcast-chip-skeleton-${item}`" class="podcast-skeleton podcast-skeleton--chip" />
          </div>
        </section>
        <section class="podcast-section">
          <div class="podcast-section__head">
            <span class="podcast-skeleton podcast-skeleton--heading" />
            <span class="podcast-skeleton podcast-skeleton--mini" />
          </div>
          <div class="podcast-card-grid">
            <article v-for="item in 12" :key="`podcast-skeleton-${item}`" class="podcast-card podcast-card--skeleton">
              <span class="podcast-skeleton podcast-skeleton--cover" />
              <span class="podcast-skeleton podcast-skeleton--line" />
              <span class="podcast-skeleton podcast-skeleton--line-short" />
            </article>
          </div>
        </section>
      </template>

      <section v-else-if="activePageKey === 'rank'" class="podcast-rank-page">
        <section class="podcast-rank-layout">
          <article class="podcast-panel podcast-rank-main">
            <div class="podcast-section__head">
              <span class="podcast-skeleton podcast-skeleton--heading" />
              <span class="podcast-skeleton podcast-skeleton--mini" />
            </div>
            <div class="podcast-program-list podcast-rank-programs">
              <span v-for="item in 8" :key="`rank-program-skeleton-${item}`" class="podcast-rank-program-skeleton">
                <span class="podcast-skeleton podcast-skeleton--program-cover" />
                <span class="podcast-skeleton podcast-skeleton--line" />
                <span class="podcast-skeleton podcast-skeleton--mini" />
              </span>
            </div>
          </article>

          <aside class="podcast-rank-side">
            <article class="podcast-panel podcast-rank-card">
              <div class="podcast-section__head">
                <span class="podcast-skeleton podcast-skeleton--heading" />
                <span class="podcast-skeleton podcast-skeleton--chip" />
              </div>
              <div class="podcast-rank-podium">
                <article v-for="item in 12" :key="`rank-card-skeleton-${item}`" class="podcast-card podcast-card--skeleton">
                  <span class="podcast-skeleton podcast-skeleton--cover" />
                  <span class="podcast-skeleton podcast-skeleton--line" />
                </article>
              </div>
            </article>
          </aside>
        </section>
      </section>

      <section v-else-if="activePageKey === 'sleep'" class="podcast-sleep-page">
        <section class="podcast-category-strip podcast-category-strip--skeleton" aria-hidden="true">
          <div class="podcast-filter-options">
            <span v-for="item in 8" :key="`sleep-chip-skeleton-${item}`" class="podcast-skeleton podcast-skeleton--chip" />
          </div>
        </section>
        <section class="podcast-section podcast-sleep-library">
          <div class="podcast-section__head">
            <span class="podcast-skeleton podcast-skeleton--heading" />
            <span class="podcast-skeleton podcast-skeleton--mini" />
          </div>
          <div class="podcast-voice-grid podcast-sleep-grid">
            <article v-for="item in 24" :key="`sleep-card-skeleton-${item}`" class="podcast-card podcast-card--skeleton">
              <span class="podcast-skeleton podcast-skeleton--cover" />
              <span class="podcast-skeleton podcast-skeleton--line" />
            </article>
          </div>
        </section>
      </section>

      <section v-else class="podcast-radio-page">
        <section class="podcast-radio-layout">
          <article class="podcast-section podcast-radio-channels">
            <div class="podcast-section__head">
              <span class="podcast-skeleton podcast-skeleton--heading" />
              <span class="podcast-skeleton podcast-skeleton--mini" />
            </div>
            <div class="podcast-radio-channel-grid">
              <article v-for="item in 12" :key="`radio-channel-skeleton-${item}`" class="podcast-card podcast-card--skeleton">
                <span class="podcast-skeleton podcast-skeleton--cover" />
                <span class="podcast-skeleton podcast-skeleton--line" />
              </article>
            </div>
          </article>
          <article class="podcast-section podcast-radio-broadcast">
            <div class="podcast-section__head">
              <span class="podcast-skeleton podcast-skeleton--heading" />
              <span class="podcast-skeleton podcast-skeleton--mini" />
            </div>
            <div class="podcast-radio-broadcast-grid">
              <article v-for="item in 12" :key="`radio-broadcast-skeleton-${item}`" class="podcast-card podcast-card--skeleton">
                <span class="podcast-skeleton podcast-skeleton--cover" />
                <span class="podcast-skeleton podcast-skeleton--line" />
              </article>
            </div>
          </article>
        </section>
      </section>
    </template>

    <template v-else>
      <template v-if="isOverviewPage">
        <section class="podcast-category-strip">
          <div class="podcast-filter-row">
            <div class="podcast-filter-options">
              <button
                v-for="item in categories"
                :key="item.id"
                type="button"
                :class="{ active: String(item.id) === String(activeCategoryId) }"
                @click="selectCategory(item)"
              >
                {{ item.name }}
              </button>
            </div>
          </div>
        </section>

        <section class="podcast-section">
          <div class="podcast-section__head">
            <div>
              <strong>猜你喜欢</strong>
            </div>
            <button class="podcast-text-button" type="button" :disabled="categoryLoading" @click="loadCategory({ reset: true })">
              <RefreshCw :size="15" :class="{ 'podcast-spin': categoryLoading }" />
              <span>刷新</span>
            </button>
          </div>
          <div class="podcast-card-grid">
            <PodcastCard
              v-for="item in recommendationPodcasts"
              :key="`recommend-${item.id}`"
              :podcast="item"
            />
          </div>
          <div ref="categoryLoadSentinel" class="podcast-autoload" aria-live="polite">
            <template v-if="categoryLoading">
              <LoaderCircle :size="16" class="podcast-spin" />
              <span>加载中</span>
            </template>
            <button
              v-else-if="categoryError && categoryPodcasts.length"
              type="button"
              @click="loadCategoryMore({ force: true })"
            >
              加载失败，重试
            </button>
            <span v-else-if="!categoryMore && categoryPodcasts.length">没有更多播客了</span>
            <span v-else>继续向下浏览，自动加载更多</span>
          </div>
        </section>
      </template>

      <template v-else-if="activePageKey === 'rank'">
        <section class="podcast-rank-page">
          <section class="podcast-rank-layout">
            <article class="podcast-panel podcast-rank-main">
              <div class="podcast-section__head">
                <div>
                  <strong>节目热榜</strong>
                </div>
                <AudioLines :size="18" />
              </div>
              <div class="podcast-program-list podcast-rank-programs">
                <SongListRow
                  v-for="track in programToplist"
                  :key="`program-${track.programId || track.id}`"
                  :track="track"
                  compact
                  @play="playProgram(track, programToplist)"
                />
              </div>
            </article>

            <aside class="podcast-rank-side">
              <article class="podcast-panel podcast-rank-card">
                <div class="podcast-section__head">
                  <div>
                    <strong>{{ rankLabel }}</strong>
                  </div>
                  <label class="podcast-rank-select">
                    <select v-model="rankType" @change="loadRank">
                      <option value="hot">热门电台榜</option>
                      <option value="new">新晋电台榜</option>
                      <option value="pay">付费精品</option>
                      <option value="hour">24 小时主播榜</option>
                      <option value="newcomer">主播新人榜</option>
                      <option value="popular">最热主播榜</option>
                    </select>
                  </label>
                </div>

                <div v-if="rankPodcastItems.length" class="podcast-rank-podium">
                  <RouterLink
                    v-for="(item, index) in rankPodcastItems"
                    :key="`rank-leader-${item.id}`"
                    class="podcast-rank-podium__item"
                    :to="getPodcastTo(item)"
                  >
                    <span class="podcast-rank-podium__badge">{{ index + 1 }}</span>
                    <img v-if="item.coverUrl" :src="item.coverUrl" :alt="item.title" loading="lazy" decoding="async" />
                    <strong>{{ item.title }}</strong>
                  </RouterLink>
                </div>
              </article>
            </aside>
          </section>
        </section>
      </template>

      <template v-else-if="activePageKey === 'sleep'">
        <section class="podcast-sleep-page">
          <section class="podcast-category-strip podcast-sleep-strip">
            <div class="podcast-filter-row">
              <div class="podcast-filter-options">
                <button
                  v-for="item in satiTagItems"
                  :key="item.tag"
                  type="button"
                  :class="{ active: item.tag === activeSatiTagId }"
                  @click="selectSatiTag(item)"
                >
                  {{ item.title }}
                </button>
              </div>
            </div>
          </section>

          <section class="podcast-section podcast-sleep-library">
            <div class="podcast-section__head">
              <div>
                <strong>{{ activeSatiTag?.title || '精选声音' }}</strong>
              </div>
              <LoaderCircle v-if="satiLoading" :size="18" class="podcast-spin" />
              <Moon v-else :size="18" />
            </div>
            <div class="podcast-voice-grid podcast-sleep-grid">
              <button
                v-for="track in visibleSatiResources"
                :key="`sati-${track.satiId || track.id}`"
                class="podcast-voice-card"
                type="button"
                v-memo="[track.id, track.satiId, track.name, track.coverUrl]"
                @click="playSatiResource(track)"
              >
                <img v-if="track.coverUrl" :src="track.coverUrl" :alt="track.name" loading="lazy" decoding="async" />
                <span><Play :size="15" fill="currentColor" /></span>
                <strong>{{ track.name }}</strong>
              </button>
            </div>
            <div v-if="satiHasMore" ref="satiLoadSentinel" class="podcast-autoload" aria-live="polite">
              <span v-if="satiHasMore">继续向下浏览，自动显示更多</span>
            </div>
          </section>
        </section>
      </template>

      <template v-else>
        <section class="podcast-radio-page">
          <section class="podcast-radio-layout">
            <article class="podcast-section podcast-radio-channels">
              <div class="podcast-section__head">
                <div>
                  <strong>DIFM 电台</strong>
                </div>
                <RadioTower :size="18" />
              </div>
              <div v-if="difmChannels.length" class="podcast-radio-channel-grid">
                <button
                  v-for="channel in difmChannels"
                  :key="`difm-${channel.source}-${channel.id}`"
                  class="podcast-radio-channel"
                  type="button"
                  @click="loadDifmTracks(channel)"
                >
                  <span><RadioReceiver :size="16" /></span>
                  <strong>{{ channel.title }}</strong>
                </button>
              </div>
            </article>

            <article class="podcast-section podcast-radio-now">
              <div class="podcast-section__head">
                <div>
                  <strong>频道播放列表</strong>
                </div>
                <RadioReceiver :size="18" />
              </div>
              <div v-if="difmTrackItems.length" class="podcast-program-list podcast-radio-track-list">
                <SongListRow
                  v-for="track in difmTrackItems"
                  :key="`difm-track-${track.id}`"
                  :track="track"
                  compact
                  @play="playProgram(track, difmTrackItems)"
                />
              </div>
              <div v-else class="podcast-state">选择一个 DIFM 频道查看播放列表。</div>
            </article>

            <article class="podcast-section podcast-radio-broadcast">
              <div class="podcast-section__head">
                <div>
                  <strong>广播电台</strong>
                </div>
                <Radio :size="18" />
              </div>
              <div class="podcast-radio-broadcast-grid">
                <article
                  v-for="item in broadcastChannelItems"
                  :key="`broadcast-${item.id}`"
                  class="podcast-radio-broadcast-card"
                >
                  <img v-if="item.coverUrl" :src="item.coverUrl" :alt="item.title" loading="lazy" decoding="async" />
                  <span v-else><Radio :size="16" /></span>
                  <strong>{{ item.title }}</strong>
                </article>
              </div>
            </article>
          </section>
        </section>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useMessage } from 'naive-ui'
import {
  AudioLines,
  Headphones,
  LoaderCircle,
  MicVocal,
  Moon,
  Play,
  Radio,
  RadioReceiver,
  RadioTower,
  RefreshCw
} from 'lucide-vue-next'
import SongListRow from '../components/SongListRow.vue'
import {
  getDifmChannelTracksData,
  getPodcastCategoryData,
  getPodcastHomeData,
  getPodcastRankData,
  getSatiResourcesData
} from '../services/netease'
import { usePlayerStore } from '../stores/player'
import '../styles/podcast.css'

const RANK_LABELS = {
  hot: '热门电台榜',
  new: '新晋电台榜',
  pay: '付费精品',
  hour: '24 小时主播榜',
  newcomer: '主播新人榜',
  popular: '最热主播榜'
}

const PODCAST_SKELETON_MIN_MS = 420
const SATI_PAGE_SIZE = 24
const SATI_MIN_ITEMS = 24
const SATI_MAX_ITEMS = 72

const PODCAST_PAGES = [
  {
    key: 'overview',
    name: 'podcast',
    label: '精选',
    description: '精选推荐、分类和搜索',
    icon: Headphones
  },
  {
    key: 'rank',
    name: 'podcast-rank',
    label: '榜单',
    description: '节目热榜和播客排行',
    icon: AudioLines
  },
  {
    key: 'sleep',
    name: 'podcast-sleep',
    label: '助眠',
    description: '白噪音、冥想和解压声音',
    icon: Moon
  },
  {
    key: 'radio',
    name: 'podcast-radio',
    label: '电台',
    description: 'DIFM 和公共广播频道',
    icon: RadioTower
  }
]

const PodcastCard = defineComponent({
  name: 'PodcastCard',
  props: {
    podcast: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    return () =>
      h(
        RouterLink,
        { class: 'podcast-card', to: props.podcast.to || `/podcast/${props.podcast.id}` },
        () => [
          h('span', { class: 'podcast-card__cover' }, [
            props.podcast.coverUrl
              ? h('img', {
                  src: props.podcast.coverUrl,
                  alt: props.podcast.title,
                  loading: 'lazy',
                  decoding: 'async'
                })
              : null,
            props.podcast.playCountLabel
              ? h('span', { class: 'podcast-card__count' }, props.podcast.playCountLabel)
              : null,
            h('span', { class: 'podcast-card__tag' }, props.podcast.category || '播客')
          ]),
          h('strong', props.podcast.title),
          h('small', props.podcast.description || props.podcast.creator || props.podcast.category)
        ]
      )
  }
})

const route = useRoute()
const player = usePlayerStore()
const message = useMessage()
const categoryLoadSentinel = ref(null)
const satiLoadSentinel = ref(null)
const loading = ref(false)
const skeletonVisible = ref(false)
const homeLoaded = ref(false)
const errorMessage = ref('')
const banners = ref([])
const featuredPodcasts = ref([])
const categories = ref([])
const activeCategoryId = ref('')
const categoryPodcasts = ref([])
const categoryOffset = ref(0)
const categoryMore = ref(false)
const categoryLoading = ref(false)
const categoryError = ref(null)
const programToplist = ref([])
const rankType = ref('hot')
const rankPodcasts = ref([])
const rankLoading = ref(false)
const satiTags = ref([])
const activeSatiTagId = ref('RCMD')
const satiResources = ref([])
const defaultSatiResources = ref([])
const satiVisibleCount = ref(SATI_PAGE_SIZE)
const satiLoading = ref(false)
const difmGroups = ref([])
const difmTracks = ref([])
const broadcastChannels = ref([])
const toArray = (value) => (Array.isArray(value) ? value : [])
let categoryObserver = null
let satiObserver = null
let categoryRequestId = 0

const podcastPages = PODCAST_PAGES
const activePage = computed(() =>
  PODCAST_PAGES.find((page) => page.name === route.name) ?? PODCAST_PAGES[0]
)
const activePageKey = computed(() => activePage.value.key)
const isOverviewPage = computed(() => activePageKey.value === 'overview')
const isSleepPage = computed(() => activePageKey.value === 'sleep')
const heroBanner = computed(() => banners.value[0] ?? null)
const spotlightPodcast = computed(() =>
  featuredPodcasts.value[0] ?? categoryPodcasts.value[0] ?? rankPodcasts.value[0] ?? null
)
const spotlightCoverUrl = computed(() => spotlightPodcast.value?.coverUrl || heroBanner.value?.coverUrl || '')
const heroTitle = computed(() => spotlightPodcast.value?.title || heroBanner.value?.title || '随心听FM')
const heroDescription = computed(() =>
  spotlightPodcast.value?.description ||
  '播客、电台节目、助眠白噪音和广播频道都放在这里，适合通勤、工作和睡前慢慢听。'
)
const activeCategory = computed(() =>
  categories.value.find((item) => String(item.id) === String(activeCategoryId.value))
)
const highScorePodcasts = computed(() =>
  dedupeById([...featuredPodcasts.value, ...categoryPodcasts.value, ...rankPodcasts.value]).slice(0, 4)
)
const hotTopPodcasts = computed(() =>
  dedupeById([...rankPodcasts.value, ...featuredPodcasts.value, ...categoryPodcasts.value]).slice(0, 4)
)
const recommendationPodcasts = computed(() =>
  dedupeById([...categoryPodcasts.value, ...featuredPodcasts.value, ...rankPodcasts.value])
)
const rankLabel = computed(() => RANK_LABELS[rankType.value] || '热门电台榜')
const rankPodcastItems = computed(() => toArray(rankPodcasts.value))
const satiTagItems = computed(() => toArray(satiTags.value))
const satiResourceItems = computed(() => toArray(satiResources.value))
const visibleSatiResources = computed(() => satiResourceItems.value.slice(0, satiVisibleCount.value))
const satiHasMore = computed(() => satiVisibleCount.value < satiResourceItems.value.length)
const difmGroupItems = computed(() => toArray(difmGroups.value))
const difmTrackItems = computed(() => toArray(difmTracks.value))
const broadcastChannelItems = computed(() => toArray(broadcastChannels.value))
const activeSatiTag = computed(() =>
  satiTagItems.value.find((item) => item.tag === activeSatiTagId.value)
)
const difmChannels = computed(() =>
  difmGroupItems.value.flatMap((group) =>
    group.channels?.length
      ? group.channels.map((channel) => ({ ...channel, source: channel.source ?? group.source }))
      : [{ id: group.id, title: group.title, source: group.source, description: '点击加载播放列表' }]
  ).slice(0, 8)
)

onMounted(() => {
  loadHome()
})

onBeforeUnmount(() => {
  disconnectCategoryLoadObserver()
  disconnectSatiLoadObserver()
})

watch([isOverviewPage, homeLoaded], () => {
  if (isOverviewPage.value && homeLoaded.value) {
    nextTick(setupCategoryLoadObserver)
  } else {
    disconnectCategoryLoadObserver()
  }
})

watch([isSleepPage, homeLoaded, () => satiResourceItems.value.length], () => {
  if (isSleepPage.value && homeLoaded.value && satiHasMore.value) {
    nextTick(setupSatiLoadObserver)
  } else {
    disconnectSatiLoadObserver()
  }
})

async function loadHome() {
  const startedAt = Date.now()

  loading.value = true
  skeletonVisible.value = true
  errorMessage.value = ''

  try {
    const data = await getPodcastHomeData()
    banners.value = data.banners
    featuredPodcasts.value = data.featured.length ? data.featured : data.hot
    categories.value = data.categories
    activeCategoryId.value = data.activeCategory?.id ?? data.categories[0]?.id ?? ''
    categoryPodcasts.value = data.categoryRadios.length ? data.categoryRadios : data.hot
    categoryOffset.value = data.categoryRadios.length
    categoryMore.value = Boolean(activeCategoryId.value)
    categoryError.value = null
    programToplist.value = data.programToplist.length ? data.programToplist : data.today
    rankPodcasts.value = Array.isArray(data.hot) ? data.hot : []
    satiTags.value = toArray(data.satiTags)
    activeSatiTagId.value = satiTags.value[0]?.tag ?? 'RCMD'
    let initialSatiResources = toArray(data.satiResources)

    if (!initialSatiResources.length) {
      try {
        initialSatiResources = toArray(await getSatiResourcesData('RCMD'))
      } catch (error) {
        console.warn('Failed to load default sati resources:', error)
      }
    }

    const initialSatiPool = fillSatiResources(initialSatiResources)

    defaultSatiResources.value = initialSatiPool
    satiResources.value = initialSatiPool
    satiVisibleCount.value = SATI_PAGE_SIZE
    difmGroups.value = toArray(data.difm)
    broadcastChannels.value = toArray(data.broadcastChannels)
    homeLoaded.value = true
    nextTick(setupCategoryLoadObserver)
  } catch (error) {
    console.warn('Failed to load podcasts:', error)
    errorMessage.value = error?.message || '播客加载失败'
    message.error(errorMessage.value)
  } finally {
    await waitForSkeleton(startedAt)
    skeletonVisible.value = false
    loading.value = false
  }
}

function waitForSkeleton(startedAt) {
  const remaining = PODCAST_SKELETON_MIN_MS - (Date.now() - startedAt)

  if (remaining <= 0) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    window.setTimeout(resolve, remaining)
  })
}

function loadCategoryMore({ force = false } = {}) {
  if (
    !isOverviewPage.value ||
    loading.value ||
    categoryLoading.value ||
    !categoryMore.value ||
    (categoryError.value && !force)
  ) {
    return
  }

  loadCategory({ reset: false })
}

async function selectCategory(item) {
  if (String(activeCategoryId.value) === String(item.id)) {
    return
  }

  activeCategoryId.value = item.id
  disconnectCategoryLoadObserver()
  categoryRequestId += 1
  categoryLoading.value = false
  categoryError.value = null
  categoryPodcasts.value = item.radios?.length ? item.radios : []
  categoryOffset.value = categoryPodcasts.value.length
  categoryMore.value = true

  if (!categoryPodcasts.value.length) {
    await loadCategory({ reset: true })
  } else {
    nextTick(setupCategoryLoadObserver)
  }
}

async function loadCategory({ reset = false } = {}) {
  if (!activeCategoryId.value || (!reset && (categoryLoading.value || !categoryMore.value))) {
    return
  }

  if (reset) {
    disconnectCategoryLoadObserver()
    categoryOffset.value = 0
    categoryMore.value = true
  }

  categoryError.value = null
  categoryLoading.value = true
  const requestId = ++categoryRequestId
  const cateId = activeCategoryId.value

  try {
    const offset = reset ? 0 : categoryOffset.value
    const data = await getPodcastCategoryData({
      cateId,
      limit: 18,
      offset
    })

    if (requestId !== categoryRequestId || String(cateId) !== String(activeCategoryId.value)) {
      return
    }

    categoryPodcasts.value = reset ? data.items : dedupeById([...categoryPodcasts.value, ...data.items])
    categoryOffset.value = reset ? data.items.length : offset + data.items.length
    categoryMore.value = Boolean(data.more && data.items.length)
  } catch (error) {
    if (requestId !== categoryRequestId) {
      return
    }

    console.warn('Failed to load podcast category:', error)
    categoryError.value = error
    message.error(error?.message || '分类播客加载失败')
  } finally {
    if (requestId === categoryRequestId) {
      categoryLoading.value = false
      nextTick(setupCategoryLoadObserver)
    }
  }
}

function setupCategoryLoadObserver() {
  disconnectCategoryLoadObserver()

  if (!isOverviewPage.value || !homeLoaded.value || !categoryLoadSentinel.value || typeof IntersectionObserver === 'undefined') {
    return
  }

  const scrollRoot = categoryLoadSentinel.value.closest('.view')
  categoryObserver = new IntersectionObserver(handleCategoryLoadIntersect, {
    root: scrollRoot,
    rootMargin: '360px 0px 360px',
    threshold: 0
  })
  categoryObserver.observe(categoryLoadSentinel.value)
}

function handleCategoryLoadIntersect(entries) {
  if (entries.some((entry) => entry.isIntersecting)) {
    loadCategoryMore()
  }
}

function setupSatiLoadObserver() {
  disconnectSatiLoadObserver()

  if (!isSleepPage.value || !homeLoaded.value || !satiLoadSentinel.value || !satiHasMore.value || typeof IntersectionObserver === 'undefined') {
    return
  }

  const scrollRoot = satiLoadSentinel.value.closest('.view')
  satiObserver = new IntersectionObserver(handleSatiLoadIntersect, {
    root: scrollRoot,
    rootMargin: '360px 0px 360px',
    threshold: 0
  })
  satiObserver.observe(satiLoadSentinel.value)
}

function handleSatiLoadIntersect(entries) {
  if (entries.some((entry) => entry.isIntersecting)) {
    revealMoreSatiResources()
  }
}

function revealMoreSatiResources() {
  if (!satiHasMore.value) {
    disconnectSatiLoadObserver()
    return
  }

  satiVisibleCount.value = Math.min(
    satiVisibleCount.value + SATI_PAGE_SIZE,
    satiResourceItems.value.length
  )

  nextTick(() => {
    if (satiHasMore.value) {
      setupSatiLoadObserver()
    } else {
      disconnectSatiLoadObserver()
    }
  })
}

function disconnectCategoryLoadObserver() {
  if (!categoryObserver) {
    return
  }

  categoryObserver.disconnect()
  categoryObserver = null
}

function disconnectSatiLoadObserver() {
  if (!satiObserver) {
    return
  }

  satiObserver.disconnect()
  satiObserver = null
}

async function loadRank() {
  if (rankLoading.value) {
    return
  }

  rankLoading.value = true

  try {
    const data = await getPodcastRankData({ type: rankType.value, limit: 12, offset: 0 })
    rankPodcasts.value = Array.isArray(data.items) ? data.items : []
  } catch (error) {
    console.warn('Failed to load podcast rank:', error)
    message.error(error?.message || '播客榜单加载失败')
  } finally {
    rankLoading.value = false
  }
}

async function selectSatiTag(item) {
  if (activeSatiTagId.value === item.tag || satiLoading.value) {
    return
  }

  activeSatiTagId.value = item.tag
  satiVisibleCount.value = SATI_PAGE_SIZE
  disconnectSatiLoadObserver()
  satiLoading.value = true

  try {
    const resources = toArray(await getSatiResourcesData(item.tag))
    const fallbackResources = await getDefaultSatiResources()

    satiResources.value = fillSatiResources(resources, fallbackResources)
    satiVisibleCount.value = SATI_PAGE_SIZE
    nextTick(setupSatiLoadObserver)
  } catch (error) {
    console.warn('Failed to load sati resources:', error)
    message.error(error?.message || '助眠声音加载失败')
  } finally {
    satiLoading.value = false
  }
}

async function loadDifmTracks(channel) {
  try {
    difmTracks.value = toArray(await getDifmChannelTracksData({
      source: channel.source,
      channelId: channel.id,
      limit: 12
    }))
  } catch (error) {
    console.warn('Failed to load DIFM tracks:', error)
    message.error(error?.message || 'DIFM 播放列表加载失败')
  }
}

async function playProgram(track, queue) {
  player.setQueue(queue)
  const played = await player.playTrack(track)

  if (!played) {
    message.error(player.state.error?.message || '当前声音暂无可播放链接')
  }
}

function playSatiResource(track) {
  playProgram(track, visibleSatiResources.value)
}

function getPodcastTo(podcast) {
  return podcast?.to || `/podcast/${podcast?.id || ''}`
}

async function getDefaultSatiResources() {
  if (defaultSatiResources.value.length) {
    return defaultSatiResources.value
  }

  defaultSatiResources.value = fillSatiResources(await getSatiResourcesData('RCMD'))
  return defaultSatiResources.value
}

function fillSatiResources(resources = [], fallbackResources = []) {
  const baseItems = dedupeById(toArray(resources))

  if (baseItems.length >= SATI_MIN_ITEMS) {
    return baseItems.slice(0, SATI_MAX_ITEMS)
  }

  return dedupeById([...baseItems, ...toArray(fallbackResources)]).slice(0, SATI_MAX_ITEMS)
}

function dedupeById(items = []) {
  const seenIds = new Set()

  return items.filter((item) => {
    const id = String(item?.id ?? '')

    if (!id || seenIds.has(id)) {
      return false
    }

    seenIds.add(id)
    return true
  })
}
</script>
