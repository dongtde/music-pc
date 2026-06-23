<template>
  <div class="view podcast-view">
    <section
      v-if="isOverviewPage && skeletonVisible"
      class="podcast-showcase podcast-showcase--skeleton"
      aria-busy="true"
      aria-label="电台内容加载中"
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
            <small><Radio :size="14" /> 酷狗电台</small>
            <strong>{{ heroTitle }}</strong>
            <em>{{ heroDescription }}</em>
          </span>
          <span class="podcast-showcase__signal">
            <RadioTower :size="22" />
          </span>
        </RouterLink>
      </article>

      <article class="podcast-showcase__panel podcast-showcase__panel--green">
        <div class="podcast-showcase__head">
          <strong>场景热播</strong>
          <a href="#podcast-hot-rank">查看全部</a>
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
          <strong>今日推荐</strong>
          <a href="#podcast-hot-rank">查看全部</a>
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
        <section class="podcast-home-rank" aria-hidden="true">
          <section class="podcast-rank-layout">
            <article class="podcast-panel podcast-rank-main">
              <div class="podcast-section__head">
                <span class="podcast-skeleton podcast-skeleton--heading" />
                <span class="podcast-skeleton podcast-skeleton--mini" />
              </div>
              <div class="podcast-program-list podcast-rank-programs">
                <span v-for="item in 8" :key="`home-program-skeleton-${item}`" class="podcast-rank-program-skeleton">
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
                  <span class="podcast-skeleton podcast-skeleton--mini" />
                </div>
                <div class="podcast-rank-podium">
                  <article v-for="item in 12" :key="`home-rank-card-skeleton-${item}`" class="podcast-card podcast-card--skeleton">
                    <span class="podcast-skeleton podcast-skeleton--cover" />
                    <span class="podcast-skeleton podcast-skeleton--line" />
                  </article>
                </div>
              </article>
            </aside>
          </section>
        </section>

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
        <section id="podcast-hot-rank" class="podcast-home-rank">
          <section class="podcast-rank-layout" aria-label="推荐电台和歌曲">
            <article class="podcast-panel podcast-rank-main">
              <div class="podcast-section__head">
                <div>
                  <strong>推荐歌曲</strong>
                </div>
                <AudioLines :size="18" />
              </div>
              <div class="podcast-program-list podcast-rank-programs">
                <SongListRow
                  v-for="track in programToplist"
                  :key="`home-program-${track.programId || track.id}`"
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
                    <strong>热门推荐</strong>
                  </div>
                  <RadioTower :size="18" />
                </div>

                <div v-if="rankPodcastItems.length" class="podcast-rank-podium">
                  <RouterLink
                    v-for="(item, index) in rankPodcastItems"
                    :key="`home-rank-leader-${item.id}`"
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
            <span v-else-if="!categoryMore && categoryPodcasts.length">没有更多电台了</span>
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
                  <strong>推荐歌曲</strong>
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
                      <option value="hot">热门推荐</option>
                      <option value="new">最新上线</option>
                      <option value="library">乐库精选</option>
                      <option value="classic">经典主题</option>
                      <option value="scene">场景电台</option>
                      <option value="heat">热度排行</option>
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

      <template v-else-if="activePageKey === 'library'">
        <section class="podcast-radio-page">
          <section
            v-for="group in libraryGroupItems"
            :key="`radio-library-${group.id}`"
            class="podcast-section podcast-radio-broadcast"
          >
            <div class="podcast-section__head">
              <div>
                <strong>{{ group.title }}</strong>
                <small>{{ group.description || '乐库电台推荐' }}</small>
              </div>
              <RadioTower :size="18" />
            </div>
            <div class="podcast-card-grid">
              <PodcastCard
                v-for="item in group.channels"
                :key="`library-radio-${group.id}-${item.id}`"
                :podcast="item"
              />
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
                  <strong>乐库分组</strong>
                </div>
                <RadioTower :size="18" />
              </div>
              <div v-if="libraryGroupItems.length" class="podcast-radio-channel-grid">
                <RouterLink
                  v-for="group in libraryGroupItems"
                  :key="`radio-group-${group.id}`"
                  class="podcast-radio-channel"
                  :to="{ name: 'podcast-sleep' }"
                >
                  <span><RadioReceiver :size="16" /></span>
                  <strong>{{ group.title }}</strong>
                  <small>{{ group.description || `${group.channels?.length || 0} 个电台` }}</small>
                </RouterLink>
              </div>
            </article>

            <article class="podcast-section podcast-radio-now">
              <div class="podcast-section__head">
                <div>
                  <strong>今日推荐歌曲</strong>
                </div>
                <RadioReceiver :size="18" />
              </div>
              <div v-if="programToplist.length" class="podcast-program-list podcast-radio-track-list">
                <SongListRow
                  v-for="track in programToplist"
                  :key="`radio-preview-track-${track.id}`"
                  :track="track"
                  compact
                  @play="playProgram(track, programToplist)"
                />
              </div>
              <div v-else class="podcast-state">暂无推荐歌曲。</div>
            </article>

            <article class="podcast-section podcast-radio-broadcast">
              <div class="podcast-section__head">
                <div>
                  <strong>全部电台</strong>
                  <small>{{ broadcastChannelItems.length }} 个电台</small>
                </div>
                <Radio :size="18" />
              </div>
              <div class="podcast-card-grid">
                <PodcastCard
                  v-for="item in broadcastChannelItems"
                  :key="`broadcast-${item.id}`"
                  :podcast="item"
                />
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
  LoaderCircle,
  Radio,
  RadioReceiver,
  RadioTower,
  RefreshCw
} from 'lucide-vue-next'
import SongListRow from '../components/SongListRow.vue'
import { useLoadMoreTrigger } from '../composables/useLoadMoreTrigger'
import {
  getPodcastCategoryData,
  getPodcastHomeData,
  getPodcastRankData
} from '../services/netease'
import { usePlayerStore } from '../stores/player'
import { createLruCache } from '../utils/lruCache'
import { getPlaybackErrorDisplay } from '../utils/playbackError'
import { isAbortError } from '../utils/request'
import '../styles/podcast.css'

const RANK_LABELS = {
  hot: '热门推荐',
  new: '最新上线',
  library: '乐库精选',
  classic: '经典主题',
  scene: '场景电台',
  heat: '热度排行'
}

const PODCAST_SKELETON_MIN_MS = 420
const PODCAST_CATEGORY_PAGE_SIZE = 18
const PODCAST_RANK_LIMIT = 12
const podcastRankCache = createLruCache(8)

const PODCAST_PAGES = [
  {
    key: 'overview',
    name: 'podcast'
  },
  {
    key: 'rank',
    name: 'podcast-rank'
  },
  {
    key: 'library',
    name: 'podcast-sleep'
  },
  {
    key: 'radio',
    name: 'podcast-radio'
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
            h('span', { class: 'podcast-card__tag' }, props.podcast.category || '电台')
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
const libraryGroups = ref([])
const broadcastChannels = ref([])
const toArray = (value) => (Array.isArray(value) ? value : [])
let categoryRequestId = 0
let categoryRequestController = null

const activePage = computed(() =>
  PODCAST_PAGES.find((page) => page.name === route.name) ?? PODCAST_PAGES[0]
)
const activePageKey = computed(() => activePage.value.key)
const isOverviewPage = computed(() => activePageKey.value === 'overview')
const heroBanner = computed(() => banners.value[0] ?? null)
const spotlightPodcast = computed(() =>
  featuredPodcasts.value[0] ?? categoryPodcasts.value[0] ?? rankPodcasts.value[0] ?? null
)
const spotlightCoverUrl = computed(() => spotlightPodcast.value?.coverUrl || heroBanner.value?.coverUrl || '')
const heroTitle = computed(() => spotlightPodcast.value?.title || heroBanner.value?.title || '酷狗电台')
const heroDescription = computed(() =>
  spotlightPodcast.value?.description ||
  '按主题、场景和时间挑选电台，进入后可连续播放当前电台的实时歌曲列表。'
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
const rankLabel = computed(() => RANK_LABELS[rankType.value] || '热门推荐')
const rankPodcastItems = computed(() => toArray(rankPodcasts.value))
const libraryGroupItems = computed(() => toArray(libraryGroups.value))
const broadcastChannelItems = computed(() => toArray(broadcastChannels.value))
const categoryLoadMoreController = useLoadMoreTrigger({
  trigger: categoryLoadSentinel,
  canLoad: () =>
    isOverviewPage.value &&
    homeLoaded.value &&
    !loading.value &&
    !categoryLoading.value &&
    categoryMore.value &&
    !categoryError.value,
  loadMore: () => loadCategoryMore(),
  getRoot: (element) => element?.closest?.('.view') ?? null,
  rootMargin: '360px 0px 360px',
  scrollThreshold: 360,
  threshold: 0
})

onMounted(() => {
  loadHome()
})

onBeforeUnmount(() => {
  categoryLoadMoreController.cleanup()
  cancelCategoryRequest()
})

watch([isOverviewPage, homeLoaded], () => {
  if (isOverviewPage.value && homeLoaded.value) {
    nextTick(categoryLoadMoreController.setup)
  } else {
    categoryLoadMoreController.cleanup()
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
    cachePodcastRank(rankType.value, rankPodcasts.value)
    libraryGroups.value = toArray(data.yuekuGroups || data.difm)
    broadcastChannels.value = toArray(data.broadcastChannels)
    homeLoaded.value = true
    nextTick(categoryLoadMoreController.setup)
  } catch (error) {
    console.warn('Failed to load radios:', error)
    errorMessage.value = error?.message || '电台加载失败'
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
  categoryLoadMoreController.cleanup()
  cancelCategoryRequest()
  categoryError.value = null
  categoryPodcasts.value = item.radios?.length ? item.radios : []
  categoryOffset.value = categoryPodcasts.value.length
  categoryMore.value = true

  if (!categoryPodcasts.value.length) {
    await loadCategory({ reset: true })
  } else {
    nextTick(categoryLoadMoreController.setup)
  }
}

async function loadCategory({ reset = false } = {}) {
  if (!activeCategoryId.value || (!reset && (categoryLoading.value || !categoryMore.value))) {
    return
  }

  if (reset) {
    categoryLoadMoreController.cleanup()
    cancelCategoryRequest()
    categoryOffset.value = 0
    categoryMore.value = true
  }

  categoryError.value = null
  categoryLoading.value = true
  const requestId = ++categoryRequestId
  const controller = new AbortController()
  categoryRequestController = controller
  const cateId = activeCategoryId.value

  try {
    const offset = reset ? 0 : categoryOffset.value
    const data = await getPodcastCategoryData({
      cateId,
      limit: PODCAST_CATEGORY_PAGE_SIZE,
      offset
    }, {
      signal: controller.signal
    })

    if (
      requestId !== categoryRequestId ||
      controller.signal.aborted ||
      String(cateId) !== String(activeCategoryId.value)
    ) {
      return
    }

    const previousPodcastCount = categoryPodcasts.value.length

    categoryPodcasts.value = reset ? data.items : dedupeById([...categoryPodcasts.value, ...data.items])
    categoryOffset.value = categoryPodcasts.value.length
    categoryMore.value = Boolean(
      data.more &&
      data.items.length &&
      (reset || categoryPodcasts.value.length > previousPodcastCount)
    )
  } catch (error) {
    if (isAbortError(error) || requestId !== categoryRequestId) {
      return
    }

    console.warn('Failed to load radio category:', error)
    categoryError.value = error
    message.error(error?.message || '分类电台加载失败')
  } finally {
    if (requestId === categoryRequestId && !controller.signal.aborted) {
      categoryLoading.value = false
      nextTick(categoryLoadMoreController.setup)
    }

    if (categoryRequestController === controller) {
      categoryRequestController = null
    }
  }
}

function cancelCategoryRequest() {
  categoryRequestId += 1

  if (categoryRequestController) {
    categoryRequestController.abort()
    categoryRequestController = null
  }

  categoryLoading.value = false
}

async function loadRank() {
  if (rankLoading.value) {
    return
  }

  const rankCacheKey = getPodcastRankCacheKey(rankType.value)
  const cachedItems = podcastRankCache.get(rankCacheKey)

  if (cachedItems) {
    rankPodcasts.value = cachedItems
    return
  }

  rankLoading.value = true

  try {
    const data = await getPodcastRankData({ type: rankType.value, limit: PODCAST_RANK_LIMIT, offset: 0 })
    rankPodcasts.value = Array.isArray(data.items) ? data.items : []
    cachePodcastRank(rankType.value, rankPodcasts.value)
  } catch (error) {
    console.warn('Failed to load radio rank:', error)
    message.error(error?.message || '电台榜单加载失败')
  } finally {
    rankLoading.value = false
  }
}

function cachePodcastRank(type, items = []) {
  podcastRankCache.set(getPodcastRankCacheKey(type), [...items])
}

function getPodcastRankCacheKey(type) {
  return `${type || 'hot'}:${PODCAST_RANK_LIMIT}:0`
}

async function playProgram(track, queue) {
  player.setQueue(queue, getPodcastProgramQueueSource())
  const played = await player.playTrack(track)

  if (!played) {
    message.error(getPlaybackErrorDisplay(player.state.error, '当前歌曲暂无可播放链接'))
  }
}

function getPodcastProgramQueueSource() {
  const sourceId = activePageKey.value === 'rank'
    ? rankType.value
    : activeCategoryId.value || activePageKey.value

  return {
    type: 'podcast-programs',
    id: sourceId
  }
}

function getPodcastTo(podcast) {
  return podcast?.to || `/podcast/${podcast?.id || ''}`
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
