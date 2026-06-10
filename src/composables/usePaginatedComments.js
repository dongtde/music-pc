import { computed, ref, unref } from 'vue'
import { DEFAULT_COMMENT_LIMIT } from '../config/app'

export function usePaginatedComments(options = {}) {
  const {
    resourceId,
    loader,
    limit = DEFAULT_COMMENT_LIMIT,
    isValidId = isNumericId,
    getFallbackTotal = () => 0,
    errorMessage = 'Comments failed to load',
    warnPrefix = 'Failed to load comments:'
  } = options

  const visible = ref(false)
  const hotComments = ref([])
  const comments = ref([])
  const total = ref(0)
  const offset = ref(0)
  const hasMore = ref(false)
  const loading = ref(false)
  const error = ref('')

  const displayTotal = computed(() => total.value || Number(getFallbackTotal()) || 0)

  function reset() {
    hotComments.value = []
    comments.value = []
    total.value = 0
    offset.value = 0
    hasMore.value = false
    loading.value = false
    error.value = ''
  }

  async function open(id = unref(resourceId)) {
    visible.value = true

    if (!comments.value.length && !loading.value) {
      await load(id, { reset: true })
    }
  }

  async function loadMore(id = unref(resourceId)) {
    if (!hasMore.value || loading.value) {
      return null
    }

    return load(id)
  }

  async function load(id = unref(resourceId), { reset: resetPage = false } = {}) {
    const targetId = String(unref(id) ?? '')

    if (!loader || !isValidId(targetId) || loading.value) {
      return null
    }

    loading.value = true
    error.value = ''

    const nextOffset = resetPage ? 0 : offset.value

    try {
      const data = await loader({
        id: targetId,
        limit,
        offset: nextOffset
      })
      const nextHotComments = data.hotComments ?? []
      const nextComments = data.comments ?? []

      hotComments.value = resetPage ? nextHotComments : hotComments.value
      comments.value = resetPage ? nextComments : [...comments.value, ...nextComments]
      total.value = Number(data.total) || comments.value.length
      hasMore.value = Boolean(data.more || comments.value.length < total.value)
      offset.value = comments.value.length

      return data
    } catch (loadError) {
      console.warn(warnPrefix, loadError)
      error.value = errorMessage
      return null
    } finally {
      loading.value = false
    }
  }

  return {
    visible,
    hotComments,
    comments,
    total,
    displayTotal,
    offset,
    hasMore,
    loading,
    error,
    reset,
    open,
    load,
    loadMore
  }
}

function isNumericId(id) {
  return /^\d+$/.test(String(id ?? ''))
}

