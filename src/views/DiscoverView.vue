<template>
  <div class="view discover">
    <nav class="tabs" aria-label="发现音乐分类">
      <router-link
        v-for="tab in discoverTabs"
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
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { discoverTabs } from '../data/music'
import ArtistsTab from './discover/ArtistsTab.vue'
import ChartsTab from './discover/ChartsTab.vue'
import LatestTab from './discover/LatestTab.vue'
import PlaylistsTab from './discover/PlaylistsTab.vue'
import RecommendTab from './discover/RecommendTab.vue'
import '../styles/discover.css'

const route = useRoute()

const tabComponents = {
  recommend: RecommendTab,
  playlists: PlaylistsTab,
  charts: ChartsTab,
  artists: ArtistsTab,
  latest: LatestTab
}

const activeTab = computed(() => {
  const tab = route.params.tab || 'recommend'
  return discoverTabs.some((item) => item.value === tab) ? tab : 'recommend'
})

const activeTabComponent = computed(() => tabComponents[activeTab.value])
</script>
