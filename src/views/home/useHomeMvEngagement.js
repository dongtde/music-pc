import { reactive, ref, shallowRef } from 'vue'
import { getMvCommentsData } from '../../services/netease'
import { createLruCache } from '../../utils/lruCache'
import { formatCompactCount } from '../../utils/number'
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
  const mvCommentCache = createLruCache(24)
  const mvCommentCounts = reactive(new Map())
  const mvCommentRequests = new Map()
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
    mvCommentCounts.delete(id)
    mvCommentCounts.set(id, data.total ?? 0)
    if (mvCommentCounts.size > 100) mvCommentCounts.delete(mvCommentCounts.keys().next().value)
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
      loaded: true,
      loading: mvCommentRequests.has(String(trackId ?? '')),
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

    if (!homeMvCommentState.loaded) {
      await loadHomeMvComments(mv.id, { reset: true })
    }
  }

  function loadHomeMvComments(trackId, { reset = false, mv = activeMv.value } = {}) {
    const id = String(trackId ?? '')
    if (!id) return
    if (mvCommentRequests.has(id)) {
      if (homeMvCommentState.trackId === id) homeMvCommentState.loading = true
      return mvCommentRequests.get(id)
    }
    const worldMv = String(mv?.id) === id && mv.source === 'world-mv-feed'
    const resourceId = worldMv ? mv.commentId : id
    const previous = homeMvCommentState.trackId === id
      ? { ...homeMvCommentState }
      : mvCommentCache.get(id) ?? createCommentState(id)
    if (homeMvCommentState.trackId === id) {
      homeMvCommentState.loading = true
      homeMvCommentState.error = ''
    }
    const request = Promise.resolve().then(async () => {
      if (!resourceId) throw new Error('这支视频暂无可用的歌曲评论')
      const data = await getMvCommentsData({
        id: resourceId,
        limit: homeDanmakuCommentLimit,
        offset: reset ? 0 : previous.offset
      })
      const nextData = {
        hotComments: reset ? data.hotComments : previous.hotComments,
        comments: reset ? data.comments : [...previous.comments, ...data.comments],
        total: data.total,
        more: Boolean(data.more && data.comments.length),
        offset: reset
          ? data.comments.length
          : previous.offset + data.comments.length
      }

      cacheHomeMvComments(id, nextData)
      if (String(homeMvCommentState.trackId) === id) applyHomeMvComments(id, nextData)
    }).catch(error => {
      console.warn('Failed to load home MV comments:', error)
      if (String(homeMvCommentState.trackId) === id) homeMvCommentState.error = worldMv ? '评论暂时加载失败，请重试' : error?.message || 'MV 评论加载失败'
    }).finally(() => {
      mvCommentRequests.delete(id)
      if (String(homeMvCommentState.trackId) === id) homeMvCommentState.loading = false
    })
    mvCommentRequests.set(id, request)
    return request
  }

  function prefetchHomeMvComments(mv = activeMv.value) {
    if (!mv?.id || mv.source !== 'world-mv-feed') return
    const id = String(mv.id)
    if (id === String(activeMv.value?.id) && homeMvCommentState.trackId !== id) restoreHomeMvComments(id)
    if (!mvCommentCache.has(id)) return loadHomeMvComments(id, { reset: true, mv })
  }

  function loadMoreHomeMvComments() {
    if (homeMvCommentState.more) {
      return loadHomeMvComments(homeMvCommentState.trackId || activeMv.value?.id)
    }
  }

  function retryHomeMvComments() {
    return loadHomeMvComments(homeMvCommentState.trackId || activeMv.value?.id, { reset: true })
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
    if (String(mv?.id) === String(homeMvCommentState.trackId) && homeMvCommentState.loaded) {
      if (mv?.source === 'world-mv-feed') return formatCompactCount(homeMvCommentState.total)
      return formatActionCount(homeMvCommentState.total) || '0'
    }
    if (mv?.source === 'world-mv-feed') {
      const count = mvCommentCounts.get(String(mv.id))
      return count == null ? '评论' : formatCompactCount(count)
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
    prefetchHomeMvComments,
    loadMoreHomeMvComments,
    retryHomeMvComments,
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
    loaded: false,
    error: '',
    hotComments: [],
    comments: [],
    total: 0,
    more: false,
    offset: 0
  }
}
