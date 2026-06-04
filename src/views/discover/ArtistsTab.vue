<template>
  <section class="discover-page">
    <section class="discover-banner discover-banner--artists">
      <div>
        <span class="tag">歌手库</span>
        <h1>找到你下一位循环播放的歌手</h1>
        <p>接入歌手分类列表与歌手榜，按语种、类型、首字母组合筛选，覆盖热门与长尾歌手。</p>
      </div>
      <Mic2 :size="52" />
    </section>

    <div class="artist-filter-panel" aria-label="歌手筛选">
      <div>
        <strong>语种</strong>
        <button
          v-for="item in areaFilters"
          :key="item.value"
          type="button"
          :class="{ active: filters.area === item.value }"
          @click="setFilter('area', item.value)"
        >
          {{ item.label }}
        </button>
      </div>
      <div>
        <strong>分类</strong>
        <button
          v-for="item in typeFilters"
          :key="item.value"
          type="button"
          :class="{ active: filters.type === item.value }"
          @click="setFilter('type', item.value)"
        >
          {{ item.label }}
        </button>
      </div>
      <div>
        <strong>筛选</strong>
        <button
          v-for="item in initialFilters"
          :key="item.value"
          type="button"
          :class="{ active: filters.initial === item.value }"
          @click="setFilter('initial', item.value)"
        >
          {{ item.label }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="discover-loading">正在加载歌手库...</div>
    <div v-else-if="error" class="discover-error">
      <strong>歌手加载失败</strong>
      <button type="button" @click="loadData">重试</button>
    </div>
    <template v-else>
      <section v-if="topArtists.length" class="artist-rank-panel">
        <header>
          <div>
            <span class="tag">歌手榜</span>
            <h2>飙升热度</h2>
          </div>
          <small>来自 `/toplist/artist`</small>
        </header>
        <div class="artist-rank-list">
          <router-link
            v-for="artist in topArtists"
            :key="artist.id"
            :to="`/playlist/artist-${artist.id}`"
            class="artist-rank-row"
          >
            <em>{{ artist.rank }}</em>
            <img
              :src="artist.coverUrl"
              :alt="artist.name"
              loading="lazy"
              decoding="async"
            />
            <span>
              <strong>{{ artist.name }}</strong>
              <small>{{ artist.tag || `${artist.followers} 关注` }}</small>
            </span>
            <i>{{ artist.trend || artist.score }}</i>
          </router-link>
        </div>
      </section>

      <SectionTitle title="分类歌手" />
      <div class="artist-grid artist-grid--real">
        <router-link
          v-for="artist in artists"
          :key="artist.id"
          :to="`/playlist/artist-${artist.id}`"
          class="artist-card"
        >
          <span class="artist-avatar artist-avatar--image">
            <img
              v-if="artist.coverUrl"
              :src="artist.coverUrl"
              :alt="artist.name"
              loading="lazy"
              decoding="async"
            />
            <Mic2 v-else :size="28" />
          </span>
          <strong>{{ artist.name }}</strong>
          <small>{{ artist.tag || '歌手' }}</small>
          <em>{{ artist.followers }} 关注</em>
        </router-link>
      </div>
    </template>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { Mic2 } from 'lucide-vue-next'
import SectionTitle from '../../components/SectionTitle.vue'
import { getArtistsDiscoveryData } from '../../services/netease'

const areaFilters = [
  { label: '全部', value: -1 },
  { label: '华语', value: 7 },
  { label: '欧美', value: 96 },
  { label: '日本', value: 8 },
  { label: '韩国', value: 16 },
  { label: '其他', value: 0 }
]
const typeFilters = [
  { label: '全部', value: -1 },
  { label: '男歌手', value: 1 },
  { label: '女歌手', value: 2 },
  { label: '乐队组合', value: 3 }
]
const initialFilters = [
  { label: '热门', value: -1 },
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').slice(0, 10).map((letter) => ({ label: letter, value: letter.toLowerCase() }))
]

const filters = reactive({
  area: -1,
  type: -1,
  initial: -1
})
const loading = ref(false)
const error = ref(null)
const artists = ref([])
const topArtists = ref([])

onMounted(() => {
  loadData()
})

function setFilter(key, value) {
  if (filters[key] === value) {
    return
  }

  filters[key] = value
  loadData()
}

async function loadData() {
  loading.value = true
  error.value = null

  try {
    const data = await getArtistsDiscoveryData(filters)
    artists.value = data.artists
    topArtists.value = data.topArtists
  } catch (loadError) {
    console.warn('Failed to load artists:', loadError)
    error.value = loadError
  } finally {
    loading.value = false
  }
}
</script>
