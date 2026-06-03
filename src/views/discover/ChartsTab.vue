<template>
  <section class="discover-page">
    <section class="discover-banner discover-banner--charts">
      <div>
        <span class="tag">实时更新</span>
        <h1>排行榜</h1>
        <p>从全站播放、收藏和新歌增长中整理当前正在上升的声音。</p>
      </div>
      <Crown :size="52" />
    </section>

    <div class="chart-grid">
      <article v-for="board in chartBoards" :key="board.id" class="chart-card">
        <header>
          <div>
            <strong>{{ board.title }}</strong>
            <small>{{ board.label }}</small>
          </div>
          <span>{{ board.trend }}</span>
        </header>

        <router-link
          v-for="track in board.tracks"
          :key="`${board.id}-${track.rank}`"
          :to="`/playlist/chart-${board.id}-${track.rank}`"
          class="rank-row"
        >
          <em>{{ track.rank }}</em>
          <span>
            <strong>{{ track.name }}</strong>
            <small>{{ track.artist }}</small>
          </span>
          <i>{{ track.change }}</i>
        </router-link>
      </article>
    </div>

    <SectionTitle title="全球媒体榜" />
    <div class="global-chart-grid">
      <router-link
        v-for="chart in globalCharts"
        :key="chart.title"
        :to="`/playlist/global-${chart.title}`"
        class="global-chart-card"
      >
        <div class="song-thumb" :class="`cover--${chart.type}`" />
        <span>
          <strong>{{ chart.title }}</strong>
          <small>{{ chart.desc }}</small>
        </span>
        <em>{{ chart.listeners }}</em>
      </router-link>
    </div>
  </section>
</template>

<script setup>
import { Crown } from 'lucide-vue-next'
import SectionTitle from '../../components/SectionTitle.vue'
import { chartBoards, globalCharts } from '../../data/music'
</script>
