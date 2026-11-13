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
      <Search v-else class="search-screen-mark" :size="22" aria-hidden="true" />
      <h2 id="song-search-title">歌曲搜索</h2>
    </header>

    <form class="search-screen-form" role="search" @submit.prevent="searchSongs()">
      <Search :size="19" aria-hidden="true" />
      <input
        v-model="draft"
        type="search"
        aria-label="搜索歌名或歌手"
        :placeholder="defaultKeyword ? `搜索歌名、歌手，如 ${defaultKeyword}` : '搜索歌名或歌手'"
        autocomplete="off"
        maxlength="100"
        @compositionstart="composing = true"
        @compositionend="composing = false"
      />
      <button v-if="draft" type="button" class="search-icon-button search-input-clear" aria-label="清空搜索内容" @click="showDiscovery"><X :size="16" /></button>
      <button type="submit" class="search-primary-button" :disabled="!draft.trim()">搜索</button>
    </form>

    <div v-if="!state.keyword" class="search-discovery search-scroll-area">
      <section class="search-history" aria-labelledby="song-search-history-title">
        <header class="search-section-header">
          <h3 id="song-search-history-title"><Clock3 :size="16" />历史搜索</h3>
          <button v-if="searchHistory.length" type="button" class="search-text-button" aria-label="清空历史搜索" @click="clearSearchHistory"><Trash2 :size="13" />清空</button>
        </header>
        <div v-if="searchHistory.length" class="search-history-list search-scroll-area">
          <button v-for="keyword in searchHistory" :key="keyword" type="button" :title="keyword" @click="pickKeyword(keyword)"><span>{{ keyword }}</span></button>
        </div>
        <p v-else class="search-history-empty">还没有搜索记录，试试下面的热门歌曲</p>
      </section>

      <section class="search-hot" aria-labelledby="song-search-hot-title" :aria-busy="hotLoading">
        <header class="search-section-header">
          <h3 id="song-search-hot-title"><TrendingUp :size="17" />热门搜索</h3>
          <span v-if="hotKeywords.length" class="search-section-note">TOP {{ hotKeywords.length }}</span>
        </header>
        <div v-if="hotLoading && !hotKeywords.length" class="search-hot-skeleton" role="status">
          <span class="search-sr-only">正在获取热门搜索</span>
          <span v-for="index in 10" :key="index" aria-hidden="true"><i /><b /></span>
        </div>
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

    <div v-else class="search-result-page">
      <header class="search-results-header">
        <div><h3>单曲</h3><span role="status" :class="{ 'has-feedback': feedback }">{{ feedback || (state.busy && !state.items.length ? '搜索中' : `${state.total || state.items.length} 首结果`) }}</span></div>
        <button v-if="state.items.length" type="button" class="search-secondary-button search-add-all" :disabled="pending.length > 0" @click="add(state.items)"><ListPlus :size="15" />全部加入</button>
      </header>
      <div v-if="!state.items.length" class="search-results search-scroll-area" :aria-busy="state.busy">
        <div v-if="state.busy && !state.items.length" class="search-loading" role="status">
          <div><Loader2 class="world-spin" :size="19" /><span>正在搜索“{{ state.keyword }}”</span></div>
          <div v-for="index in 4" :key="index" class="search-track-skeleton" aria-hidden="true"><i /><span><b /><b /></span></div>
        </div>
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
        <button v-else-if="state.more" class="search-more" type="button" :disabled="state.busy" @click="searchSongs(true)"><Loader2 v-if="state.busy" class="world-spin" :size="15" />{{ state.busy ? '正在加载' : '加载更多歌曲' }}</button>
      </WorldScreenList>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ArrowLeft, CircleAlert, Clock3, ListPlus, Loader2, Search, Trash2, TrendingUp, X } from 'lucide-vue-next'
import { useSearchBoot, useSearchHistory } from '../../composables/useSearch'
import { getSearchResultData } from '../../services/netease'
import { trackKey } from '../../services/listeningRoomProtocol.js'
import { contentRequest } from './contentRequest.js'
import { SCREEN_INPUT_SIZE } from './createScreenProjection.js'
import WorldScreenList from './WorldScreenList.vue'

const props = defineProps({ open: Boolean, placement: { type: Object, default: null }, playback: { type: Object, default: () => ({}) }, addTracks: { type: Function, required: true } })
const emit = defineEmits(['activate', 'close'])
const screen = ref(null), draft = ref(''), composing = ref(false), pending = ref([]), feedback = ref('')
const state = reactive({ keyword: '', items: [], total: 0, busy: false, error: '', more: false, offset: 0 })
const { defaultKeyword, hotKeywords, loadSearchBoot } = useSearchBoot({ hotLimit: 10 })
const { clearSearchHistory, loadSearchHistory, rememberSearchHistory, searchHistory } = useSearchHistory()
const hotLoading = ref(false), hotError = ref('')
const searchPlayback = computed(() => ({ ...props.playback, pendingKeys: [...new Set([...(props.playback.pendingKeys || []), ...pending.value])] }))
const screenStyle = computed(() => ({
  width: `${SCREEN_INPUT_SIZE}px`, height: `${SCREEN_INPUT_SIZE}px`,
  transform: props.placement?.transform
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
  --search-ink: #eef4ff;
  --search-muted: #91a6bd;
  --search-gold: #efd4a1;
  --search-line: #9fbfee24;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 5;
  display: grid;
  grid-template-rows: 32px 50px minmax(0, 1fr);
  gap: 14px;
  padding: 20px;
  box-sizing: border-box;
  overflow: hidden;
  contain: layout paint;
  transform-origin: 0 0;
  background: #0c1b2b;
  color: var(--search-ink);
  color-scheme: dark;
  font: 14px/1.4 'Segoe UI', 'Microsoft YaHei', sans-serif;
}
.world-song-search *, .world-song-search *::before, .world-song-search *::after { box-sizing: border-box; }
.world-song-search h2, .world-song-search h3, .world-song-search p, .world-song-search ol { margin: 0; }
.world-song-search button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 0; padding: 0; border-radius: 6px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.world-song-search button:disabled { opacity: .45; cursor: default; }
.world-song-search button:focus-visible { outline: 2px solid #9fbfee; outline-offset: 2px; }
.world-song-search button:hover:not(:disabled) { background: #243d58; }
.world-song-search svg { flex-shrink: 0; }
.search-screen-header { display: flex; align-items: center; gap: 10px; }
.search-screen-header h2 { flex: 1; font-size: 23px; line-height: 32px; font-weight: 600; letter-spacing: .02em; }
.search-screen-mark { color: var(--search-gold); margin: 0 5px; }
.world-song-search .search-icon-button { flex-shrink: 0; width: 30px; height: 30px; color: var(--search-muted); }
.search-screen-form { display: flex; align-items: center; gap: 10px; padding: 5px 6px 5px 13px; border: 1px solid #8ba6c745; border-radius: 8px; background: #14283e; color: var(--search-muted); }
.search-screen-form:focus-within { border-color: #d7c29c; box-shadow: 0 0 0 1px #efd4a11a; }
.search-screen-form input { flex: 1; width: 100%; min-width: 0; padding: 5px 0; border: 0; outline: 0; background: transparent; color: var(--search-ink); font: 15px/24px 'Segoe UI', 'Microsoft YaHei', sans-serif; }
.search-screen-form input::placeholder { color: #91a6bda6; }
.search-screen-form input::-webkit-search-cancel-button { display: none; }
.world-song-search .search-input-clear { width: 22px; height: 28px; }
.world-song-search .search-primary-button { min-height: 36px; padding: 8px 17px; background: var(--search-gold); color: #172133; font-weight: 600; white-space: nowrap; }
.world-song-search .search-primary-button:hover:not(:disabled) { background: #ffe3b1; }
.world-song-search .search-secondary-button { min-height: 30px; padding: 6px 11px; border: 1px solid #9fbfee38; background: #182d44; font-size: 12px; white-space: nowrap; }
.world-song-search .search-text-button { min-height: 22px; padding: 2px 4px; color: var(--search-muted); font-size: 12px; }
.search-scroll-area { min-height: 0; overflow: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #8ca5bf55 transparent; }
.search-discovery { display: flex; flex-direction: column; gap: 14px; }
.search-discovery > section { flex-shrink: 0; }
.search-section-header { display: flex; align-items: center; justify-content: space-between; min-height: 22px; margin-bottom: 9px; }
.search-section-header h3 { display: flex; align-items: center; gap: 7px; font-size: 15px; line-height: 22px; font-weight: 600; }
.search-section-header h3 svg { color: var(--search-muted); }
.search-section-note { color: var(--search-muted); font-size: 10px; letter-spacing: .08em; }
.search-history-list { display: flex; flex-wrap: wrap; gap: 5px; max-height: 61px; }
.world-song-search .search-history-list button { justify-content: flex-start; max-width: 100%; min-height: 28px; padding: 4px 11px; border: 1px solid #9fbfee26; border-radius: 5px; background: #172a40; color: #c2d1e2; font-size: 12px; line-height: 18px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.search-history-list button > span { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.search-history-empty { padding: 5px 0; color: var(--search-muted); font-size: 12px; line-height: 18px; }
.search-hot-list, .search-hot-skeleton { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px 10px; padding: 0; list-style: none; }
.world-song-search .search-hot-list button { justify-content: flex-start; gap: 9px; width: 100%; height: 35px; padding: 6px 10px; border: 1px solid #9fbfee14; background: #14273c; text-align: left; }
.search-hot-rank { flex: 0 0 19px; color: var(--search-muted); font-size: 14px; line-height: 20px; font-weight: 600; font-variant-numeric: tabular-nums; }
.search-hot-rank.is-top { color: var(--search-gold); }
.search-hot-list strong { min-width: 0; overflow: hidden; font-size: 14px; line-height: 20px; font-weight: 500; white-space: nowrap; text-overflow: ellipsis; }
.search-hot-skeleton > span { display: flex; align-items: center; gap: 10px; height: 35px; padding: 10px; border-radius: 6px; background: #14273c; }
.search-hot-skeleton i, .search-hot-skeleton b, .search-track-skeleton i, .search-track-skeleton b { display: block; border-radius: 3px; background: #29415a; }
.search-hot-skeleton i { width: 14px; height: 13px; }
.search-hot-skeleton b { width: 68%; height: 9px; background: #20374f; }
.search-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.search-result-page { display: grid; grid-template-rows: 30px minmax(0, 1fr); gap: 10px; min-height: 0; }
.search-results-header, .search-results-header > div { display: flex; align-items: center; gap: 9px; }
.search-results-header { justify-content: space-between; }
.search-results-header h3 { font-size: 15px; font-weight: 600; }
.search-results-header span { color: var(--search-muted); font-size: 12px; }
.world-song-search .search-add-all { color: var(--search-gold); border-color: #efd4a138; }
.search-results-header span.has-feedback { color: var(--search-gold); }
.search-message { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; height: 100%; padding: 20px; text-align: center; color: var(--search-muted); }
.search-message strong { color: var(--search-ink); font-size: 17px; font-weight: 500; }
.search-message p { font-size: 12px; line-height: 20px; }
.search-message--hot { height: 195px; }
.search-message--hot strong { font-size: 14px; }
.search-loading > div:first-child { display: flex; align-items: center; gap: 8px; min-height: 36px; color: var(--search-muted); font-size: 13px; }
.search-track-skeleton { display: flex; align-items: center; gap: 12px; height: 59px; border-bottom: 1px solid var(--search-line); }
.search-track-skeleton > i { flex-shrink: 0; width: 40px; height: 40px; }
.search-track-skeleton > span { display: flex; flex-direction: column; gap: 9px; width: 65%; }
.search-track-skeleton b { width: 72%; height: 10px; }
.search-track-skeleton b + b { width: 46%; height: 7px; background: #20374f; }
.world-song-search .search-more { display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%; min-height: 36px; margin-top: 10px; background: #172c42; color: #bacce0; font-size: 12px; }
.search-more--error { padding: 8px; color: #e4b5a8; font-size: 12px; }
@media (prefers-reduced-motion: reduce) { .world-song-search .world-spin { animation: none; } }
</style>
