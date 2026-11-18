<template>
  <div v-if="open && placement" class="world-search-input-plane" :style="{ ...inputPlaneStyle, transform: placement.transform, clipPath: placement.clipPath || 'none' }">
    <input ref="input" v-model="draft" class="world-search-native-input" :style="inputStyle" aria-label="搜索歌名或歌手" autocomplete="off" maxlength="100"
      @pointerdown.stop @pointerup.stop @click.stop @wheel.stop @keydown.stop="onKey" @blur="$emit('close')"
      @compositionstart="composing = true" @compositionend="composing = false" />
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, watch, watchEffect } from 'vue'
import { useSearchBoot, useSearchHistory } from '../../composables/useSearch'
import { getSearchResultData } from '../../services/netease'
import { trackKey } from '../../services/listeningRoomProtocol.js'
import { contentRequest } from './contentRequest.js'
import { SEARCH_INPUT_RECT } from './createSongSearchScreen.js'
import { SCREEN_INPUT_SIZE } from './createScreenProjection.js'

const props = defineProps({ open: Boolean, placement: { type: Object, default: null }, addTracks: { type: Function, required: true } })
const emit = defineEmits(['activate', 'close', 'state'])
const input = ref(null), draft = ref(''), composing = ref(false), pending = ref([]), feedback = ref('')
const state = reactive({ keyword: '', items: [], total: 0, busy: false, error: '', more: false, offset: 0 })
const { hotKeywords, loadSearchBoot } = useSearchBoot({ hotLimit: 10 })
const { clearSearchHistory, loadSearchHistory, rememberSearchHistory, searchHistory } = useSearchHistory()
const hotLoading = ref(false), hotError = ref('')
const scale = SCREEN_INPUT_SIZE / 768
const inputPlaneStyle = { position: 'absolute', top: '0', left: '0', width: `${SCREEN_INPUT_SIZE}px`, height: `${SCREEN_INPUT_SIZE}px`, transformOrigin: '0 0', pointerEvents: 'none', overflow: 'hidden', contain: 'layout paint', zIndex: '5' }
const inputStyle = { position: 'absolute', boxSizing: 'border-box', left: `${SEARCH_INPUT_RECT.x * scale}px`, top: `${SEARCH_INPUT_RECT.y * scale}px`, width: `${SEARCH_INPUT_RECT.width * scale}px`, height: `${SEARCH_INPUT_RECT.height * scale}px`, padding: '0 4px', border: '0', outline: '0', background: 'transparent', color: 'transparent', WebkitTextFillColor: 'transparent', caretColor: 'var(--world-control-accent)', font: "18px/1.5 'Microsoft YaHei', sans-serif", pointerEvents: 'auto' }
let revision = 0, disposed = false

watchEffect(() => emit('state', { ...state, items: [...state.items], draft: draft.value, feedback: feedback.value, pending: [...pending.value], history: [...searchHistory.value], hot: [...hotKeywords.value], hotLoading: hotLoading.value, hotError: hotError.value }))

async function loadHotKeywords() {
  if (disposed || hotLoading.value) return
  hotLoading.value = true; hotError.value = ''
  try {
    await contentRequest(loadSearchBoot())
    if (!hotKeywords.value.length) hotError.value = '暂时无法获取热门搜索'
  } catch { if (!disposed) hotError.value = '热门搜索加载失败' }
  finally { if (!disposed) hotLoading.value = false }
}
function showDiscovery() {
  revision++
  Object.assign(state, { keyword: '', items: [], total: 0, busy: false, error: '', more: false, offset: 0 })
  draft.value = ''; feedback.value = ''; loadSearchHistory()
}
async function searchSongs(append = false, query = draft.value) {
  if (disposed || composing.value || (append && (state.busy || !state.more))) return
  const keyword = append ? state.keyword : query.trim()
  if (!keyword) { emit('activate'); return }
  const token = ++revision, offset = append ? state.offset : 0
  state.busy = true; state.error = ''; feedback.value = ''
  if (!append) {
    loadSearchHistory(); rememberSearchHistory(keyword)
    Object.assign(state, { keyword, items: [], total: 0, offset: 0, more: false })
    emit('close')
  }
  try {
    const result = await contentRequest(getSearchResultData({ keyword, type: 1, limit: 30, offset }))
    if (disposed || token !== revision) return
    const tracks = (result.items || []).map(track => ({ ...track, kind: 'song' }))
    state.items = [...(append ? state.items : []), ...tracks]
    state.total = result.total || state.items.length; state.offset = offset + tracks.length
    state.more = Boolean(result.hasMore) && tracks.length > 0
  } catch { if (!disposed && token === revision) state.error = append ? '更多歌曲加载失败' : '请检查网络连接后重试' }
  finally { if (!disposed && token === revision) state.busy = false }
}
async function add(tracks) {
  const keys = tracks.map(trackKey)
  if (keys.some(key => pending.value.includes(key))) return
  pending.value = [...pending.value, ...keys]; feedback.value = '正在加入播放列表…'
  try {
    const added = await props.addTracks(tracks, `歌曲搜索 · ${state.keyword}`, true)
    if (!disposed) feedback.value = added ? '已加入播放列表' : '加入失败，请稍后重试'
  } catch { if (!disposed) feedback.value = '加入失败，请稍后重试' }
  finally { if (!disposed) pending.value = pending.value.filter(key => !keys.includes(key)) }
}
function select({ command, payload }) {
  if (command === 'input') emit('activate')
  else if (command === 'search') searchSongs()
  else if (command === 'keyword') { draft.value = payload; searchSongs() }
  else if (command === 'discovery') showDiscovery()
  else if (command === 'clear-history') clearSearchHistory()
  else if (command === 'hot-retry') loadHotKeywords()
  else if (command === 'more') searchSongs(true)
  else if (command === 'add') add([payload])
  else if (command === 'add-all') add(state.items)
}
function onKey(event) {
  if (event.isComposing || composing.value) return
  if (event.key === 'Escape') { event.preventDefault(); emit('close') }
  if (event.key === 'Enter') { event.preventDefault(); searchSongs() }
}
watch(() => props.open && Boolean(props.placement), async visible => {
  if (visible) { loadSearchHistory(); await nextTick(); input.value?.focus({ preventScroll: true }) }
  else composing.value = false
})
onMounted(loadHotKeywords)
onBeforeUnmount(() => { disposed = true; revision++ })
defineExpose({ select })
</script>

<style scoped>
.world-search-input-plane { position: absolute; top: 0; left: 0; width: 512px; height: 512px; transform-origin: 0 0; pointer-events: none; overflow: hidden; contain: layout paint; z-index: 5; }
/* The visible text is in the depth-tested canvas. This field only hosts the IME. */
.world-search-native-input { position: absolute; box-sizing: border-box; padding: 0 4px; border: 0; outline: 0; background: transparent; color: transparent; -webkit-text-fill-color: transparent; caret-color: var(--world-control-accent); font: 18px/1.5 'Microsoft YaHei', sans-serif; pointer-events: auto; }
.world-search-native-input::selection { background: #d6dbaa33; }
</style>
