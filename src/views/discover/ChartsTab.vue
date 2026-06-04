<template>
  <section class="discover-page">
    <div v-if="loading" class="discover-loading">正在同步榜单...</div>
    <div v-else-if="error" class="discover-error">
      <strong>排行榜加载失败</strong>
      <button type="button" @click="loadData">重试</button>
    </div>
    <template v-else>
      <div class="chart-summary-grid">
        <article
          v-for="board in boards"
          :key="board.id"
          class="chart-summary-card"
          :class="{ 'is-playing': playingChartId === board.id }"
        >
          <router-link :to="`/playlist/${board.id}`" class="chart-summary-card__link">
            <span class="chart-summary-card__cover">
              <img v-if="board.coverUrl" :src="board.coverUrl" :alt="board.title" />
              <span v-else class="song-thumb" :class="`cover--${board.type}`" />
              <em><Headphones :size="14" /> {{ board.listeners }}</em>
            </span>
            <span class="chart-summary-card__body">
              <strong>{{ board.title }}</strong>
              <span
                v-for="track in board.tracks.slice(0, 3)"
                :key="`${board.id}-${track.id || track.rank}`"
                class="chart-summary-track"
              >
                <i>{{ Number(track.rank) || track.rank }}</i>
                <span>{{ track.name }}<template v-if="track.artist">- {{ track.artist }}</template></span>
              </span>
            </span>
          </router-link>

          <button
            class="chart-card__play chart-summary-card__play"
            type="button"
            :disabled="playingChartId === board.id"
            :aria-label="`播放 ${board.title}`"
            @click.stop.prevent="playChart(board)"
          >
            <Play :size="20" fill="currentColor" />
          </button>
        </article>
      </div>

      <section v-for="section in chartSections" :key="section.title" class="chart-section">
        <SectionTitle :title="section.title" />
        <div class="region-chart-grid">
          <article
            v-for="chart in section.items"
            :key="chart.id"
            class="region-chart-card"
            :class="{ 'is-playing': playingChartId === chart.id }"
          >
            <router-link
              :to="`/playlist/${chart.id}`"
              class="region-chart-card__link"
              :aria-label="chart.title"
            >
              <img v-if="chart.coverUrl" :src="chart.coverUrl" :alt="chart.title" />
              <span v-else class="song-thumb" :class="`cover--${chart.type}`" />
              <em><Headphones :size="14" /> {{ chart.listeners }}</em>
            </router-link>

            <button
              class="chart-card__play region-chart-card__play"
              type="button"
              :disabled="playingChartId === chart.id"
              :aria-label="`播放 ${chart.title}`"
              @click.stop.prevent="playChart(chart)"
            >
              <Play :size="22" fill="currentColor" />
            </button>
          </article>
        </div>
      </section>
    </template>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { Headphones, Play } from 'lucide-vue-next'
import { useMessage } from 'naive-ui'
import SectionTitle from '../../components/SectionTitle.vue'
import { getChartsDiscoveryData, getPlaylistDetailData } from '../../services/netease'
import { usePlayerStore } from '../../stores/player'

const loading = ref(false)
const error = ref(null)
const boards = ref([])
const chartSections = ref([])
const playingChartId = ref('')
const message = useMessage()
const player = usePlayerStore()
const chartTrackCache = new Map()

onMounted(() => {
  loadData()
})

async function loadData() {
  loading.value = true
  error.value = null

  try {
    const data = await getChartsDiscoveryData()
    boards.value = data.boards
    chartSections.value = data.chartSections
  } catch (loadError) {
    console.warn('Failed to load charts:', loadError)
    error.value = loadError
  } finally {
    loading.value = false
  }
}

async function playChart(chart) {
  const chartId = String(chart?.id ?? '')

  if (!chartId) {
    return
  }

  playingChartId.value = chartId

  try {
    const tracks = await resolveChartTracks(chart)

    if (!tracks.length) {
      message.error('这张排行榜暂无可播放歌曲')
      return
    }

    player.setQueue(tracks)

    const played = await player.playTrack(tracks[0])

    if (!played) {
      message.error(player.state.error?.message || '当前排行榜暂无可播放链接')
    }
  } catch (playError) {
    console.warn('Failed to play chart:', playError)
    message.error('播放排行榜失败，请稍后再试')
  } finally {
    playingChartId.value = ''
  }
}

async function resolveChartTracks(chart) {
  const chartId = String(chart?.id ?? '')

  if (!chartId) {
    return []
  }

  if (Array.isArray(chart.tracks) && chart.tracks.length) {
    return chart.tracks.filter((track) => track?.id)
  }

  if (chartTrackCache.has(chartId)) {
    return chartTrackCache.get(chartId)
  }

  const detail = await getPlaylistDetailData(chartId)
  const tracks = (detail.tracks ?? []).filter((track) => track?.id)

  chartTrackCache.set(chartId, tracks)
  return tracks
}
</script>
