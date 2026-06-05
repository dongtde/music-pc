<template>
  <header class="topbar">
    <div class="history-actions">
      <button type="button" aria-label="后退" @click="router.back()"><ChevronLeft :size="20" /></button>
      <button type="button" aria-label="前进" @click="router.forward()"><ChevronRight :size="20" /></button>
    </div>

    <div
      ref="searchWrap"
      class="top-search"
      :class="{ 'top-search--open': searchExpanded }"
      @focusout="handleSearchFocusOut"
      @pointerdown.capture="handleSearchPointerDown"
    >
      <n-input
        v-model:value="searchKeyword"
        round
        clearable
        :placeholder="searchPlaceholder"
        class="search-input"
        @focus="openSearchPanel"
        @clear="clearSearch"
        @keydown.enter.prevent="submitSearch()"
      >
        <template #prefix>
          <Search :size="18" />
        </template>
      </n-input>

      <Transition name="search-panel" @after-leave="handleSearchPanelAfterLeave">
        <div v-if="searchPanelVisible" class="search-panel" @pointerdown.prevent>
        <section v-if="!trimmedKeyword && !searchedKeyword" class="search-section">
          <div v-if="searchHistory.length" class="search-history-block">
            <header class="search-section__head search-section__head--controls">
              <strong>历史搜索</strong>
              <button
                type="button"
                class="mini-action search-history-clear"
                aria-label="清空历史搜索"
                @click="clearSearchHistory"
              >
                <Trash2 :size="14" />
              </button>
            </header>
            <div class="search-history-list">
              <button
                v-for="item in searchHistory"
                :key="item"
                class="search-history-item"
                type="button"
                @click="pickKeyword(item)"
              >
                <Clock3 :size="14" />
                <span>{{ item }}</span>
              </button>
            </div>
          </div>
          <header class="search-section__head">
            <strong>热门搜索</strong>
            <small>{{ defaultKeyword ? `默认：${defaultKeyword}` : '发现今天大家都在听什么' }}</small>
          </header>
          <div class="hot-search-list">
            <button
              v-for="(item, index) in hotKeywords"
              :key="item.id"
              class="hot-search-item"
              type="button"
              @click="pickKeyword(item.keyword)"
            >
              <span :class="{ hot: index < 3 }">{{ index + 1 }}</span>
              <div>
                <strong>{{ item.keyword }}</strong>
                <small>{{ item.content || formatScore(item.score) }}</small>
              </div>
            </button>
          </div>
        </section>

        <section v-else-if="trimmedKeyword && !searchedKeyword" class="search-section">
          <header class="search-section__head">
            <strong>搜索建议</strong>
            <small>按 Enter 搜索“{{ trimmedKeyword }}”</small>
          </header>
          <div v-if="suggestLoading" class="search-empty">
            <Loader2 class="spin" :size="18" />
            <span>正在获取联想</span>
          </div>
          <template v-else>
            <button class="search-all-button" type="button" @click="submitSearch(trimmedKeyword)">
              <Search :size="16" />
              <span>搜索 “{{ trimmedKeyword }}”</span>
            </button>
            <div v-if="keywordSuggestions.length" class="keyword-suggest-list">
              <button
                v-for="item in keywordSuggestions"
                :key="item.id"
                type="button"
                @click="pickKeyword(item.title)"
              >
                <img
                  v-if="item.iconUrl"
                  :src="item.iconUrl"
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <Search v-else :size="15" />
                <span>{{ item.title }}</span>
                <small>{{ item.subtitle }}</small>
              </button>
            </div>
            <div v-if="suggestMatches.length" class="suggest-chip-row">
              <button
                v-for="item in suggestMatches"
                :key="item.id"
                type="button"
                @click="pickKeyword(item.title)"
              >
                {{ item.title }}
              </button>
            </div>
            <SearchGroup title="单曲" :items="suggestions.songs" @select="handleSuggestionSelect" />
            <SearchGroup title="歌手" :items="suggestions.artists" @select="handleSuggestionSelect" />
            <SearchGroup title="专辑" :items="suggestions.albums" @select="handleSuggestionSelect" />
            <SearchGroup title="歌单" :items="suggestions.playlists" @select="handleSuggestionSelect" />
            <div v-if="!hasSuggestions" class="search-empty">
              <span>暂时没有联想结果</span>
            </div>
          </template>
        </section>

        <section v-else class="search-section search-section--results">
          <header class="search-section__head">
            <strong>搜索结果</strong>
            <small>{{ resultTotal ? `${resultTotal} 个结果` : `“${searchedKeyword}”` }}</small>
          </header>
          <nav class="search-tabs" aria-label="搜索分类">
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
          <div v-if="resultLoading" class="search-empty">
            <Loader2 class="spin" :size="18" />
            <span>正在搜索</span>
          </div>
          <div v-else-if="!searchResults.length" class="search-empty">
            <span>没有找到相关内容</span>
          </div>
          <div v-else-if="activeSearchType === 1" class="search-song-result-list">
            <SongListRow
              v-for="item in searchResults"
              :key="`song-${item.id}`"
              :track="item"
              compact
              @play="handleSearchSongPlay"
            />
          </div>
          <div v-else class="search-result-list">
            <button
              v-for="item in searchResults"
              :key="`${activeSearchType}-${item.id}`"
              class="search-result-row"
              type="button"
              @click="handleResultSelect(item)"
            >
              <span class="search-cover">
                <img
                  v-if="item.coverUrl"
                  :src="item.coverUrl"
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <component v-else :is="activeTabIcon" :size="18" />
              </span>
              <div>
                <strong>{{ item.title || item.name }}</strong>
                <small>{{ getResultSubtitle(item) }}</small>
              </div>
            </button>
          </div>
        </section>
        </div>
      </Transition>
    </div>

    <div class="topbar__spacer" />
    <button class="icon-button" type="button" aria-label="消息"><Mail :size="18" /></button>
    <button
      class="icon-button"
      type="button"
      :aria-label="theme.state.mode === 'dark' ? '切换浅色主题' : '切换深色主题'"
      @click="theme.toggleTheme"
    >
      <Sun v-if="theme.state.mode === 'dark'" :size="18" />
      <Moon v-else :size="18" />
    </button>
    <router-link class="icon-button" to="/settings" aria-label="设置">
      <Settings :size="18" />
    </router-link>
  </header>
</template>

<script setup>
import { computed, defineComponent, h, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  ChevronLeft,
  ChevronRight,
  Disc3,
  Flame,
  Clock3,
  ListMusic,
  Loader2,
  Mail,
  Moon,
  Music,
  Search,
  Settings,
  Sun,
  Trash2,
  User,
  Video
} from 'lucide-vue-next'
import { useMessage } from 'naive-ui'
import SongListRow from './SongListRow.vue'
import { getSearchBootData, getSearchResultData, getSearchSuggestData } from '../services/netease'
import { usePlayerStore } from '../stores/player'
import { useThemeStore } from '../stores/theme'

const SearchGroup = defineComponent({
  name: 'SearchGroup',
  props: {
    title: { type: String, required: true },
    items: { type: Array, default: () => [] }
  },
  emits: ['select'],
  setup(props, { emit }) {
    return () => props.items.length
      ? h('div', { class: 'suggest-group' }, [
          h('strong', { class: 'suggest-group__title' }, props.title),
          ...props.items.map((item) =>
            h('button', {
              key: `${item.type}-${item.id}`,
              class: 'suggest-row',
              type: 'button',
              onClick: () => emit('select', item)
            }, [
              h('span', { class: 'suggest-row__dot' }),
              h('span', { class: 'suggest-row__main' }, item.title || item.name),
              h('small', item.artist || item.subtitle || item.album || '')
            ])
          )
        ])
      : null
  }
})

const SEARCH_INPUT_TRANSITION_MS = 320
const SEARCH_PANEL_LEAVE_MS = 220
const SEARCH_HISTORY_KEY = 'mappic.searchHistory'
const SEARCH_HISTORY_LIMIT = 8

const searchTabs = [
  { label: '单曲', type: 1, icon: Music },
  { label: '歌手', type: 100, icon: User },
  { label: '专辑', type: 10, icon: Disc3 },
  { label: '歌单', type: 1000, icon: ListMusic },
  { label: '用户', type: 1002, icon: User },
  { label: 'MV', type: 1004, icon: Video }
]

const theme = useThemeStore()
const player = usePlayerStore()
const router = useRouter()
const message = useMessage()
const searchWrap = ref(null)
const searchExpanded = ref(false)
const searchPanelVisible = ref(false)
const searchKeyword = ref('')
const defaultKeyword = ref('')
const hotKeywords = ref([])
const searchHistory = ref([])
const emptySuggestions = () => ({
  keywordSuggestions: [],
  matches: [],
  songs: [],
  artists: [],
  albums: [],
  playlists: []
})
const suggestions = ref(emptySuggestions())
const suggestLoading = ref(false)
const searchedKeyword = ref('')
const activeSearchType = ref(1)
const searchResults = ref([])
const resultTotal = ref(0)
const resultLoading = ref(false)
let suggestTimer = 0
let suggestRequestId = 0
let resultRequestId = 0
let searchPanelTimer = 0
let searchPanelCloseTimer = 0
let searchPanelLeaving = false
let searchPointerDownInside = false

const trimmedKeyword = computed(() => searchKeyword.value.trim())
const keywordSuggestions = computed(() => suggestions.value.keywordSuggestions.slice(0, 10))
const suggestMatches = computed(() => suggestions.value.matches.slice(0, 6))
const hasSuggestions = computed(() =>
  Boolean(
    keywordSuggestions.value.length ||
    suggestMatches.value.length ||
    suggestions.value.songs.length ||
    suggestions.value.artists.length ||
    suggestions.value.albums.length ||
    suggestions.value.playlists.length
  )
)
const searchPlaceholder = computed(() =>
  defaultKeyword.value ? `搜索 ${defaultKeyword.value}` : '搜索音乐、歌手、歌词、用户'
)
const activeTabIcon = computed(() =>
  searchTabs.find((tab) => tab.type === activeSearchType.value)?.icon ?? Search
)

watch(trimmedKeyword, (keyword) => {
  window.clearTimeout(suggestTimer)
  searchedKeyword.value = ''

  if (!keyword) {
    suggestions.value = emptySuggestions()
    suggestLoading.value = false
    return
  }

  suggestLoading.value = true
  suggestTimer = window.setTimeout(() => loadSuggestions(keyword), 260)
})

onMounted(() => {
  loadSearchHistory()
  loadSearchBoot()
  document.addEventListener('pointerdown', handleOutsideClick)
})

onUnmounted(() => {
  window.clearTimeout(suggestTimer)
  window.clearTimeout(searchPanelTimer)
  window.clearTimeout(searchPanelCloseTimer)
  document.removeEventListener('pointerdown', handleOutsideClick)
})

async function loadSearchBoot() {
  try {
    const data = await getSearchBootData()
    defaultKeyword.value = data.defaultKeyword
    hotKeywords.value = data.hotKeywords.slice(0, 10)
  } catch (error) {
    console.warn('Failed to load search boot data:', error)
  }
}

function loadSearchHistory() {
  try {
    const raw = window.localStorage.getItem(SEARCH_HISTORY_KEY)

    if (!raw) {
      searchHistory.value = []
      return
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      searchHistory.value = []
      return
    }

    searchHistory.value = parsed
      .map((item) => String(item ?? '').trim())
      .filter(Boolean)
      .slice(0, SEARCH_HISTORY_LIMIT)
  } catch (error) {
    searchHistory.value = []
  }
}

function persistSearchHistory(items) {
  searchHistory.value = items

  try {
    window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(items))
  } catch (error) {
    console.warn('Failed to persist search history:', error)
  }
}

function rememberSearchHistory(keyword) {
  const query = String(keyword ?? '').trim()

  if (!query) {
    return
  }

  const next = [query, ...searchHistory.value.filter((item) => item !== query)].slice(0, SEARCH_HISTORY_LIMIT)
  persistSearchHistory(next)
}

function clearSearchHistory() {
  persistSearchHistory([])

  try {
    window.localStorage.removeItem(SEARCH_HISTORY_KEY)
  } catch (error) {
    console.warn('Failed to clear search history:', error)
  }
}

async function loadSuggestions(keyword) {
  const requestId = ++suggestRequestId

  try {
    const data = await getSearchSuggestData(keyword)

    if (requestId !== suggestRequestId) {
      return
    }

    suggestions.value = data
  } catch (error) {
    if (requestId === suggestRequestId) {
      suggestions.value = emptySuggestions()
    }
  } finally {
    if (requestId === suggestRequestId) {
      suggestLoading.value = false
    }
  }
}

function openSearchPanel() {
  if (searchPanelVisible.value) {
    return
  }

  if (searchPanelLeaving) {
    window.clearTimeout(searchPanelCloseTimer)
    searchPanelCloseTimer = 0
    searchPanelLeaving = false
    searchPanelVisible.value = true
    return
  }

  if (searchPanelTimer) {
    return
  }

  if (searchExpanded.value) {
    searchPanelVisible.value = true
    return
  }

  searchExpanded.value = true
  searchPanelTimer = window.setTimeout(() => {
    searchPanelVisible.value = true
    searchPanelTimer = 0
  }, SEARCH_INPUT_TRANSITION_MS)
}

function closeSearchPanel() {
  window.clearTimeout(searchPanelTimer)
  searchPanelTimer = 0

  if (searchPanelVisible.value) {
    searchPanelLeaving = true
    searchPanelVisible.value = false
    window.clearTimeout(searchPanelCloseTimer)
    searchPanelCloseTimer = window.setTimeout(finishSearchPanelClose, SEARCH_PANEL_LEAVE_MS)
    return
  }

  if (searchPanelLeaving) {
    return
  }

  searchExpanded.value = false
}

function handleSearchPanelAfterLeave() {
  if (searchPanelCloseTimer) {
    return
  }

  finishSearchPanelClose()
}

function finishSearchPanelClose() {
  window.clearTimeout(searchPanelCloseTimer)
  searchPanelCloseTimer = 0
  searchPanelLeaving = false

  if (!searchPanelVisible.value) {
    searchExpanded.value = false
  }
}

function handleSearchPointerDown() {
  searchPointerDownInside = true
  window.setTimeout(() => {
    searchPointerDownInside = false
  }, 0)
}

function handleSearchFocusOut(event) {
  const relatedTarget = event.relatedTarget

  if (
    searchPointerDownInside ||
    (relatedTarget instanceof Element && searchWrap.value?.contains(relatedTarget))
  ) {
    return
  }

  window.requestAnimationFrame(() => {
    const activeElement = document.activeElement

    if (activeElement instanceof Element && searchWrap.value?.contains(activeElement)) {
      return
    }

    closeSearchPanel()
  })
}

function clearSearch() {
  searchKeyword.value = ''
  searchedKeyword.value = ''
  searchResults.value = []
  resultTotal.value = 0
}

function pickKeyword(keyword) {
  searchKeyword.value = keyword
  submitSearch(keyword)
}

function submitSearch(keyword = trimmedKeyword.value || defaultKeyword.value) {
  const query = String(keyword ?? '').trim()

  if (!query) {
    return
  }

  rememberSearchHistory(query)
  openSearchPanel()
  searchKeyword.value = query
  searchedKeyword.value = query
  activeSearchType.value = 1
  loadResults()
}

function switchSearchType(type) {
  if (activeSearchType.value === type) {
    return
  }

  activeSearchType.value = type
  loadResults()
}

async function loadResults() {
  const query = searchedKeyword.value

  if (!query) {
    return
  }

  const requestId = ++resultRequestId
  resultLoading.value = true

  try {
    const data = await getSearchResultData({
      keyword: query,
      type: activeSearchType.value,
      limit: activeSearchType.value === 1 ? 30 : 20
    })

    if (requestId !== resultRequestId) {
      return
    }

    searchResults.value = data.items
    resultTotal.value = data.total
  } catch (error) {
    if (requestId === resultRequestId) {
      searchResults.value = []
      resultTotal.value = 0
      message.error('搜索失败，请稍后再试')
    }
  } finally {
    if (requestId === resultRequestId) {
      resultLoading.value = false
    }
  }
}

function handleSuggestionSelect(item) {
  if (item.type === 'song') {
    playSong(item, suggestions.value.songs)
    return
  }

  if (item.to) {
    closeSearchPanel()
    router.push(item.to)
    return
  }

  pickKeyword(item.title || item.name)
}

function handleResultSelect(item) {
  if (item.to) {
    closeSearchPanel()
    router.push(item.to)
    return
  }

  searchKeyword.value = item.title || item.name
  submitSearch(searchKeyword.value)
}

function handleSearchSongPlay(song) {
  playSong(song, searchResults.value)
}

async function playSong(song, queue = []) {
  const playableQueue = queue.filter((item) => item.type === 'song')

  if (playableQueue.length) {
    player.setQueue(playableQueue)
  }

  const played = await player.playTrack(song)

  if (!played) {
    message.error(player.state.error?.message || '当前歌曲暂无可播放链接')
  }
}

function getResultSubtitle(item) {
  if (activeSearchType.value === 1) {
    return [item.artist, item.album, item.duration].filter(Boolean).join(' · ')
  }

  return item.subtitle || ''
}

function formatScore(score) {
  if (!score) {
    return '热门内容'
  }

  if (score >= 10000) {
    return `${Math.round(score / 10000)} 万热度`
  }

  return `${score} 热度`
}

function handleOutsideClick(event) {
  const target = event.target

  if (!(target instanceof Element)) {
    return
  }

  if (searchWrap.value?.contains(target)) {
    return
  }

  closeSearchPanel()
}
</script>
