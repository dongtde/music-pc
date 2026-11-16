<template>
  <section
    v-show="active || preview"
    class="soda-video-feed"
    :class="{ 'soda-video-feed--embedded': embedded, 'soda-video-feed--preview': preview && !active }"
    aria-label="沉浸式视频 MV"
    :aria-hidden="!active && !(embedded && preview)"
    :inert="(!active && !(embedded && preview)) || (!embedded && homeMvCommentsModalVisible)"
    @pointerdown.capture="activatePreview"
    @wheel.capture="activatePreview"
    @keydown.capture="activatePreview"
  >
    <div
      ref="mvScroller"
      class="soda-video-feed__scroller"
      :inert="embedded && homeMvCommentsModalVisible"
      :class="{ 'soda-video-feed__scroller--dragging': mvDragging }"
      tabindex="0"
      @scroll="handleMvScroll"
      @wheel.passive="enableMvAutoPlay"
      @keydown="handleMvKeydown"
      @pointerdown="startMvDrag"
      @pointermove="handleMvPointerMove"
      @pointerup="stopMvDrag"
      @pointerleave="stopMvDrag"
      @pointercancel="stopMvDrag"
      @click.capture="suppressMvDragClick"
    >
      <article
        v-for="(mv, index) in mvQueue"
        :key="mv.id"
        class="soda-mv-slide"
        :class="{
          active: index === activeMvIndex,
          'soda-mv-slide--light': !isMvSlideHydrated(index)
        }"
        :aria-label="`${mv.title} - ${mv.artist}`"
      >
        <template v-if="isMvSlideHydrated(index)">
          <div v-if="!embedded" class="soda-mv-slide__backdrop" aria-hidden="true">
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
            <MvMediaFrame :enabled="embedded" :backdrop="embedded ? undefined : mv.coverUrl">
            <video
              v-if="(index === activeMvIndex || (embedded && Math.abs(index - activeMvIndex) <= 1)) && getHomeMvVideoUrl(mv)"
              :key="`${mv.id}-${getHomeMvVideoUrl(mv)}`"
              :ref="(element) => setHomeVideoElement(element, index)"
              class="soda-mv-stage__video"
              :src="getHomeMvVideoUrl(mv)"
              :poster="embedded ? undefined : mv.coverUrl"
              playsinline
              :crossorigin="embedded ? 'anonymous' : undefined"
              :muted="index !== activeMvIndex || homeMvMuted"
              :preload="embedded && index >= activeMvIndex ? 'auto' : 'metadata'"
              @loadedmetadata="index === activeMvIndex && handleHomeMvMetadata($event)"
              @timeupdate="index === activeMvIndex && handleHomeMvTimeUpdate($event)"
              @play="index === activeMvIndex && handleHomeMvPlay($event)"
              @pause="index === activeMvIndex && handleHomeMvPause()"
              @ended="index === activeMvIndex && goNextMvFromGesture()"
              @error="index === activeMvIndex && handleHomeMvError()"
              @click="toggleHomeMvPlayback(index)"
            />
            <button
              v-else
              class="soda-mv-poster"
              type="button"
              :disabled="mvQueueLoading || isActiveMvLoading(mv)"
              @click.stop="playMvFromGesture(index)"
            >
              <img v-if="!embedded && mv.coverUrl" :src="mv.coverUrl" :alt="mv.title" />
              <span>
                <Loader2 v-if="isActiveMvLoading(mv)" class="soda-spin" :size="34" />
                <Play v-else :size="38" fill="currentColor" />
              </span>
              <small v-if="index === activeMvIndex && homeMvState.error">{{ homeMvState.error }}</small>
              <small v-else>{{ isActiveMvLoading(mv) ? '正在获取播放地址' : '点击播放 MV' }}</small>
            </button>
            </MvMediaFrame>
            <button
              v-if="index === activeMvIndex && getHomeMvVideoUrl(mv) && !homeMvState.isPlaying && !homeMvState.error"
              class="soda-mv-stage__play"
              type="button"
              :disabled="isActiveMvLoading(mv)"
              :aria-label="`播放 ${mv.title}`"
              @click.stop="playMvFromGesture(index)"
            >
              <Play :size="42" fill="currentColor" />
            </button>
            <div v-if="index === activeMvIndex && getHomeMvVideoUrl(mv) && homeMvState.error" class="soda-mv-stage__error" role="status">
              <p>{{ homeMvState.error }}</p>
              <button type="button" @click.stop="retryHomeMvPlayback">重新播放</button>
            </div>
          </div>

          <section v-if="embedded" class="soda-mv-caption">
            <p class="soda-mv-creator">@{{ mv.artist }}</p>
            <h1>{{ mv.title }}</h1>
            <p class="soda-mv-soundtrack"><span>{{ mv.artist }} · {{ mv.title }}</span></p>
          </section>
          <section v-else class="soda-mv-caption">
            <h1>{{ mv.title }}</h1>
            <p>{{ mv.artist }}<span v-if="mv.playCount"> · {{ mv.playCount }} 播放</span></p>
            <small v-if="mv.desc">{{ mv.desc }}</small>
          </section>

          <DanmakuLayer
            v-if="index === activeMvIndex && !embedded"
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

          <aside v-if="embedded" class="soda-action-rail soda-mv-action-rail" aria-label="MV 操作">
            <button type="button" :aria-label="`${isHomeMvLiked(mv) ? '取消喜欢' : '喜欢'} ${mv.title}`" :aria-pressed="isHomeMvLiked(mv)" @click.stop="toggleHomeMvLike(mv)"><Heart :size="32" :fill="isHomeMvLiked(mv) ? 'currentColor' : 'none'" /><span>{{ isHomeMvLiked(mv) ? '已喜欢' : '喜欢' }}</span></button>
            <button type="button" :aria-label="`评论 ${mv.title} ${getHomeMvCommentLabel(mv)}`" @click.stop="openHomeMvComments(mv)"><MessageCircleMore :size="32" /><span>{{ getHomeMvCommentLabel(mv) }}</span></button>
            <button type="button" :aria-label="`投屏 ${mv.title}`" :disabled="index !== activeMvIndex || !homeMvState.isReady || Boolean(homeMvState.error)" @click.stop="castMv(mv)"><Cast :size="32" /><span>投屏</span></button>
            <button class="soda-mv-disc" :class="{ 'is-playing': index === activeMvIndex && homeMvState.isPlaying }" type="button" :aria-label="index === activeMvIndex && homeMvState.isPlaying ? '暂停 MV' : '播放 MV'" @click.stop="toggleHomeMvPlayback(index)"><span :style="mv.coverUrl ? { backgroundImage: `url(${JSON.stringify(mv.coverUrl)})` } : undefined"><Music2 :size="20" /></span></button>
          </aside>
          <aside v-else class="soda-action-rail soda-mv-action-rail" aria-label="MV 操作">
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
              class="soda-action-rail__danmaku-toggle"
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
            <button v-if="embedded && mvFeedError" class="soda-mv-retry" type="button" @click.stop="loadHomeMvs({ append: true })">重试加载</button>
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
        </template>
      </article>

      <div v-if="mvQueueLoading && !mvQueue.length" class="soda-video-empty">
        <Loader2 class="soda-spin" :size="34" />
        <span>正在加载 MV</span>
      </div>
      <div v-else-if="!mvQueue.length" class="soda-video-empty" role="status">
        <span>{{ mvFeedError || '暂时没有可播放的 MV' }}</span>
        <button type="button" @click="loadHomeMvs({ force: true })">重新加载</button>
      </div>
    </div>
    <WorldMvComments
      v-if="embedded && homeMvCommentsModalVisible"
      :state="homeMvCommentState"
      @close="homeMvCommentsModalVisible = false"
      @load-more="loadMoreHomeMvComments"
      @retry="retryHomeMvComments"
    />
  </section>

  <CommentModal
    v-if="!embedded && homeMvCommentsModalMounted"
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
    @retry="retryHomeMvComments"
  />
</template>

<script setup>
import { defineAsyncComponent, nextTick, toRef, watch } from 'vue'
import { Cast, Heart, Loader2, MessageCircleMore, Music2, Play, Radio } from 'lucide-vue-next'
import DanmakuLayer from '../../components/DanmakuLayer.vue'
import { useHomeVideoFeed } from './useHomeVideoFeed'
import MvMediaFrame from '../../components/music-world/MvMediaFrame.vue'
import WorldMvComments from '../../components/music-world/WorldMvComments.vue'

const CommentModal = defineAsyncComponent(() => import('../../components/CommentModal.vue'))
const props = defineProps({
  embedded: Boolean,
  preview: Boolean,
  loadMvs: Function,
  active: {
    type: Boolean,
    default: false
  }
})
const emit = defineEmits(['cast', 'activate'])
async function activatePreview(event) {
  if (!props.embedded || !props.preview || props.active) return
  if (event.type === 'keydown' && !['ArrowDown', 'ArrowUp', ' ', 'Enter'].includes(event.key)) return
  if (event.type === 'wheel' && !event.deltaY) return
  if (event.type === 'keydown' || event.type === 'wheel') { event.preventDefault(); event.stopPropagation() }
  emit('activate')
  if (event.type === 'wheel') {
    await nextTick()
    playMvFromGesture(activeMvIndex.value + Math.sign(event.deltaY))
  } else if (event.type === 'keydown') {
    await nextTick()
    if (event.key === 'Enter') playMvFromGesture(activeMvIndex.value)
    else handleMvKeydown(event)
  }
}
const active = toRef(props, 'active')

const {
  homeVideoElement,
  pauseHomeMv,
  mvScroller,
  mvDragging,
  mvQueue,
  mvQueueLoading,
  mvFeedError,
  loadHomeMvs,
  activeMvIndex,
  activeMvLoading,
  homeMvState,
  homeMvMuted,
  homeMvDanmakuEnabled,
  homeMvDanmakuState,
  homeMvCommentState,
  homeMvCommentsModalVisible,
  homeMvCommentsModalMounted,
  homeMvCommentSubtitle,
  homeDanmakuMaxItems,
  homeDanmakuPrefetchThreshold,
  handleMvScroll,
  enableMvAutoPlay,
  handleMvKeydown,
  startMvDrag,
  handleMvPointerMove,
  stopMvDrag,
  suppressMvDragClick,
  isMvSlideHydrated,
  getHomeMvVideoUrl,
  setHomeVideoElement,
  handleHomeMvMetadata,
  handleHomeMvTimeUpdate,
  handleHomeMvPlay,
  handleHomeMvPause,
  handleHomeMvError,
  retryHomeMvPlayback,
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
  loadMoreHomeMvComments,
  retryHomeMvComments
} = useHomeVideoFeed({ active, loadMvs: props.loadMvs, autoplay: props.embedded, ...(props.embedded ? { fallback: [] } : {}) })
function castMv(mv) {
  const video = homeVideoElement.value
  if (!video || !homeMvState.isReady) return
  const payload = { url: video.currentSrc || video.src, title: mv.title, artist: mv.artist, currentTime: video.currentTime, volume: video.volume }
  pauseHomeMv()
  emit('cast', payload)
}
watch(() => props.preview, preview => { if (preview) loadHomeMvs() }, { immediate: true })
</script>
