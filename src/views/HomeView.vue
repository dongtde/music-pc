<template>
  <div class="view home-view" :class="{ 'home-view--video': activeHomeSection === 'video' }">
    <nav
      class="soda-feed__tabs"
      aria-label="首页分类"
      :style="{ '--active-tab-index': activeHomeSectionIndex }"
    >
      <button
        v-for="section in homeSections"
        :key="section.value"
        type="button"
        :class="{ active: activeHomeSection === section.value }"
        @click="setHomeSection(section.value)"
      >
        {{ section.label }}
      </button>
    </nav>

    <HomeMusicFeed
      :active="activeHomeSection === 'music'"
      @first-data-ready="markHomeDataReady"
    />
    <HomeVideoFeed :active="activeHomeSection === 'video'" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import HomeMusicFeed from './home/HomeMusicFeed.vue'
import HomeVideoFeed from './home/HomeVideoFeed.vue'
import { HOME_SECTIONS as homeSections } from './home/homeConstants'

const activeHomeSection = ref('music')
const homeDataReady = ref(false)
const emit = defineEmits(['home-ready'])

const activeHomeSectionIndex = computed(() =>
  Math.max(0, homeSections.findIndex((section) => section.value === activeHomeSection.value))
)

function setHomeSection(value) {
  if (value === activeHomeSection.value) {
    return
  }

  activeHomeSection.value = value
}

function markHomeDataReady() {
  if (homeDataReady.value) {
    return
  }

  homeDataReady.value = true
  emit('home-ready')
}
</script>
