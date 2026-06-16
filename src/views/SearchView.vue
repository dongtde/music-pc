<template>
  <div class="view search-page">
    <section class="search-page__hero">
      <div class="search-page__title">
        <span class="tag">Search</span>
        <h1>搜索音乐</h1>
        <p>输入歌曲、歌手、专辑、歌单或 MV，按 Enter 查看完整结果。</p>
      </div>

      <div class="search-page__box">
        <n-input
          v-model:value="keyword"
          round
          clearable
          size="large"
          :placeholder="searchPlaceholder"
          @keydown.enter.prevent="submitSearch()"
        >
          <template #prefix>
            <Search :size="18" />
          </template>
        </n-input>
        <button class="search-page__submit" type="button" @click="submitSearch()">
          <Search :size="17" />
          <span>搜索</span>
        </button>
      </div>
    </section>

    <section v-if="searchHistory.length" class="search-page__section">
      <header class="search-page__section-head">
        <h2>搜索历史</h2>
        <button type="button" class="mini-action search-page__clear" @click="clearSearchHistory">
          <Trash2 :size="14" />
        </button>
      </header>
      <div class="search-page__chips">
        <button
          v-for="item in searchHistory"
          :key="item"
          type="button"
          @click="submitSearch(item)"
        >
          <Clock3 :size="14" />
          <span>{{ item }}</span>
        </button>
      </div>
    </section>

    <section v-if="trimmedKeyword" class="search-page__section">
      <header class="search-page__section-head">
        <h2>搜索建议</h2>
        <small>按 Enter 搜索“{{ trimmedKeyword }}”</small>
      </header>

      <div v-if="suggestLoading" class="search-page__state">
        <Loader2 class="spin" :size="18" />
        <span>正在获取联想</span>
      </div>

      <template v-else>
        <button class="search-page__wide-action" type="button" @click="submitSearch(trimmedKeyword)">
          <Search :size="16" />
          <span>搜索“{{ trimmedKeyword }}”</span>
        </button>

        <div v-if="keywordSuggestions.length" class="search-page__suggestions">
          <button
            v-for="item in keywordSuggestions"
            :key="item.id"
            type="button"
            @click="submitSearch(item.title)"
          >
            <Search :size="15" />
            <span>{{ item.title }}</span>
            <small>{{ item.subtitle }}</small>
          </button>
        </div>

        <div v-if="suggestMatches.length" class="search-page__chips">
          <button
            v-for="item in suggestMatches"
            :key="item.id"
            type="button"
            @click="handleSuggestionSelect(item)"
          >
            <span>{{ item.title }}</span>
          </button>
        </div>
      </template>
    </section>

    <section class="search-page__section">
      <header class="search-page__section-head">
        <h2>热门搜索</h2>
        <small>{{ defaultKeyword ? `默认：${defaultKeyword}` : '大家正在听' }}</small>
      </header>
      <div class="search-page__hot">
        <button
          v-for="(item, index) in hotKeywords"
          :key="item.id"
          type="button"
          @click="submitSearch(item.keyword)"
        >
          <span :class="{ hot: index < 3 }">{{ index + 1 }}</span>
          <strong>{{ item.keyword }}</strong>
          <small>{{ item.content || formatScore(item.score) }}</small>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Clock3, Loader2, Search, Trash2 } from 'lucide-vue-next'
import { STORAGE_KEYS } from '../config/app'
import { getSearchBootData, getSearchSuggestData } from '../services/netease'
import { readJsonStorage, writeJsonStorage } from '../utils/storage'
import '../styles/search.css'

const SEARCH_HISTORY_LIMIT = 8

const router = useRouter()
const keyword = ref('')
const defaultKeyword = ref('')
const hotKeywords = ref([])
const searchHistory = ref([])
const suggestions = ref(createEmptySuggestions())
const suggestLoading = ref(false)
let suggestTimer = 0
let suggestRequestId = 0

const trimmedKeyword = computed(() => keyword.value.trim())
const keywordSuggestions = computed(() => suggestions.value.keywordSuggestions.slice(0, 10))
const suggestMatches = computed(() => suggestions.value.matches.slice(0, 8))
const searchPlaceholder = computed(() =>
  defaultKeyword.value ? `搜索 ${defaultKeyword.value}` : '搜索音乐、歌手、专辑、歌单、MV'
)

watch(trimmedKeyword, (query) => {
  window.clearTimeout(suggestTimer)

  if (!query) {
    suggestLoading.value = false
    suggestions.value = createEmptySuggestions()
    return
  }

  suggestLoading.value = true
  suggestTimer = window.setTimeout(() => loadSuggestions(query), 260)
})

onMounted(() => {
  loadSearchHistory()
  loadSearchBoot()
})

onUnmounted(() => {
  window.clearTimeout(suggestTimer)
})

async function loadSearchBoot() {
  try {
    const data = await getSearchBootData()
    defaultKeyword.value = data.defaultKeyword
    hotKeywords.value = data.hotKeywords.slice(0, 20)
  } catch (error) {
    console.warn('Failed to load search boot data:', error)
  }
}

async function loadSuggestions(query) {
  const requestId = ++suggestRequestId

  try {
    const data = await getSearchSuggestData(query)

    if (requestId !== suggestRequestId) {
      return
    }

    suggestions.value = data
  } catch (error) {
    if (requestId === suggestRequestId) {
      suggestions.value = createEmptySuggestions()
    }
  } finally {
    if (requestId === suggestRequestId) {
      suggestLoading.value = false
    }
  }
}

function submitSearch(value = trimmedKeyword.value || defaultKeyword.value) {
  const query = String(value ?? '').trim()

  if (!query) {
    return
  }

  rememberSearchHistory(query)
  router.push({ name: 'search-detail', params: { keyword: query } })
}

function handleSuggestionSelect(item) {
  if (item.to) {
    router.push(item.to)
    return
  }

  submitSearch(item.title || item.name)
}

function loadSearchHistory() {
  const parsed = readJsonStorage(STORAGE_KEYS.searchHistory, [])

  searchHistory.value = Array.isArray(parsed)
    ? parsed.map((item) => String(item ?? '').trim()).filter(Boolean).slice(0, SEARCH_HISTORY_LIMIT)
    : []
}

function persistSearchHistory(items) {
  searchHistory.value = items

  if (!writeJsonStorage(STORAGE_KEYS.searchHistory, items)) {
    console.warn('Failed to persist search history')
  }
}

function rememberSearchHistory(query) {
  const next = [query, ...searchHistory.value.filter((item) => item !== query)].slice(0, SEARCH_HISTORY_LIMIT)
  persistSearchHistory(next)
}

function clearSearchHistory() {
  persistSearchHistory([])
}

function createEmptySuggestions() {
  return {
    keywordSuggestions: [],
    matches: [],
    songs: [],
    artists: [],
    albums: [],
    playlists: []
  }
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
</script>
