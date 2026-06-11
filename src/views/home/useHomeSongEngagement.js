import { computed, reactive, ref, shallowRef, watch } from 'vue'
import {
  getSongCommentsData,
  getSongInteractionStatsData
} from '../../services/netease'
import { useSongComments } from '../../composables/useSongComments'
import {
  HOME_DANMAKU_COMMENT_LIMIT as homeDanmakuCommentLimit
} from './homeConstants'
import {
  formatActionCount,
  isNeteaseTrackId
} from './homeUtils'

export function useHomeSongEngagement({ activeSong, allSongs, recommendationQueue, player }) {
  const likedIds = shallowRef(new Set())
  const songStats = shallowRef(new Map())
  const danmakuEnabled = ref(true)
  const songCommentsModalVisible = ref(false)
  const songCommentsModalMounted = ref(false)
  const songDanmakuState = reactive(createCommentStream())
  const songStatsLoadingIds = new Set()
  let songDanmakuRequestId = 0

  const songCommentState = useSongComments({
    track: activeSong,
    getFallbackTotal: getSongCommentCount,
    onLoaded: ({ trackId, data }) => {
      updateSongStats(trackId, {
        commentCount: data.total,
        commentCountLabel: formatActionCount(data.total)
      })
    }
  })
  const songCommentSubtitle = computed(() => {
    const song = songCommentState.track.value

    return song ? `${song.name} - ${song.artist}` : ''
  })

  watch(danmakuEnabled, (enabled) => {
    if (enabled) {
      loadMoreSongDanmaku()
    }
  })

  async function loadActiveSongStats(trackId) {
    const id = String(trackId ?? '')

    if (!isNeteaseTrackId(id) || songStats.value.has(id) || songStatsLoadingIds.has(id)) {
      return
    }

    songStatsLoadingIds.add(id)

    try {
      const stats = await getSongInteractionStatsData(id)
      updateSongStats(id, stats)
    } catch (error) {
      console.warn('Failed to load feed song stats:', error)
    } finally {
      songStatsLoadingIds.delete(id)
    }
  }

  function updateSongStats(trackId, stats) {
    const id = String(trackId ?? '')

    if (!id) {
      return
    }

    const nextSongStats = new Map(songStats.value)
    const nextStats = {
      ...(nextSongStats.get(id) ?? {}),
      ...stats
    }

    nextSongStats.set(id, nextStats)
    songStats.value = nextSongStats
    mergeStatsIntoTracks(id, nextStats)
  }

  function mergeStatsIntoTracks(trackId, stats) {
    const id = String(trackId)

    for (const queue of [allSongs.value, recommendationQueue.value]) {
      queue
        .filter((song) => String(song?.id) === id)
        .forEach((song) => Object.assign(song, stats))
    }

    if (String(player.state.currentTrack.id) === id) {
      Object.assign(player.state.currentTrack, stats)
    }
  }

  function toggleLike(song) {
    const nextLikedIds = new Set(likedIds.value)
    const id = String(song.id)
    const wasLiked = nextLikedIds.has(id)

    if (wasLiked) {
      nextLikedIds.delete(id)
    } else {
      nextLikedIds.add(id)
    }

    likedIds.value = nextLikedIds

    if (isNeteaseTrackId(id)) {
      const nextLikedCount = Math.max(0, getSongLikeCount(song) + (wasLiked ? -1 : 1))
      const previousLabel = getSongStats(song).likedCountLabel

      updateSongStats(id, {
        likedCount: nextLikedCount,
        likedCountLabel: previousLabel || formatActionCount(nextLikedCount)
      })
    }
  }

  async function openSongCommentsModal(song = activeSong.value) {
    if (!song) {
      return
    }

    songCommentsModalMounted.value = true
    songCommentsModalVisible.value = true
    await songCommentState.open(song)
  }

  function toggleDanmaku() {
    danmakuEnabled.value = !danmakuEnabled.value
  }

  function resetSongDanmakuStream(song = activeSong.value) {
    songDanmakuRequestId += 1
    Object.assign(songDanmakuState, createCommentStream(String(song?.id ?? '')))
    songDanmakuState.more = Boolean(isNeteaseTrackId(songDanmakuState.trackId))
  }

  async function loadMoreSongDanmaku(song = activeSong.value) {
    const id = String(song?.id ?? songDanmakuState.trackId ?? '')

    if (
      !danmakuEnabled.value ||
      !isNeteaseTrackId(id) ||
      songDanmakuState.loading ||
      !songDanmakuState.more
    ) {
      return
    }

    const requestId = ++songDanmakuRequestId
    songDanmakuState.loading = true
    songDanmakuState.error = ''

    try {
      const data = await getSongCommentsData({
        id,
        limit: homeDanmakuCommentLimit,
        offset: songDanmakuState.offset
      })

      if (requestId !== songDanmakuRequestId || id !== String(activeSong.value?.id ?? '')) {
        return
      }

      songDanmakuState.trackId = id
      songDanmakuState.hotComments = songDanmakuState.offset === 0 ? data.hotComments : []
      songDanmakuState.comments = data.comments
      songDanmakuState.total = data.total
      songDanmakuState.offset += data.comments.length
      songDanmakuState.more = Boolean(data.more && data.comments.length)

      updateSongStats(id, {
        commentCount: data.total,
        commentCountLabel: formatActionCount(data.total)
      })
    } catch (error) {
      if (requestId === songDanmakuRequestId) {
        console.warn('Failed to load song danmaku comments:', error)
        songDanmakuState.error = error?.message || '弹幕评论加载失败'
        songDanmakuState.more = false
      }
    } finally {
      if (requestId === songDanmakuRequestId) {
        songDanmakuState.loading = false
      }
    }
  }

  function loadMoreSongComments() {
    songCommentState.loadMore(songCommentState.track.value)
  }

  function isLiked(song) {
    return likedIds.value.has(String(song.id))
  }

  function getSongStats(song) {
    return songStats.value.get(String(song?.id ?? '')) ?? song ?? {}
  }

  function getSongLikeCount(song) {
    return Number(getSongStats(song).likedCount) || 0
  }

  function getSongCommentCount(song) {
    return Number(getSongStats(song).commentCount) || 0
  }

  function getSongLikeLabel(song) {
    const stats = getSongStats(song)

    return stats.likedCountLabel || formatActionCount(getSongLikeCount(song))
  }

  function getSongCommentLabel(song) {
    const stats = getSongStats(song)

    return stats.commentCountLabel || formatActionCount(getSongCommentCount(song))
  }

  return {
    danmakuEnabled,
    songDanmakuState,
    songCommentsModalVisible,
    songCommentsModalMounted,
    songHotComments: songCommentState.hotComments,
    songComments: songCommentState.comments,
    songCommentsHasMore: songCommentState.hasMore,
    songCommentsLoading: songCommentState.loading,
    songCommentsError: songCommentState.error,
    displaySongCommentTotal: songCommentState.displayTotal,
    songCommentSubtitle,
    loadActiveSongStats,
    resetSongDanmakuStream,
    loadMoreSongDanmaku,
    toggleLike,
    openSongCommentsModal,
    toggleDanmaku,
    loadMoreSongComments,
    isLiked,
    getSongLikeLabel,
    getSongCommentLabel
  }
}

function createCommentStream(trackId = '') {
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
