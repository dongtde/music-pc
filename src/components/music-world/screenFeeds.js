import { contentRequest } from './contentRequest.js'

export const FEED_LAYOUT = { size: 768, listTop: 132, listBottom: 744, rowHeight: 94 }
export const FEED_VIEW_ROWS = (FEED_LAYOUT.listBottom - FEED_LAYOUT.listTop) / FEED_LAYOUT.rowHeight
export const FEED_IDS = ['recommend', 'playlists', 'artists', 'charts']
export const ARTIST_INITIALS = [-1, ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']
const titles = { recommend: '推荐', playlists: '歌单', artists: '歌手', charts: '排行榜' }
export const clampScroll = (scroll, count) => Math.max(0, Math.min(Number(scroll) || 0, Math.max(0, count - FEED_VIEW_ROWS)))
const unique = items => [...new Map(items.filter(item => item?.id != null).map(item => [`${item.kind}:${item.id}`, item])).values()]

// Each physical screen owns its request, collection, pagination and scroll position.
export function createScreenFeeds({ load, onChange = () => {}, onAdd = () => {} }) {
  let disposed = false
  const screens = Object.fromEntries(FEED_IDS.map(id => [id, { id, title: titles[id], items: [], detail: null, initial: -1, scroll: 0, busy: false, error: '', more: false, loaded: false, offset: 0 }]))
  const revisions = {}, roots = {}
  const emit = () => { if (!disposed) onChange(Object.fromEntries(FEED_IDS.map(id => [id, { ...screens[id] }]))) }
  async function fetch(id, append = false) {
    const state = screens[id]
    if (!state || state.busy || disposed || append && !state.more) return
    const revision = revisions[id] = (revisions[id] || 0) + 1
    const offset = append ? state.offset : 0
    state.busy = true; state.error = ''; emit()
    try {
      const result = await contentRequest(load(id, state.detail, offset, { initial: state.initial }))
      if (disposed || revision !== revisions[id]) return
      const previous = append ? state.items : [], items = unique([...previous, ...(result.items || [])])
      state.items = items
      state.offset = offset + (result.items?.length || 0)
      state.more = Boolean(result.more) && items.length > previous.length
      state.loaded = true
      state.scroll = clampScroll(state.scroll, items.length)
    } catch {
      if (revision === revisions[id] && !disposed) state.error = '暂时无法载入，请点击重试'
    } finally {
      if (revision === revisions[id] && !disposed) { state.busy = false; emit() }
    }
  }
  function select(id, item) {
    const state = screens[id]
    if (!state || !item || disposed) return
    if (item.kind === 'song') return onAdd(item, state.title)
    roots[id] = { ...state }
    revisions[id] = (revisions[id] || 0) + 1
    Object.assign(state, { detail: item, title: item.name || item.title, items: [], scroll: 0, offset: 0, more: false, busy: false, loaded: false })
    return fetch(id)
  }
  function back(id) {
    if (!roots[id] || disposed) return
    revisions[id] = (revisions[id] || 0) + 1
    Object.assign(screens[id], roots[id], { busy: false }); delete roots[id]; emit()
    if (!screens[id].loaded) return fetch(id)
  }
  function scroll(id, delta) {
    const state = screens[id]; if (!state || disposed) return
    state.scroll = clampScroll(state.scroll + delta, state.items.length); emit()
    if (delta > 0 && state.more && !state.error && state.scroll >= state.items.length - FEED_VIEW_ROWS - 1) fetch(id, true)
  }
  function setArtistInitial(value) {
    const initial = String(value) === '-1' ? -1 : String(value).toUpperCase(), state = screens.artists
    if (disposed || !ARTIST_INITIALS.includes(initial) || state.detail) return
    if (state.initial === initial && (state.loaded || state.busy) && !state.error) return
    // A new letter owns its request; late pages from the previous letter cannot replace it.
    revisions.artists = (revisions.artists || 0) + 1
    Object.assign(state, { initial, items: [], scroll: 0, offset: 0, more: false, busy: false, loaded: false })
    return fetch('artists')
  }
  return {
    getState: () => screens, select, back, scroll, setArtistInitial,
    loadAll: () => Promise.allSettled(FEED_IDS.map(id => screens[id].loaded ? null : fetch(id))),
    retry: id => fetch(id, screens[id].items.length > 0 && screens[id].more),
    dispose() { disposed = true },
  }
}
