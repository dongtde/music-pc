<template>
  <div
    class="song-list-row"
    :class="{ 'is-playing': isPlaying(track), 'is-compact': compact }"
    role="button"
    tabindex="0"
    @click="handlePlayClick"
    @keydown="handleRowKeydown"
  >
    <span class="song-list-row__main">
      <span class="song-list-row__cover" :class="`song-list-row__cover--${track.type}`">
        <img
          v-if="track.coverUrl"
          class="song-list-row__cover-image"
          :src="track.coverUrl"
          :alt="track.name"
          loading="lazy"
          decoding="async"
        />
        <span
          class="song-list-row__play"
          :class="{ 'song-list-row__play--playing': isPlaying(track) }"
          aria-label="播放单曲"
        >
          <AudioLines v-if="isPlaying(track)" :size="16" />
          <Play v-else :size="15" fill="currentColor" />
        </span>
      </span>

      <span class="song-list-row__title">
        <span class="song-list-row__name">
          <strong>{{ track.name }}</strong>
          <span v-if="track.vip" class="song-list-row__badge">VIP</span>
          <RouterLink
            v-if="videoTarget"
            class="song-list-row__video"
            :to="videoTarget"
            aria-label="有视频"
            @click.stop
          >
            <Video :size="11" />
          </RouterLink>
        </span>
        <RouterLink
          v-if="artistTarget"
          class="song-list-row__artist"
          :to="artistTarget"
          @click.stop
        >
          {{ track.artist }}
        </RouterLink>
        <small v-else>{{ track.artist }}</small>
      </span>
    </span>

    <RouterLink
      v-if="albumTarget"
      class="song-list-row__album"
      :to="albumTarget"
      @click.stop
    >
      {{ track.album }}
    </RouterLink>
    <span v-else class="song-list-row__album">{{ track.album }}</span>
    <span class="song-list-row__time">{{ track.time }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMessage } from 'naive-ui'
import { AudioLines, Play, Video } from 'lucide-vue-next'
import { usePlayerStore } from '../stores/player'

const player = usePlayerStore()
const message = useMessage()

const props = defineProps({
  track: {
    type: Object,
    required: true
  },
  compact: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['play'])

const artistTarget = computed(() => getArtistTarget(props.track))
const albumTarget = computed(() => getAlbumTarget(props.track))
const videoTarget = computed(() => getVideoTarget(props.track))

function isPlaying(track) {
  return track.isPlaying || (player.state.currentTrack.id === track.id && player.state.isPlaying)
}

function handlePlayClick() {
  if (props.track.vip) {
    message.warning('当前歌曲为 VIP 歌曲，将尝试播放试听')
  }

  emit('play', props.track)
}

function handleRowKeydown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return
  }

  if (isInteractiveTarget(event.target)) {
    return
  }

  event.preventDefault()
  handlePlayClick()
}

function isInteractiveTarget(target) {
  return Boolean(target?.closest?.('a, button'))
}

function getArtistTarget(track) {
  const id = normalizeRouteId(
    track.artistId ?? track.artistIds?.[0] ?? track.artists?.[0]?.id ?? track.ar?.[0]?.id
  )

  return id ? `/artist/${id}` : ''
}

function getAlbumTarget(track) {
  const id = normalizeRouteId(track.albumId ?? track.album?.id ?? track.al?.id)

  return id ? `/album/${id}` : ''
}

function getVideoTarget(track) {
  if (!track.hasVideo) {
    return ''
  }

  const mvId = normalizeRouteId(track.mvId ?? track.videoId ?? track.mv)

  return mvId ? { name: 'video', query: { mvId } } : { name: 'video' }
}

function normalizeRouteId(value) {
  return value === undefined || value === null || value === '' ? '' : String(value)
}
</script>

<style scoped>
.song-list-row {
  position: relative;
  display: grid;
  width: 100%;
  min-height: 58px;
  grid-template-columns: minmax(360px, 1fr) minmax(180px, 320px) 64px;
  gap: 24px;
  align-items: center;
  padding: 6px 16px;
  border: 0;
  color: var(--text-main);
  background: transparent;
  cursor: pointer;
  font: inherit;
  overflow: hidden;
  text-align: left;
  transition:
    background-color 220ms ease,
    color 220ms ease;
}

.song-list-row::before {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: rgba(var(--accent-rgb), 0.14);
  content: "";
  opacity: 0;
  transition: opacity 220ms ease;
}

.song-list-row:focus-visible {
  outline: 1px solid rgba(var(--accent-rgb), 0.58);
  outline-offset: -1px;
}

.song-list-row > * {
  position: relative;
  z-index: 1;
}

.song-list-row:nth-of-type(odd) {
  background: rgba(127, 137, 154, 0.08);
}

.song-list-row:hover,
.song-list-row.is-playing {
  background: rgba(var(--accent-rgb), 0.08);
}

.song-list-row:hover::before,
.song-list-row.is-playing::before {
  opacity: 1;
}

.song-list-row:hover .song-list-row__title strong,
.song-list-row.is-playing .song-list-row__title strong,
.song-list-row.is-playing .song-list-row__title small,
.song-list-row.is-playing .song-list-row__artist,
.song-list-row.is-playing .song-list-row__album,
.song-list-row.is-playing .song-list-row__time,
.song-list-row.is-playing .song-list-row__badge,
.song-list-row.is-playing .song-list-row__video {
  color: var(--accent);
}

.song-list-row.is-playing .song-list-row__badge,
.song-list-row.is-playing .song-list-row__video {
  border-color: rgba(var(--accent-rgb), 0.58);
}

.song-list-row__album,
.song-list-row__artist,
.song-list-row__time,
.song-list-row__title small {
  color: var(--text-muted);
  font-size: 12px;
}

.song-list-row__album,
.song-list-row__artist,
.song-list-row__video {
  text-decoration: none;
  transition:
    border-color 220ms ease,
    color 220ms ease,
    background-color 220ms ease;
}

.song-list-row__album:hover,
.song-list-row__artist:hover,
.song-list-row__video:hover {
  color: var(--accent);
}

.song-list-row__main {
  display: grid;
  min-width: 0;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
}

.song-list-row__cover {
  position: relative;
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  overflow: hidden;
  border-radius: 7px;
  color: #ffffff;
  background: #222222;
}

.song-list-row__cover-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.song-list-row__play {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 2;
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 50%;
  color: #ffffff;
  background: var(--accent);
  box-shadow: 0 10px 20px rgba(var(--accent-rgb), 0.3);
  opacity: 0;
  transform: translate(-50%, calc(-50% + 6px)) scale(0.9);
  transition:
    opacity 220ms ease,
    transform 220ms ease;
}

.song-list-row__play--playing {
  color: #ffffff;
  background: transparent;
  box-shadow: none;
  animation: song-row-playing-beat 960ms ease-in-out infinite;
  filter: drop-shadow(0 0 8px rgba(var(--accent-rgb), 0.58));
}

.song-list-row:hover .song-list-row__play,
.song-list-row.is-playing .song-list-row__play {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

.song-list-row__cover--sunset {
  background: linear-gradient(135deg, #cc4b49, #f8c85b);
}

.song-list-row__cover--neon {
  background: linear-gradient(135deg, #020313, #161959 50%, #f0198d);
}

.song-list-row__cover--lofi {
  background: linear-gradient(135deg, #2d1d16, #334656);
}

.song-list-row__cover--stage {
  background: linear-gradient(135deg, #1a2630, #7fb8d0);
}

.song-list-row__cover--piano {
  background: linear-gradient(135deg, #7d4c20, #0d0907);
}

.song-list-row__title {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.song-list-row__name {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.song-list-row__title strong,
.song-list-row__title small,
.song-list-row__artist,
.song-list-row__album {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-list-row__title strong {
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 500;
  transition: color 220ms ease;
}

.song-list-row__badge,
.song-list-row__video {
  display: inline-flex;
  height: 14px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  line-height: 1;
}

.song-list-row__badge {
  padding: 0 3px;
  border: 1px solid #20d783;
  color: #20d783;
  font-size: 9px;
  font-weight: 800;
}

.song-list-row__video {
  width: 19px;
  border: 1px solid var(--border-strong);
  color: var(--text-muted);
}

.song-list-row__video:hover {
  border-color: rgba(var(--accent-rgb), 0.58);
  background: rgba(var(--accent-rgb), 0.1);
}

.song-list-row__time {
  text-align: right;
}

.song-list-row.is-compact {
  min-height: 52px;
  grid-template-columns: minmax(0, 1fr) 44px;
  gap: 10px;
  padding: 6px 10px;
}

.song-list-row.is-compact .song-list-row__album {
  display: none;
}

.song-list-row.is-compact .song-list-row__main {
  grid-template-columns: 38px minmax(0, 1fr);
}

.song-list-row.is-compact .song-list-row__cover {
  width: 38px;
  height: 38px;
}

.song-list-row.is-compact .song-list-row__play {
  width: 26px;
  height: 26px;
}

@keyframes song-row-playing-beat {
  0%, 100% {
    opacity: 0.72;
    transform: translate(-50%, -50%) scale(0.94);
  }
  45% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.12);
  }
}
</style>
