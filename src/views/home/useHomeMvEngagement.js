import { reactive, ref, shallowRef } from 'vue'
import { getMvCommentsData } from '../../services/netease'
import {
  HOME_DANMAKU_COMMENT_LIMIT as homeDanmakuCommentLimit
} from './homeConstants'
import {
  formatActionCount,
  isNeteaseTrackId
} from './homeUtils'

export function useHomeMvEngagement({ activeMv, activeMvId }) {
  const likedMvIds = shallowRef(new Set())
  const homeMvDanmakuEnabled = ref(true)
  const homeMvCommentsModalVisible = ref(false)
  const homeMvCommentsModalMounted = ref(false)
  const homeMvCommentState = reactive(createCommentState())
  const homeMvDanmakuState = reactive(createCommentState())
  const mvCommentCache = new Map()
  let homeMvDanmakuRequestId = 0

  function cacheHomeMvComments(trackId, data) {
    const id = String(trackId ?? '')

    if (!id) {
      return
    }

    mvCommentCache.set(id, {
      hotComments: data.hotComments ?? [],
      comments: data.comments ?? [],
      total: data.total ?? 0,
      more: Boolean(data.more),
      offset: data.comments?.length ?? 0
    })
  }

  function restoreHomeMvComments(trackId) {
    const id = String(trackId ?? '')
    const cached = mvCommentCache.get(id)

    if (cached) {
      applyHomeMvComments(id, cached)
      return
    }

    Object.assign(homeMvCommentState, createCommentState(id))
  }

  function applyHomeMvComments(trackId, data) {
    Object.assign(homeMvCommentState, {
      trackId: String(trackId ?? ''),
      error: '',
      hotComments: data.hotComments ?? [],
      comments: data.comments ?? [],
      total: data.total ?? 0,
      more: Boolean(data.more),
      offset: data.offset ?? data.comments?.length ?? 0
    })
  }

  async function openHomeMvComments(mv = activeMv.value) {
    if (!mv?.id) {
      return
    }

    homeMvCommentsModalMounted.value = true
    homeMvCommentsModalVisible.value = true

    if (String(homeMvCommentState.trackId) !== String(mv.id)) {
      restoreHomeMvComments(mv.id)
    }

    if (!homeMvCommentState.comments.length && !homeMvCommentState.hotComments.length) {
      await loadHomeMvComments(mv.id, { reset: true })
    }
  }

  async function loadHomeMvComments(trackId, { reset = false } = {}) {
    const id = String(trackId ?? '')

    if (!id || homeMvCommentState.loading) {
      return
    }

    homeMvCommentState.loading = true
    homeMvCommentState.error = ''

    try {
      const data = await getMvCommentsData({
        id,
        limit: homeDanmakuCommentLimit,
        offset: reset ? 0 : homeMvCommentState.offset
      })
      const nextData = {
        hotComments: reset ? data.hotComments : homeMvCommentState.hotComments,
        comments: reset ? data.comments : [...homeMvCommentState.comments, ...data.comments],
        total: data.total,
        more: data.more,
        offset: reset
          ? data.comments.length
          : homeMvCommentState.comments.length + data.comments.length
      }

      cacheHomeMvComments(id, nextData)
      applyHomeMvComments(id, nextData)
    } catch (error) {
      console.warn('Failed to load home MV comments:', error)
      homeMvCommentState.error = error?.message || 'MV 评论加载失败'
    } finally {
      homeMvCommentState.loading = false
    }
  }

  function loadMoreHomeMvComments() {
    if (homeMvCommentState.more) {
      loadHomeMvComments(homeMvCommentState.trackId || activeMv.value?.id)
    }
  }

  function toggleHomeMvDanmaku() {
    homeMvDanmakuEnabled.value = !homeMvDanmakuEnabled.value

    if (homeMvDanmakuEnabled.value) {
      loadMoreHomeMvDanmaku()
    }
  }

  function resetHomeMvDanmakuStream(trackId = activeMv.value?.id, data = null) {
    const id = String(trackId ?? '')
    homeMvDanmakuRequestId += 1
    Object.assign(homeMvDanmakuState, {
      ...createCommentState(id),
      hotComments: data?.hotComments ?? [],
      comments: data?.comments ?? [],
      total: data?.total ?? 0,
      offset: data?.offset ?? data?.comments?.length ?? 0,
      more: Boolean(isNeteaseTrackId(id) && (data?.more ?? true))
    })
  }

  async function loadMoreHomeMvDanmaku(trackId = activeMv.value?.id) {
    const id = String(trackId ?? homeMvDanmakuState.trackId ?? '')

    if (
      !id ||
      !homeMvDanmakuEnabled.value ||
      !isNeteaseTrackId(id) ||
      homeMvDanmakuState.loading ||
      !homeMvDanmakuState.more ||
      String(homeMvDanmakuState.trackId) !== id
    ) {
      return
    }

    const requestId = ++homeMvDanmakuRequestId
    homeMvDanmakuState.loading = true
    homeMvDanmakuState.error = ''

    try {
      const data = await getMvCommentsData({
        id,
        limit: homeDanmakuCommentLimit,
        offset: homeMvDanmakuState.offset
      })

      if (requestId !== homeMvDanmakuRequestId || id !== String(activeMv.value?.id ?? '')) {
        return
      }

      homeMvDanmakuState.hotComments = homeMvDanmakuState.offset === 0 ? data.hotComments : []
      homeMvDanmakuState.comments = data.comments
      homeMvDanmakuState.total = data.total
      homeMvDanmakuState.offset += data.comments.length
      homeMvDanmakuState.more = Boolean(data.more && data.comments.length)
    } catch (error) {
      if (requestId === homeMvDanmakuRequestId) {
        console.warn('Failed to load home MV danmaku comments:', error)
        homeMvDanmakuState.error = error?.message || 'MV 弹幕评论加载失败'
        homeMvDanmakuState.more = false
      }
    } finally {
      if (requestId === homeMvDanmakuRequestId) {
        homeMvDanmakuState.loading = false
      }
    }
  }

  function toggleHomeMvLike(mv) {
    if (!mv?.id) {
      return
    }

    const nextLikedIds = new Set(likedMvIds.value)
    const id = String(mv.id)

    if (nextLikedIds.has(id)) {
      nextLikedIds.delete(id)
    } else {
      nextLikedIds.add(id)
    }

    likedMvIds.value = nextLikedIds
  }

  function isHomeMvLiked(mv) {
    return Boolean(mv?.id && likedMvIds.value.has(String(mv.id)))
  }

  function getHomeMvStats(mv) {
    return mv?.stats ?? mv ?? {}
  }

  function getHomeMvLikeLabel(mv) {
    const stats = getHomeMvStats(mv)
    const baseCount = Number(stats.likedCount) || 0
    const count = baseCount + (isHomeMvLiked(mv) ? 1 : 0)

    return formatActionCount(count)
  }

  function getHomeMvCommentLabel(mv) {
    if (String(mv?.id) === String(homeMvCommentState.trackId) && homeMvCommentState.total) {
      return formatActionCount(homeMvCommentState.total)
    }

    return formatActionCount(getHomeMvStats(mv).commentCount)
  }

  return {
    homeMvDanmakuEnabled,
    homeMvCommentsModalVisible,
    homeMvCommentsModalMounted,
    homeMvCommentState,
    homeMvDanmakuState,
    cacheHomeMvComments,
    restoreHomeMvComments,
    applyHomeMvComments,
    openHomeMvComments,
    loadMoreHomeMvComments,
    toggleHomeMvDanmaku,
    resetHomeMvDanmakuStream,
    loadMoreHomeMvDanmaku,
    toggleHomeMvLike,
    isHomeMvLiked,
    getHomeMvLikeLabel,
    getHomeMvCommentLabel
  }
}

function createCommentState(trackId = '') {
  return {
    trackId,
    loading: false,
    error: '',
    hotComments: [],
    comments: [],
    total: 0,
    more: false,
    offset: 0
  }
}
