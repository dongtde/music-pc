<template>
  <section
    v-if="placement"
    ref="screen"
    class="world-song-search"
    :style="screenStyle"
    role="region"
    aria-labelledby="song-search-title"
    tabindex="-1"
    @pointerdown.stop="activate"
    @pointerup.stop
    @click.stop
    @wheel.stop="activate"
    @focusin="activate"
    @keydown.stop="onKey"
  >
    <header class="search-screen-header">
      <button v-if="state.keyword" type="button" class="search-icon-button" aria-label="返回搜索首页" title="返回搜索首页" @click="showDiscovery"><ArrowLeft :size="21" /></button>
      <Search v-else class="search-screen-mark" :size="26" aria-hidden="true" />
      <h2 id="song-search-title">歌曲搜索</h2>
    </header>

    <form class="search-screen-form" role="search" @submit.prevent="searchSongs()">
      <Search :size="22" aria-hidden="true" />
      <input
        v-model="draft"
        type="search"
        aria-label="搜索歌名或歌手"
        placeholder="搜索歌名或歌手"
        autocomplete="off"
        maxlength="100"
        @compositionstart="composing = true"
        @compositionend="composing = false"
      />
      <button v-if="draft" type="button" class="search-icon-button search-input-clear" aria-label="清空搜索内容" @click="showDiscovery"><X :size="20" /></button>
      <button type="submit" class="search-primary-button" :disabled="!draft.trim()">搜索</button>
    </form>

    <div v-if="!state.keyword" class="search-discovery search-scroll-area">
      <section class="search-history" aria-labelledby="song-search-history-title">
        <header class="search-section-header">
          <h3 id="song-search-history-title"><Clock3 :size="20" />历史搜索</h3>
          <button v-if="searchHistory.length" type="button" class="search-text-button" aria-label="清空历史搜索" @click="clearSearchHistory"><Trash2 :size="18" />清空</button>
        </header>
        <div v-if="searchHistory.length" class="search-history-list search-scroll-area">
          <button v-for="keyword in searchHistory" :key="keyword" type="button" :title="keyword" @click="pickKeyword(keyword)"><span>{{ keyword }}</span></button>
        </div>
        <p v-else class="search-history-empty">试试下面的热门歌曲</p>
      </section>

      <section class="search-hot" aria-labelledby="song-search-hot-title" :aria-busy="hotLoading">
        <header class="search-section-header">
          <h3 id="song-search-hot-title"><TrendingUp :size="22" />热门搜索</h3>
        </header>
        <WorldMusicLoading v-if="hotLoading && !hotKeywords.length" class="search-hot-loading" label="正在获取热门搜索" :paused="playback.reducedMotion" />
        <div v-else-if="!hotKeywords.length" class="search-message search-message--hot" role="status">
          <CircleAlert :size="24" /><strong>{{ hotError }}</strong>
          <button type="button" class="search-secondary-button" @click="loadHotKeywords">重新加载</button>
        </div>
        <ol v-else class="search-hot-list">
          <li v-for="(item, index) in hotKeywords" :key="item.id">
            <button type="button" :title="item.keyword" @click="pickKeyword(item.keyword)">
              <span class="search-hot-rank" :class="{ 'is-top': index < 3 }">{{ index + 1 }}</span>
              <strong>{{ item.keyword }}</strong>
            </button>
          </li>
        </ol>
      </section>
    </div>

    <div v-else class="search-result-page" :class="{ 'is-loading': state.busy && !state.items.length }">
      <header v-if="!state.busy || state.items.length" class="search-results-header">
        <div><h3>单曲</h3><span role="status" :class="{ 'has-feedback': feedback }">{{ feedback || `${state.total || state.items.length} 首结果` }}</span></div>
        <button v-if="state.items.length" type="button" class="search-secondary-button search-add-all" :disabled="pending.length > 0" @click="add(state.items)"><ListPlus :size="20" />全部加入</button>
      </header>
      <div v-if="!state.items.length" class="search-results search-scroll-area" :aria-busy="state.busy">
        <WorldMusicLoading v-if="state.busy" class="search-loading" :label="`正在搜索“${state.keyword}”`" :paused="playback.reducedMotion" />
        <div v-else-if="!state.items.length" class="search-message" role="status">
          <CircleAlert v-if="state.error" :size="28" /><Search v-else :size="30" :stroke-width="1.5" />
          <strong>{{ state.error ? '歌曲搜索失败' : '没有找到相关歌曲' }}</strong>
          <p>{{ state.error || '换个歌名或歌手，再试一次' }}</p>
          <button v-if="state.error" type="button" class="search-primary-button" @click="searchSongs(false, state.keyword)">重新搜索</button>
          <button v-else type="button" class="search-secondary-button" @click="showDiscovery">查看热门搜索</button>
        </div>
      </div>
      <WorldScreenList v-else class="search-results" :items="state.items" :playback="searchPlayback" :aria-busy="state.busy" @select="add([$event])" @scroll="onScroll">
        <div v-if="state.error" class="search-more search-more--error" role="status"><span>{{ state.error }}</span><button type="button" class="search-text-button" @click="searchSongs(true)">重试</button></div>
        <button v-else-if="state.more" class="search-more" type="button" :disabled="state.busy" @click="searchSongs(true)"><WorldMusicLoading v-if="state.busy" class="search-more-loading" label="正在加载更多歌曲" :paused="playback.reducedMotion" />{{ state.busy ? '正在加载' : '加载更多歌曲' }}</button>
      </WorldScreenList>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ArrowLeft, CircleAlert, Clock3, ListPlus, Search, Trash2, TrendingUp, X } from 'lucide-vue-next'
import { useSearchBoot, useSearchHistory } from '../../composables/useSearch'
import { getSearchResultData } from '../../services/netease'
import { trackKey } from '../../services/listeningRoomProtocol.js'
import { contentRequest } from './contentRequest.js'
import { SCREEN_INPUT_SIZE } from './createScreenProjection.js'
import WorldScreenList from './WorldScreenList.vue'
import WorldMusicLoading from './WorldMusicLoading.vue'

const props = defineProps({ open: Boolean, placement: { type: Object, default: null }, playback: { type: Object, default: () => ({}) }, addTracks: { type: Function, required: true } })
const emit = defineEmits(['activate', 'close'])
const screen = ref(null), draft = ref(''), composing = ref(false), pending = ref([]), feedback = ref('')
const state = reactive({ keyword: '', items: [], total: 0, busy: false, error: '', more: false, offset: 0 })
const { hotKeywords, loadSearchBoot } = useSearchBoot({ hotLimit: 10 })
const { clearSearchHistory, loadSearchHistory, rememberSearchHistory, searchHistory } = useSearchHistory()
const hotLoading = ref(false), hotError = ref('')
const searchPlayback = computed(() => ({ ...props.playback, pendingKeys: [...new Set([...(props.playback.pendingKeys || []), ...pending.value])] }))
const screenStyle = computed(() => ({
  width: `${SCREEN_INPUT_SIZE}px`, height: `${SCREEN_INPUT_SIZE}px`,
  transform: props.placement?.transform, clipPath: props.placement?.clipPath || 'none'
}))
let revision = 0, disposed = false

function activate() {
  if (!props.open) emit('activate')
}

async function loadHotKeywords() {
  if (disposed || hotLoading.value) return
  hotLoading.value = true
  hotError.value = ''
  try {
    await contentRequest(loadSearchBoot())
    if (!hotKeywords.value.length) hotError.value = '暂时无法获取热门搜索'
  } catch {
    if (!disposed) hotError.value = '热门搜索加载失败'
  } finally {
    if (!disposed) hotLoading.value = false
  }
}

async function pickKeyword(keyword) {
  draft.value = keyword
  searchSongs()
  await nextTick()
  screen.value?.querySelector('input')?.focus({ preventScroll: true })
}

async function showDiscovery() {
  revision++
  Object.assign(state, { keyword: '', items: [], total: 0, busy: false, error: '', more: false, offset: 0 })
  draft.value = ''
  feedback.value = ''
  loadSearchHistory()
  await nextTick()
  screen.value?.querySelector('input')?.focus({ preventScroll: true })
}

async function searchSongs(append = false, query = draft.value) {
  if (disposed || composing.value || (append && (state.busy || !state.more))) return
  const keyword = append ? state.keyword : query.trim()
  if (!keyword) return
  const token = ++revision, offset = append ? state.offset : 0
  state.busy = true
  state.error = ''
  feedback.value = ''
  if (!append) {
    loadSearchHistory()
    rememberSearchHistory(keyword)
    Object.assign(state, { keyword, items: [], total: 0, offset: 0, more: false })
    screen.value?.querySelector('.search-results')?.scrollTo(0, 0)
  }
  try {
    const result = await contentRequest(getSearchResultData({ keyword, type: 1, limit: 30, offset }))
    if (disposed || token !== revision) return
    const tracks = (result.items || []).map(track => ({ ...track, kind: 'song' }))
    state.items = [...(append ? state.items : []), ...tracks]
    state.total = result.total || state.items.length
    state.offset = offset + tracks.length
    state.more = Boolean(result.hasMore) && tracks.length > 0
  } catch {
    if (!disposed && token === revision) state.error = append ? '更多歌曲加载失败' : '请检查网络连接后重试'
  } finally {
    if (!disposed && token === revision) state.busy = false
  }
}

async function add(tracks) {
  const keys = tracks.map(trackKey)
  if (keys.some(key => pending.value.includes(key))) return
  pending.value = [...pending.value, ...keys]
  feedback.value = '正在加入播放列表…'
  try {
    const added = await props.addTracks(tracks, `歌曲搜索 · ${state.keyword}`, true)
    if (!disposed) feedback.value = added ? '已加入播放列表' : '加入失败，请稍后重试'
  } catch {
    if (!disposed) feedback.value = '加入失败，请稍后重试'
  } finally {
    if (!disposed) pending.value = pending.value.filter(key => !keys.includes(key))
  }
}

function onScroll(event) {
  const el = event.target
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40 && state.more && !state.busy && !state.error) searchSongs(true)
}

function onKey(event) {
  if (event.isComposing) return
  if (event.key === 'Escape') { event.preventDefault(); emit('close'); return }
}

watch(() => Boolean(props.placement), visible => {
  if (visible) {
    loadSearchHistory()
    if (!hotKeywords.value.length) loadHotKeywords()
  } else composing.value = false
}, { immediate: true })
watch(() => props.open, visible => {
  if (visible) loadSearchHistory()
})
watch(() => props.open && Boolean(props.placement), async visible => {
  if (visible) { await nextTick(); screen.value?.querySelector('input')?.focus({ preventScroll: true }) }
})
onBeforeUnmount(() => { disposed = true; revision++ })
</script>

<style scoped>
.world-song-search {
  --search-ink: #eef2e8;
  --search-muted: #a4bdc5;
  --search-accent:var(--world-control-accent);
  --search-line: #aacad221;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 5;
  display: grid;
  grid-template-rows: 44px 56px minmax(0, 1fr);
  gap: 14px;
  padding: 20px;
  box-sizing: border-box;
  overflow: hidden;
  contain: layout paint;
  transform-origin: 0 0;
  background: #081d2a;
  border-top: 3px solid var(--search-accent);
  color: var(--search-ink);
  color-scheme: dark;
  font: 18px/1.4 'Microsoft YaHei', 'Segoe UI', sans-serif;
}
.world-song-search *, .world-song-search *::before, .world-song-search *::after { box-sizing: border-box; }
.world-song-search h2, .world-song-search h3, .world-song-search p, .world-song-search ol { margin: 0; }
.world-song-search button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 0; padding: 0; border-radius: 7px; background: transparent; color:var(--world-control-accent); font: inherit; cursor: pointer; }
.world-song-search button:disabled { opacity: .45; cursor: default; }
.world-song-search button:focus-visible { outline: 2px solid var(--search-accent); outline-offset: -2px; }
.world-song-search button:hover:not(:disabled) { background:var(--world-control-hover); }
.world-song-search svg { flex-shrink: 0; }
.search-screen-header { display: flex; align-items: center; gap: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--search-line); }
.search-screen-header h2 { flex: 1; font-size: 26px; line-height: 34px; font-weight: 500; letter-spacing: .02em; }
.search-screen-mark { color: var(--search-accent); margin: 0 4px; }
.world-song-search .search-icon-button { flex-shrink: 0; width: 34px; height: 34px; color:var(--world-control-accent); }
.search-screen-form { display: flex; align-items: center; gap: 10px; padding: 5px 6px 5px 13px; border: 1px solid #91afb955; border-radius: 8px; background: #102d3c; color: var(--search-muted); }
.search-screen-form:focus-within { border-color: var(--search-accent); box-shadow:0 0 0 1px var(--world-control-selected-tint); }
.search-screen-form input { flex: 1; width: 100%; min-width: 0; padding: 5px 0; border: 0; outline: 0; background: transparent; color: var(--search-ink); font: inherit; line-height: 28px; }
.search-screen-form input::placeholder { color: var(--search-muted); }
.search-screen-form input::-webkit-search-cancel-button { display: none; }
.world-song-search .search-input-clear { width: 30px; height: 36px; }
.world-song-search .search-primary-button { min-height: 42px; padding: 8px 18px; background:var(--world-control-accent); color:var(--world-control-on-accent); font-weight: 600; white-space: nowrap; }
.world-song-search .search-primary-button:disabled { opacity: 1; cursor: not-allowed; }
.world-song-search .search-primary-button:hover:not(:disabled) { background:var(--world-control-accent-hover); }
.world-song-search .search-secondary-button { min-height: 40px; padding: 7px 12px; border:1px solid var(--world-control-border); background:var(--world-control-surface); font-size: 16px; white-space: nowrap; color:var(--world-control-accent); }
.world-song-search .search-text-button { min-height: 32px; padding: 4px 6px; color:var(--world-control-accent); font-size: 16px; }
.search-scroll-area { min-height: 0; overflow: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #91afb955 transparent; }
.search-discovery { display: flex; flex-direction: column; gap: 18px; padding-right: 4px; }
.search-discovery > section { flex-shrink: 0; }
.search-section-header { display: flex; align-items: center; justify-content: space-between; min-height: 30px; margin-bottom: 10px; }
.search-section-header h3 { display: flex; align-items: center; gap: 8px; font-size: 20px; line-height: 28px; font-weight: 500; }
.search-section-header h3 svg { color: var(--search-muted); }
.search-history-list { display: flex; flex-wrap: wrap; gap: 8px; max-height: 84px; }
.world-song-search .search-history-list button { flex-shrink: 0; justify-content: flex-start; max-width: 100%; min-height: 38px; padding: 6px 12px; border:1px solid var(--world-control-border); background:var(--world-control-surface); color:var(--world-control-accent); font-size: 16px; line-height: 24px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.search-history-list button > span { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.search-history-empty { padding: 4px 0; color: var(--search-muted); font-size: 16px; line-height: 24px; }
.search-hot-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px 10px; padding: 0; list-style: none; }
.world-song-search .search-hot-list button { justify-content: flex-start; gap: 10px; width: 100%; min-height: 46px; padding: 8px 10px; background:var(--world-control-surface); text-align: left; }
.search-hot-rank { flex: 0 0 22px; color:var(--world-control-accent); font: 500 21px/28px Bahnschrift, 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums; }
.search-hot-rank.is-top { color: var(--search-accent); }
.search-hot-list strong { min-width: 0; overflow: hidden; font-size: 18px; line-height: 28px; font-weight: 500; white-space: nowrap; text-overflow: ellipsis; }
.search-result-page { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 12px; min-height: 0; }
.search-result-page.is-loading { grid-template-rows: minmax(0, 1fr); }
.search-results-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.search-results-header > div { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; min-width: 0; }
.search-results-header h3 { font-size: 20px; font-weight: 500; }
.search-results-header span { color: var(--search-muted); font-size: 16px; overflow-wrap: anywhere; }
.world-song-search .search-add-all { flex-shrink: 0; color: var(--search-accent); border-color:var(--world-control-border); }
.search-results-header span.has-feedback { color: var(--search-accent); }
.search-message { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; height: 100%; padding: 20px; text-align: center; color: var(--search-muted); }
.search-message strong { color: var(--search-ink); font-size: 22px; font-weight: 500; }
.search-message p { font-size: 18px; line-height: 28px; }
.search-message--hot { min-height: 220px; }
.world-song-search .search-hot-loading { min-height: 220px; height: 258px; }
.world-song-search .search-loading { min-height: 0; }
.search-hot-loading :deep(canvas), .search-loading :deep(canvas) { width: 184px; height: 184px; }
.world-song-search .search-more-loading { width: 28px; height: 28px; min-height: 0; }
.search-more-loading :deep(canvas) { width: 28px; height: 28px; }
.world-song-search .search-more { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 8px; width: 100%; min-height: 44px; margin-top: 10px; background:var(--world-control-surface); color:var(--world-control-accent); font-size: 16px; }
.search-more--error { padding: 8px; color: #e4b5a8; font-size: 16px; }
</style>
