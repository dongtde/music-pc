<template>
  <section class="discover-page">
    <section class="discover-banner discover-banner--playlists">
      <div>
        <span class="tag">精品歌单</span>
        <h1>把今天交给合适的歌单</h1>
        <p>按心情、场景和风格整理的精选内容，适合长时间循环播放。</p>
      </div>
      <n-button round type="primary">
        <template #icon>
          <Headphones :size="18" />
        </template>
        播放精选
      </n-button>
    </section>

    <div class="filter-row" aria-label="歌单分类">
      <button
        v-for="mood in playlistMoods"
        :key="mood"
        type="button"
        :class="{ active: mood === '全部' }"
      >
        {{ mood }}
      </button>
    </div>

    <SectionTitle title="全部歌单" />
    <div class="playlist-grid playlist-grid--dense">
      <PlaylistCard v-for="playlist in curatedPlaylists" :key="playlist.id" :playlist="playlist" />
    </div>
  </section>
</template>

<script setup>
import { Headphones } from 'lucide-vue-next'
import PlaylistCard from '../../components/PlaylistCard.vue'
import SectionTitle from '../../components/SectionTitle.vue'
import { curatedPlaylists, playlistMoods } from '../../data/music'
</script>
