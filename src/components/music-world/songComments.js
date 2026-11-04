import { contentRequest } from './contentRequest.js'

const commentKey = item => String(item.id ?? `${item.user?.name}:${item.content}`)
const dedupe = items => {
  const unique = new Map()
  for (const item of items) {
    if (!item?.content?.trim()) continue
    const key = commentKey(item)
    unique.set(key, { ...item, hot: Boolean(item.hot || unique.get(key)?.hot) })
  }
  return [...unique.values()]
}
export function createSongComments({ load, onChange = () => {} }) {
  let revision = 0, disposed = false
  let state = { trackId: '', items: [], total: 0, index: 0, busy: false, more: false, error: '', empty: '播放一首歌，听听大家的故事', offset: 0 }
  const emit = () => { if (!disposed) onChange({ ...state }) }
  async function fetch(append = false) {
    if (disposed || state.busy || !state.trackId || append && !state.more) return
    const token = revision, offset = append ? state.offset : 0
    state.busy = true; state.error = ''; emit()
    try {
      const result = await contentRequest(load({ id: state.trackId, limit: 20, offset }))
      if (disposed || token !== revision) return
      const old = append ? state.items : []
      state.items = dedupe([...old, ...(!append ? (result.hotComments || []).map(item => ({ ...item, hot: true })) : []), ...(result.comments || [])])
      // Hot comments are not part of the API's regular-comment offset.
      state.offset = offset + (result.comments?.length || 0)
      state.total = Number(result.total) || state.items.length
      state.more = Boolean(result.more) && state.items.length > old.length && (result.comments?.length || 0) > 0
      state.empty = '这首歌还没有留言，先让音乐说话'
    } catch {
      if (token === revision && !disposed) state.error = '评论暂时无法加载，点击重试'
    } finally {
      if (token === revision && !disposed) { state.busy = false; emit() }
    }
  }
  function setTrack(track = {}) {
    revision++
    const local = track.source === 'local' || track.localUrl || String(track.id || '').startsWith('local-')
    // Kugou comments are keyed by mixsongid, even when playback uses a hash id.
    const remoteId = track.mixsongid || track.album_audio_id || track.id || track.hash || ''
    state = { trackId: local ? '' : String(remoteId), items: [], index: 0, total: 0, busy: false, more: false, error: '', offset: 0, empty: local ? '本地音乐暂不提供在线评论' : '播放一首歌，听听大家的故事' }
    emit()
    if (state.trackId) return fetch()
  }
  return {
    setTrack, getState: () => state,
    select(index) { state.index = Math.max(0, Math.min(index, state.items.length - 1)); emit() },
    step(delta) { if (state.items.length) { state.index = (state.index + delta + state.items.length) % state.items.length; emit() } },
    more: () => fetch(true), retry: () => fetch(state.items.length > 0 && state.more),
    dispose() { disposed = true; revision++ },
  }
}
