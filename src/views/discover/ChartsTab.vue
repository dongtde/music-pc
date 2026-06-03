<template>
  <section class="discover-page">
    <section class="discover-banner discover-banner--charts">
      <div>
        <span class="tag">实时更新</span>
        <h1>排行榜</h1>
        <p>接入云音乐榜单列表与榜单详情，展示热歌、新歌、原创等核心榜单的实时曲目。</p>
      </div>
      <Crown :size="52" />
    </section>

    <div v-if="loading" class="discover-loading">正在同步榜单...</div>
    <div v-else-if="error" class="discover-error">
      <strong>排行榜加载失败</strong>
      <button type="button" @click="loadData">重试</button>
    </div>
    <template v-else>
      <div class="chart-grid">
        <article v-for="board in boards" :key="board.id" class="chart-card">
          <header>
            <div>
              <strong>{{ board.title }}</strong>
              <small>{{ board.label }}</small>
            </div>
            <router-link :to="`/playlist/${board.id}`">查看</router-link>
          </header>

          <router-link
            v-for="track in board.tracks"
            :key="`${board.id}-${track.id || track.rank}`"
            :to="`/playlist/${board.id}`"
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

      <SectionTitle title="官方榜单" />
      <div class="official-chart-grid">
        <router-link
          v-for="chart in officialCharts"
          :key="chart.id"
          :to="`/playlist/${chart.id}`"
          class="official-chart-card"
        >
          <img :src="chart.coverUrl" :alt="chart.title" />
          <span>
            <strong>{{ chart.title }}</strong>
            <small>{{ chart.desc || chart.label }}</small>
          </span>
          <em>{{ chart.listeners }}</em>
        </router-link>
      </div>

      <SectionTitle title="全球媒体榜" />
      <div class="global-chart-grid">
        <router-link
          v-for="chart in globalCharts"
          :key="chart.id"
          :to="`/playlist/${chart.id}`"
          class="global-chart-card"
        >
          <img v-if="chart.coverUrl" class="song-thumb__image" :src="chart.coverUrl" :alt="chart.title" />
          <div v-else class="song-thumb" :class="`cover--${chart.type}`" />
          <span>
            <strong>{{ chart.title }}</strong>
            <small>{{ chart.desc || chart.label }}</small>
          </span>
          <em>{{ chart.listeners }}</em>
        </router-link>
      </div>
    </template>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { Crown } from 'lucide-vue-next'
import SectionTitle from '../../components/SectionTitle.vue'
import { getChartsDiscoveryData } from '../../services/netease'

const loading = ref(false)
const error = ref(null)
const boards = ref([])
const officialCharts = ref([])
const globalCharts = ref([])

onMounted(() => {
  loadData()
})

async function loadData() {
  loading.value = true
  error.value = null

  try {
    const data = await getChartsDiscoveryData()
    boards.value = data.boards
    officialCharts.value = data.officialCharts
    globalCharts.value = data.globalCharts
  } catch (loadError) {
    console.warn('Failed to load charts:', loadError)
    error.value = loadError
  } finally {
    loading.value = false
  }
}
</script>
