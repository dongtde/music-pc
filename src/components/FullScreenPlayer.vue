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

      <div
        v-if="visualizerActive && visualizerMode === 'particles'"
        class="full-player__visualizer full-player__visualizer--particles"
        :class="{ 'is-playing': visualizerActive && player.state.isPlaying }"
        aria-hidden="true"
      >
        <span
          v-for="particle in particleDots"
          :key="particle.key"
          :style="particle.style"
        />
      </div>

      <FullPlayerSpectrumVisualizer
        v-if="visualizerActive && visualizerMode === 'spectrum'"
        :active="visualizerActive && visualizerMode === 'spectrum'"
        :playing="player.state.isPlaying"
      />

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

          <LyricsScroller
            ref="lyricsScroller"
            variant="full"
            :lines="lyricLines"
            :active-index="playbackLyricIndex"
            :current-time="player.state.currentTime"
            :playing="player.state.isPlaying"
            :danmaku-active="danmakuActive"
            :layout-delay="coverFlightActive ? openingWorkDelay : 0"
            @seek="seekToLyric"
          />
        </section>
      </div>

      <DanmakuLayer
        v-if="danmakuMounted"
        class="full-player__danmaku"
        :enabled="danmakuActive"
        :song="track"
        :hot-comments="danmakuHotComments"
        :comments="danmakuComments"
        :max-items="danmakuMaxItems"
        :has-more="danmakuHasMore"
        :loading="danmakuLoading"
        :prefetch-threshold="danmakuPrefetchThreshold"
        @need-more="$emit('danmaku-need-more')"
      />

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
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
} from 'vue';
import { ChevronDown } from 'lucide-vue-next';
import { getCachedTrackLyrics } from '../services/lyrics';
import { usePlayerStore } from '../stores/player';
import {
  createLyricPlaceholder,
  getLyricFrame,
  isNeteaseTrackId,
} from '../utils/lyrics';
import FullPlayerSpectrumVisualizer from './FullPlayerSpectrumVisualizer.vue';
import LyricsScroller from './LyricsScroller.vue';
import '../styles/full-player.css';

const DanmakuLayer = defineAsyncComponent({
  loader: () => import('./DanmakuLayer.vue'),
  suspensible: false,
});

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
  danmakuHasMore: {
    type: Boolean,
    default: false,
  },
  danmakuLoading: {
    type: Boolean,
    default: false,
  },
  danmakuPrefetchThreshold: {
    type: Number,
    default: 8,
  },
  danmakuMaxItems: {
    type: Number,
    default: 36,
  },
  danmakuActivationDelay: {
    type: Number,
    default: 520,
  },
  visualizerMode: {
    type: String,
    default: 'spectrum',
  },
  playerBarHeight: {
    type: Number,
    default: 92,
  },
});

const emit = defineEmits(['close', 'cover-flight-end', 'danmaku-need-more']);
const player = usePlayerStore();

const coverLabel = ref(null);
const coverFlyer = ref(null);
const lyricsScroller = ref(null);
const coverFlightActive = ref(false);
const lastSourceRect = ref(null);
const danmakuMounted = ref(false);
const danmakuActive = ref(false);
const visualizerActive = ref(false);
const playbackLyricIndex = ref(0);
const lyricLines = ref(createLyricPlaceholder('歌词加载中...'));
let coverFlightAnimation = null;
let danmakuActivationTimer = null;
let danmakuActivationFrame = 0;
let visualizerActivationTimer = null;
let visualizerActivationFrame = 0;
let lyricsLayoutTimer = 0;
let lyricRequestId = 0;
const coverFlightDuration = 620;
const openingWorkDelay = coverFlightDuration + 90;
const visualizerActivationDelay = coverFlightDuration + 120;
const visualizerModeSwitchDelay = 120;

const fallbackCoverPalette = {
  primary: '#213245',
  secondary: '#8bbad5',
  tertiary: '#e7a976',
};

const particleDots = Array.from({ length: 42 }, (_, index) => ({
  key: `particle-${index}`,
  style: {
    '--particle-x': `${6 + ((index * 17) % 88)}%`,
    '--particle-y': `${8 + ((index * 29) % 78)}%`,
    '--particle-size': `${2 + (index % 5)}px`,
    '--particle-delay': `${-index * 0.17}s`,
    '--particle-duration': `${4.8 + (index % 6) * 0.55}s`,
  },
}));

const coverStyle = computed(() => {
  const palette = props.track.coverPalette ?? fallbackCoverPalette;

  return {
    '--cover-primary': palette.primary ?? fallbackCoverPalette.primary,
    '--cover-secondary': palette.secondary ?? fallbackCoverPalette.secondary,
    '--cover-tertiary': palette.tertiary ?? fallbackCoverPalette.tertiary,
    '--cover-image': props.track.coverUrl
      ? `url("${props.track.coverUrl}")`
      : 'none',
    '--player-bar-actual-height': `${Math.max(0, Number(props.playerBarHeight) || 92)}px`,
  };
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
  () => [props.open, props.danmakuEnabled, props.track.id],
  () => {
    scheduleDanmakuActivation();
  },
  { immediate: true },
);

watch(
  () => props.open,
  (open) => {
    if (open) {
      scheduleVisualizerActivation(visualizerActivationDelay);
      return;
    }

    deactivateVisualizer();
  },
  { immediate: true },
);

watch(
  () => props.visualizerMode,
  () => {
    if (props.open) {
      scheduleVisualizerActivation(visualizerModeSwitchDelay);
    }
  },
);

watch(
  () => props.open,
  async (open, previousOpen) => {
    if (!open && previousOpen === undefined) {
      return;
    }

    const sourceRect = getFlightSourceRect();

    if (open) {
      coverFlightActive.value = Boolean(sourceRect);
      await nextTick();
      await waitForLayoutFrame();
      playCoverFlight('enter', { sourceRect });
      requestLyricsLayoutRefresh('auto', openingWorkDelay);
      return;
    }

    const targetRect = cloneRect(getCoverLabelRect());
    coverFlightActive.value = Boolean(sourceRect && targetRect);
    hideCoverLabel();
    await nextTick();
    playCoverFlight('leave', { sourceRect, targetRect });
  },
  { flush: 'sync', immediate: true },
);

watch(
  () => props.track,
  (track) => {
    loadTrackLyrics(track);
  },
  { immediate: true },
);

watch(
  () => player.state.currentTime,
  (currentTime) => {
    syncPlaybackLyric(currentTime);
  },
);

watch(playbackLyricIndex, async () => {
  await nextTick();
  requestLyricsLayoutRefresh('smooth', coverFlightActive.value ? openingWorkDelay : 0);
});

onBeforeUnmount(() => {
  clearDanmakuActivation();
  clearVisualizerActivation();
  clearLyricsLayoutRefresh();
  lyricRequestId += 1;
});

function scheduleDanmakuActivation() {
  clearDanmakuActivation();
  danmakuActive.value = false;

  if (!props.open || !props.danmakuEnabled) {
    return;
  }

  const delay = Math.max(0, Number(props.danmakuActivationDelay) || 0);

  danmakuActivationTimer = window.setTimeout(() => {
    danmakuActivationTimer = null;
    danmakuMounted.value = true;
    danmakuActivationFrame = window.requestAnimationFrame(() => {
      danmakuActivationFrame = 0;
      danmakuActive.value = Boolean(props.open && props.danmakuEnabled);
    });
  }, delay);
}

function clearDanmakuActivation() {
  if (danmakuActivationTimer) {
    window.clearTimeout(danmakuActivationTimer);
    danmakuActivationTimer = null;
  }

  if (danmakuActivationFrame) {
    window.cancelAnimationFrame(danmakuActivationFrame);
    danmakuActivationFrame = 0;
  }
}

function scheduleVisualizerActivation(delay = visualizerActivationDelay) {
  clearVisualizerActivation();
  visualizerActive.value = false;

  if (!props.open) {
    return;
  }

  const timeout = Math.max(0, Number(delay) || 0);

  visualizerActivationTimer = window.setTimeout(() => {
    visualizerActivationTimer = null;
    visualizerActivationFrame = window.requestAnimationFrame(() => {
      visualizerActivationFrame = 0;
      visualizerActive.value = Boolean(props.open);
    });
  }, timeout);
}

function deactivateVisualizer() {
  clearVisualizerActivation();
  visualizerActive.value = false;
}

function clearVisualizerActivation() {
  if (visualizerActivationTimer) {
    window.clearTimeout(visualizerActivationTimer);
    visualizerActivationTimer = null;
  }

  if (visualizerActivationFrame) {
    window.cancelAnimationFrame(visualizerActivationFrame);
    visualizerActivationFrame = 0;
  }
}

function requestLyricsLayoutRefresh(behavior = 'smooth', delay = 0) {
  clearLyricsLayoutRefresh();

  const runRefresh = () => {
    lyricsLayoutTimer = 0;
    lyricsScroller.value?.refreshLayout(behavior);
  };

  const timeout = Math.max(0, Number(delay) || 0);

  if (!timeout) {
    runRefresh();
    return;
  }

  lyricsLayoutTimer = window.setTimeout(runRefresh, timeout);
}

function clearLyricsLayoutRefresh() {
  if (!lyricsLayoutTimer) {
    return;
  }

  window.clearTimeout(lyricsLayoutTimer);
  lyricsLayoutTimer = 0;
}

async function loadTrackLyrics(track) {
  const trackId = String(track?.id ?? track ?? '');
  lyricRequestId += 1;
  const requestId = lyricRequestId;
  playbackLyricIndex.value = 0;
  lyricsScroller.value?.resetInteraction();

  if (!isNeteaseTrackId(trackId)) {
    lyricLines.value = createLyricPlaceholder(trackId ? '暂无歌词' : '无播放歌曲');
    await nextTick();
    requestLyricsLayoutRefresh('auto', props.open ? openingWorkDelay : 0);
    return;
  }

  lyricLines.value = createLyricPlaceholder('歌词加载中...');

  try {
    const lines = await getCachedTrackLyrics(track && typeof track === 'object' ? track : trackId);

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

  await nextTick();
  requestLyricsLayoutRefresh('auto', props.open ? openingWorkDelay : 0);
}

function syncPlaybackLyric(currentTime) {
  const lines = lyricLines.value;

  if (!lines.length || lines[0]?.placeholder) {
    playbackLyricIndex.value = 0;
    return;
  }

  const nextIndex = getLyricFrame(lines, currentTime).activeIndex;

  if (nextIndex !== playbackLyricIndex.value) {
    playbackLyricIndex.value = nextIndex;
  }
}

function seekToLyric({ index, seconds }) {
  playbackLyricIndex.value = Number.isInteger(index) ? index : playbackLyricIndex.value;
  player.seekTo(seconds);
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
  const fromTransform = createFlightTransform(fromRect, toRect);
  const toTransform = 'translate3d(0, 0, 0) scale(1, 1)';

  Object.assign(flyer.style, {
    display: 'block',
    left: `${toRect.left}px`,
    top: `${toRect.top}px`,
    width: `${toRect.width}px`,
    height: `${toRect.height}px`,
    borderRadius: toRadius,
    opacity: '1',
    transform: fromTransform,
    transformOrigin: 'top left',
  });

  coverFlightAnimation = flyer.animate(
    [
      {
        borderRadius: fromRadius,
        opacity: 0.96,
        transform: fromTransform,
      },
      {
        borderRadius: toRadius,
        opacity: 1,
        transform: toTransform,
      },
    ],
    {
      duration: coverFlightDuration,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'forwards',
    },
  );

  coverFlightAnimation.onfinish = () => {
    resetCoverFlyer(flyer);
    coverFlightAnimation = null;
    coverFlightActive.value = false;
    showCoverLabel();
    emit('cover-flight-end', direction);
  };

  coverFlightAnimation.oncancel = () => {
    resetCoverFlyer(flyer);
    coverFlightAnimation = null;
    coverFlightActive.value = false;
    showCoverLabel();
    emit('cover-flight-end', direction);
  };
}

function createFlightTransform(fromRect, toRect) {
  const scaleX = fromRect.width / toRect.width;
  const scaleY = fromRect.height / toRect.height;
  const translateX = fromRect.left - toRect.left;
  const translateY = fromRect.top - toRect.top;

  return `translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleX}, ${scaleY})`;
}

function resetCoverFlyer(flyer) {
  Object.assign(flyer.style, {
    display: 'none',
    left: '',
    top: '',
    width: '',
    height: '',
    borderRadius: '',
    opacity: '',
    transform: '',
    transformOrigin: '',
  });
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
