<template>
  <div class="view playlist-detail">
    <section class="playlist-hero">
      <div class="playlist-cover" :class="`playlist-cover--${playlist.type}`">
        <span v-if="playlist.type === 'sunset'" class="playlist-cover__sun" />
        <span v-if="playlist.type === 'neon'" class="playlist-cover__neon">Daily<br />Mix</span>
        <span v-if="playlist.type === 'lofi'" class="playlist-cover__desk" />
        <span v-if="playlist.type === 'stage'" class="playlist-cover__light playlist-cover__light--left" />
        <span v-if="playlist.type === 'stage'" class="playlist-cover__light playlist-cover__light--right" />
        <span v-if="playlist.type === 'piano'" class="playlist-cover__piano" />
      </div>

      <div class="playlist-hero__content">
        <h1>{{ playlist.title }}</h1>
        <p>{{ playlist.description }}</p>

        <div class="playlist-meta">
          <span class="playlist-avatar">M</span>
          <strong>{{ playlist.creator }}</strong>
          <span>{{ playlist.updated }}</span>
          <span>{{ playlist.trackCount }} 首</span>
          <span>{{ playlist.listeners }} 播放</span>
        </div>

        <div class="playlist-actions">
          <button class="playlist-action playlist-action--primary" type="button">
            <Play :size="18" fill="currentColor" />
            <span>播放全部</span>
          </button>
          <button class="playlist-action" type="button">
            <Plus :size="17" />
            <span>收藏</span>
          </button>
          <button class="playlist-action" type="button">
            <Share2 :size="17" />
            <span>分享</span>
          </button>
          <button class="playlist-action playlist-action--icon" type="button" aria-label="更多">
            <MoreHorizontal :size="19" />
          </button>
        </div>
      </div>
    </section>

    <section class="playlist-table" aria-label="歌曲列表">
      <header class="playlist-table__head">
        <span>标题</span>
        <span>专辑</span>
        <span>时长</span>
      </header>

      <SongListRow v-for="track in playlistTracks" :key="track.id" :track="track" />
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { MoreHorizontal, Play, Plus, Share2 } from 'lucide-vue-next'
import SongListRow from '../components/SongListRow.vue'
import { curatedPlaylists, newSongs } from '../data/music'
import '../styles/playlist.css'

const route = useRoute()

const fallbackPlaylist = curatedPlaylists.find((item) => item.id === 'daily') ?? curatedPlaylists[0]

const playlist = computed(() => {
  const match = curatedPlaylists.find((item) => item.id === route.params.id) ?? fallbackPlaylist

  return {
    ...match,
    creator: match.id === 'daily' ? 'Mappic 音乐' : '编辑精选',
    updated: match.id === 'daily' ? '今天 06:00 更新' : '最近更新',
    trackCount: newSongs.length,
    tags: match.id === 'daily' ? ['每日推荐', '私人定制', '流行', '新歌'] : ['精选', '流行', '发现'],
    description:
      match.id === 'daily'
        ? '根据你的播放偏好、收藏记录和最近常听风格生成，每天刷新一批适合现在听的歌曲。'
        : match.desc
  }
})

const playlistTracks = computed(() => {
  const offset = playlist.value.id === 'daily' ? 0 : 2
  return newSongs.map((song, index) => ({
    ...song,
    id: `${playlist.value.id}-${song.rank}`,
    rank: String(index + 1).padStart(2, '0'),
    type: newSongs[(index + offset) % newSongs.length].type,
    to: `/playlist/new-${String(index + 1).padStart(2, '0')}`,
    vip: index % 2 === 0,
    hasVideo: index % 3 !== 1
  }))
})
</script>
