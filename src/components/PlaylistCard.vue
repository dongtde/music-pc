<template>
  <article class="playlist-card" :class="{ 'is-playing': playingPlaylist }">
    <div class="playlist-card__cover-wrap">
      <router-link class="playlist-card__cover-link" :to="playlistLink" :aria-label="playlist.title">
        <div class="cover" :class="`cover--${playlist.type}`">
          <img
            v-if="playlist.coverUrl"
            class="cover__image"
            :src="playlist.coverUrl"
            :alt="playlist.title"
            loading="lazy"
            decoding="async"
          />
          <div v-else class="cover__visual">
            <span v-if="playlist.type === 'sunset'" class="sun" />
            <span v-if="playlist.type === 'neon'" class="neon-title">Electric<br />Dreams</span>
            <span v-if="playlist.type === 'lofi'" class="desk" />
            <span v-if="playlist.type === 'stage'" class="stage-light stage-light--left" />
            <span v-if="playlist.type === 'stage'" class="stage-light stage-light--right" />
            <span v-if="playlist.type === 'piano'" class="piano" />
          </div>
          <span class="cover-hover-bg" aria-hidden="true" />
          <span class="listeners"><Headphones :size="15" /> {{ playlist.listeners }}</span>
        </div>
      </router-link>
      <button
        class="playlist-play-button"
        type="button"
        :disabled="playingPlaylist"
        :aria-label="`播放 ${playlist.title}`"
        @click.stop.prevent="playPlaylist"
      >
        <Play :size="22" fill="currentColor" />
      </button>
    </div>
    <router-link class="playlist-card__title" :to="playlistLink">
      <strong>{{ playlist.title }}</strong>
    </router-link>
  </article>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Headphones, Play } from 'lucide-vue-next'
import { useMessage } from 'naive-ui'
import { getPlaylistDetailData } from '../services/netease'
import { usePlayerStore } from '../stores/player'

const props = defineProps({
  playlist: {
    type: Object,
    required: true
  }
})

const message = useMessage()
const player = usePlayerStore()
const playingPlaylist = ref(false)
const cachedTracks = ref(null)
const playlistLink = computed(() => `/playlist/${props.playlist.id}`)

async function playPlaylist() {
  const playlistId = String(props.playlist?.id ?? '')

  if (!playlistId || playingPlaylist.value) {
    return
  }

  if (!isNeteasePlaylistId(playlistId)) {
    message.error('这张歌单暂无可播放歌曲')
    return
  }

  playingPlaylist.value = true

  try {
    const tracks = await resolvePlaylistTracks(playlistId)

    if (!tracks.length) {
      message.error('这张歌单暂无可播放歌曲')
      return
    }

    player.setQueue(tracks)

    const played = await player.playTrack(tracks[0])

    if (!played) {
      message.error(player.state.error?.message || '当前歌单暂无可播放链接')
    }
  } catch (error) {
    console.warn('Failed to play playlist:', error)
    message.error('播放歌单失败，请稍后再试')
  } finally {
    playingPlaylist.value = false
  }
}

async function resolvePlaylistTracks(playlistId) {
  if (cachedTracks.value) {
    return cachedTracks.value
  }

  const detail = await getPlaylistDetailData(playlistId)
  const tracks = (detail.tracks ?? []).filter((track) => track?.id)

  cachedTracks.value = tracks
  return tracks
}

function isNeteasePlaylistId(playlistId) {
  return /^\d+$/.test(String(playlistId ?? ''))
}
</script>
