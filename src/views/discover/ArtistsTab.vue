<template>
  <section class="discover-page">
    <section class="discover-banner discover-banner--artists">
      <div>
        <span class="tag">歌手库</span>
        <h1>找到你下一位循环播放的歌手</h1>
        <p>从热门唱作人到独立乐队，按地区和风格快速发现。</p>
      </div>
      <Mic2 :size="52" />
    </section>

    <div class="filter-row" aria-label="歌手分类">
      <button
        v-for="category in artistCategories"
        :key="category"
        type="button"
        :class="{ active: category === '全部' }"
      >
        {{ category }}
      </button>
    </div>

    <SectionTitle title="热门歌手" />
    <div class="artist-grid">
      <router-link
        v-for="artist in featuredArtists"
        :key="artist.name"
        :to="`/playlist/artist-${artist.name}`"
        class="artist-card"
      >
        <span class="artist-avatar" :style="{ '--artist-color': artist.color }">
          {{ artist.name.slice(0, 1) }}
        </span>
        <strong>{{ artist.name }}</strong>
        <small>{{ artist.tag }}</small>
        <em>{{ artist.followers }} 关注</em>
      </router-link>
    </div>
  </section>
</template>

<script setup>
import { Mic2 } from 'lucide-vue-next'
import SectionTitle from '../../components/SectionTitle.vue'
import { artistCategories, featuredArtists } from '../../data/music'
</script>
