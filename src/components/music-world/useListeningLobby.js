import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { fetchListeningRooms } from '../../services/listeningRoomDirectory.js'
import { readStorage, writeStorage } from '../../utils/storage'

// The physical display and text inputs share one directory and one action lock.
// Only poll while the display is being viewed, and discard stale responses.
export function useListeningLobby(store, { active, displayName }) {
  const rooms = ref([]), loading = ref(false), directoryError = ref(''), directoryServer = ref('')
  const directoryLoaded = ref(false)
  const name = ref(store.state.name || readStorage('lanyin.listening.name') || displayName.value || '音乐同伴'), serverUrl = ref(store.state.serverUrl)
  const filter = ref('all'), query = ref(''), invitation = ref(''), busy = ref(false), pendingId = ref('')
  const copied = ref(false), copyFallback = ref('')
  const room = computed(() => store.state.room)
  const filteredRooms = computed(() => {
    const needle = query.value.trim().toLowerCase()
    return rooms.value.filter(item => (filter.value !== 'open' || item.joinable) &&
      (filter.value !== 'playing' || item.playing) &&
      (!needle || [item.id, item.hostName, item.track?.name, item.track?.artist].join(' ').toLowerCase().includes(needle)))
  })
  const snapshot = computed(() => ({
    rooms: filteredRooms.value, total: rooms.value.length, loading: loading.value, error: directoryError.value,
    // Background polls keep the last empty/error message instead of flashing loading text.
    initialLoading: loading.value && !directoryLoaded.value,
    busy: busy.value || store.state.connecting, pendingId: pendingId.value, filter: filter.value, query: query.value,
    // Do not invalidate the screen for queue metadata or multiplayer positions.
    room: room.value ? {
      id: room.value.id, hostId: room.value.hostId, capacity: room.value.capacity,
      members: room.value.members.map(({ id, name, connected, error, buffering }) => ({ id, name, connected, error, buffering })),
    } : null,
    connected: store.state.connected,
    copied: copied.value, isHost: room.value?.hostId === store.state.memberId,
    autoplayBlocked: store.state.autoplayBlocked, localError: store.state.localError, roomError: room.value?.error,
    notice: copied.value ? '邀请已复制，发给好友即可加入' : store.state.notice,
    errorMessage: store.state.error || store.state.localError || room.value?.error || '',
  }))
  let mounted = false, version = 0, timer, controller, copiedTimer
  const canLoad = () => mounted && active.value && !room.value && !busy.value && !document.hidden
  function stop() {
    version++; clearTimeout(timer); controller?.abort(); controller = null; loading.value = false
  }
  async function refresh() {
    stop()
    if (!canLoad()) return
    const token = version, request = new AbortController()
    controller = request; loading.value = true
    try {
      const result = await fetchListeningRooms(serverUrl.value, { signal: request.signal })
      if (token !== version || !canLoad()) return
      rooms.value = result.rooms; directoryServer.value = result.serverUrl; directoryError.value = ''; directoryLoaded.value = true
    } catch (error) {
      if (token !== version || request.signal.aborted) return
      rooms.value = []; directoryServer.value = ''; directoryError.value = error.message; directoryLoaded.value = true
    } finally {
      if (token === version) {
        loading.value = false; controller = null
        if (canLoad()) timer = setTimeout(refresh, 5000)
      }
    }
  }
  function schedule() { stop(); if (canLoad()) void refresh() }
  watch([active, () => room.value?.id, busy], schedule)
  watch(serverUrl, () => {
    stop(); rooms.value = []; directoryServer.value = ''; directoryError.value = ''; directoryLoaded.value = false
    if (canLoad()) timer = setTimeout(refresh, 500)
  })
  watch(displayName, value => { if (value && name.value === '音乐同伴') name.value = value })
  watch(() => store.state.serverUrl, value => { if (value) serverUrl.value = value })
  watch(() => room.value?.id, () => {
    clearTimeout(copiedTimer); copied.value = false; copyFallback.value = ''
    if (room.value && store.state.name) name.value = store.state.name
  })
  async function enter(mode, listed) {
    if (busy.value || store.state.connecting || room.value) return false
    if (!name.value.trim()) { store.state.error = '先填写一个昵称吧'; return false }
    if (listed && (!listed.joinable || !directoryServer.value)) return false
    busy.value = true; pendingId.value = listed?.id || mode; copyFallback.value = ''
    const endpoint = listed ? directoryServer.value : serverUrl.value
    try {
      const ok = await store[mode]({ serverUrl: endpoint, invitation: listed?.id || invitation.value, name: name.value.trim() })
      if (ok) { serverUrl.value = store.state.serverUrl; writeStorage('lanyin.listening.server', store.state.serverUrl) }
      return ok
    } finally { busy.value = false; pendingId.value = '' }
  }
  async function join(id) {
    const listed = rooms.value.find(item => item.id === id)
    if (!listed) { await refresh(); return false }
    return enter('join', listed)
  }
  async function copy() {
    const value = store.invitation()
    if (!value) return
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(value)
      copied.value = true; clearTimeout(copiedTimer); copiedTimer = setTimeout(() => copied.value = false, 2500)
    } catch { copyFallback.value = value }
  }
  async function leave() {
    if (busy.value) return
    busy.value = true
    try { await store.leave() } finally { busy.value = false }
  }
  onMounted(() => { mounted = true; schedule(); document.addEventListener('visibilitychange', schedule) })
  onBeforeUnmount(() => { mounted = false; stop(); clearTimeout(copiedTimer); document.removeEventListener('visibilitychange', schedule) })
  return reactive({ state: store.state, room, rooms, filteredRooms, loading, directoryError, name, serverUrl, filter, query,
    invitation, busy, pendingId, copied, copyFallback, snapshot, refresh,
    create: () => enter('create'), join, joinInvitation: () => enter('join'), copy, leave,
    enableAudio: () => store.enableAudio(), retryLocal: () => store.retryLocal(), retry: () => store.command('retry'),
  })
}
