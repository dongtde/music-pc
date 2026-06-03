<template>
  <Transition name="full-player">
    <section
      v-show="open"
      class="full-player-page"
      :style="coverStyle"
      aria-label="全屏播放器"
    >
      <button
        class="full-player__close"
        type="button"
        aria-label="收起全屏播放器"
        @click="$emit('close')"
      >
        <ChevronDown :size="30" />
      </button>

      <div class="full-player__shell">
        <section class="full-player__turntable" aria-label="唱片封面">
          <div class="full-player__deck">
            <div class="full-player__platter">
              <div
                class="full-player__record"
                :class="{ 'full-player__record--paused': coverFlightActive }"
              >
                <div
                  ref="coverLabel"
                  class="full-player__label album-art--mini"
                  :class="{ 'full-player__label--hidden': coverFlightActive }"
                >
                  <span />
                </div>
              </div>
            </div>
            <span class="full-player__deck-mark">Q</span>
          </div>
        </section>

        <section class="full-player__lyrics-panel">
          <h1>{{ track.name }}</h1>
          <p>{{ track.artist }}</p>

          <div
            ref="lyricsScroll"
            class="full-player__lyrics-scroll"
            :class="{
              'full-player__lyrics-scroll--dragging': lyricsDragging,
              'full-player__lyrics-scroll--wheeling': lyricsWheeling,
              'full-player__lyrics-scroll--previewing': lyricsPreviewing,
            }"
            aria-label="滚动歌词"
            @pointerdown="startLyricsDrag"
            @pointermove="handleLyricsPointerMove"
            @pointerup="stopLyricsDrag"
            @pointerleave="stopLyricsDrag"
            @pointercancel="stopLyricsDrag"
            @wheel.prevent="handleLyricsWheel"
          >
            <button
              v-for="(line, index) in lyricLines"
              :key="line.text"
              class="full-player__lyric-line"
              :class="{
                active: displayLyricIndex === index,
              }"
              type="button"
              :data-lyric-index="index"
              @click="selectLyric(index)"
            >
              <span class="full-player__lyric-play"
                ><Play :size="15" fill="currentColor"
              /></span>
              <span class="full-player__lyric-text">{{ line.text }}</span>
              <span class="full-player__lyric-time">{{ line.time }}</span>
            </button>
          </div>
        </section>
      </div>

      <div class="full-player__spectrum" aria-hidden="true">
        <span v-for="bar in 64" :key="bar" />
      </div>
    </section>
  </Transition>

  <Teleport to="body">
    <div
      ref="coverFlyer"
      class="full-player__cover-flyer album-art--mini"
      :style="coverStyle"
      aria-hidden="true"
    >
      <span />
    </div>
  </Teleport>
</template>

<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import { ChevronDown, Play } from 'lucide-vue-next';
import '../styles/full-player.css';

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  track: {
    type: Object,
    required: true,
  },
  sourceRect: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['close', 'cover-flight-end']);

const coverLabel = ref(null);
const coverFlyer = ref(null);
const coverFlightActive = ref(false);
const lyricsScroll = ref(null);
const lyricsDragging = ref(false);
const lyricsWheeling = ref(false);
const playbackLyricIndex = ref(4);
const previewLyricIndex = ref(null);
const lyricsPreviewing = ref(false);
const lyricsDragState = {
  startY: 0,
  startScrollTop: 0,
};
const lyricsDragScrollSpeed = 2.2;
const lyricsWheelScrollSpeed = 1.2;
let coverFlightAnimation = null;
let lyricsPreviewTimer = null;
let lyricsWheelTimer = null;

const fallbackCoverPalette = {
  primary: '#213245',
  secondary: '#8bbad5',
  tertiary: '#e7a976',
};

const coverStyle = computed(() => {
  const palette = props.track.coverPalette ?? fallbackCoverPalette;

  return {
    '--cover-primary': palette.primary ?? fallbackCoverPalette.primary,
    '--cover-secondary': palette.secondary ?? fallbackCoverPalette.secondary,
    '--cover-tertiary': palette.tertiary ?? fallbackCoverPalette.tertiary,
    '--cover-image': props.track.coverUrl
      ? `url("${props.track.coverUrl}")`
      : 'none',
  };
});

const lyricLines = [
  { time: '01:02', text: '夜空中最亮的星', active: false },
  { time: '01:08', text: '能否听清', active: false },
  { time: '01:14', text: '那仰望的人', active: false },
  { time: '01:20', text: '心底的孤独和叹息', active: false },
  { time: '01:24', text: '夜空中最亮的星', active: true },
  { time: '01:31', text: '能否记起', active: false },
  { time: '01:37', text: '曾与我同行', active: false },
  { time: '01:43', text: '消失在风里的身影', active: false },
  { time: '01:51', text: '我祈祷拥有一颗透明的心灵', active: false },
  { time: '01:58', text: '和会流泪的眼睛', active: false },
  { time: '02:05', text: '给我再去相信的勇气', active: false },
  { time: '02:12', text: '越过谎言去拥抱你', active: false },
];

const displayLyricIndex = computed(
  () => previewLyricIndex.value ?? playbackLyricIndex.value,
);
const currentLyricIndex = computed(() => displayLyricIndex.value);

watch(
  () => props.open,
  async (open) => {
    if (open) {
      coverFlightActive.value = Boolean(props.sourceRect);
      await nextTick();
      centerCurrentLyric('auto');
      playCoverFlight('enter');
      return;
    }

    const targetRect = getCoverLabelRect();
    coverFlightActive.value = Boolean(props.sourceRect && targetRect);
    hideCoverLabel();
    await nextTick();
    playCoverFlight('leave', targetRect);
  },
  { flush: 'sync' },
);

watch(currentLyricIndex, async () => {
  if (lyricsDragging.value || lyricsPreviewing.value) {
    return;
  }

  await nextTick();
  centerCurrentLyric();
});

onMounted(() => {
  window.addEventListener('resize', handleLyricsResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleLyricsResize);
  clearLyricsPreviewTimer();
  clearLyricsWheelTimer();
});

function startLyricsDrag(event) {
  const scroller = lyricsScroll.value;

  if (!scroller) {
    return;
  }

  lyricsDragging.value = true;
  lyricsPreviewing.value = true;
  previewLyricIndex.value = displayLyricIndex.value;
  lyricsDragState.startY = event.clientY;
  lyricsDragState.startScrollTop = scroller.scrollTop;
  clearLyricsPreviewTimer();
  clearLyricsWheelTimer();
  lyricsWheeling.value = false;
  scroller.setPointerCapture?.(event.pointerId);
  updatePreviewLyricFromCenter();
}

function handleLyricsPointerMove(event) {
  const scroller = lyricsScroll.value;

  if (!scroller) {
    return;
  }

  if (lyricsDragging.value) {
    scroller.scrollTop =
      lyricsDragState.startScrollTop -
      (event.clientY - lyricsDragState.startY) * lyricsDragScrollSpeed;
    updatePreviewLyricFromCenter();
  }
}

function stopLyricsDrag(event) {
  if (!lyricsDragging.value) {
    return;
  }

  updatePreviewLyricFromCenter();
  lyricsScroll.value?.releasePointerCapture?.(event.pointerId);
  lyricsDragging.value = false;
  centerCurrentLyric();
  schedulePlaybackLyricReturn();
}

function handleLyricsWheel(event) {
  const scroller = lyricsScroll.value;

  if (!scroller || lyricsDragging.value) {
    return;
  }

  event.preventDefault();
  lyricsPreviewing.value = true;
  lyricsWheeling.value = true;
  clearLyricsPreviewTimer();
  clearLyricsWheelTimer();

  const wheelDelta =
    event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? event.deltaY * 18
      : event.deltaY;

  scroller.scrollTop += wheelDelta * lyricsWheelScrollSpeed;
  updatePreviewLyricFromCenter();

  lyricsWheelTimer = window.setTimeout(() => {
    lyricsWheeling.value = false;
    centerCurrentLyric();
    schedulePlaybackLyricReturn();
  }, 140);
}

function selectLyric(index) {
  playbackLyricIndex.value = index;
  previewLyricIndex.value = null;
  lyricsPreviewing.value = false;
  lyricsWheeling.value = false;
  clearLyricsPreviewTimer();
  clearLyricsWheelTimer();
}

function updatePreviewLyricFromCenter() {
  const scroller = lyricsScroll.value;

  if (!scroller) {
    return;
  }

  const centerY =
    scroller.getBoundingClientRect().top + scroller.clientHeight / 2;
  const lyricLines = scroller.querySelectorAll('.full-player__lyric-line');
  let nearestIndex = displayLyricIndex.value;
  let nearestDistance = Number.POSITIVE_INFINITY;

  lyricLines.forEach((line) => {
    const rect = line.getBoundingClientRect();
    const distance = Math.abs(rect.top + rect.height / 2 - centerY);
    const lyricIndex = Number(line.dataset.lyricIndex);

    if (distance < nearestDistance && Number.isInteger(lyricIndex)) {
      nearestDistance = distance;
      nearestIndex = lyricIndex;
    }
  });

  if (nearestIndex !== previewLyricIndex.value) {
    previewLyricIndex.value = nearestIndex;
  }
}

function schedulePlaybackLyricReturn() {
  clearLyricsPreviewTimer();
  lyricsPreviewTimer = window.setTimeout(() => {
    lyricsPreviewing.value = false;
    previewLyricIndex.value = null;
    centerCurrentLyric();
  }, 4200);
}

function clearLyricsPreviewTimer() {
  if (lyricsPreviewTimer) {
    window.clearTimeout(lyricsPreviewTimer);
    lyricsPreviewTimer = null;
  }
}

function clearLyricsWheelTimer() {
  if (lyricsWheelTimer) {
    window.clearTimeout(lyricsWheelTimer);
    lyricsWheelTimer = null;
  }
}

function centerCurrentLyric(behavior = 'smooth') {
  const scroller = lyricsScroll.value;
  const lyricIndex = currentLyricIndex.value;

  if (!scroller || lyricIndex < 0) {
    return;
  }

  const activeLine = scroller.querySelector(
    `[data-lyric-index="${lyricIndex}"]`,
  );

  if (!activeLine) {
    return;
  }

  scroller.scrollTo({
    top:
      activeLine.offsetTop -
      scroller.clientHeight / 2 +
      activeLine.offsetHeight / 2,
    behavior,
  });
}

function handleLyricsResize() {
  centerCurrentLyric('auto');
}

function playCoverFlight(direction, targetRectOverride = null) {
  const sourceRect = props.sourceRect;
  const targetRect = targetRectOverride ?? getCoverLabelRect();
  const flyer = coverFlyer.value;

  if (
    !isUsableRect(sourceRect) ||
    !isUsableRect(targetRect) ||
    !flyer ||
    prefersReducedMotion()
  ) {
    coverFlightActive.value = false;
    coverFlightAnimation = null;
    showCoverLabel();
    emit('cover-flight-end', direction);
    return;
  }

  coverFlightAnimation?.cancel();
  coverFlightActive.value = true;

  const fromRect = direction === 'enter' ? sourceRect : targetRect;
  const toRect = direction === 'enter' ? targetRect : sourceRect;
  const fromRadius = direction === 'enter' ? '8px' : '50%';
  const toRadius = direction === 'enter' ? '50%' : '8px';

  Object.assign(flyer.style, {
    display: 'block',
    left: `${fromRect.left}px`,
    top: `${fromRect.top}px`,
    width: `${fromRect.width}px`,
    height: `${fromRect.height}px`,
    borderRadius: fromRadius,
    opacity: '1',
  });
  flyer.getBoundingClientRect();

  coverFlightAnimation = flyer.animate(
    [
      {
        left: `${fromRect.left}px`,
        top: `${fromRect.top}px`,
        width: `${fromRect.width}px`,
        height: `${fromRect.height}px`,
        borderRadius: fromRadius,
        opacity: 0.96,
        transform: 'scale(1)',
      },
      {
        left: `${toRect.left}px`,
        top: `${toRect.top}px`,
        width: `${toRect.width}px`,
        height: `${toRect.height}px`,
        borderRadius: toRadius,
        opacity: 1,
        transform: 'scale(1)',
      },
    ],
    {
      duration: 620,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'forwards',
    },
  );

  coverFlightAnimation.onfinish = () => {
    flyer.style.display = 'none';
    coverFlightAnimation = null;
    coverFlightActive.value = false;
    showCoverLabel();
    emit('cover-flight-end', direction);
  };

  coverFlightAnimation.oncancel = () => {
    flyer.style.display = 'none';
    coverFlightAnimation = null;
    coverFlightActive.value = false;
    showCoverLabel();
    emit('cover-flight-end', direction);
  };
}

function hideCoverLabel() {
  if (coverLabel.value) {
    coverLabel.value.style.opacity = '0';
  }
}

function getCoverLabelRect() {
  const label = coverLabel.value;

  if (!label) {
    return null;
  }

  const rect = label.getBoundingClientRect();
  const width = label.offsetWidth;
  const height = label.offsetHeight;

  return {
    left: rect.left + (rect.width - width) / 2,
    top: rect.top + (rect.height - height) / 2,
    width,
    height,
  };
}

function isUsableRect(rect) {
  return Boolean(
    rect &&
    Number.isFinite(rect.left) &&
    Number.isFinite(rect.top) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0,
  );
}

function showCoverLabel() {
  if (coverLabel.value) {
    coverLabel.value.style.opacity = '';
  }
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
</script>
