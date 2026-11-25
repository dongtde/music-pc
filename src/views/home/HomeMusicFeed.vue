<template>
  <section
    v-show="active"
    id="home-music-feed"
    :aria-busy="musicFeedSettling || undefined"
    class="soda-feed"
    :class="{ 'soda-feed--settling': musicFeedSettling }"
    :style="isHomeTouch2D ? { '--home-page-index': mobilePageIndex, '--home-swipe-offset': `${swipeOffset}px` } : undefined"
    aria-label="主页推荐听歌"
    :aria-hidden="!active"
  >
    <div
      v-if="recommendationsError"
      v-show="!isHomeTouch2D || mobilePageIndex !== 2"
      class="soda-feed__load-status soda-feed__load-status--error"
      role="status"
      aria-live="polite"
    >
      <span>
        推荐接口暂不可用，已显示本地推荐
      </span>
    </div>

    <div
      ref="feedScroller"
      class="soda-feed__scroller"
      :class="{ 'soda-feed__scroller--dragging': feedDragging }"
      tabindex="0"
      @scroll="handleFeedScroll"
      @keydown="handleFeedKeydown"
      @pointerdown="startFeedDrag"
      @pointermove="handleFeedPointerMove"
      @pointerup="stopFeedDrag"
      @pointerleave="stopFeedDrag"
      @pointercancel="stopFeedDrag"
    >
      <article
        v-for="(song, index) in recommendationQueue"
        :key="song.id"
        class="soda-slide"
        :class="{
          active: index === activeIndex,
          'soda-slide--light': !isSlideHydrated(index)
        }"
        :style="getSlideStyle(song, index)"
        :aria-label="`${song.name} - ${song.artist}`"
      >
        <template v-if="isSlideHydrated(index)">
          <div class="soda-slide__backdrop" aria-hidden="true">
            <img
              v-if="song.coverUrl"
              :src="song.coverUrl"
              alt=""
              :loading="index === activeIndex ? 'eager' : 'lazy'"
              :fetchpriority="index === activeIndex ? 'high' : 'low'"
              decoding="async"
            />
            <span v-else class="soda-slide__fallback" :class="`cover--${song.type}`" />
          </div>

          <div class="soda-slide__pages">
            <section
              class="soda-slide__page soda-slide__page--danmaku"
              aria-label="弹幕页"
              :aria-hidden="isHomeTouch2D && mobilePageIndex !== 0"
              :inert="isHomeTouch2D && mobilePageIndex !== 0"
            >
              <DanmakuLayer
                v-if="index === activeIndex"
                :key="`danmaku-${song.id}`"
                class="soda-slide__danmaku"
                :enabled="danmakuEnabled && (!isHomeTouch2D || (active && mobilePageIndex === 0))"
                :song="song"
                :hot-comments="songDanmakuState.hotComments"
                :comments="songDanmakuState.comments"
                :max-items="isHomeTouch2D ? 12 : homeDanmakuMaxItems"
                :lanes="isHomeTouch2D ? 6 : undefined"
                :has-more="songDanmakuState.more"
                :loading="songDanmakuState.loading"
                :prefetch-threshold="homeDanmakuPrefetchThreshold"
                @need-more="loadMoreSongDanmaku"
              />
              <p v-if="isHomeTouch2D && !danmakuEnabled" class="soda-danmaku-disabled">弹幕已关闭，点击右侧弹幕按钮开启</p>
              <section v-if="isHomeTouch2D" class="soda-slide__caption">
                <h1 :title="song.name">{{ song.name }}</h1>
                <p :title="song.artist">{{ song.artist }}</p>
              </section>
              <footer v-if="isHomeTouch2D" class="soda-slide__footer">
                <div
                  class="soda-slide__progress"
                  role="slider"
                  :tabindex="isSongSeekable(song) ? 0 : -1"
                  :aria-valuemin="0"
                  :aria-valuemax="getSongProgressMax(song)"
                  :aria-valuenow="getSongProgressNow(song)"
                  :aria-disabled="!isSongSeekable(song) || undefined"
                  :aria-label="`${song.name} 播放进度`"
                  @pointerdown="seekFromProgress($event, song)"
                  @keydown="handleProgressKeydown($event, song)"
                >
                  <span class="soda-slide__progress-time">{{ getCurrentTimeLabel(song) }}</span>
                  <span class="soda-slide__progress-rail" aria-hidden="true">
                    <span :style="{ width: `${getSongProgress(song)}%` }" />
                  </span>
                  <span class="soda-slide__progress-time">{{ getDurationLabel(song) }}</span>
                </div>
              </footer>
            </section>

            <section
              class="soda-slide__page soda-slide__page--cover"
              aria-label="封面与三行歌词"
              :aria-hidden="isHomeTouch2D && mobilePageIndex !== 1"
              :inert="isHomeTouch2D && mobilePageIndex !== 1"
            >
              <div class="soda-slide__player">
                <div class="soda-slide__visual" aria-hidden="true">
                  <span class="soda-slide__disc" :class="{ 'soda-slide__disc--playing': isSongPlaying(song) }" />
                  <span class="soda-slide__cover" :class="`cover--${song.type}`">
                    <img
                      v-if="song.coverUrl"
                      :src="song.coverUrl"
                      :alt="song.name"
                      :loading="index === activeIndex ? 'eager' : 'lazy'"
                      :fetchpriority="index === activeIndex ? 'high' : 'low'"
                      decoding="async"
                    />
                  </span>
                </div>

                <section class="soda-slide__caption">
                  <div class="soda-slide__tag-row">
                    <span class="soda-slide__kicker"><AudioLines :size="16" />{{ getMoodSignal(index) }}</span>
                    <span
                      v-for="badge in getSongAccessBadges(song)"
                      :key="`access-${badge.value}`"
                      class="soda-slide__meta-tag"
                      :class="`soda-slide__meta-tag--${badge.value}`"
                      :title="badge.label"
                    >{{ badge.badgeLabel }}</span>
                    <span
                      v-for="quality in getAudioQualityBadges(song, { limit: 1, includeDefault: true })"
                      :key="`quality-${quality.value}`"
                      class="soda-slide__meta-tag soda-slide__meta-tag--quality"
                      :class="`soda-slide__meta-tag--quality-${quality.value}`"
                      :title="quality.label"
                    >{{ quality.badgeLabel }}</span>
                  </div>
                  <h1 :title="song.name">{{ song.name }}</h1>
                  <p :title="[song.artist, song.album].filter(Boolean).join(' · ')">{{ song.artist }}<span v-if="song.album"> · {{ song.album }}</span></p>
                </section>
              </div>

              <LyricsScroller
                v-if="index === activeIndex"
                :key="isHomeTouch2D ? 'preview-lyrics' : 'desktop-lyrics'"
                :ref="(instance) => setLyricsScroller(instance, 'preview')"
                variant="home"
                :preview-lines="isHomeTouch2D ? 3 : 0"
                :lines="displayLyricLines"
                :active-index="activeLyricIndex"
                :current-time="homePlaybackTime"
                :loading="isLyricLoading"
                :seekable="activeHomePlayback"
                require-seekable
                @seek="seekToLyric"
              />

              <footer class="soda-slide__footer">
                <div
                  class="soda-slide__progress"
                  role="slider"
                  :tabindex="isSongSeekable(song) ? 0 : -1"
                  :aria-valuemin="0"
                  :aria-valuemax="getSongProgressMax(song)"
                  :aria-valuenow="getSongProgressNow(song)"
                  :aria-disabled="!isSongSeekable(song) || undefined"
                  :aria-label="`${song.name} 播放进度`"
                  @pointerdown="seekFromProgress($event, song)"
                  @keydown="handleProgressKeydown($event, song)"
                >
                  <span class="soda-slide__progress-time">{{ getCurrentTimeLabel(song) }}</span>
                  <span class="soda-slide__progress-rail" aria-hidden="true">
                    <span :style="{ width: `${getSongProgress(song)}%` }" />
                  </span>
                  <span class="soda-slide__progress-time">{{ getDurationLabel(song) }}</span>
                </div>
              </footer>
            </section>

            <section
              v-if="isHomeTouch2D"
              class="soda-slide__page soda-slide__page--lyrics"
              aria-label="沉浸式歌词"
              :aria-hidden="mobilePageIndex !== 2"
              :inert="mobilePageIndex !== 2"
            >
              <LyricsScroller
                v-if="index === activeIndex"
                :ref="(instance) => setLyricsScroller(instance, 'full')"
                variant="home"
                :lines="displayLyricLines"
                :active-index="activeLyricIndex"
                :current-time="homePlaybackTime"
                :loading="isLyricLoading"
                :seekable="activeHomePlayback"
                require-seekable
                @seek="seekToLyric"
              />
            </section>
          </div>

          <aside v-show="!isHomeTouch2D || mobilePageIndex !== 2" class="soda-action-rail" aria-label="歌曲操作">
            <button
              type="button"
              :aria-label="`${isLiked(song) ? '取消喜欢' : '喜欢'} ${getSongLikeLabel(song)}`"
              :title="isLiked(song) ? '取消喜欢' : '喜欢'"
              :class="{ active: isLiked(song) }"
              :aria-pressed="isLiked(song)"
              @click.stop="toggleLike(song)"
            >
              <Heart :size="24" :fill="isLiked(song) ? 'currentColor' : 'none'" />
              <span class="soda-action-rail__label">{{ isLiked(song) ? '已喜欢' : '喜欢' }}</span>
              <span v-if="getSongLikeLabel(song)" class="soda-action-rail__count">
                {{ getSongLikeLabel(song) }}
              </span>
            </button>
            <button
              type="button"
              :aria-label="`评论 ${getSongCommentLabel(song)}`"
              title="评论"
              @click.stop="openSongCommentsModal(song)"
            >
              <MessageCircleMore :size="24" />
              <span class="soda-action-rail__label">评论</span>
              <span v-if="getSongCommentLabel(song)" class="soda-action-rail__count">
                {{ getSongCommentLabel(song) }}
              </span>
            </button>
            <button
              class="soda-action-rail__danmaku-toggle"
              type="button"
              :aria-label="isHomeTouch2D && mobilePageIndex !== 0 ? '查看弹幕页' : (danmakuEnabled ? '关闭弹幕' : '开启弹幕')"
              :title="isHomeTouch2D && mobilePageIndex !== 0 ? '查看弹幕页' : (danmakuEnabled ? '关闭弹幕' : '开启弹幕')"
              :class="{ active: danmakuEnabled && (!isHomeTouch2D || mobilePageIndex === 0) }"
              :aria-pressed="isHomeTouch2D && mobilePageIndex !== 0 ? undefined : danmakuEnabled"
              @click.stop="handleDanmakuButton"
            >
              <Radio :size="24" />
              <span class="soda-action-rail__label">{{ danmakuEnabled && (!isHomeTouch2D || mobilePageIndex === 0) ? '弹幕开' : '弹幕' }}</span>
            </button>
            <button
              class="soda-action-rail__play"
              type="button"
              :aria-label="getPlayLabel(song)"
              :title="getPlayLabel(song)"
              :disabled="isHomeTrackLoading(song)"
              @click.stop="playSongFromGesture(index)"
            >
              <Loader2
                v-if="isHomeTrackLoading(song)"
                class="soda-spin"
                :size="26"
              />
              <Pause v-else-if="isSongPlaying(song)" :size="26" fill="currentColor" />
              <Play v-else :size="26" fill="currentColor" />
              <span class="soda-action-rail__label">{{ isSongPlaying(song) ? '暂停' : '播放' }}</span>
            </button>
          </aside>
        </template>
      </article>
    </div>
  </section>

  <CommentModal
    v-if="songCommentsModalMounted"
    v-model:show="songCommentsModalVisible"
    title="歌曲评论"
    :subtitle="songCommentSubtitle"
    :total="displaySongCommentTotal"
    :hot-comments="songHotComments"
    :comments="songComments"
    :loading="songCommentsLoading"
    :error="songCommentsError"
    :has-more="songCommentsHasMore"
    @load-more="loadMoreSongComments"
  />
</template>

<script setup>
import { defineAsyncComponent, nextTick, toRef, watch } from 'vue'
import {
  AudioLines,
  Heart,
  Loader2,
  MessageCircleMore,
  Pause,
  Play,
  Radio
} from 'lucide-vue-next'
import DanmakuLayer from '../../components/DanmakuLayer.vue'
import LyricsScroller from '../../components/LyricsScroller.vue'
import { getAudioQualityBadges } from '../../utils/audioQuality'
import { getSongAccessBadges } from '../../utils/songAccess'
import { useHomeMusicFeed } from './useHomeMusicFeed'
import { useResponsiveLayout } from '../../composables/useResponsiveLayout'

const CommentModal = defineAsyncComponent(() => import('../../components/CommentModal.vue'))
const props = defineProps({
  active: {
    type: Boolean,
    default: false
  },
  mobilePageIndex: { type: Number, default: 1 },
  swipeOffset: { type: Number, default: 0 }
})
const emit = defineEmits(['first-data-ready', 'page-request'])
const { isHomeTouch2D } = useResponsiveLayout()
const active = toRef(props, 'active')
const lyricsScrollers = new Map()

function setLyricsScroller(instance, key) {
  if (instance) lyricsScrollers.set(key, instance)
  else lyricsScrollers.delete(key)
}

function resetLyricInteraction() {
  for (const scroller of lyricsScrollers.values()) scroller.resetInteraction()
}

defineExpose({ resetLyricInteraction })

const {
  feedScroller,
  musicFeedSettling,
  recommendationsSettled,
  recommendationsError,
  feedDragging,
  recommendationQueue,
  activeIndex,
  player,
  activeHomePlayback,
  homePlaybackTime,
  displayLyricLines,
  activeLyricIndex,
  isLyricLoading,
  danmakuEnabled,
  songDanmakuState,
  homeDanmakuMaxItems,
  homeDanmakuPrefetchThreshold,
  songCommentsModalVisible,
  songCommentsModalMounted,
  songHotComments,
  songComments,
  songCommentsHasMore,
  songCommentsLoading,
  songCommentsError,
  displaySongCommentTotal,
  songCommentSubtitle,
  handleFeedScroll,
  handleFeedKeydown,
  startFeedDrag,
  handleFeedPointerMove,
  stopFeedDrag,
  seekToLyric,
  loadMoreSongDanmaku,
  toggleLike,
  openSongCommentsModal,
  toggleDanmaku,
  playSongFromGesture,
  seekFromProgress,
  handleProgressKeydown,
  loadMoreSongComments,
  isSlideHydrated,
  getSlideStyle,
  isSongPlaying,
  isHomeTrackLoading,
  isSongSeekable,
  getMoodSignal,
  isLiked,
  getSongLikeLabel,
  getSongCommentLabel,
  getPlayLabel,
  isActiveSong,
  getSongProgressNow,
  getCurrentTimeLabel,
  getSongProgress,
  getSongProgressMax,
  getDurationLabel
} = useHomeMusicFeed({ active })

function handleDanmakuButton() {
  if (isHomeTouch2D.value && props.mobilePageIndex !== 0) emit('page-request', 0)
  else toggleDanmaku()
}

watch([isHomeTouch2D, () => props.mobilePageIndex], async ([touch2D, index]) => {
  if (touch2D && index === 0 && !danmakuEnabled.value) toggleDanmaku()
  await nextTick()
  for (const scroller of lyricsScrollers.values()) scroller.refreshLayout('auto')
}, { immediate: true })

watch(recommendationsSettled, (settled) => {
  if (settled) {
    emit('first-data-ready')
  }
}, { immediate: true })
</script>
