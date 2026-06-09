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
import { computed, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import { discoverTabs } from '../data/music'
import '../styles/discover.css'

const route = useRoute()

const displayTabs = computed(() =>
  discoverTabs.map((tab) =>
    tab.value === 'latest'
      ? { ...tab, label: '专辑', value: 'albums' }
      : tab
  )
)

const tabComponents = {
  recommend: defineAsyncComponent(() => import('./discover/RecommendTab.vue')),
  playlists: defineAsyncComponent(() => import('./discover/PlaylistsTab.vue')),
  charts: defineAsyncComponent(() => import('./discover/ChartsTab.vue')),
  artists: defineAsyncComponent(() => import('./discover/ArtistsTab.vue')),
  albums: defineAsyncComponent(() => import('./discover/AlbumsTab.vue')),
  latest: defineAsyncComponent(() => import('./discover/AlbumsTab.vue'))
}

const activeTab = computed(() => {
  const tab = route.params.tab || 'recommend'

  if (tab === 'latest') {
    return 'albums'
  }

  return displayTabs.value.some((item) => item.value === tab) ? tab : 'recommend'
})

const activeTabComponent = computed(() => tabComponents[activeTab.value])
</script>
