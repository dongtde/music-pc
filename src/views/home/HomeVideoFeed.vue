<template>
  <section
    v-show="active"
    class="soda-video-feed"
    aria-label="沉浸式视频 MV"
    :aria-hidden="!active"
  >
    <div
      ref="mvScroller"
      class="soda-video-feed__scroller"
      :class="{ 'soda-video-feed__scroller--dragging': mvDragging }"
      tabindex="0"
      @scroll="handleMvScroll"
      @keydown="handleMvKeydown"
      @pointerdown="startMvDrag"
      @pointermove="handleMvPointerMove"
      @pointerup="stopMvDrag"
      @pointerleave="stopMvDrag"
      @pointercancel="stopMvDrag"
    >
      <article
        v-for="(mv, index) in mvQueue"
        :key="mv.id"
        class="soda-mv-slide"
        :class="{ active: index === activeMvIndex }"
        :aria-label="`${mv.title} - ${mv.artist}`"
      >
        <div class="soda-mv-slide__backdrop" aria-hidden="true">
          <img
            v-if="mv.coverUrl"
            :src="mv.coverUrl"
            alt=""
            :loading="index === activeMvIndex ? 'eager' : 'lazy'"
            :fetchpriority="index === activeMvIndex ? 'high' : 'low'"
            decoding="async"
          />
          <span v-else class="soda-slide__fallback" :class="`cover--${mv.type}`" />
        </div>

        <div class="soda-mv-stage">
          <video
            v-if="index === activeMvIndex && getHomeMvVideoUrl(mv)"
            :key="`${mv.id}-${getHomeMvVideoUrl(mv)}`"
            :ref="(element) => setHomeVideoElement(element, index)"
            class="soda-mv-stage__video"
            :src="getHomeMvVideoUrl(mv)"
            :poster="mv.coverUrl"
            playsinline
            preload="metadata"
            @loadedmetadata="handleHomeMvMetadata"
            @timeupdate="handleHomeMvTimeUpdate"
            @play="handleHomeMvPlay"
            @pause="handleHomeMvPause"
            @ended="goNextMvFromGesture"
            @error="handleHomeMvError"
            @click="toggleHomeMvPlayback(index)"
          />
          <button
            v-else
            class="soda-mv-poster"
            type="button"
            :disabled="mvQueueLoading || isActiveMvLoading(mv)"
            @click.stop="playMvFromGesture(index)"
          >
            <img v-if="mv.coverUrl" :src="mv.coverUrl" :alt="mv.title" />
            <span>
              <Loader2 v-if="isActiveMvLoading(mv)" class="soda-spin" :size="34" />
              <Play v-else :size="38" fill="currentColor" />
            </span>
            <small v-if="index === activeMvIndex && homeMvState.error">{{ homeMvState.error }}</small>
            <small v-else>{{ isActiveMvLoading(mv) ? '正在获取播放地址' : '点击播放 MV' }}</small>
          </button>
          <button
            v-if="index === activeMvIndex && getHomeMvVideoUrl(mv) && !homeMvState.isPlaying"
            class="soda-mv-stage__play"
            type="button"
            :disabled="isActiveMvLoading(mv)"
            :aria-label="`播放 ${mv.title}`"
            @click.stop="playMvFromGesture(index)"
          >
            <Play :size="42" fill="currentColor" />
          </button>
        </div>

        <section class="soda-mv-caption">
          <h1>{{ mv.title }}</h1>
          <p>{{ mv.artist }}<span v-if="mv.playCount"> · {{ mv.playCount }} 播放</span></p>
          <small v-if="mv.desc">{{ mv.desc }}</small>
        </section>

        <DanmakuLayer
          v-if="index === activeMvIndex"
          :key="`home-mv-danmaku-${mv.id}`"
          class="soda-mv-slide__danmaku"
          :enabled="homeMvDanmakuEnabled"
          :song="{ id: mv.id, name: mv.title }"
          :hot-comments="homeMvDanmakuState.hotComments"
          :comments="homeMvDanmakuState.comments"
          :max-items="homeDanmakuMaxItems"
          :has-more="homeMvDanmakuState.more"
          :loading="homeMvDanmakuState.loading"
          :prefetch-threshold="homeDanmakuPrefetchThreshold"
          @need-more="loadMoreHomeMvDanmaku"
        />

        <aside class="soda-action-rail soda-mv-action-rail" aria-label="MV 操作">
          <button
            type="button"
            :aria-label="`${isHomeMvLiked(mv) ? '取消喜欢' : '喜欢'} ${getHomeMvLikeLabel(mv)}`"
            :title="isHomeMvLiked(mv) ? '取消喜欢' : '喜欢'"
            :class="{ active: isHomeMvLiked(mv) }"
            @click.stop="toggleHomeMvLike(mv)"
          >
            <Heart :size="24" :fill="isHomeMvLiked(mv) ? 'currentColor' : 'none'" />
            <span class="soda-action-rail__label">{{ isHomeMvLiked(mv) ? '已喜欢' : '喜欢' }}</span>
            <span v-if="getHomeMvLikeLabel(mv)" class="soda-action-rail__count">
              {{ getHomeMvLikeLabel(mv) }}
            </span>
          </button>
          <button
            type="button"
            :aria-label="`评论 ${getHomeMvCommentLabel(mv)}`"
            title="评论"
            @click.stop="openHomeMvComments(mv)"
          >
            <MessageCircleMore :size="24" />
            <span class="soda-action-rail__label">评论</span>
            <span v-if="getHomeMvCommentLabel(mv)" class="soda-action-rail__count">
              {{ getHomeMvCommentLabel(mv) }}
            </span>
          </button>
          <button
            type="button"
            :aria-label="homeMvDanmakuEnabled ? '关闭弹幕' : '开启弹幕'"
            :title="homeMvDanmakuEnabled ? '关闭弹幕' : '开启弹幕'"
            :class="{ active: homeMvDanmakuEnabled }"
            @click.stop="toggleHomeMvDanmaku"
          >
            <Radio :size="24" />
            <span class="soda-action-rail__label">{{ homeMvDanmakuEnabled ? '弹幕开' : '弹幕' }}</span>
          </button>
        </aside>

        <footer class="soda-mv-slide__footer">
          <div
            class="soda-slide__progress soda-mv-progress"
            role="slider"
            :tabindex="index === activeMvIndex ? 0 : -1"
            :aria-valuemin="0"
            :aria-valuemax="Math.floor(getHomeMvDuration(mv) || 0)"
            :aria-valuenow="getHomeMvProgressNow(mv)"
            :aria-label="`${mv.title} 播放进度`"
            @pointerdown="seekHomeMvFromProgress($event, mv)"
          >
            <span class="soda-slide__progress-time">{{ getHomeMvCurrentTimeLabel(mv) }}</span>
            <span class="soda-slide__progress-rail" aria-hidden="true">
              <span :style="{ width: `${getHomeMvProgress(mv)}%` }" />
            </span>
            <span class="soda-slide__progress-time">{{ getHomeMvDurationLabel(mv) }}</span>
          </div>
        </footer>
      </article>

      <div v-if="mvQueueLoading && !mvQueue.length" class="soda-video-empty">
        <Loader2 class="soda-spin" :size="34" />
        <span>正在加载 MV</span>
      </div>
    </div>
  </section>

  <CommentModal
    v-if="homeMvCommentsModalMounted"
    v-model:show="homeMvCommentsModalVisible"
    title="MV 评论"
    :subtitle="homeMvCommentSubtitle"
    :total="homeMvCommentState.total"
    :hot-comments="homeMvCommentState.hotComments"
    :comments="homeMvCommentState.comments"
    :loading="homeMvCommentState.loading"
    :error="homeMvCommentState.error"
    :has-more="homeMvCommentState.more"
    @load-more="loadMoreHomeMvComments"
  />
</template>

<script setup>
import { defineAsyncComponent, toRef } from 'vue'
import { Heart, Loader2, MessageCircleMore, Play, Radio } from 'lucide-vue-next'
import DanmakuLayer from '../../components/DanmakuLayer.vue'
import { useHomeVideoFeed } from './useHomeVideoFeed'

const CommentModal = defineAsyncComponent(() => import('../../components/CommentModal.vue'))
const props = defineProps({
  active: {
    type: Boolean,
    default: false
  }
})
const active = toRef(props, 'active')

const {
  mvScroller,
  mvDragging,
  mvQueue,
  mvQueueLoading,
  activeMvIndex,
  activeMvLoading,
  homeMvState,
  homeMvDanmakuEnabled,
  homeMvDanmakuState,
  homeMvCommentState,
  homeMvCommentsModalVisible,
  homeMvCommentsModalMounted,
  homeMvCommentSubtitle,
  homeDanmakuMaxItems,
  homeDanmakuPrefetchThreshold,
  handleMvScroll,
  handleMvKeydown,
  startMvDrag,
  handleMvPointerMove,
  stopMvDrag,
  getHomeMvVideoUrl,
  setHomeVideoElement,
  handleHomeMvMetadata,
  handleHomeMvTimeUpdate,
  handleHomeMvPlay,
  handleHomeMvPause,
  handleHomeMvError,
  goNextMvFromGesture,
  toggleHomeMvPlayback,
  playMvFromGesture,
  isActiveMvLoading,
  loadMoreHomeMvDanmaku,
  isHomeMvLiked,
  getHomeMvLikeLabel,
  toggleHomeMvLike,
  getHomeMvCommentLabel,
  openHomeMvComments,
  toggleHomeMvDanmaku,
  getHomeMvDuration,
  getHomeMvProgressNow,
  seekHomeMvFromProgress,
  getHomeMvCurrentTimeLabel,
  getHomeMvProgress,
  getHomeMvDurationLabel,
  loadMoreHomeMvComments
} = useHomeVideoFeed({ active })
</script>
