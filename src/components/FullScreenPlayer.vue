<template>
  <Transition
    :name="playerTransitionName"
    :appear="isMobile && !homeMode"
    @before-enter="startPlayerTransition('enter')"
    @after-enter="finishPlayerTransition('enter')"
    @enter-cancelled="finishPlayerTransition('enter')"
    @before-leave="startPlayerTransition('leave')"
    @after-leave="finishPlayerTransition('leave')"
    @leave-cancelled="finishPlayerTransition('leave')"
  >
    <section
      v-show="open"
      class="full-player-page"
      :class="{ 'full-player-page--3d': is3DView, 'full-player-page--mobile': isMobile && !is3DView, 'full-player-page--route-hidden': routeHidden }"
      :style="coverStyle"
      :data-expansion-effect="isMobile ? theme.state.fullPlayerTransition : undefined"
      :inert="!open || routeHidden"
      :id="homeMode ? 'home-music-feed' : undefined"
      :aria-label="homeMode ? '首页播放器' : '全屏播放器'"
    >
      <button
        class="full-player__close"
        type="button"
        :aria-label="homeMode ? '打开首页导航' : '收起全屏播放器'"
        @click="$emit('close')"
      >
        <ChevronDown :size="30" />
      </button>

      <button
        v-if="!isMobile"
        class="full-player__view-switch"
        type="button"
        :aria-pressed="is3DView"
        :aria-label="is3DView ? '返回歌词播放器' : '切换到 3D 播放器'"
        @click="togglePlayerView"
      >
        <component :is="is3DView ? AlignLeft : Box" :size="17" />
        <span>{{ is3DView ? '歌词页面' : '3D 播放器' }}</span>
      </button>
      <nav v-if="homeMode && isMobile && !is3DView" class="full-player__home-sections" aria-label="首页分类">
        <button class="active" type="button" aria-pressed="true" @click="$emit('home-section', 'music')">音乐</button>
        <button type="button" aria-pressed="false" @click="$emit('home-section', 'video')">MV</button>
      </nav>


      <ThreeMusicRoom
        v-if="is3DView"
        :active="open"
        :track="track"
        :playing="player.state.isPlaying"
        :loading="player.state.isLoading"
        :queue-available="player.state.queue.length > 0"
        :current-time="player.state.currentTime"
        :duration="player.state.duration"
        :lines="lyricLines"
        :active-index="playbackLyricIndex"
        @seek="seekToLyric"
        @toggle-play="$emit('toggle-play')"
        @previous="$emit('previous')"
        @next="$emit('next')"
      />
      <MobilePlayerPages
        v-if="mobileContentVisible && isMobile && !is3DView"
        :page="mobilePage"
        :track="track"
        :previous-track="adjacentTracks.previous"
        :next-track="adjacentTracks.next"
        :transport-element="transportElement"
        :liked="liked"
        :lines="lyricLines"
        :active-index="playbackLyricIndex"
        :current-time="player.state.currentTime"
        :playing="player.state.isPlaying"
        :can-change-track="player.state.queue.length > 1"
        :track-loading="player.state.isLoading"
        :danmaku-enabled="danmakuEnabled"
        :danmaku-active="danmakuActive"
        :hot-comments="danmakuHotComments"
        :comments="danmakuComments"
        :has-more="danmakuHasMore"
        :loading="danmakuLoading"
        :error="danmakuError"
        @update:page="$emit('update:mobilePage', $event)"
        @toggle-like="$emit('toggle-like')"
        @seek="seekToLyric"
        @need-more="$emit('danmaku-need-more')"
        @toggle-danmaku="$emit('toggle-danmaku')"
        @retry-danmaku="$emit('retry-danmaku')"
        @swipe-next="$emit('swipe-next', $event)"
        @swipe-previous="$emit('swipe-previous', $event)"
      />

      <div
        v-if="!isMobile && !is3DView && visualizerActive && visualizerMode === 'particles'"
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
        v-if="!isMobile && !is3DView && visualizerActive && visualizerMode === 'spectrum'"
        :active="visualizerActive && visualizerMode === 'spectrum'"
        :playing="player.state.isPlaying"
      />

      <div v-show="!is3DView && !isMobile" class="full-player__shell">
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
            v-if="!isMobile"
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
        v-if="danmakuMounted && !is3DView && !isMobile"
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
import { AlignLeft, Box, ChevronDown } from 'lucide-vue-next';
import { getCachedTrackLyrics } from '../services/lyrics';
import { usePlayerStore } from '../stores/player';
import { useThemeStore } from '../stores/theme';
import { useResponsiveLayout } from '../composables/useResponsiveLayout';
import {
  createLyricPlaceholder,
  getLyricFrame,
  isNeteaseTrackId,
} from '../utils/lyrics';
import FullPlayerSpectrumVisualizer from './FullPlayerSpectrumVisualizer.vue';
import LyricsScroller from './LyricsScroller.vue';
import MobilePlayerPages from './MobilePlayerPages.vue';
import '../styles/full-player.css';
import '../styles/mobile-player-transition.css';

const DanmakuLayer = defineAsyncComponent({
  loader: () => import('./DanmakuLayer.vue'),
  suspensible: false,
});
const ThreeMusicRoom = defineAsyncComponent(() => import('./ThreeMusicRoom.vue'));

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  track: {
    type: Object,
    required: true,
  },
  mobilePage: { type: String, default: 'cover', validator: value => ['cover', 'lyrics', 'danmaku'].includes(value) },
  liked: { type: Boolean, default: false },
  homeMode: { type: Boolean, default: false },
  routeHidden: { type: Boolean, default: false },
  danmakuError: { type: String, default: '' },
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
  transportElement: { type: Object, default: null },
});

const emit = defineEmits(['close', 'cover-flight-end', 'transition-start', 'transition-end', 'danmaku-need-more', 'toggle-play', 'previous', 'next', 'update:mobilePage', 'toggle-like', 'toggle-danmaku', 'retry-danmaku', 'swipe-next', 'swipe-previous', 'home-section']);
const player = usePlayerStore();
const theme = useThemeStore();
const adjacentTracks = computed(() => {
  const queue = player.state.queue;
  if (queue.length < 2) return { previous: null, next: null };
  const index = queue.findIndex(track => String(track.id) === String(props.track.id));
  return {
    previous: queue[index < 0 ? queue.length - 1 : (index - 1 + queue.length) % queue.length],
    next: queue[index < 0 ? 0 : (index + 1) % queue.length],
  };
});
const is3DView = ref(false);
const { isMobile2D: isMobile } = useResponsiveLayout();
const mobileContentVisible = ref(props.open);
const playerTransitionName = computed(() => isMobile.value
  ? `mobile-player-${theme.state.reducedMotion ? 'none' : theme.state.fullPlayerTransition}`
  : 'full-player');

watch(() => props.open, (open) => {
  if (open) mobileContentVisible.value = true;
}, { flush: 'sync' });

function startPlayerTransition(phase) {
  if (isMobile.value) emit('transition-start', phase);
}

function finishPlayerTransition(phase) {
  if (phase === 'leave' && !props.open) mobileContentVisible.value = false;
  emit('transition-end', phase);
}

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
const openingWorkDelay = computed(() => theme.getTransitionDuration() + 90);
const visualizerActivationDelay = computed(() => theme.getTransitionDuration() + 120);
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
  () => [props.open, props.danmakuEnabled, props.track.id, is3DView.value],
  () => {
    scheduleDanmakuActivation();
  },
  { immediate: true },
);
watch(isMobile, (mobile) => {
  if (mobile) deactivateVisualizer();
  else if (props.open) scheduleVisualizerActivation(visualizerModeSwitchDelay);
  nextTick(() => requestLyricsLayoutRefresh('auto'));
});
watch(is3DView, (world) => {
  if (world && isMobile.value) emit('update:mobilePage', 'cover');
});

watch(
  () => props.open,
  (open) => {
    if (open) {
      scheduleVisualizerActivation(visualizerActivationDelay.value);
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
    if (isMobile.value) {
      coverFlightAnimation?.cancel();
      coverFlightActive.value = false;
      emit('cover-flight-end', open ? 'enter' : 'leave');
      return;
    }

    const sourceRect = getFlightSourceRect();

    if (is3DView.value) {
      coverFlightAnimation?.cancel();
      coverFlightActive.value = false;
      emit('cover-flight-end', open ? 'enter' : 'leave');
      return;
    }

    if (open) {
      coverFlightActive.value = Boolean(sourceRect);
      await nextTick();
      await waitForLayoutFrame();
      if (is3DView.value || !props.open) {
        coverFlightActive.value = false;
        emit('cover-flight-end', props.open ? 'enter' : 'leave');
        return;
      }
      playCoverFlight('enter', { sourceRect });
      requestLyricsLayoutRefresh('auto', openingWorkDelay.value);
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
  requestLyricsLayoutRefresh('smooth', coverFlightActive.value ? openingWorkDelay.value : 0);
});

onBeforeUnmount(() => {
  clearDanmakuActivation();
  clearVisualizerActivation();
  clearLyricsLayoutRefresh();
  lyricRequestId += 1;
  coverFlightAnimation?.cancel();
});

function togglePlayerView() {
  coverFlightAnimation?.cancel();
  coverFlightActive.value = false;
  is3DView.value = !is3DView.value;
  if (is3DView.value) {
    deactivateVisualizer();
  } else {
    scheduleVisualizerActivation(visualizerModeSwitchDelay);
    nextTick(() => requestLyricsLayoutRefresh('auto'));
  }
}

function scheduleDanmakuActivation() {
  clearDanmakuActivation();
  danmakuActive.value = false;

  if (!props.open || !props.danmakuEnabled || is3DView.value) {
    return;
  }

  const delay = Math.max(0, Number(props.danmakuActivationDelay) || 0);

  danmakuActivationTimer = window.setTimeout(() => {
    danmakuActivationTimer = null;
    danmakuMounted.value = true;
    danmakuActivationFrame = window.requestAnimationFrame(() => {
      danmakuActivationFrame = 0;
      danmakuActive.value = Boolean(props.open && props.danmakuEnabled && !is3DView.value);
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

function scheduleVisualizerActivation(delay = visualizerActivationDelay.value) {
  clearVisualizerActivation();
  visualizerActive.value = false;

  if (!props.open || is3DView.value || isMobile.value) {
    return;
  }

  const timeout = Math.max(0, Number(delay) || 0);

  visualizerActivationTimer = window.setTimeout(() => {
    visualizerActivationTimer = null;
    visualizerActivationFrame = window.requestAnimationFrame(() => {
      visualizerActivationFrame = 0;
      visualizerActive.value = Boolean(props.open && !is3DView.value && !isMobile.value);
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
    requestLyricsLayoutRefresh('auto', props.open ? openingWorkDelay.value : 0);
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
  requestLyricsLayoutRefresh('auto', props.open ? openingWorkDelay.value : 0);
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
  const miniRadius = isMobile.value ? '9px' : '8px';
  const fullRadius = isMobile.value ? '16px' : '50%';
  const fromRadius = direction === 'enter' ? miniRadius : fullRadius;
  const toRadius = direction === 'enter' ? fullRadius : miniRadius;
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
      duration: theme.getTransitionDuration(),
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
