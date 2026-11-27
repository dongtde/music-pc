const HEADER_FADE_DISTANCE = 64
const HEADER_TITLE_OFFSET = 8

// Use the same scroll position for both directions, including overscroll at the top.
export function getDetailHeaderProgress(root, title) {
  if (!root || !title || root.scrollTop <= 0) return 0

  const header = root.closest('.mobile-detail-page, .main-panel')?.querySelector('.topbar')
  const headerBottom = header?.getBoundingClientRect().bottom ?? root.getBoundingClientRect().top
  const distance = headerBottom + HEADER_TITLE_OFFSET + HEADER_FADE_DISTANCE
    - title.getBoundingClientRect().bottom

  return Math.round(Math.max(0, Math.min(1, distance / HEADER_FADE_DISTANCE)) * 1000) / 1000
}
