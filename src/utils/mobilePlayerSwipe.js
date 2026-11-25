// Decide the gesture axis before capturing a pointer. Reading pages retain
// vertical scrolling; only the cover/info page can turn it into a song change.
export function getPlayerSwipeAxis(dx, dy, { page, canChangeTrack = false, trackLoading = false }) {
  const x = Math.abs(dx)
  const y = Math.abs(dy)
  if (y >= 14 && y >= x * 1.4) {
    return page === 'cover' && canChangeTrack && !trackLoading ? 'vertical' : 'scroll'
  }
  if (x >= 14 && x >= y * 1.4) return 'horizontal'
  return null
}

export function getPlayerSwipeAction({ axis, dx = 0, dy = 0, width = 0, height = 0 }) {
  if (axis === 'horizontal' && Math.abs(dx) >= Math.min(64, Math.max(36, width * .14))) {
    return dx < 0 ? 'next-page' : 'previous-page'
  }
  if (axis === 'vertical' && Math.abs(dy) >= Math.min(88, Math.max(48, height * .1))) {
    return dy < 0 ? 'next-song' : 'previous-song'
  }
  return null
}

// Commit only after more than 70% of the mini player's text viewport is swiped.
export function getMiniPlayerSwipeDirection({ dx = 0, dy = 0, width = 0 }) {
  if (!Number.isFinite(width) || width <= 0) return 0
  const axis = getPlayerSwipeAxis(dx, dy, { page: 'lyrics' })
  if (axis !== 'horizontal' || Math.abs(dx) <= width * .7) return 0
  return dx < 0 ? 1 : -1
}

export const MOBILE_PLAYER_PAGES = [
  { id: 'danmaku', label: '弹幕页面' },
  { id: 'cover', label: '封面页面' },
  { id: 'lyrics', label: '歌词页面' }
]

export function getPlayerPageIndex(page) {
  const index = MOBILE_PLAYER_PAGES.findIndex(item => item.id === page)
  return index < 0 ? 1 : index
}

export function getPlayerPageTarget(page, direction = 0) {
  const index = Math.max(0, Math.min(MOBILE_PLAYER_PAGES.length - 1, getPlayerPageIndex(page) + direction))
  return MOBILE_PLAYER_PAGES[index].id
}

export function getPlayerPageDragOffset(page, dx, width) {
  const size = Math.max(1, Number(width) || 1)
  const offset = Math.max(-size, Math.min(size, dx))
  const index = getPlayerPageIndex(page)
  const atEdge = (index === 0 && dx > 0) || (index === MOBILE_PLAYER_PAGES.length - 1 && dx < 0)
  return atEdge ? offset * .25 : offset
}
