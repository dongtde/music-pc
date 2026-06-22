import { ref, unref } from 'vue'
import { getSongInteractionStatsData } from '../services/netease'
import { createLruCache } from '../utils/lruCache'
import { useSongComments } from './useSongComments'

const commentStatsCache = createLruCache(120)

export function useCurrentTrackComments(options = {}) {
  const {
    track,
    onLoaded,
    onBeforeOpen,
    getFallbackTotal: getBaseFallbackTotal = (song) => Number(song?.commentCount) || 0
  } = options

  const modalVisible = ref(false)
  const modalMounted = ref(false)
  const statsStale = ref(false)
  const statsError = ref('')
  const commentState = useSongComments({
    track,
    getFallbackTotal: getFallbackTotalWithCache,
    onLoaded: handleCommentsLoaded
  })

  let statsRequestId = 0

  const hotComments = commentState.hotComments
  const comments = commentState.comments
  const hasMore = commentState.hasMore
  const loading = commentState.loading
  const error = commentState.error
  const displayTotal = commentState.displayTotal

  function syncTrack(nextTrack = getCurrentTrack()) {
    refreshTotal(nextTrack)

    if (modalVisible.value) {
      commentState.open(nextTrack)
    }
  }

  async function openModal(nextTrack = getCurrentTrack()) {
    modalMounted.value = true
    modalVisible.value = true
    onBeforeOpen?.()
    await commentState.open(nextTrack)
  }

  function preload(nextTrack = getCurrentTrack(), preloadOptions) {
    return commentState.preload(nextTrack, preloadOptions)
  }

  function loadMore(nextTrack = getCurrentTrack()) {
    return commentState.loadMore(nextTrack)
  }

  async function refreshTotal(nextTrack = getCurrentTrack()) {
    const id = String(nextTrack?.id ?? '')
    const requestId = ++statsRequestId

    commentState.reset()
    statsError.value = ''
    statsStale.value = false

    const cachedStats = getCachedCommentStats(nextTrack)

    if (cachedStats) {
      applyCommentStats(nextTrack, cachedStats)
      statsStale.value = true
    }

    if (!isNeteaseNumericTrackId(id)) {
      return
    }

    try {
      const stats = await getSongInteractionStatsData(id)

      if (requestId !== statsRequestId || id !== String(getCurrentTrack()?.id ?? '')) {
        return
      }

      const normalizedStats = normalizeCommentStats(stats)
      cacheCommentStats(id, normalizedStats)
      applyCommentStats(nextTrack, normalizedStats)
      statsStale.value = false
    } catch (error) {
      if (requestId === statsRequestId) {
        console.warn('Failed to load current track comment count:', error)
        statsError.value = '评论数刷新失败'
      }
    }
  }

  function getCurrentTrack() {
    return unref(track) ?? null
  }

  function handleCommentsLoaded(payload) {
    const id = String(payload?.trackId ?? payload?.track?.id ?? '')

    if (id) {
      const stats = normalizeCommentStats({
        commentCount: payload?.data?.total,
        commentCountLabel: payload?.data?.totalLabel
      })
      cacheCommentStats(id, stats)
      applyCommentStats(payload.track, stats)
      statsStale.value = false
      statsError.value = ''
    }

    onLoaded?.(payload)
  }

  function getFallbackTotalWithCache(song) {
    return Number(getBaseFallbackTotal(song)) || Number(getCachedCommentStats(song)?.commentCount) || 0
  }

  return {
    modalVisible,
    modalMounted,
    hotComments,
    comments,
    hasMore,
    loading,
    error,
    statsStale,
    statsError,
    displayTotal,
    syncTrack,
    openModal,
    preload,
    loadMore,
    refreshTotal,
    reset: commentState.reset
  }
}

function getCachedCommentStats(track) {
  const id = String(track?.id ?? '')

  if (!id) {
    return null
  }

  const cachedStats = commentStatsCache.get(id)

  if (cachedStats) {
    return cachedStats
  }

  const commentCount = Number(track?.commentCount)

  if (Number.isFinite(commentCount) && (commentCount > 0 || track?.commentCountLabel)) {
    return normalizeCommentStats({
      commentCount,
      commentCountLabel: track.commentCountLabel
    })
  }

  return null
}

function cacheCommentStats(trackId, stats) {
  const id = String(trackId ?? '')

  if (!id || !stats) {
    return
  }

  commentStatsCache.set(id, {
    ...stats,
    cachedAt: Date.now()
  })
}

function applyCommentStats(track, stats) {
  if (!track || !stats) {
    return
  }

  track.commentCount = Number(stats.commentCount) || 0
  track.commentCountLabel = stats.commentCountLabel || ''
}

function normalizeCommentStats(stats = {}) {
  return {
    commentCount: Number(stats.commentCount) || 0,
    commentCountLabel: stats.commentCountLabel || ''
  }
}

function isNeteaseNumericTrackId(trackId) {
  return /^\d+$/.test(String(trackId ?? ''))
}
