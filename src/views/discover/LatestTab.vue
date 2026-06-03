<template>
  <section class="discover-page">
    <section class="discover-banner discover-banner--latest">
      <div>
        <span class="tag">今日上新</span>
        <h1>最新音乐</h1>
        <p>新歌、新碟和正在冒头的创作，一次听完今天的更新。</p>
      </div>
      <CalendarDays :size="52" />
    </section>

    <div class="section-head">
      <SectionTitle title="新歌速递" compact />
      <div class="genre-tabs">
        <button type="button">全部</button>
        <button type="button">华语</button>
        <button type="button">欧美</button>
        <button type="button">电子</button>
      </div>
    </div>
    <div class="song-list song-list--latest">
      <router-link
        v-for="song in newSongs"
        :key="song.rank"
        :to="`/playlist/new-${song.rank}`"
        class="song-row song-row--wide"
      >
        <span>{{ song.rank }}</span>
        <div class="song-thumb" :class="`cover--${song.type}`" />
        <strong>{{ song.name }}</strong>
        <small>{{ song.artist }}</small>
        <em>{{ song.album }}</em>
        <i>{{ song.time }}</i>
      </router-link>
    </div>

    <section class="latest-section">
      <SectionTitle title="新碟上架" />
      <div class="playlist-grid">
        <PlaylistCard v-for="album in latestAlbumCards" :key="album.id" :playlist="album" />
      </div>
    </section>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { CalendarDays } from 'lucide-vue-next'
import PlaylistCard from '../../components/PlaylistCard.vue'
import SectionTitle from '../../components/SectionTitle.vue'
import { latestAlbums, newSongs } from '../../data/music'

const latestAlbumCards = computed(() =>
  latestAlbums.map((album) => ({
    ...album,
    desc: album.artist
  }))
)
</script>
