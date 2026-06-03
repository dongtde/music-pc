<template>
  <div class="view simple-view">
    <div class="empty-panel">
      <component :is="iconComponent" :size="44" />
      <h1>{{ title }}</h1>
      <p>这个模块已经接入路由，后续可以在这里扩展列表、播放流或详情页。</p>
      <n-button type="primary" round @click="$router.push('/discover/recommend')">返回推荐</n-button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Heart, ListMusic, Music, Radio, Users, Video } from 'lucide-vue-next'
import '../styles/simple.css'

const route = useRoute()
const icons = { Heart, ListMusic, Music, Radio, Users, Video }
const title = computed(() => {
  if (route.name === 'playlist') return route.params.id === 'liked' ? '我喜欢的音乐' : route.meta.title
  if (route.path.includes('liked')) return '我喜欢的音乐'
  if (route.path.includes('recent')) return '最近播放'
  if (route.path.includes('local')) return '本地与下载'
  return route.meta.title || '音乐'
})
const iconComponent = computed(() => icons[route.meta.icon] || Music)
</script>
