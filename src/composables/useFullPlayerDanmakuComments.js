import { onUnmounted, reactive, unref } from 'vue'
import { getSongCommentsData } from '../services/netease'
import { isNeteaseTrackId } from '../utils/lyrics'

const DEFAULT_COMMENT_LIMIT = 80
const DEFAULT_LOAD_DELAY = 560

export function useFullPlayerDanmakuComments(options = {}) {
  const {
    track,
    open,
    enabled,
    limit = DEFAULT_COMMENT_LIMIT,
    loadDelay = DEFAULT_LOAD_DELAY,
    onLoaded
  } = options

  const state = reactive({
    trackId: '',
    loading: false,
    error: '',
    hotComments: [],
    comments: [],
    total: 0,
    more: false,
    offset: 0
  })

  let requestId = 0
  let loadTimer = 0

  function reset(nextTrack = getCurrentTrack()) {
    requestId += 1
    state.trackId = String(nextTrack?.id ?? '')
    state.loading = false
    state.error = ''
    state.hotComments = []
    state.comments = []
    state.total = 0
    state.offset = 0
    state.more = Boolean(isNeteaseTrackId(state.trackId))
  }

  function schedule(delay = loadDelay) {
    clearSchedule()

    if (!isActive()) {
      return
    }

    loadTimer = window.setTimeout(() => {
      loadTimer = 0
      loadMore()
    }, Math.max(0, Number(delay) || 0))
  }

  function clearSchedule() {
    if (!loadTimer) {
      return
    }

    window.clearTimeout(loadTimer)
    loadTimer = 0
  }

  async function loadMore(nextTrack = getCurrentTrack()) {
    clearSchedule()

    const id = String(nextTrack?.id ?? state.trackId ?? '')

    if (
      !isActive() ||
      !isNeteaseTrackId(id) ||
      state.loading ||
      !state.more
    ) {
      return null
    }

    const currentRequestId = ++requestId
    state.loading = true
    state.error = ''

    try {
      const data = await getSongCommentsData({
        id,
        limit,
        offset: state.offset
      })

      if (currentRequestId !== requestId || id !== String(getCurrentTrack()?.id ?? '')) {
        return null
      }

      state.trackId = id
      state.hotComments = state.offset === 0 ? data.hotComments : []
      state.comments = data.comments
      state.total = data.total
      state.offset += data.comments.length
      state.more = Boolean(data.more && data.comments.length)
      onLoaded?.({
        trackId: id,
        track: nextTrack,
        data
      })
      return data
    } catch (error) {
      if (currentRequestId === requestId) {
        console.warn('Failed to load full player danmaku comments:', error)
        state.error = error?.message || '弹幕评论加载失败'
        state.more = false
      }
      return null
    } finally {
      if (currentRequestId === requestId) {
        state.loading = false
      }
    }
  }

  function isActive() {
    return Boolean(unref(open) && unref(enabled))
  }

  function getCurrentTrack() {
    return unref(track) ?? null
  }

  onUnmounted(() => {
    clearSchedule()
  })

  return {
    state,
    reset,
    schedule,
    clearSchedule,
    loadMore
  }
}
