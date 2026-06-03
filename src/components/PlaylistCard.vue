<template>
  <router-link class="playlist-card" :to="`/playlist/${playlist.id}`">
    <div class="cover" :class="`cover--${playlist.type}`">
      <img v-if="playlist.coverUrl" class="cover__image" :src="playlist.coverUrl" :alt="playlist.title" loading="lazy" />
      <div v-else class="cover__visual">
        <span v-if="playlist.type === 'sunset'" class="sun" />
        <span v-if="playlist.type === 'neon'" class="neon-title">Electric<br />Dreams</span>
        <span v-if="playlist.type === 'lofi'" class="desk" />
        <span v-if="playlist.type === 'stage'" class="stage-light stage-light--left" />
        <span v-if="playlist.type === 'stage'" class="stage-light stage-light--right" />
        <span v-if="playlist.type === 'piano'" class="piano" />
      </div>
      <span class="cover-hover-bg" aria-hidden="true" />
      <span class="listeners"><Headphones :size="15" /> {{ playlist.listeners }}</span>
      <span class="playlist-play-button" aria-label="播放歌单">
        <Play :size="22" fill="currentColor" />
      </span>
    </div>
    <strong>{{ playlist.title }}</strong>
  </router-link>
</template>

<script setup>
import { Headphones, Play } from 'lucide-vue-next'

defineProps({
  playlist: {
    type: Object,
    required: true
  }
})
</script>
