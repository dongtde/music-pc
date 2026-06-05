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

        <section class="full-player__lyrics-panel" aria-label="歌词">
          <header class="full-player__lyrics-head">
            <h1>{{ track.name }}</h1>
            <p>{{ track.artist }}</p>
          </header>

          <div
            class="full-player__qq-lyrics"
            :class="{
              'full-player__qq-lyrics--dragging': lyricsDragging,
              'full-player__qq-lyrics--wheeling': lyricsWheeling,
              'full-player__qq-lyrics--previewing': lyricsInteractionActive,
            }"
          >
            <div
              v-if="lyricsInteractionActive && previewLyric"
              class="full-player__lyric-guide"
            >
              <span class="full-player__lyric-guide-time">{{ previewLyric.time }}</span>
              <span class="full-player__lyric-guide-line" />
              <button
                class="full-player__lyric-guide-play"
                type="button"
                :disabled="previewLyric.placeholder"
                aria-label="跳转到选中歌词"
                @click.stop="seekToPreviewLyric"
              >
                <Play :size="14" fill="currentColor" />
              </button>
            </div>

            <div
              ref="lyricsScroll"
              class="full-player__lyrics-scroll"
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
                :key="`${line.seconds}-${line.text}-${index}`"
                class="full-player__lyric-line"
                :class="{
                  active: playbackLyricIndex === index,
                  preview: lyricsInteractionActive && previewLyricIndex === index,
                  past: index < playbackLyricIndex,
                  future: index > playbackLyricIndex,
                  placeholder: line.placeholder,
                }"
                type="button"
                :data-lyric-index="index"
                @click="selectLyric(index)"
              >
                <span class="full-player__lyric-text">{{ line.text }}</span>
                <span v-if="line.translation" class="full-player__lyric-translation">
                  {{ line.translation }}
                </span>
              </button>
            </div>
          </div>
        </section>
      </div>

      <DanmakuLayer
        class="full-player__danmaku"
        :enabled="open && danmakuEnabled"
        :song="track"
        :hot-comments="danmakuHotComments"
        :comments="danmakuComments"
      />

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
import DanmakuLayer from './DanmakuLayer.vue';
import { getTrackLyricData } from '../services/netease';
import { usePlayerStore } from '../stores/player';
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
  danmakuEnabled: {
    type: Boolean,
    default: true,
  },
  danmakuHotComments: {
    type: Array,
    default: () => [],
  },
  danmakuComments: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['close', 'cover-flight-end']);
const player = usePlayerStore();

const coverLabel = ref(null);
const coverFlyer = ref(null);
const coverFlightActive = ref(false);
const lastSourceRect = ref(null);
const lyricsScroll = ref(null);
const lyricsDragging = ref(false);
const lyricsWheeling = ref(false);
const playbackLyricIndex = ref(0);
const previewLyricIndex = ref(null);
const lyricsPreviewing = ref(false);
const lyricLines = ref(createLyricPlaceholder('歌词加载中...'));
const lyricsDragState = {
  startY: 0,
  startScrollTop: 0,
  moved: false,
};
const lyricsDragScrollSpeed = 2.2;
const lyricsWheelScrollSpeed = 1.2;
let coverFlightAnimation = null;
let lyricsPreviewTimer = null;
let lyricsWheelTimer = null;
let lyricRequestId = 0;
let suppressNextLyricClick = false;

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

const currentLyricIndex = computed(() => playbackLyricIndex.value);
const lyricsInteractionActive = computed(
  () => lyricsDragging.value || lyricsWheeling.value || lyricsPreviewing.value,
);
const previewLyric = computed(() => {
  const index = previewLyricIndex.value ?? playbackLyricIndex.value;

  return lyricLines.value[index] ?? null;
});

watch(
  () => props.sourceRect,
  (rect) => {
    const nextRect = cloneRect(rect);

    if (isUsableRect(nextRect)) {
      lastSourceRect.value = nextRect;
    }
  },
  { immediate: true },
);

watch(
  () => props.open,
  async (open) => {
    const sourceRect = getFlightSourceRect();

    if (open) {
      coverFlightActive.value = Boolean(sourceRect);
      await nextTick();
      await waitForLayoutFrame();
      refreshLyricsLayout('auto');
      playCoverFlight('enter', { sourceRect });
      return;
    }

    const targetRect = cloneRect(getCoverLabelRect());
    coverFlightActive.value = Boolean(sourceRect && targetRect);
    hideCoverLabel();
    await nextTick();
    playCoverFlight('leave', { sourceRect, targetRect });
  },
  { flush: 'sync' },
);

watch(
  () => props.track.id,
  (trackId) => {
    loadTrackLyrics(trackId);
  },
  { immediate: true },
);

watch(
  () => player.state.currentTime,
  (currentTime) => {
    syncPlaybackLyric(currentTime);
  },
);

watch(currentLyricIndex, async () => {
  if (lyricsInteractionActive.value) {
    return;
  }

  await nextTick();
  updateLyricsEdgePadding();
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

async function loadTrackLyrics(trackId) {
  lyricRequestId += 1;
  const requestId = lyricRequestId;
  playbackLyricIndex.value = 0;
  previewLyricIndex.value = null;
  lyricsPreviewing.value = false;
  lyricsWheeling.value = false;
  clearLyricsPreviewTimer();
  clearLyricsWheelTimer();

  if (!isNeteaseTrackId(trackId)) {
    lyricLines.value = createLyricPlaceholder(trackId ? '暂无歌词' : '无播放歌曲');
    await refreshLyricsLayout('auto');
    return;
  }

  lyricLines.value = createLyricPlaceholder('歌词加载中...');

  try {
    const lines = await getTrackLyricData(trackId);

    if (requestId !== lyricRequestId) {
      return;
    }

    lyricLines.value = lines;
    syncPlaybackLyric(player.state.currentTime);
  } catch (error) {
    if (requestId !== lyricRequestId) {
      return;
    }

    console.warn('Failed to load lyrics:', error);
    lyricLines.value = createLyricPlaceholder('歌词加载失败');
  }

  await refreshLyricsLayout('auto');
}

function syncPlaybackLyric(currentTime) {
  const lines = lyricLines.value;

  if (!lines.length || lines[0]?.placeholder) {
    playbackLyricIndex.value = 0;
    return;
  }

  const nextIndex = findCurrentLyricIndex(lines, currentTime);

  if (nextIndex !== playbackLyricIndex.value) {
    playbackLyricIndex.value = nextIndex;
  }
}

function findCurrentLyricIndex(lines, currentTime) {
  let low = 0;
  let high = lines.length - 1;
  let currentIndex = 0;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);

    if (lines[middle].seconds <= currentTime + 0.16) {
      currentIndex = middle;
      low = middle + 1;
      continue;
    }

    high = middle - 1;
  }

  return currentIndex;
}

function createLyricPlaceholder(text) {
  return [{ time: '--:--', text, seconds: 0, placeholder: true }];
}

function isNeteaseTrackId(trackId) {
  return /^\d+$/.test(String(trackId ?? ''));
}

function startLyricsDrag(event) {
  const scroller = lyricsScroll.value;

  if (!scroller || event.button > 0) {
    return;
  }

  lyricsDragging.value = true;
  lyricsPreviewing.value = true;
  previewLyricIndex.value = playbackLyricIndex.value;
  lyricsDragState.startY = event.clientY;
  lyricsDragState.startScrollTop = scroller.scrollTop;
  lyricsDragState.moved = false;
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
    const deltaY = event.clientY - lyricsDragState.startY;

    if (Math.abs(deltaY) > 3) {
      lyricsDragState.moved = true;
    }

    scroller.scrollTop =
      lyricsDragState.startScrollTop - deltaY * lyricsDragScrollSpeed;
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

  if (lyricsDragState.moved) {
    suppressNextLyricClick = true;
    window.setTimeout(() => {
      suppressNextLyricClick = false;
    }, 0);
  }

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
    schedulePlaybackLyricReturn();
  }, 140);
}

function selectLyric(index) {
  const line = lyricLines.value[index];

  if (suppressNextLyricClick) {
    suppressNextLyricClick = false;
    return;
  }

  seekToLyricLine(line, index);
}

function seekToPreviewLyric() {
  seekToLyricLine(previewLyric.value, previewLyricIndex.value);
}

function seekToLyricLine(line, index) {
  if (!line || line.placeholder) {
    return;
  }

  playbackLyricIndex.value = Number.isInteger(index) ? index : playbackLyricIndex.value;
  previewLyricIndex.value = null;
  lyricsPreviewing.value = false;
  lyricsWheeling.value = false;
  clearLyricsPreviewTimer();
  clearLyricsWheelTimer();
  player.seekTo(line.seconds);
  nextTick(() => centerCurrentLyric());
}

function updatePreviewLyricFromCenter() {
  const scroller = lyricsScroll.value;

  if (!scroller) {
    return;
  }

  const centerY =
    scroller.getBoundingClientRect().top + scroller.clientHeight / 2;
  const lyricLines = scroller.querySelectorAll('.full-player__lyric-line');
  let nearestIndex = previewLyricIndex.value ?? playbackLyricIndex.value;
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

async function refreshLyricsLayout(behavior = 'smooth') {
  await nextTick();
  updateLyricsEdgePadding();
  centerCurrentLyric(behavior);
}

function updateLyricsEdgePadding() {
  const scroller = lyricsScroll.value;

  if (!scroller) {
    return;
  }

  const activeLine = scroller.querySelector(
    `[data-lyric-index="${currentLyricIndex.value}"]`,
  );
  const firstLine = scroller.querySelector('[data-lyric-index="0"]');
  const lineHeight = activeLine?.offsetHeight || firstLine?.offsetHeight || 86;
  const edgePadding = Math.max(0, scroller.clientHeight / 2 - lineHeight / 2);

  scroller.style.setProperty('--full-player-lyrics-edge-padding', `${edgePadding}px`);
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
  updateLyricsEdgePadding();
  centerCurrentLyric('auto');
}

function playCoverFlight(direction, options = {}) {
  const sourceRect = cloneRect(options.sourceRect ?? getFlightSourceRect());
  const targetRect = cloneRect(options.targetRect ?? getCoverLabelRect());
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

function getFlightSourceRect() {
  const rect = cloneRect(props.sourceRect);

  return isUsableRect(rect) ? rect : cloneRect(lastSourceRect.value);
}

function cloneRect(rect) {
  if (!rect) {
    return null;
  }

  return {
    left: Number(rect.left),
    top: Number(rect.top),
    width: Number(rect.width),
    height: Number(rect.height),
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

function waitForLayoutFrame() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });
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
