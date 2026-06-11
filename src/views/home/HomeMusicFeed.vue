<template>
  <section
    v-show="active"
    class="soda-feed"
    :class="{ 'soda-feed--settling': musicFeedSettling }"
    aria-label="主页推荐听歌"
    :aria-hidden="!active"
  >
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
                <span class="soda-slide__kicker">
                  <AudioLines :size="16" />
                  {{ getMoodSignal(index) }}
                </span>
                <span v-if="song.vip" class="soda-slide__meta-tag">VIP</span>
                <span v-if="song.hasVideo" class="soda-slide__meta-tag">视频</span>
              </div>
              <h1>{{ song.name }}</h1>
              <p>{{ song.artist }}<span v-if="song.album"> · {{ song.album }}</span></p>
              <div class="soda-slide__position" aria-hidden="true">
                <ChevronUp :size="14" />
                <span>{{ song.rank }} / {{ recommendationQueue.length }}</span>
                <ChevronDown :size="14" />
              </div>
            </section>
          </div>

          <LyricsScroller
            v-if="index === activeIndex"
            variant="home"
            :lines="displayLyricLines"
            :active-index="activeLyricIndex"
            :loading="isLyricLoading"
            require-seekable
            @seek="seekToLyric"
          />

          <DanmakuLayer
            v-if="index === activeIndex"
            :key="`danmaku-${song.id}`"
            class="soda-slide__danmaku"
            :enabled="danmakuEnabled"
            :song="song"
            :hot-comments="songDanmakuState.hotComments"
            :comments="songDanmakuState.comments"
            :max-items="homeDanmakuMaxItems"
            :has-more="songDanmakuState.more"
            :loading="songDanmakuState.loading"
            :prefetch-threshold="homeDanmakuPrefetchThreshold"
            @need-more="loadMoreSongDanmaku"
          />

          <aside class="soda-action-rail" aria-label="歌曲操作">
            <button
              type="button"
              :aria-label="`${isLiked(song) ? '取消喜欢' : '喜欢'} ${getSongLikeLabel(song)}`"
              :title="isLiked(song) ? '取消喜欢' : '喜欢'"
              :class="{ active: isLiked(song) }"
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
              type="button"
              :aria-label="danmakuEnabled ? '关闭弹幕' : '开启弹幕'"
              :title="danmakuEnabled ? '关闭弹幕' : '开启弹幕'"
              :class="{ active: danmakuEnabled }"
              @click.stop="toggleDanmaku"
            >
              <Radio :size="24" />
              <span class="soda-action-rail__label">{{ danmakuEnabled ? '弹幕开' : '弹幕' }}</span>
            </button>
            <button type="button" aria-label="下一首" title="下一首" @click.stop="goNextFromGesture">
              <SkipForward :size="24" />
              <span class="soda-action-rail__label">下一首</span>
            </button>
            <button
              class="soda-action-rail__play"
              type="button"
              :aria-label="getPlayLabel(song)"
              :title="getPlayLabel(song)"
              :disabled="player.state.isLoading && isActiveSong(song)"
              @click.stop="playSongFromGesture(index)"
            >
              <Loader2
                v-if="player.state.isLoading && isActiveSong(song)"
                class="soda-spin"
                :size="26"
              />
              <Pause v-else-if="isSongPlaying(song)" :size="26" fill="currentColor" />
              <Play v-else :size="26" fill="currentColor" />
              <span class="soda-action-rail__label">{{ isSongPlaying(song) ? '暂停' : '播放' }}</span>
            </button>
          </aside>

          <footer class="soda-slide__footer">
            <div
              class="soda-slide__progress"
              role="slider"
              :tabindex="isActiveSong(song) ? 0 : -1"
              :aria-valuemin="0"
              :aria-valuemax="Math.floor(player.state.duration || 0)"
              :aria-valuenow="getSongProgressNow(song)"
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
import { defineAsyncComponent, toRef } from 'vue'
import {
  AudioLines,
  ChevronDown,
  ChevronUp,
  Heart,
  Loader2,
  MessageCircleMore,
  Pause,
  Play,
  Radio,
  SkipForward
} from 'lucide-vue-next'
import DanmakuLayer from '../../components/DanmakuLayer.vue'
import LyricsScroller from '../../components/LyricsScroller.vue'
import { useHomeMusicFeed } from './useHomeMusicFeed'

const CommentModal = defineAsyncComponent(() => import('../../components/CommentModal.vue'))
const props = defineProps({
  active: {
    type: Boolean,
    default: false
  }
})
const active = toRef(props, 'active')

const {
  feedScroller,
  musicFeedSettling,
  feedDragging,
  recommendationQueue,
  activeIndex,
  player,
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
  goNextFromGesture,
  playSongFromGesture,
  seekFromProgress,
  handleProgressKeydown,
  loadMoreSongComments,
  isSlideHydrated,
  getSlideStyle,
  isSongPlaying,
  getMoodSignal,
  isLiked,
  getSongLikeLabel,
  getSongCommentLabel,
  getPlayLabel,
  isActiveSong,
  getSongProgressNow,
  getCurrentTimeLabel,
  getSongProgress,
  getDurationLabel
} = useHomeMusicFeed({ active })
</script>
