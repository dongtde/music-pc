<template>
  <RouterLink class="artist-video-card" :to="video.to">
    <span class="artist-video-card__cover" :class="`artist-video-card__cover--${video.type}`">
      <img
        v-if="video.coverUrl"
        :src="video.coverUrl"
        :alt="video.title"
        loading="lazy"
        decoding="async"
      />
      <span class="artist-video-card__play" aria-hidden="true">
        <Play :size="20" fill="currentColor" />
      </span>
      <em>{{ video.duration }}</em>
    </span>
    <strong>{{ video.title }}</strong>
    <small>{{ video.playCount }} 播放 · {{ video.publishTime }}</small>
  </RouterLink>
</template>

<script setup>
import { Play } from 'lucide-vue-next'

defineProps({
  video: {
    type: Object,
    required: true
  }
})
</script>
