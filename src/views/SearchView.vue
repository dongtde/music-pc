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
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Clock3, Loader2, Search, Trash2 } from 'lucide-vue-next'
import {
  formatSearchScore,
  useSearchBoot,
  useSearchHistory,
  useSearchSuggestions
} from '../composables/useSearch'
import '../styles/search.css'

const router = useRouter()
const keyword = ref('')

const trimmedKeyword = computed(() => keyword.value.trim())
const { defaultKeyword, hotKeywords, loadSearchBoot } = useSearchBoot({ hotLimit: 20 })
const {
  clearSearchHistory,
  rememberSearchHistory,
  searchHistory
} = useSearchHistory()
const { suggestions, suggestLoading } = useSearchSuggestions(trimmedKeyword)
const keywordSuggestions = computed(() => suggestions.value.keywordSuggestions.slice(0, 10))
const suggestMatches = computed(() => suggestions.value.matches.slice(0, 8))
const searchPlaceholder = computed(() =>
  defaultKeyword.value ? `搜索 ${defaultKeyword.value}` : '搜索音乐、歌手、专辑、歌单、MV'
)

onMounted(() => {
  loadSearchBoot()
})

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

function formatScore(score) {
  return formatSearchScore(score)
}
</script>
