import { computed, ref, shallowRef, unref } from 'vue'
import { getSongCommentsData } from '../services/netease'

const DEFAULT_COMMENT_LIMIT = 30

export function useSongComments(options = {}) {
  const {
    track,
    limit = DEFAULT_COMMENT_LIMIT,
    getFallbackTotal = (song) => Number(song?.commentCount) || 0,
    onLoaded
  } = options

  const selectedTrack = shallowRef(null)
  const trackId = ref(null)
  const hotComments = ref([])
  const comments = ref([])
  const total = ref(0)
  const offset = ref(0)
  const hasMore = ref(false)
  const loading = ref(false)
  const error = ref('')
  let requestId = 0

  const currentTrack = computed(() => unref(track) ?? selectedTrack.value)
  const displayTrack = computed(() => selectedTrack.value ?? currentTrack.value)
  const displayTotal = computed(() =>
    total.value || Number(getFallbackTotal(displayTrack.value)) || 0
  )
  const activeHotComments = computed(() =>
    isLoadedForCurrentTrack() ? hotComments.value : []
  )
  const activeComments = computed(() =>
    isLoadedForCurrentTrack() ? comments.value : []
  )

  function reset(options = {}) {
    requestId += 1
    trackId.value = null
    hotComments.value = []
    comments.value = []
    total.value = 0
    offset.value = 0
    hasMore.value = false
    loading.value = false
    error.value = ''

    if (!options.keepTrack) {
      selectedTrack.value = null
    }
  }

  async function preload(song = currentTrack.value, options = {}) {
    if (options.enabled === false) {
      return null
    }

    const target = resolveTrack(song)

    if (!target) {
      return null
    }

    selectedTrack.value = target
    const id = getTrackId(target)

    if (!isNeteaseTrackId(id)) {
      reset({ keepTrack: true })
      selectedTrack.value = target
      trackId.value = id
      return null
    }

    if (
      String(trackId.value) === id &&
      (hotComments.value.length || comments.value.length || loading.value)
    ) {
      return null
    }

    reset({ keepTrack: true })
    selectedTrack.value = target
    return load(target, true)
  }

  async function open(song = currentTrack.value) {
    const target = resolveTrack(song)

    if (!target) {
      return null
    }

    selectedTrack.value = target
    const id = getTrackId(target)

    if (!isNeteaseTrackId(id)) {
      reset({ keepTrack: true })
      selectedTrack.value = target
      trackId.value = id
      error.value = '当前歌曲暂无评论数据'
      return null
    }

    if (
      !loading.value &&
      (String(trackId.value) !== id || !comments.value.length)
    ) {
      return load(target, true)
    }

    return null
  }

  async function loadMore(song = displayTrack.value) {
    if (!hasMore.value || loading.value) {
      return null
    }

    return load(song, false)
  }

  async function load(song = displayTrack.value, resetPage = false) {
    const target = resolveTrack(song)

    if (!target || loading.value) {
      return null
    }

    selectedTrack.value = target
    const id = getTrackId(target)

    if (!isNeteaseTrackId(id)) {
      error.value = '当前歌曲暂无评论数据'
      return null
    }

    const currentRequestId = ++requestId
    const nextOffset = resetPage ? 0 : offset.value

    loading.value = true
    error.value = ''

    try {
      const data = await getSongCommentsData({
        id,
        limit,
        offset: nextOffset
      })

      if (currentRequestId !== requestId || getTrackId(currentTrack.value) !== id) {
        return null
      }

      if (resetPage) {
        hotComments.value = data.hotComments
        comments.value = data.comments
      } else {
        comments.value = [...comments.value, ...data.comments]
      }

      trackId.value = id
      total.value = data.total
      hasMore.value = data.more || comments.value.length < data.total
      offset.value = comments.value.length
      onLoaded?.({
        trackId: id,
        track: target,
        data,
        reset: resetPage
      })
      return data
    } catch (loadError) {
      if (currentRequestId !== requestId) {
        return null
      }

      console.warn('Failed to load song comments:', loadError)
      error.value = '评论加载失败'
      return null
    } finally {
      if (currentRequestId === requestId) {
        loading.value = false
      }
    }
  }

  function isLoadedForCurrentTrack() {
    return Boolean(trackId.value && getTrackId(currentTrack.value) === String(trackId.value))
  }

  function resolveTrack(song) {
    return unref(song) ?? currentTrack.value ?? null
  }

  function getTrackId(song) {
    return String(song?.id ?? '')
  }

  return {
    track: selectedTrack,
    trackId,
    hotComments,
    comments,
    total,
    offset,
    hasMore,
    loading,
    error,
    displayTotal,
    activeHotComments,
    activeComments,
    reset,
    preload,
    open,
    loadMore,
    load
  }
}

function isNeteaseTrackId(trackId) {
  return /^\d+$/.test(String(trackId ?? ''))
}
