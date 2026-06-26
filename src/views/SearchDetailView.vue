<template>
  <div ref="pageRoot" class="view search-detail" @scroll.passive="scheduleSearchRangeUpdate">
    <section class="search-detail__head">
      <div>
        <span class="tag">Search result</span>
        <h1>{{ keyword || '搜索结果' }}</h1>
        <p>{{ resultSummary }}</p>
      </div>

      <div class="search-detail__input">
        <n-input
          v-model:value="searchInput"
          round
          clearable
          size="large"
          placeholder="搜索音乐、歌手、专辑、歌单、MV"
          @keydown.enter.prevent="submitSearch()"
        >
          <template #prefix>
            <Search :size="18" />
          </template>
        </n-input>
        <button type="button" class="search-page__submit" @click="submitSearch()">
          <Search :size="17" />
          <span>搜索</span>
        </button>
      </div>
    </section>

    <nav class="search-tabs search-detail__tabs" aria-label="搜索分类">
      <button
        v-for="tab in searchTabs"
        :key="tab.type"
        type="button"
        :class="{ active: activeSearchType === tab.type }"
        @click="switchSearchType(tab.type)"
      >
        <component :is="tab.icon" :size="15" />
        <span>{{ tab.label }}</span>
      </button>
    </nav>

    <section v-if="activeSearchType === 1" class="playlist-table search-detail__table">
      <header class="playlist-table__head">
        <span>标题</span>
        <span>专辑</span>
        <span>时长</span>
      </header>

      <div v-if="resultLoading && !displayItems.length" class="search-page__state">
        <Loader2 class="spin" :size="18" />
        <span>正在搜索</span>
      </div>

      <div v-else-if="!displayItems.length" class="search-page__state">
        没有找到相关歌曲
      </div>

      <div
        ref="searchTrackVirtualList"
        class="playlist-virtual-list"
        :style="{ height: `${searchVirtualTotalHeight}px` }"
      >
        <div
          class="playlist-virtual-window"
          :style="{ transform: `translateY(${searchVirtualOffsetY}px)` }"
        >
          <SongListRow
            v-for="item in visibleSearchSongItems"
            :key="`song-${item.id}`"
            :track="item"
            @play="playSearchSong"
          />
        </div>
      </div>
    </section>

    <section v-else class="search-detail__grid">
      <div v-if="resultLoading && !displayItems.length" class="search-page__state">
        <Loader2 class="spin" :size="18" />
        <span>正在搜索</span>
      </div>

      <div v-else-if="!displayItems.length" class="search-page__state">
        没有找到相关内容
      </div>

      <button
        v-for="item in displayItems"
        :key="`${activeSearchType}-${item.id}`"
        type="button"
        class="search-detail-card"
        @click="handleResultSelect(item)"
      >
        <span class="search-detail-card__cover">
          <img
            v-if="item.coverUrl"
            :src="item.coverUrl"
            :alt="item.title || item.name"
            loading="lazy"
            decoding="async"
          />
          <component v-else :is="activeTabIcon" :size="24" />
        </span>
        <span class="search-detail-card__body">
          <strong>{{ item.title || item.name }}</strong>
          <small>{{ item.subtitle || getResultSubtitle(item) }}</small>
        </span>
      </button>
    </section>

    <div v-if="showLoadMore" class="search-detail__load-more" aria-live="polite">
      <button type="button" :disabled="resultLoading" @click="loadMoreResults">
        <Loader2 v-if="resultLoading" class="spin" :size="16" />
        <span>{{ resultLoading ? '正在加载' : '加载更多' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Disc3,
  ListMusic,
  Loader2,
  Music,
  Search,
  User,
  Video
} from 'lucide-vue-next'
import { useMessage } from 'naive-ui'
import SongListRow from '../components/SongListRow.vue'
import { useSearchHistory } from '../composables/useSearch'
import { useVirtualRows } from '../composables/useVirtualRows'
import { getSearchResultData } from '../services/netease'
import { usePlayerStore } from '../stores/player'
import { formatCompactCount } from '../utils/number'
import { getPlaybackErrorDisplay } from '../utils/playbackError'
import { isAbortError } from '../utils/request'
import '../styles/playlist.css'
import '../styles/search.css'

const SEARCH_PAGE_SIZE = 30
const TRACK_ROW_HEIGHT = 58
const searchTabs = [
  { label: '单曲', type: 1, icon: Music },
  { label: '歌手', type: 100, icon: User },
  { label: '专辑', type: 10, icon: Disc3 },
  { label: '歌单', type: 1000, icon: ListMusic },
  { label: '用户', type: 1002, icon: User },
  { label: 'MV', type: 1004, icon: Video }
]

const route = useRoute()
const router = useRouter()
const player = usePlayerStore()
const message = useMessage()

const pageRoot = ref(null)
const searchTrackVirtualList = ref(null)
const searchInput = ref('')
const activeSearchType = ref(normalizeSearchType(route.query.type))
const searchResults = ref([])
const resultTotal = ref(0)
const resultHasMore = ref(false)
const resultLoading = ref(false)
const resultError = ref('')
let resultRequestId = 0
let resultController = null
const { rememberSearchHistory } = useSearchHistory()

const keyword = computed(() => String(route.params.keyword ?? route.query.keyword ?? '').trim())
const activeTabIcon = computed(() =>
  searchTabs.find((tab) => tab.type === activeSearchType.value)?.icon ?? Search
)
const displayItems = computed(() =>
  searchResults.value.map((item, index) => ({
    ...item,
    rank: activeSearchType.value === 1 ? String(index + 1).padStart(2, '0') : item.rank
  }))
)
const {
  offsetY: searchVirtualOffsetY,
  scheduleRangeUpdate: scheduleSearchRangeUpdate,
  totalHeight: searchVirtualTotalHeight,
  updateRange: updateSearchVirtualRange,
  visibleItems: visibleSearchSongItems
} = useVirtualRows(displayItems, {
  root: pageRoot,
  list: searchTrackVirtualList,
  rowHeight: TRACK_ROW_HEIGHT
})
const resultSummary = computed(() => {
  if (!keyword.value) {
    return '输入关键词开始搜索'
  }

  if (resultLoading.value && !searchResults.value.length) {
    return '正在从酷狗音乐获取结果'
  }

  if (resultError.value) {
    return resultError.value
  }

  const total = resultTotal.value || searchResults.value.length
  return total ? `找到 ${formatCompactCount(total)} 个结果` : '暂无匹配结果'
})
const showLoadMore = computed(() =>
  Boolean(keyword.value && !resultError.value && searchResults.value.length && resultHasMore.value)
)

watch(
  () => route.params.keyword,
  (value) => {
    const query = String(value ?? '').trim()
    searchInput.value = query
    loadResults({ reset: true })
  },
  { immediate: true }
)

watch(
  () => route.query.type,
  (value) => {
    const nextType = normalizeSearchType(value)

    if (nextType === activeSearchType.value) {
      return
    }

    activeSearchType.value = nextType
    nextTick(updateSearchVirtualRange)
    loadResults({ reset: true })
  }
)

onUnmounted(() => {
  cancelResultRequest()
})

function submitSearch(value = searchInput.value) {
  const query = String(value ?? '').trim()

  if (!query) {
    router.push({ name: 'search' })
    return
  }

  rememberSearchHistory(query)
  router.push({
    name: 'search-detail',
    params: { keyword: query },
    query: activeSearchType.value === 1 ? {} : { type: String(activeSearchType.value) }
  })
}

function switchSearchType(type) {
  if (activeSearchType.value === type) {
    return
  }

  activeSearchType.value = type
  router.replace({
    name: 'search-detail',
    params: { keyword: keyword.value },
    query: type === 1 ? {} : { type: String(type) }
  })
  loadResults({ reset: true })
}

function loadMoreResults() {
  return loadResults({ reset: false })
}

async function loadResults({ reset = true } = {}) {
  if (resultLoading.value && !reset) {
    return
  }

  if (!keyword.value) {
    cancelResultRequest()
    searchResults.value = []
    resultTotal.value = 0
    resultHasMore.value = false
    resultError.value = ''
    return
  }

  cancelResultRequest()
  const requestId = ++resultRequestId
  const controller = new AbortController()
  const offset = reset ? 0 : searchResults.value.length
  resultController = controller
  resultLoading.value = true
  resultError.value = ''

  try {
    const data = await getSearchResultData({
      keyword: keyword.value,
      type: activeSearchType.value,
      limit: SEARCH_PAGE_SIZE,
      offset
    }, {
      signal: controller.signal
    })

    if (requestId !== resultRequestId || controller.signal.aborted) {
      return
    }

    const previousResultCount = reset ? 0 : searchResults.value.length
    const nextItems = reset ? data.items : [...searchResults.value, ...data.items]

    searchResults.value = uniqueItems(nextItems)
    resultTotal.value = data.total || searchResults.value.length
    resultHasMore.value = Boolean(data.hasMore && searchResults.value.length > previousResultCount)
  } catch (error) {
    if (isAbortError(error)) {
      return
    }

    if (requestId !== resultRequestId) {
      return
    }

    console.warn('Failed to load search results:', error)
    resultError.value = '搜索失败，请稍后再试'
    message.error(resultError.value)
  } finally {
    if (resultController === controller) {
      resultController = null
    }

    if (requestId === resultRequestId && !controller.signal.aborted) {
      resultLoading.value = false
    }
  }
}

function cancelResultRequest() {
  resultRequestId += 1

  if (!resultController) {
    return
  }

  resultController.abort()
  resultController = null
  resultLoading.value = false
}

function uniqueItems(items = []) {
  const seen = new Set()
  const output = []

  for (const item of items) {
    const key = `${activeSearchType.value}-${item?.id ?? item?.title ?? item?.name}`

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    output.push(item)
  }

  return output
}

function handleResultSelect(item) {
  if (item.to) {
    router.push(item.to)
    return
  }

  if (item.title || item.name) {
    submitSearch(item.title || item.name)
  }
}

async function playSearchSong(song) {
  if (String(player.state.currentTrack.id) === String(song.id)) {
    await player.togglePlay()
    return
  }

  const played = await player.playTrack(song)
  if (played) {
    player.appendToQueue(song, { type: 'search-detail', id: keyword.value })
  }

  if (!played) {
    message.error(getPlaybackErrorDisplay(player.state.error, '当前歌曲暂无可播放链接'))
  }
}

function getResultSubtitle(item) {
  if (activeSearchType.value === 1) {
    return [item.artist, item.album, item.duration].filter(Boolean).join(' · ')
  }

  return item.subtitle || ''
}

function normalizeSearchType(value) {
  const type = Number(value) || 1
  return searchTabs.some((tab) => tab.type === type) ? type : 1
}
</script>
