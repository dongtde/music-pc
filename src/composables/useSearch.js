import { computed, onUnmounted, ref, unref, watch } from 'vue'
import { STORAGE_KEYS } from '../config/app'
import { getSearchBootData, getSearchSuggestData } from '../services/netease'
import { isAbortError } from '../utils/request'
import { readJsonStorage, writeJsonStorage } from '../utils/storage'

const SEARCH_HISTORY_LIMIT = 8

export function createEmptySearchSuggestions() {
  return {
    keywordSuggestions: [],
    matches: [],
    songs: [],
    artists: [],
    albums: [],
    playlists: []
  }
}

export function useSearchBoot({ hotLimit = 10 } = {}) {
  const defaultKeyword = ref('')
  const hotKeywords = ref([])

  async function loadSearchBoot() {
    try {
      const data = await getSearchBootData()
      defaultKeyword.value = data.defaultKeyword
      hotKeywords.value = data.hotKeywords.slice(0, hotLimit)
    } catch (error) {
      console.warn('Failed to load search boot data:', error)
    }
  }

  return {
    defaultKeyword,
    hotKeywords,
    loadSearchBoot
  }
}

export function useSearchHistory({ limit = SEARCH_HISTORY_LIMIT } = {}) {
  const searchHistory = ref([])

  function loadSearchHistory() {
    const parsed = readJsonStorage(STORAGE_KEYS.searchHistory, [])

    searchHistory.value = Array.isArray(parsed)
      ? parsed
        .map((item) => String(item ?? '').trim())
        .filter(Boolean)
        .slice(0, limit)
      : []
  }

  function persistSearchHistory(items) {
    searchHistory.value = items

    if (!writeJsonStorage(STORAGE_KEYS.searchHistory, items)) {
      console.warn('Failed to persist search history')
    }
  }

  function rememberSearchHistory(keyword) {
    const query = String(keyword ?? '').trim()

    if (!query) {
      return
    }

    const next = [query, ...searchHistory.value.filter((item) => item !== query)].slice(0, limit)
    persistSearchHistory(next)
  }

  function clearSearchHistory() {
    persistSearchHistory([])
  }

  loadSearchHistory()

  return {
    clearSearchHistory,
    loadSearchHistory,
    rememberSearchHistory,
    searchHistory
  }
}

export function useSearchSuggestions(source, { debounceMs = 260 } = {}) {
  const suggestions = ref(createEmptySearchSuggestions())
  const suggestLoading = ref(false)
  let suggestTimer = 0
  let suggestController = null

  const trimmedKeyword = computed(() => String(unref(source) ?? '').trim())

  watch(trimmedKeyword, (query) => {
    window.clearTimeout(suggestTimer)
    abortSuggestionRequest()

    if (!query) {
      suggestions.value = createEmptySearchSuggestions()
      suggestLoading.value = false
      return
    }

    suggestLoading.value = true
    suggestTimer = window.setTimeout(() => {
      loadSuggestions(query)
    }, debounceMs)
  })

  onUnmounted(() => {
    window.clearTimeout(suggestTimer)
    abortSuggestionRequest()
  })

  async function loadSuggestions(query = trimmedKeyword.value) {
    const keyword = String(query ?? '').trim()

    window.clearTimeout(suggestTimer)
    abortSuggestionRequest()

    if (!keyword) {
      suggestions.value = createEmptySearchSuggestions()
      suggestLoading.value = false
      return
    }

    const controller = new AbortController()
    suggestController = controller
    suggestLoading.value = true

    try {
      const data = await getSearchSuggestData(keyword, {
        signal: controller.signal
      })

      if (suggestController !== controller || controller.signal.aborted) {
        return
      }

      suggestions.value = data
    } catch (error) {
      if (isAbortError(error)) {
        return
      }

      if (suggestController === controller) {
        suggestions.value = createEmptySearchSuggestions()
      }
    } finally {
      if (suggestController === controller) {
        suggestController = null
        suggestLoading.value = false
      }
    }
  }

  function abortSuggestionRequest() {
    if (!suggestController) {
      return
    }

    suggestController.abort()
    suggestController = null
  }

  return {
    loadSuggestions,
    suggestLoading,
    suggestions
  }
}

export function formatSearchScore(score) {
  if (!score) {
    return '热门内容'
  }

  if (score >= 10000) {
    return `${Math.round(score / 10000)} 万热度`
  }

  return `${score} 热度`
}
