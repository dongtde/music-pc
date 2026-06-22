<template>
  <div class="track-summary">
    <button
      ref="albumArtButton"
      class="album-art album-art--mini album-art-button"
      :class="{ 'album-art-button--expanded': albumArtHidden }"
      type="button"
      :aria-label="fullPlayerOpen ? '收起全屏播放器' : '打开全屏播放器'"
      @click="$emit('toggle-full-player')"
    >
      <span />
      <span class="album-art-button__hover">
        <component :is="fullPlayerOpen ? Minimize2 : Maximize2" :size="22" />
      </span>
    </button>
    <div class="track-summary__body">
      <div class="track-summary__text">
        <span
          ref="trackMetaViewport"
          class="track-summary__marquee"
          :class="{ 'is-overflowing': trackMetaOverflowing }"
          :title="`${track.name} - ${track.artist}`"
        >
          <span ref="trackMetaMeasure" class="track-summary__marquee-measure" aria-hidden="true">
            <strong class="track-summary__marquee-title">{{ track.name }}</strong>
            <span class="track-summary__separator">-</span>
            <small class="track-summary__marquee-artist">{{ track.artist }}</small>
          </span>
          <span class="track-summary__marquee-frame">
            <span class="track-summary__marquee-content">
              <strong class="track-summary__marquee-title">{{ track.name }}</strong>
              <span class="track-summary__separator" aria-hidden="true">-</span>
              <small class="track-summary__marquee-artist">{{ track.artist }}</small>
            </span>
            <span
              v-if="trackMetaOverflowing"
              class="track-summary__marquee-content"
              aria-hidden="true"
            >
              <strong class="track-summary__marquee-title">{{ track.name }}</strong>
              <span class="track-summary__separator" aria-hidden="true">-</span>
              <small class="track-summary__marquee-artist">{{ track.artist }}</small>
            </span>
          </span>
        </span>
      </div>
      <PlayerTrackActions
        :liked="liked"
        :comment-total="commentTotal"
        @toggle-like="$emit('toggle-like')"
        @open-comments="$emit('open-comments')"
      />
    </div>
  </div>
</template>

<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Maximize2, Minimize2 } from 'lucide-vue-next'
import PlayerTrackActions from './PlayerTrackActions.vue'

const props = defineProps({
  track: {
    type: Object,
    required: true
  },
  fullPlayerOpen: {
    type: Boolean,
    default: false
  },
  albumArtHidden: {
    type: Boolean,
    default: false
  },
  liked: {
    type: Boolean,
    default: false
  },
  commentTotal: {
    type: Number,
    default: 0
  }
})

defineEmits(['toggle-full-player', 'toggle-like', 'open-comments'])

const albumArtButton = ref(null)
const trackMetaViewport = ref(null)
const trackMetaMeasure = ref(null)
const trackMetaOverflowing = ref(false)

let trackMarqueeResizeObserver = null
let trackMarqueeMeasureFrame = 0

watch(
  () => [props.track?.name, props.track?.artist],
  () => {
    scheduleTrackMarqueeMeasure()
  }
)

function getAlbumArtRect() {
  const rect = albumArtButton.value?.getBoundingClientRect()

  if (!rect) {
    return null
  }

  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  }
}

function scheduleTrackMarqueeMeasure() {
  if (typeof window === 'undefined' || trackMarqueeMeasureFrame) {
    return
  }

  trackMarqueeMeasureFrame = window.requestAnimationFrame(async () => {
    trackMarqueeMeasureFrame = 0
    await nextTick()
    measureTrackMarqueeOverflow()
  })
}

function measureTrackMarqueeOverflow() {
  trackMetaOverflowing.value = isTrackTextOverflowing(
    trackMetaViewport.value,
    trackMetaMeasure.value
  )
}

function isTrackTextOverflowing(viewport, content) {
  if (!viewport || !content) {
    return false
  }

  const style = window.getComputedStyle(viewport)
  const titleWidth = parseFloat(style.getPropertyValue('--track-title-width')) || 0
  const artistWidth = parseFloat(style.getPropertyValue('--track-artist-width')) || 0
  const title = content.querySelector('.track-summary__marquee-title')
  const artist = content.querySelector('.track-summary__marquee-artist')

  return (
    content.scrollWidth > viewport.clientWidth + 1 ||
    (title && title.scrollWidth > titleWidth + 1) ||
    (artist && artist.scrollWidth > artistWidth + 1)
  )
}

onMounted(() => {
  window.addEventListener('resize', scheduleTrackMarqueeMeasure)

  if (typeof ResizeObserver !== 'undefined' && trackMetaViewport.value) {
    trackMarqueeResizeObserver = new ResizeObserver(scheduleTrackMarqueeMeasure)
    trackMarqueeResizeObserver.observe(trackMetaViewport.value)
  }

  scheduleTrackMarqueeMeasure()
})

onUnmounted(() => {
  window.removeEventListener('resize', scheduleTrackMarqueeMeasure)
  trackMarqueeResizeObserver?.disconnect()
  trackMarqueeResizeObserver = null

  if (trackMarqueeMeasureFrame) {
    window.cancelAnimationFrame(trackMarqueeMeasureFrame)
    trackMarqueeMeasureFrame = 0
  }
})

defineExpose({
  getAlbumArtRect,
  scheduleTrackMarqueeMeasure
})
</script>
