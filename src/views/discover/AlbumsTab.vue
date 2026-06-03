<template>
  <section class="discover-page">
    <section class="discover-banner discover-banner--albums">
      <div>
        <span class="tag">专辑</span>
        <h1>新碟上架</h1>
        <p>接入最新专辑与热门专辑列表，按发行时间和热度查看当前正在上架的作品。</p>
      </div>
      <Disc3 :size="52" />
    </section>

    <div v-if="loading" class="discover-loading">正在加载专辑...</div>
    <div v-else-if="error" class="discover-error">
      <strong>专辑加载失败</strong>
      <button type="button" @click="loadData">重试</button>
    </div>
    <template v-else>
      <section v-if="newestAlbum" class="album-spotlight">
        <router-link class="album-spotlight__cover" :to="`/album/${newestAlbum.id}`">
          <img :src="newestAlbum.coverUrl" :alt="newestAlbum.title" />
          <span><Play :size="22" fill="currentColor" /></span>
        </router-link>
        <div class="album-spotlight__body">
          <span class="tag">新碟上架</span>
          <h2>{{ newestAlbum.title }}</h2>
          <p>{{ newestAlbum.desc || newestAlbum.artist }}</p>
          <div class="album-spotlight__meta">
            <span>{{ newestAlbum.artist }}</span>
            <span>{{ newestAlbum.publishTime }}</span>
            <span>{{ newestAlbum.listeners }}</span>
          </div>
        </div>
      </section>

      <SectionTitle title="热门专辑" />
      <div class="album-grid">
        <router-link
          v-for="album in albums"
          :key="album.id"
          :to="`/album/${album.id}`"
          class="album-card"
        >
          <div class="album-card__cover">
            <img :src="album.coverUrl" :alt="album.title" />
            <span><Play :size="20" fill="currentColor" /></span>
          </div>
          <strong>{{ album.title }}</strong>
          <small>{{ album.desc || album.artist }}</small>
        </router-link>
      </div>
    </template>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { Disc3, Play } from 'lucide-vue-next'
import SectionTitle from '../../components/SectionTitle.vue'
import { getAlbumsDiscoveryData } from '../../services/netease'

const loading = ref(false)
const error = ref(null)
const newestAlbum = ref(null)
const albums = ref([])

onMounted(() => {
  loadData()
})

async function loadData() {
  loading.value = true
  error.value = null

  try {
    const data = await getAlbumsDiscoveryData()
    newestAlbum.value = data.newestAlbum
    albums.value = data.albums
  } catch (loadError) {
    console.warn('Failed to load albums:', loadError)
    error.value = loadError
  } finally {
    loading.value = false
  }
}
</script>
