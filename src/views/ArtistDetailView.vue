<template>
  <div class="view artist-detail">
    <section
      v-if="isLoading"
      class="artist-detail-skeleton"
      aria-busy="true"
      aria-label="正在加载歌手详情"
    >
      <section class="artist-detail-skeleton__hero">
        <span class="artist-detail-skeleton__cover" />
        <div class="artist-detail-skeleton__content">
          <span class="artist-detail-skeleton__line artist-detail-skeleton__line--title" />
          <span class="artist-detail-skeleton__line artist-detail-skeleton__line--alias" />
          <span class="artist-detail-skeleton__line artist-detail-skeleton__line--description" />
          <div class="artist-detail-skeleton__chips">
            <span v-for="item in 4" :key="`artist-meta-skeleton-${item}`" />
          </div>
          <div class="artist-detail-skeleton__chips artist-detail-skeleton__chips--tags">
            <span v-for="item in 5" :key="`artist-tag-skeleton-${item}`" />
          </div>
        </div>
      </section>

      <section class="artist-detail-skeleton__table">
        <span class="artist-detail-skeleton__line artist-detail-skeleton__line--section" />
        <div class="artist-detail-skeleton__rows">
          <span
            v-for="item in ARTIST_DETAIL_TRACK_SKELETON_COUNT"
            :key="`artist-track-skeleton-${item}`"
          />
        </div>
      </section>
    </section>

    <template v-else>
      <section class="artist-detail-hero">
        <div class="artist-detail-cover" :class="`artist-detail-cover--${artist.type}`">
          <img
            v-if="artist.coverUrl || artist.avatarUrl"
            class="artist-detail-cover__image"
            :src="artist.coverUrl || artist.avatarUrl"
            :alt="artist.name"
            loading="lazy"
            decoding="async"
          />
        </div>

        <div class="artist-detail-hero__content">
          <h1>{{ artist.name }}</h1>
          <div v-if="artist.aliases.length" class="artist-detail-aliases">
            {{ artist.aliases.join(' / ') }}
          </div>
          <div class="artist-detail-description-wrap" :data-full-text="artist.description">
            <p class="artist-detail-description">
              {{ artist.description }}
            </p>
          </div>

          <div class="artist-detail-meta">
            <span>
              <Music :size="14" />
              {{ formatStat(artist.musicSize) }} 首歌曲
            </span>
            <span>
              <Disc3 :size="14" />
              {{ formatStat(artist.albumSize) }} 张专辑
            </span>
            <span>
              <Video :size="14" />
              {{ formatStat(artist.videoCount || artist.mvSize) }} 个视频
            </span>
            <span v-if="artist.rank">
              <BadgeCheck :size="14" />
              榜单第 {{ artist.rank }}
            </span>
          </div>

          <div v-if="artistTags.length" class="artist-detail-tags">
            <span v-for="tag in artistTags" :key="tag">{{ tag }}</span>
          </div>
        </div>
      </section>

      <div v-if="errorMessage" class="artist-detail-state artist-detail-state--error">
        {{ errorMessage }}
      </div>

      <section class="artist-detail-section">
        <header class="artist-detail-section__head">
          <h2>热门歌曲</h2>
          <small>{{ artistTracks.length }} 首</small>
        </header>

        <section class="playlist-table artist-track-table" aria-label="歌手热门歌曲列表">
          <header class="playlist-table__head">
            <span>标题</span>
            <span>专辑</span>
            <span>时长</span>
          </header>

          <SongListRow
            v-for="track in artistTracks"
            :key="track.id"
            :track="track"
            @play="playArtistTrack"
          />
        </section>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  BadgeCheck,
  Disc3,
  Music,
  Video
} from 'lucide-vue-next'
import { useMessage } from 'naive-ui'
import SongListRow from '../components/SongListRow.vue'
import { getArtistDetailData } from '../services/netease'
import { usePlayerStore } from '../stores/player'
import '../styles/artist.css'

const ARTIST_DETAIL_TRACK_SKELETON_COUNT = 10

const route = useRoute()
const player = usePlayerStore()
const message = useMessage()

const remoteArtist = ref(null)
const remoteTracks = ref([])
const isLoading = ref(false)
const errorMessage = ref('')

const artist = computed(() =>
  remoteArtist.value || {
    id: route.params.id,
    name: '歌手详情',
    aliases: [],
    identity: '',
    identities: [],
    description: '当前歌手暂无本地回退数据',
    coverUrl: '',
    avatarUrl: '',
    albumSize: 0,
    musicSize: 0,
    mvSize: 0,
    videoCount: 0,
    rank: 0,
    followed: false,
    type: 'sunset'
  }
)

const artistTracks = computed(() =>
  remoteTracks.value.map((track, index) => ({
    ...track,
    rank: String(index + 1).padStart(2, '0')
  }))
)

const artistTags = computed(() => {
  const tags = [
    artist.value.identity,
    ...artist.value.identities
  ].filter(Boolean)

  return [...new Set(tags)].slice(0, 6)
})

watch(
  () => route.params.id,
  (id) => {
    loadArtistDetail(id)
  },
  { immediate: true }
)

async function loadArtistDetail(id) {
  remoteArtist.value = null
  remoteTracks.value = []
  errorMessage.value = ''

  if (!/^\d+$/.test(String(id ?? ''))) {
    errorMessage.value = '歌手 ID 不正确'
    return
  }

  isLoading.value = true

  try {
    const data = await getArtistDetailData(id)
    remoteArtist.value = data.artist
    remoteTracks.value = data.tracks
  } catch (error) {
    console.warn('Failed to load artist detail:', error)
    errorMessage.value = '歌手详情加载失败'
  } finally {
    isLoading.value = false
  }
}

async function playArtistTrack(track) {
  player.setQueue(artistTracks.value)

  if (String(player.state.currentTrack.id) === String(track.id)) {
    await player.togglePlay()
    return
  }

  const played = await player.playTrack(track)
  if (!played) {
    message.error(player.state.error?.message || '当前歌曲暂无可播放链接')
  }
}

function formatStat(value = 0) {
  const count = Number(value) || 0

  if (count >= 100000000) {
    return `${trimNumber(count / 100000000)}亿`
  }

  if (count >= 10000) {
    return `${trimNumber(count / 10000)}万`
  }

  return String(count)
}

function trimNumber(number) {
  return Number(number.toFixed(1)).toString()
}
</script>
