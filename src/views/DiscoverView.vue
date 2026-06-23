<template>
  <div class="view discover">
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

    <component :is="activeTabComponent" />
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { discoverTabs } from '../data/music'
import '../styles/discover.css'

const DISCOVER_IDLE_PREFETCH_TABS = ['playlists', 'charts']
const prefetchedDiscoverTabs = new Set()
const route = useRoute()
let discoverTabPrefetchCancel = null

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

onMounted(() => {
  scheduleDiscoverTabPrefetch()
})

onBeforeUnmount(() => {
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
