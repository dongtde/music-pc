<template>
  <div ref="discoverScroller" class="view discover" @scroll.passive="handleDiscoverScroll">
    <nav class="tabs" aria-label="发现音乐分类">
      <router-link
        v-for="tab in displayTabs"
        :key="tab.value"
        :to="`/discover/${tab.value}`"
        :class="{ active: activeTab === tab.value }"
      >
        {{ tab.label }}
      </router-link>
    </nav>

    <KeepAlive>
      <component :is="activeTabComponent" :key="activeTab" />
    </KeepAlive>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { discoverTabs } from '../data/music'
import '../styles/discover.css'

const DISCOVER_IDLE_PREFETCH_TABS = ['playlists', 'charts']
const prefetchedDiscoverTabs = new Set()
const route = useRoute()
let discoverTabPrefetchCancel = null
const emit = defineEmits(['discover-scroll-state'])
const discoverScroller = ref(null)
let previousScrollTop = 0
let scrollDirection = 0
let scrollDirectionDistance = 0
let headerHidden = false

const displayTabs = computed(() =>
  discoverTabs.map((tab) =>
    tab.value === 'latest'
      ? { ...tab, label: '专辑', value: 'albums' }
      : tab
  )
)

const tabLoaders = {
  recommend: () => import('./discover/RecommendTab.vue'),
  playlists: () => import('./discover/PlaylistsTab.vue'),
  charts: () => import('./discover/ChartsTab.vue'),
  artists: () => import('./discover/ArtistsTab.vue'),
  albums: () => import('./discover/AlbumsTab.vue')
}

const tabComponents = {
  recommend: defineAsyncComponent(tabLoaders.recommend),
  playlists: defineAsyncComponent(tabLoaders.playlists),
  charts: defineAsyncComponent(tabLoaders.charts),
  artists: defineAsyncComponent(tabLoaders.artists),
  albums: defineAsyncComponent(tabLoaders.albums),
  latest: defineAsyncComponent(tabLoaders.albums)
}

const activeTab = computed(() => {
  const tab = route.params.tab || 'recommend'

  if (tab === 'latest') {
    return 'albums'
  }

  return displayTabs.value.some((item) => item.value === tab) ? tab : 'recommend'
})

const activeTabComponent = computed(() => tabComponents[activeTab.value])

function handleDiscoverScroll(event) {
  const scroller = event.currentTarget
  const scrollTop = scroller.scrollTop
  const layout = document.documentElement.dataset.layout
  const isMobileLayout = layout === 'mobile-2d' || layout === 'compact-2d'
  const maxScrollTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
  const isAtBottom = maxScrollTop - scrollTop <= 8
  const delta = scrollTop - previousScrollTop
  const direction = Math.sign(delta)

  if (!isMobileLayout || scrollTop <= 12) {
    setDiscoverHeaderHidden(false)
    scrollDirection = 0
    scrollDirectionDistance = 0
  } else if (isAtBottom) {
    // Keep the header latched while the browser clamps the scroll position at the bottom.
    setDiscoverHeaderHidden(true)
    scrollDirection = 0
    scrollDirectionDistance = 0
  } else {
    if (direction && direction !== scrollDirection) {
      scrollDirection = direction
      scrollDirectionDistance = 0
    }

    if (direction) {
      scrollDirectionDistance += Math.abs(delta)
      if (scrollDirectionDistance >= 5) {
        setDiscoverHeaderHidden(direction > 0)
        scrollDirectionDistance = 0
      }
    }
  }

  previousScrollTop = scrollTop
}

function setDiscoverHeaderHidden(hidden) {
  if (headerHidden === hidden) return
  headerHidden = hidden
  emit('discover-scroll-state', hidden)
}

onMounted(() => {
  resetDiscoverScrollState()
  scheduleDiscoverTabPrefetch()
})

onActivated(resetDiscoverScrollState)
onDeactivated(() => setDiscoverHeaderHidden(false))

function resetDiscoverScrollState() {
  previousScrollTop = discoverScroller.value?.scrollTop || 0
  scrollDirection = 0
  scrollDirectionDistance = 0
  setDiscoverHeaderHidden(false)
}

onBeforeUnmount(() => {
  setDiscoverHeaderHidden(false)
  discoverTabPrefetchCancel?.()
  discoverTabPrefetchCancel = null
})

function scheduleDiscoverTabPrefetch() {
  if (typeof window === 'undefined') {
    return
  }

  const runPrefetch = () => {
    discoverTabPrefetchCancel = null
    DISCOVER_IDLE_PREFETCH_TABS
      .filter((tab) => tab !== activeTab.value)
      .forEach(prefetchDiscoverTab)
  }

  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(runPrefetch, { timeout: 1800 })
    discoverTabPrefetchCancel = () => window.cancelIdleCallback(id)
    return
  }

  const id = window.setTimeout(runPrefetch, 800)
  discoverTabPrefetchCancel = () => window.clearTimeout(id)
}

function prefetchDiscoverTab(tab) {
  const loader = tabLoaders[tab]

  if (!loader || prefetchedDiscoverTabs.has(tab)) {
    return
  }

  prefetchedDiscoverTabs.add(tab)
  loader().catch(() => {
    prefetchedDiscoverTabs.delete(tab)
  })
}
</script>
