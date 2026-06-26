<template>
  <div
    class="song-list-row"
    :class="{ 'is-playing': isPlaying(track), 'is-compact': compact }"
    role="button"
    tabindex="0"
    @dblclick="handleRowDoubleClick"
    @keydown="handleRowKeydown"
  >
    <span class="song-list-row__main">
      <span class="song-list-row__cover" :class="`song-list-row__cover--${track.type}`">
        <img
          v-if="track.coverUrl"
          class="song-list-row__cover-image"
          :src="track.thumbnailUrl || track.coverUrl"
          :alt="track.name"
          loading="lazy"
          decoding="async"
        />
        <button
          class="song-list-row__play"
          :class="{ 'song-list-row__play--playing': isPlaying(track) }"
          type="button"
          @click.stop="handlePlayIconClick"
          aria-label="播放单曲"
        >
          <AudioLines v-if="isPlaying(track)" :size="16" />
          <Play v-else :size="15" fill="currentColor" />
        </button>
      </span>

      <span class="song-list-row__title">
        <span class="song-list-row__name">
          <strong>{{ track.name }}</strong>
          <span
            v-for="badge in accessBadges"
            :key="badge.value"
            class="song-list-row__badge"
            :class="`song-list-row__badge--${badge.value}`"
            :title="badge.label"
            :aria-label="badge.label"
          >
            <span>{{ badge.badgeLabel }}</span>
          </span>
          <span
            v-for="quality in qualityBadges"
            :key="quality.value"
            class="song-list-row__quality"
            :class="`song-list-row__quality--${quality.value}`"
            :title="quality.label"
          >
            {{ quality.badgeLabel }}
          </span>
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
        <span
          v-if="artistLinks.length"
          class="song-list-row__artists"
        >
          <template
            v-for="(artist, index) in artistLinks"
            :key="artist.key"
          >
            <RouterLink
              v-if="artist.to"
              class="song-list-row__artist"
              :to="artist.to"
              @click.stop
            >
              {{ artist.name }}
            </RouterLink>
            <small
              v-else
              class="song-list-row__artist song-list-row__artist--plain"
            >
              {{ artist.name }}
            </small>
            <span
              v-if="index < artistLinks.length - 1"
              class="song-list-row__artist-separator"
              aria-hidden="true"
            >
              /
            </span>
          </template>
        </span>
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
import { useAuthStore } from '../stores/auth'
import { getAudioQualityBadges } from '../utils/audioQuality'
import { createKugouMvRouteTarget } from '../utils/mv'
import { getSongAccessBadges } from '../utils/songAccess'

const player = usePlayerStore()
const auth = useAuthStore()
const message = useMessage()

const props = defineProps({
  track: {
    type: Object,
    required: true
  },
  compact: {
    type: Boolean,
    default: false
  },
  showVipPlaybackWarning: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['play'])

const artistLinks = computed(() => getArtistLinks(props.track))
const albumTarget = computed(() => getAlbumTarget(props.track))
const videoTarget = computed(() => getVideoTarget(props.track))
const accessBadges = computed(() => getSongAccessBadges(props.track))
const qualityBadges = computed(() =>
  getAudioQualityBadges(props.track, { limit: 1, includeDefault: true })
)
const hasAccountLogin = computed(() => auth.state.isLoggedIn && auth.state.loginType !== 'guest')

function isPlaying(track) {
  return track.isPlaying || (player.state.currentTrack.id === track.id && player.state.isPlaying)
}

function handleRowDoubleClick(event) {
  if (isInteractiveTarget(event?.target)) {
    return
  }

  playTrack()
}

function handlePlayIconClick() {
  playTrack()
}

function playTrack() {
  if (props.showVipPlaybackWarning && props.track.vip && !hasAccountLogin.value) {
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
  playTrack()
}

function isInteractiveTarget(target) {
  return Boolean(target?.closest?.('a, button'))
}

function getArtistLinks(track = {}) {
  return getTrackArtists(track).map((artist, index) => {
    const id = normalizeRouteId(artist.id)

    return {
      ...artist,
      id,
      key: `${id || 'artist'}-${artist.name}-${index}`,
      to: id ? `/artist/${id}` : ''
    }
  })
}

function getTrackArtists(track = {}) {
  const artists = getExplicitArtists(track)
  const artistIds = getArtistIds(track, artists)
  const displayNames = splitArtistNames(track.artist || artists[0]?.name)

  if (artists.length > 1) {
    return artists
  }

  if (displayNames.length > 1) {
    return displayNames.map((name, index) => ({
      name,
      id: artistIds[index] ?? (index === 0 ? artists[0]?.id : '')
    }))
  }

  if (artists.length) {
    return artists
  }

  const fallbackName = displayNames[0] || String(track.artist ?? '').trim()

  return fallbackName
    ? [{
        name: fallbackName,
        id: artistIds[0] ?? track.artistId ?? ''
      }]
    : []
}

function getExplicitArtists(track = {}) {
  const source = Array.isArray(track.artists) && track.artists.length ? track.artists : track.ar

  return (Array.isArray(source) ? source : [])
    .map((artist) => ({
      id:
        artist?.id ??
        artist?.author_id ??
        artist?.authorId ??
        artist?.singerid ??
        artist?.singer_id ??
        artist?.singerId ??
        artist?.artist_id ??
        artist?.artistId ??
        '',
      name: String(
        artist?.name ??
          artist?.author_name ??
          artist?.authorName ??
          artist?.singername ??
          artist?.singer_name ??
          artist?.singerName ??
          artist?.artist_name ??
          artist?.artistName ??
          ''
      ).trim()
    }))
    .filter((artist) => artist.name)
}

function getArtistIds(track = {}, artists = []) {
  const ids = Array.isArray(track.artistIds)
    ? track.artistIds
    : artists.map((artist) => artist.id)

  return ids
    .map(normalizeRouteId)
    .filter(Boolean)
}

function splitArtistNames(value) {
  return String(value ?? '')
    .split(/\s+\/\s+/)
    .map((name) => name.trim())
    .filter(Boolean)
}

function getAlbumTarget(track) {
  const id = normalizeRouteId(track.albumId ?? track.album?.id ?? track.al?.id)

  return id ? `/album/${id}` : ''
}

function getVideoTarget(track) {
  const target = createKugouMvRouteTarget(track)

  if (!track.hasVideo && !target.params?.id) {
    return ''
  }

  return target
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
  height: 58px;
  min-height: 58px;
  grid-template-columns: minmax(360px, 1fr) minmax(180px, 320px) 64px;
  gap: 24px;
  align-items: center;
  padding: 6px 16px;
  border: 0;
  border-radius: 8px;
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
  border-radius: inherit;
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
.song-list-row.is-playing .song-list-row__artists,
.song-list-row.is-playing .song-list-row__artist,
.song-list-row.is-playing .song-list-row__album,
.song-list-row.is-playing .song-list-row__time,
.song-list-row.is-playing .song-list-row__badge,
.song-list-row.is-playing .song-list-row__quality,
.song-list-row.is-playing .song-list-row__video {
  color: var(--accent);
}

.song-list-row.is-playing .song-list-row__badge,
.song-list-row.is-playing .song-list-row__quality,
.song-list-row.is-playing .song-list-row__video {
  border-color: rgba(var(--accent-rgb), 0.58);
}

.song-list-row__album,
.song-list-row__artists,
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
.song-list-row__artist:focus-visible,
.song-list-row__video:hover {
  color: var(--accent);
}

.song-list-row__artists {
  display: flex;
  min-width: 0;
  max-width: 100%;
  align-items: center;
  align-self: flex-start;
  overflow: hidden;
  white-space: nowrap;
}

.song-list-row__artist,
.song-list-row__title small {
  align-self: flex-start;
  max-width: 100%;
}

.song-list-row__artist {
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  align-items: center;
  cursor: pointer;
  outline: none;
}

.song-list-row__artist:hover,
.song-list-row__artist:focus-visible {
  color: var(--accent);
}

.song-list-row__artist--plain {
  cursor: default;
}

.song-list-row__artist--plain:hover {
  color: var(--text-muted);
}

.song-list-row__artist-separator {
  flex: 0 0 auto;
  padding: 0 6px 0 2px;
  color: var(--text-subtle);
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
  appearance: none;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: #ffffff;
  background: var(--accent);
  box-shadow: 0 10px 20px rgba(var(--accent-rgb), 0.3);
  cursor: pointer;
  font: inherit;
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
.song-list-row:focus-within .song-list-row__play,
.song-list-row.is-playing .song-list-row__play {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

.song-list-row__play:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.92);
  outline-offset: 2px;
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
  min-width: 0;
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 500;
  transition: color 220ms ease;
}

.song-list-row__badge,
.song-list-row__quality,
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
  gap: 2px;
  min-width: 28px;
  padding: 0 4px 0 3px;
  border: 1px solid var(--theme-badge-border);
  color: var(--theme-badge-color);
  background: var(--theme-badge-bg);
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0;
  white-space: nowrap;
}

.song-list-row__badge svg {
  flex: 0 0 auto;
}

.song-list-row__badge--trial {
  border-color: rgba(78, 168, 255, 0.58);
  color: #4ea8ff;
  background: rgba(78, 168, 255, 0.1);
}

.song-list-row__quality {
  min-width: 20px;
  padding: 0 4px;
  border: 1px solid var(--theme-badge-border);
  color: var(--theme-badge-color);
  background: var(--theme-badge-bg);
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0;
  white-space: nowrap;
}

.song-list-row__quality--flac,
.song-list-row__quality--high {
  border-color: var(--theme-badge-strong-border);
  color: var(--theme-badge-color);
  background: var(--theme-badge-strong-bg);
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
  height: 52px;
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
