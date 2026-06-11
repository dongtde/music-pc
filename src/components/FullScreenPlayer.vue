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
        v-if="visualizerMode === 'trails'"
        class="full-player__visualizer full-player__visualizer--comment-nebula"
        :class="{ 'is-playing': player.state.isPlaying }"
        aria-hidden="true"
      >
        <span
          v-for="thread in nebulaThreads"
          :key="thread.key"
          class="full-player__nebula-thread"
          :style="thread.style"
        />
        <article
          v-for="comment in commentNebulaItems"
          :key="comment.key"
          class="full-player__comment-signal"
          :style="comment.style"
        >
          <span
            class="full-player__comment-avatar"
            :class="{ 'full-player__comment-avatar--empty': !comment.avatarUrl }"
            :style="comment.avatarStyle"
          >
            <span v-if="!comment.avatarUrl">{{ comment.initial }}</span>
          </span>
          <span class="full-player__comment-text">{{ comment.text }}</span>
        </article>
      </div>

      <div
        v-if="visualizerMode === 'particles'"
        class="full-player__visualizer full-player__visualizer--particles"
        :class="{ 'is-playing': player.state.isPlaying }"
        aria-hidden="true"
      >
        <span
          v-for="particle in particleDots"
          :key="particle.key"
          :style="particle.style"
        />
      </div>

      <div class="full-player__shell">
        <section class="full-player__turntable" aria-label="唱片封面">
          <div class="full-player__deck">
            <div
              v-if="visualizerMode === 'halo'"
              class="full-player__record-corona"
              :class="{ 'is-playing': player.state.isPlaying }"
              aria-hidden="true"
            >
              <span class="full-player__corona-aura full-player__corona-aura--one" />
              <span class="full-player__corona-aura full-player__corona-aura--two" />
              <span
                v-for="ray in coronaRays"
                :key="ray.key"
                class="full-player__corona-ray"
                :style="ray.style"
              />
              <span
                v-for="spark in coronaSparks"
                :key="spark.key"
                class="full-player__corona-spark"
                :style="spark.style"
              />
            </div>
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

        <div
          v-if="visualizerMode === 'needle'"
          class="full-player__needle-map"
          :class="{ 'is-playing': player.state.isPlaying }"
          aria-hidden="true"
        >
          <svg viewBox="0 0 760 260" preserveAspectRatio="none">
            <path class="full-player__needle-route full-player__needle-route--base" d="M18 148 C130 38 230 210 348 104 S548 28 742 138" />
            <path class="full-player__needle-route full-player__needle-route--main" d="M18 148 C130 38 230 210 348 104 S548 28 742 138" />
            <path class="full-player__needle-route full-player__needle-route--echo" d="M24 170 C152 96 238 168 372 132 S582 86 734 170" />
            <circle
              v-for="star in needleStars"
              :key="star.key"
              class="full-player__needle-star"
              :cx="star.x"
              :cy="star.y"
              :r="star.r"
              :style="star.style"
            />
          </svg>
          <span
            v-for="bar in needleToneBars"
            :key="bar.key"
            class="full-player__needle-tone"
            :style="bar.style"
          />
        </div>

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
            :playing="player.state.isPlaying"
            :danmaku-active="danmakuActive"
            :breath="visualizerMode === 'breath'"
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
import { getTrackLyricData } from '../services/netease';
import { usePlayerStore } from '../stores/player';
import {
  createLyricPlaceholder,
  findCurrentLyricIndex,
  isNeteaseTrackId,
} from '../utils/lyrics';
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
    default: 'halo',
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
const playbackLyricIndex = ref(0);
const lyricLines = ref(createLyricPlaceholder('歌词加载中...'));
let coverFlightAnimation = null;
let danmakuActivationTimer = null;
let danmakuActivationFrame = 0;
let lyricRequestId = 0;

const fallbackCoverPalette = {
  primary: '#213245',
  secondary: '#8bbad5',
  tertiary: '#e7a976',
};

const coronaRays = Array.from({ length: 54 }, (_, index) => ({
  key: `corona-ray-${index}`,
  style: {
    '--corona-rotate': `${index * (360 / 54)}deg`,
    '--corona-length': `${34 + ((index * 11) % 62)}px`,
    '--corona-width': `${2 + (index % 4)}px`,
    '--corona-delay': `${-(index % 18) * 0.11}s`,
    '--corona-scale': `${0.72 + (index % 5) * 0.11}`,
    '--corona-scale-low': `${(0.72 + (index % 5) * 0.11) * 0.66}`,
    '--corona-scale-high': `${(0.72 + (index % 5) * 0.11) * 1.42}`,
  },
}));
const coronaSparks = Array.from({ length: 18 }, (_, index) => ({
  key: `corona-spark-${index}`,
  style: {
    '--spark-rotate': `${index * 20 + (index % 3) * 6}deg`,
    '--spark-y': `${-210 - (index % 5) * 24}px`,
    '--spark-y-low': `${-186 - (index % 5) * 18}px`,
    '--spark-y-high': `${-238 - (index % 5) * 28}px`,
    '--spark-size': `${4 + (index % 4)}px`,
    '--spark-delay': `${-index * 0.21}s`,
  },
}));
const nebulaThreads = Array.from({ length: 9 }, (_, index) => ({
  key: `nebula-thread-${index}`,
  style: {
    '--nebula-top': `${12 + ((index * 11) % 72)}%`,
    '--nebula-left': `${-8 + (index % 3) * 7}%`,
    '--nebula-width': `${34 + (index % 4) * 9}vw`,
    '--nebula-delay': `${-index * 0.62}s`,
    '--nebula-duration': `${12 + (index % 4) * 1.4}s`,
    '--nebula-drift': `${34 + (index % 4) * 10}vw`,
  },
}));
const fallbackNebulaComments = [
  { content: '这句歌词像突然亮起来的城市', user: { name: '听友', avatarUrl: '' } },
  { content: '副歌一进来，整个人被拽进夜色里', user: { name: '云', avatarUrl: '' } },
  { content: '此刻的心跳刚好对上鼓点', user: { name: '晚风', avatarUrl: '' } },
  { content: '耳机里开了一场小型流星雨', user: { name: '星', avatarUrl: '' } },
  { content: '这首适合把灯关掉听', user: { name: '夜航', avatarUrl: '' } },
  { content: '像把没说出口的话全部放出来', user: { name: '回声', avatarUrl: '' } },
];
const needleStars = Array.from({ length: 16 }, (_, index) => ({
  key: `needle-star-${index}`,
  x: 34 + ((index * 47) % 690),
  y: 42 + ((index * 73) % 176),
  r: 1.8 + (index % 5) * 0.55,
  style: {
    '--star-delay': `${-index * 0.18}s`,
  },
}));
const needleToneBars = Array.from({ length: 24 }, (_, index) => ({
  key: `needle-tone-${index}`,
  style: {
    '--tone-index': index,
    '--tone-left': `${4 + index * 4}%`,
    '--tone-height': `${18 + ((index * 9) % 56)}px`,
    '--tone-delay': `${-(index % 8) * 0.09}s`,
  },
}));
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

const commentNebulaItems = computed(() => {
  const sourceComments = [
    ...props.danmakuHotComments.slice(0, 5),
    ...props.danmakuComments.slice(0, 9),
  ];
  const comments = (sourceComments.length ? sourceComments : fallbackNebulaComments)
    .filter((comment) => String(comment?.content ?? '').trim())
    .slice(0, 11);

  return comments.map((comment, index) => {
    const user = comment.user ?? {};
    const avatarUrl = user.avatarUrl || '';

    return {
      key: `nebula-comment-${comment.id ?? index}-${index}`,
      text: clampVisualizerComment(comment.content),
      initial: String(user.name || '听').slice(0, 1),
      avatarUrl,
      avatarStyle: avatarUrl
        ? { '--comment-avatar-image': `url("${avatarUrl}")` }
        : {},
      style: {
        '--comment-top': `${11 + ((index * 19) % 76)}%`,
        '--comment-left': `${6 + ((index * 23) % 78)}%`,
        '--comment-delay': `${-index * 0.48}s`,
        '--comment-duration': `${8.8 + (index % 4) * 1.05}s`,
        '--comment-scale': `${0.82 + (index % 5) * 0.05}`,
        '--comment-scale-high': `${0.9 + (index % 5) * 0.05}`,
        '--comment-float-x': `${index % 2 ? '-' : ''}${18 + (index % 5) * 9}px`,
      },
    };
  });
});

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
  async (open, previousOpen) => {
    if (!open && previousOpen === undefined) {
      return;
    }

    const sourceRect = getFlightSourceRect();

    if (open) {
      coverFlightActive.value = Boolean(sourceRect);
      await nextTick();
      await waitForLayoutFrame();
      lyricsScroller.value?.refreshLayout('auto');
      playCoverFlight('enter', { sourceRect });
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

watch(playbackLyricIndex, async () => {
  await nextTick();
  lyricsScroller.value?.refreshLayout();
});

onBeforeUnmount(() => {
  clearDanmakuActivation();
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

async function loadTrackLyrics(trackId) {
  lyricRequestId += 1;
  const requestId = lyricRequestId;
  playbackLyricIndex.value = 0;
  lyricsScroller.value?.resetInteraction();

  if (!isNeteaseTrackId(trackId)) {
    lyricLines.value = createLyricPlaceholder(trackId ? '暂无歌词' : '无播放歌曲');
    await nextTick();
    lyricsScroller.value?.refreshLayout('auto');
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

  await nextTick();
  lyricsScroller.value?.refreshLayout('auto');
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

function clampVisualizerComment(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();

  if (text.length <= 24) {
    return text;
  }

  return `${text.slice(0, 23)}...`;
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
