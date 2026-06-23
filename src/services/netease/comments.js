import {
  getAlbumComments,
  getDjComments,
  getMvComments as getNeteaseMvComments,
  getPlaylistComments,
  getSongComments,
  getSongRedCount
} from '../../api/modules/netease'
import { CACHE_TTL } from '../../config/app'
import { cacheKey, getCachedData } from '../cache'

export async function getPodcastProgramCommentsData({ id, limit = 20, offset = 0 } = {}) {
  const response = await getDjComments({ id, limit, offset })

  return mapCommentResult(response, { offset })
}

export async function getMvCommentsData({ id, limit = 20, offset = 0 }) {
  const response = await getNeteaseMvComments({ id, limit, offset })

  return mapMvCommentResult(response)
}

export async function getSongInteractionStatsData(id) {
  const trackId = String(id ?? '')

  if (!trackId) {
    return {
      likedCount: 0,
      likedCountLabel: '',
      commentCount: 0,
      commentCountLabel: ''
    }
  }

  const redResponse = await getSongRedCount({ id: trackId }).catch(() => ({}))
  const redData = redResponse.data ?? {}

  return {
    likedCount: 0,
    likedCountLabel: '',
    commentCount: toFiniteCount(redData.count),
    commentCountLabel: redData.countDesc || ''
  }
}

export async function getAlbumCommentsData({ id, limit = 20, offset = 0 }) {
  const response = await getAlbumComments({ id, limit, offset })

  return mapCommentResult(response, { offset })
}

export async function getPlaylistCommentsData({ id, limit = 20, offset = 0 }) {
  const response = await getPlaylistComments({ id, limit, offset })

  return mapCommentResult(response, { offset })
}

export async function getPlaylistCommentStatsData(id) {
  const playlistId = String(id ?? '')

  if (!playlistId) {
    return {
      commentCount: 0,
      commentCountLabel: ''
    }
  }

  return getCachedData(
    cacheKey('playlist-comment-stats', { id: playlistId }),
    CACHE_TTL.comments,
    async () => {
      const response = await getPlaylistComments({
        id: playlistId,
        limit: 1,
        offset: 0
      })

      return {
        commentCount: toFiniteCount(response.total),
        commentCountLabel: ''
      }
    }
  )
}

export async function getSongCommentsData({ id, limit = 20, offset = 0 }) {
  return getCachedData(
    cacheKey('song-comments', { id, limit, offset }),
    CACHE_TTL.comments,
    async () => {
      const response = await getSongComments({ id, limit, offset })

      return mapCommentResult(response, { offset })
    }
  )
}

export function mapMvCommentResult(result = {}) {
  return mapCommentResult(result, { isFirstPage: true })
}

function mapCommentResult(result = {}, { offset = 0, isFirstPage = offset <= 0 } = {}) {
  return {
    hotComments: (result.hotComments ?? []).map(mapComment),
    comments: (result.comments ?? []).map(mapComment),
    total: result.total ?? 0,
    more: result.more,
    isFirstPage
  }
}

function mapComment(comment) {
  const user = comment.user ?? {}

  return {
    id: comment.commentId ?? comment.time ?? `${user.userId}-${comment.time}`,
    content: comment.content,
    time: formatCommentTime(comment.time),
    likedCount: comment.likedCount ?? 0,
    user: {
      name: user.nickname || '匿名用户',
      avatarUrl: user.avatarUrl || user.avatar || ''
    }
  }
}

function formatCommentTime(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function toFiniteCount(value = 0) {
  const count = Number(value)

  return Number.isFinite(count) ? count : 0
}
