<template>
  <div
    class="mobile-navigation"
    :class="{
      'mobile-navigation--immersive': collapsible,
      'mobile-navigation--expanded': expanded,
    }"
    @keydown.esc="expanded = false"
  >
    <button
      v-if="collapsible"
      type="button"
      class="mobile-navigation__toggle"
      :aria-label="expanded ? '收起底部导航' : '展开底部导航'"
      :aria-expanded="expanded"
      aria-controls="mobile-main-navigation"
      @click="expanded = !expanded"
    >
      <ChevronUp :size="20" aria-hidden="true" />
    </button>
    <Transition name="mobile-navigation-reveal">
      <nav
        v-show="!collapsible || expanded"
        id="mobile-main-navigation"
        class="mobile-tabbar"
        aria-label="主导航"
        :inert="collapsible && !expanded"
      >
        <RouterLink
          v-for="tab in tabs"
          :key="tab.id"
          :to="tab.to"
          class="mobile-tabbar__item"
          :class="{ 'is-active': activeTab === tab.id }"
          :aria-current="activeTab === tab.id ? 'page' : undefined"
          @click="expanded = false"
        >
          <component :is="tab.icon" :size="23" :stroke-width="activeTab === tab.id ? 2.5 : 1.75" />
          <span>{{ tab.label }}</span>
        </RouterLink>
      </nav>
    </Transition>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronUp, Compass, House, RadioTower, UserRound, Video } from 'lucide-vue-next'

const props = defineProps({
  collapsible: { type: Boolean, default: false },
})
const expanded = ref(false)
const route = useRoute()
const tabs = [
  { id: 'home', label: '首页', to: '/home', icon: House },
  { id: 'discover', label: '发现', to: '/discover/recommend', icon: Compass },
  { id: 'podcast', label: '电台', to: '/podcast', icon: RadioTower },
  { id: 'video', label: '视频', to: '/mv', icon: Video },
  { id: 'library', label: '我的', to: '/library/liked', icon: UserRound }
]
const activeTab = ref('discover')

watch([() => props.collapsible, () => route.fullPath], () => {
  expanded.value = false
})

watch(() => route.path, (path) => {
  if (path === '/home' || path === '/') activeTab.value = 'home'
  else if (path.startsWith('/discover')) activeTab.value = 'discover'
  else if (path.startsWith('/podcast')) activeTab.value = 'podcast'
  else if (/^\/(mv|video|kugou-mv)(\/|$)/.test(path)) activeTab.value = 'video'
  else if (/^\/(library|settings|friends)(\/|$)/.test(path)) activeTab.value = 'library'
}, { immediate: true })
defineExpose({ openNavigation: () => { expanded.value = true } })
</script>

<style scoped>
.mobile-navigation { display: contents; }
</style>
