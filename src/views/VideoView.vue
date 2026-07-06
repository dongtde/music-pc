<template>
  <div
    ref="viewRoot"
    class="view mv-view"
    :class="{ 'mv-view--watch': isWatchMode }"
    @scroll.passive="handleViewScroll"
  >
    <template v-if="isWatchMode">
      <section ref="playerSection" class="mv-watch">
        <div ref="playerStage" class="mv-watch__stage" @pointermove="handleStagePointerMove" @pointerleave="hideControlsSoon">
          <video
            v-if="activeVideoUrl"
            :key="`${activeMv.id}-${activeMv.urlQuality || 'auto'}-${activeVideoUrl}`"
            ref="videoElement"
            class="mv-watch__video"
            :src="activeVideoUrl"
            :poster="activeMv.coverUrl"
            playsinline
            preload="metadata"
            @loadedmetadata="handleVideoMetadata"
            @timeupdate="handleVideoTimeUpdate"
            @play="handleVideoPlay"
            @pause="handleVideoPause"
            @ended="handleVideoEnded"
            @error="handleVideoError"
            @click="toggleActivePlayback"
          />

          <button
            v-if="activeVideoUrl && !isVideoPlaying"
            class="mv-watch__play"
            type="button"
            :disabled="loading"
            @click="playActiveMv({ skipScroll: true })"
          >
            <Play :size="44" fill="currentColor" />
          </button>

          <button
            v-if="activeMv && !activeVideoUrl"
            class="mv-watch__poster"
            type="button"
            :disabled="loading"
            @click="reloadActiveMv({ autoplay: true })"
          >
            <img v-if="activeMv.coverUrl" :src="activeMv.coverUrl" :alt="activeMv.title" />
            <span>
              <RefreshCw v-if="loading" :size="34" class="mv-spin" />
              <Play v-else :size="38" fill="currentColor" />
            </span>
            <small>{{ loading ? '正在获取播放地址' : '播放地址加载失败，点击重试' }}</small>
          </button>

          <div v-if="!activeMv" class="mv-watch__empty">
            <Video :size="48" />
            <span>{{ loading ? '正在加载 MV' : '暂无可播放 MV' }}</span>
          </div>

          <div v-if="videoRecoveryVisible" class="mv-watch__recovery" role="alert">
            <strong>{{ videoState.error }}</strong>
            <span>可以重新获取播放地址，或者换一个清晰度继续。</span>
            <div>
              <button type="button" :disabled="loading" @click.stop="retryActiveMvPlayback">
                <RefreshCw :size="16" :class="{ 'mv-spin': loading }" />
                <span>重新获取</span>
              </button>
              <button
                v-if="recoveryQuality"
                type="button"
                :disabled="loading"
                @click.stop="selectQuality(recoveryQuality, { autoplay: true })"
              >
                <span>切到 {{ recoveryQuality }}P</span>
              </button>
              <button type="button" :disabled="!activeVideoUrl" @click.stop="openActiveVideoExternally">
                <ExternalLink :size="16" />
                <span>外部打开</span>
              </button>
            </div>
          </div>

          <DanmakuLayer
            class="mv-watch__danmaku"
            :enabled="danmakuEnabled"
            :song="{ id: activeMv?.id, name: activeMv?.title }"
            :hot-comments="danmakuCommentState.hotComments"
            :comments="danmakuCommentState.comments"
            :has-more="danmakuCommentState.more"
            :loading="danmakuCommentState.loading"
            @need-more="loadMoreDanmakuComments"
          />

          <div class="mv-watch__top">
            <button class="mv-video-icon" type="button" aria-label="返回视频首页" title="返回视频首页" @click="backToBrowse">
              <ChevronLeft :size="20" />
            </button>
            <span>{{ playbackStatusText }}</span>
          </div>

          <div class="mv-watch__controls" :class="{ 'is-visible': controlsVisible || !isVideoPlaying }">
            <button class="mv-watch__progress" type="button" aria-label="视频进度" @click="seekFromProgress">
              <span :style="{ width: `${progressPercent}%` }" />
            </button>

            <div class="mv-watch__control-row">
              <div class="mv-watch__control-group">
                <button class="mv-video-icon" type="button" :aria-label="isVideoPlaying ? '暂停' : '播放'" @click="toggleActivePlayback">
                  <Pause v-if="isVideoPlaying" :size="18" fill="currentColor" />
                  <Play v-else :size="18" fill="currentColor" />
                </button>
                <button class="mv-video-icon" type="button" aria-label="上一个 MV" title="上一个 MV" @click="playRelativeMv(-1)">
                  <SkipBack :size="17" fill="currentColor" />
                </button>
                <button class="mv-video-icon" type="button" aria-label="下一个 MV" title="下一个 MV" @click="playRelativeMv(1)">
                  <SkipForward :size="17" fill="currentColor" />
                </button>
                <span class="mv-watch__time">{{ formatVideoClock(videoState.currentTime) }}/{{ activeMv?.duration || videoState.durationText }}</span>
              </div>

              <div class="mv-watch__control-group mv-watch__control-group--right">
                <button class="mv-video-icon" type="button" :aria-label="videoState.muted ? '取消静音' : '静音'" @click="toggleMute">
                  <VolumeX v-if="videoState.muted || videoState.volume === 0" :size="17" />
                  <Volume2 v-else :size="17" />
                </button>
                <input
                  class="mv-volume"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  :value="videoState.volume"
                  aria-label="视频音量"
                  @input="setVolume"
                />
                <button
                  class="mv-video-pill"
                  type="button"
                  :class="{ active: danmakuEnabled }"
                  :aria-label="danmakuEnabled ? '关闭弹幕' : '开启弹幕'"
                  @click="toggleDanmaku"
                >
                  弹幕
                </button>
                <div class="mv-quality">
                  <button class="mv-video-pill" type="button" aria-label="切换清晰度" @click="qualityMenuVisible = !qualityMenuVisible">
                    {{ activeMv?.urlQuality ? `${activeMv.urlQuality}P` : '超清' }}
                  </button>
                  <div v-if="qualityMenuVisible" class="mv-quality__menu">
                    <button
                      v-for="quality in qualityOptions"
                      :key="quality"
                      type="button"
                      :class="{ active: Number(activeMv?.urlQuality) === Number(quality) }"
                      @click="selectQuality(quality)"
                    >
                      {{ quality }}P
                    </button>
                  </div>
                </div>
                <button class="mv-video-icon" type="button" aria-label="画中画" title="画中画" @click="togglePictureInPicture">
                  <PictureInPicture2 :size="17" />
                </button>
                <button class="mv-video-icon" type="button" aria-label="全屏" title="全屏" @click="toggleFullscreen">
                  <Maximize :size="17" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="mv-watch__info">
          <div class="mv-watch__title">
            <h1>{{ activeMv?.title || 'MV 播放' }}</h1>
            <p>
              演唱：{{ activeMv?.artist || '未知艺人' }}
              <span>{{ activeMv?.playCount || 0 }} 次观看</span>
              <span v-if="activeMv?.publishTime">发布时间：{{ activeMv.publishTime }}</span>
            </p>
          </div>

          <p v-if="activeMv?.description" class="mv-watch__desc">{{ activeMv.description }}</p>

          <div class="mv-watch__actions">
            <button class="mv-detail-action" type="button" :disabled="!activeMv || subscribeLoading" @click="toggleSubscribe">
              <Bookmark :size="18" :fill="activeMv?.subed ? 'currentColor' : 'none'" />
              <span>{{ activeMv?.subed ? '已收藏' : '收藏' }}</span>
            </button>
            <button class="mv-detail-action" type="button" :disabled="!activeVideoUrl" @click="downloadActiveMv">
              <Download :size="18" />
              <span>下载</span>
            </button>
            <button class="mv-detail-action" type="button" :disabled="!activeMv" @click="shareActiveMv">
              <Share2 :size="18" />
              <span>分享</span>
            </button>
            <button class="mv-detail-action" type="button" :disabled="!activeMv" @click="openComments">
              <MessageCircle :size="18" />
              <span>评论</span>
            </button>
            <button class="mv-detail-action" type="button" :disabled="!activeMv || likeLoading" @click="toggleLike">
              <Heart :size="18" :fill="activeMv?.stats?.liked ? 'currentColor' : 'none'" />
              <span>{{ formatCount(activeMv?.stats?.likedCount) }}</span>
            </button>
            <RouterLink v-if="activeMv?.artistId" class="mv-detail-action" :to="`/artist/${activeMv.artistId}`">
              <User :size="18" />
              <span>歌手</span>
            </RouterLink>
          </div>
        </div>
      </section>

      <section v-if="watchRelatedSections.length" class="mv-browse-section">
        <header class="mv-section-head">
          <h2>继续观看</h2>
          <button type="button" @click="backToBrowse">更多</button>
        </header>
        <div class="mv-card-row">
          <button
            v-for="mv in watchRelatedMvs"
            :key="`watch-${mv.id}`"
            class="mv-video-card"
            type="button"
            @pointerdown="stopMvPreview(mv, getMvPreviewCardKey('watch', mv))"
            @click="selectMv(mv, { autoplay: true })"
            @mouseenter="queueMvPreview(mv, getMvPreviewCardKey('watch', mv))"
            @mouseleave="stopMvPreview(mv, getMvPreviewCardKey('watch', mv))"
          >
            <span class="mv-video-card__cover" :class="getMvPreviewCoverClass(mv, getMvPreviewCardKey('watch', mv))">
              <img v-if="mv.coverUrl" :src="mv.coverUrl" :alt="mv.title" loading="lazy" decoding="async" />
              <video
                v-if="isMvPreviewActive(mv, getMvPreviewCardKey('watch', mv)) && mvPreviewState.url"
                ref="mvPreviewVideo"
                class="mv-video-card__preview"
                :class="{ 'is-ready': isMvPreviewReady(mv, getMvPreviewCardKey('watch', mv)) }"
                :src="mvPreviewState.url"
                muted
                autoplay
                loop
                playsinline
                preload="auto"
                disablepictureinpicture
                @loadeddata="handleMvPreviewReady(mv, getMvPreviewCardKey('watch', mv), $event)"
                @canplay="handleMvPreviewReady(mv, getMvPreviewCardKey('watch', mv), $event)"
                @error="handleMvPreviewError(mv, getMvPreviewCardKey('watch', mv), $event)"
              />
              <span
                v-if="isMvPreviewLoading(mv, getMvPreviewCardKey('watch', mv))"
                class="mv-video-card__preview-loading"
                aria-hidden="true"
              >
                <LoaderCircle :size="18" class="mv-spin" />
              </span>
              <em>{{ mv.duration || '--:--' }}</em>
              <span class="mv-video-card__play"><Play :size="17" fill="currentColor" /></span>
            </span>
            <strong>{{ mv.title }}</strong>
            <small>{{ mv.artist }}</small>
          </button>
        </div>
      </section>
    </template>

    <template v-else>
      <header class="mv-page-head">
        <nav class="mv-tabs" aria-label="视频分类">
          <button
            v-for="tab in browseTabs"
            :key="tab.value"
            type="button"
            :class="{ active: activeBrowseTab === tab.value }"
            @click="activeBrowseTab = tab.value"
          >
            {{ tab.label }}
          </button>
        </nav>
      </header>

      <section
        v-if="browseSkeletonVisible"
        class="mv-skeleton"
        aria-busy="true"
        aria-label="正在加载视频内容"
      >
        <div class="mv-skeleton__hero-row">
          <article v-for="item in 3" :key="`mv-hero-skeleton-${item}`" class="mv-skeleton__hero-card">
            <span class="mv-skeleton__pill" />
            <span class="mv-skeleton__line mv-skeleton__line--hero-title" />
            <span class="mv-skeleton__line mv-skeleton__line--hero-meta" />
          </article>
        </div>

        <section v-for="section in 3" :key="`mv-section-skeleton-${section}`" class="mv-skeleton__section">
          <span class="mv-skeleton__title" />
          <div class="mv-card-row">
            <article v-for="item in 5" :key="`mv-card-skeleton-${section}-${item}`" class="mv-skeleton__card">
              <span class="mv-skeleton__cover" />
              <span class="mv-skeleton__line" />
              <span class="mv-skeleton__line mv-skeleton__line--short" />
            </article>
          </div>
        </section>
      </section>

      <template v-else>
        <section v-if="activeBrowseTab === 'recommend'" class="mv-hero-carousel">
          <button
            v-for="mv in heroMvs"
            :key="`hero-${mv.id}`"
            class="mv-hero-card"
            type="button"
            @pointerdown="stopMvPreview(mv, getMvPreviewCardKey('hero', mv))"
            @click="selectMv(mv, { autoplay: true })"
            @mouseenter="queueMvPreview(mv, getMvPreviewCardKey('hero', mv))"
            @mouseleave="stopMvPreview(mv, getMvPreviewCardKey('hero', mv))"
          >
            <img v-if="mv.coverUrl" :src="mv.coverUrl" :alt="mv.title" loading="lazy" decoding="async" />
            <video
              v-if="isMvPreviewActive(mv, getMvPreviewCardKey('hero', mv)) && mvPreviewState.url"
              ref="mvPreviewVideo"
              class="mv-hero-card__preview"
              :class="{ 'is-ready': isMvPreviewReady(mv, getMvPreviewCardKey('hero', mv)) }"
              :src="mvPreviewState.url"
              muted
              autoplay
              loop
              playsinline
              preload="auto"
              disablepictureinpicture
              @loadeddata="handleMvPreviewReady(mv, getMvPreviewCardKey('hero', mv), $event)"
              @canplay="handleMvPreviewReady(mv, getMvPreviewCardKey('hero', mv), $event)"
              @error="handleMvPreviewError(mv, getMvPreviewCardKey('hero', mv), $event)"
            />
            <span
              v-if="isMvPreviewLoading(mv, getMvPreviewCardKey('hero', mv))"
              class="mv-video-card__preview-loading mv-hero-card__preview-loading"
              aria-hidden="true"
            >
              <LoaderCircle :size="18" class="mv-spin" />
            </span>
            <span class="mv-hero-card__shade" />
            <span class="mv-hero-card__label">视频</span>
            <span class="mv-hero-card__caption">
              <strong>{{ mv.title }}</strong>
              <small>{{ mv.artist }}</small>
            </span>
          </button>
        </section>

        <section v-if="errorMessage" class="mv-state mv-state--error">{{ errorMessage }}</section>

        <template v-if="activeBrowseTab === 'recommend'">
          <section v-for="section in browseSections" :key="section.id" class="mv-browse-section">
            <header class="mv-section-head">
              <h2>{{ section.title }}</h2>
              <button v-if="section.moreTarget" type="button" @click="openMore(section.moreTarget)">
                更多 <ChevronRight :size="15" />
              </button>
            </header>
            <div class="mv-card-row">
              <button
                v-for="mv in section.items"
                :key="`${section.id}-${mv.id}`"
                class="mv-video-card"
                type="button"
                @pointerdown="stopMvPreview(mv, getMvPreviewCardKey(section.id, mv))"
                @click="selectMv(mv, { autoplay: true })"
                @mouseenter="queueMvPreview(mv, getMvPreviewCardKey(section.id, mv))"
                @mouseleave="stopMvPreview(mv, getMvPreviewCardKey(section.id, mv))"
              >
                <span class="mv-video-card__cover" :class="getMvPreviewCoverClass(mv, getMvPreviewCardKey(section.id, mv))">
                  <img v-if="mv.coverUrl" :src="mv.coverUrl" :alt="mv.title" loading="lazy" decoding="async" />
                  <video
                    v-if="isMvPreviewActive(mv, getMvPreviewCardKey(section.id, mv)) && mvPreviewState.url"
                    ref="mvPreviewVideo"
                    class="mv-video-card__preview"
                    :class="{ 'is-ready': isMvPreviewReady(mv, getMvPreviewCardKey(section.id, mv)) }"
                    :src="mvPreviewState.url"
                    muted
                    autoplay
                    loop
                    playsinline
                    preload="auto"
                    disablepictureinpicture
                    @loadeddata="handleMvPreviewReady(mv, getMvPreviewCardKey(section.id, mv), $event)"
                    @canplay="handleMvPreviewReady(mv, getMvPreviewCardKey(section.id, mv), $event)"
                    @error="handleMvPreviewError(mv, getMvPreviewCardKey(section.id, mv), $event)"
                  />
                  <span
                    v-if="isMvPreviewLoading(mv, getMvPreviewCardKey(section.id, mv))"
                    class="mv-video-card__preview-loading"
                    aria-hidden="true"
                  >
                    <LoaderCircle :size="18" class="mv-spin" />
                  </span>
                  <span class="mv-video-card__count"><Video :size="12" />{{ mv.playCount }}</span>
                  <span class="mv-video-card__play"><Play :size="17" fill="currentColor" /></span>
                </span>
                <strong>{{ mv.title }}</strong>
                <small>{{ mv.artist }}</small>
              </button>
            </div>
          </section>
        </template>

        <section v-else class="mv-library">
        <div class="mv-filter-panel">
          <div class="mv-filter-group">
            <span>地区</span>
            <button v-for="item in areas" :key="item" type="button" :class="{ active: filters.area === item }" @click="setFilter('area', item)">
              {{ item }}
            </button>
          </div>
          <div class="mv-filter-group">
            <span>类型</span>
            <button v-for="item in types" :key="item" type="button" :class="{ active: filters.type === item }" @click="setFilter('type', item)">
              {{ item }}
            </button>
          </div>
          <div class="mv-filter-group">
            <span>排序</span>
            <button v-for="item in orders" :key="item" type="button" :class="{ active: filters.order === item }" @click="setFilter('order', item)">
              {{ item }}
            </button>
          </div>
        </div>

        <div v-if="filteredLoading && !filteredMvs.length" class="mv-grid mv-grid--skeleton">
          <span v-for="item in 12" :key="item" class="mv-card-skeleton" />
        </div>
        <div
          v-else-if="filteredMvs.length"
          ref="filteredVirtualList"
          class="mv-grid-virtual"
          :style="{ height: `${filteredVirtualTotalHeight}px` }"
        >
          <div
            class="mv-grid-virtual__window"
            :style="{ transform: `translateY(${filteredVirtualOffsetY}px)` }"
          >
            <div
              v-for="row in visibleFilteredMvRows"
              :key="row.key"
              class="mv-grid mv-grid--virtual-row"
            >
              <button
                v-for="mv in row.items"
                :key="`all-${mv.id}`"
                class="mv-video-card"
                type="button"
                @pointerdown="stopMvPreview(mv, getMvPreviewCardKey('library', mv))"
                @click="selectMv(mv, { autoplay: true })"
                @mouseenter="queueMvPreview(mv, getMvPreviewCardKey('library', mv))"
                @mouseleave="stopMvPreview(mv, getMvPreviewCardKey('library', mv))"
              >
                <span class="mv-video-card__cover" :class="getMvPreviewCoverClass(mv, getMvPreviewCardKey('library', mv))">
                  <img v-if="mv.coverUrl" :src="mv.coverUrl" :alt="mv.title" loading="lazy" decoding="async" />
                  <video
                    v-if="isMvPreviewActive(mv, getMvPreviewCardKey('library', mv)) && mvPreviewState.url"
                    ref="mvPreviewVideo"
                    class="mv-video-card__preview"
                    :class="{ 'is-ready': isMvPreviewReady(mv, getMvPreviewCardKey('library', mv)) }"
                    :src="mvPreviewState.url"
                    muted
                    autoplay
                    loop
                    playsinline
                    preload="auto"
                    disablepictureinpicture
                    @loadeddata="handleMvPreviewReady(mv, getMvPreviewCardKey('library', mv), $event)"
                    @canplay="handleMvPreviewReady(mv, getMvPreviewCardKey('library', mv), $event)"
                    @error="handleMvPreviewError(mv, getMvPreviewCardKey('library', mv), $event)"
                  />
                  <span
                    v-if="isMvPreviewLoading(mv, getMvPreviewCardKey('library', mv))"
                    class="mv-video-card__preview-loading"
                    aria-hidden="true"
                  >
                    <LoaderCircle :size="18" class="mv-spin" />
                  </span>
                  <span class="mv-video-card__count"><Video :size="12" />{{ mv.playCount }}</span>
                  <span class="mv-video-card__play"><Play :size="17" fill="currentColor" /></span>
                </span>
                <strong>{{ mv.title }}</strong>
                <small>{{ mv.artist }}</small>
              </button>
            </div>
          </div>
        </div>
        <div v-else class="mv-state">暂无 MV 数据，换个筛选条件试试。</div>

        <div v-if="filteredLoading && filteredMvs.length" class="mv-library__loading" role="status" aria-live="polite">
          <LoaderCircle :size="17" class="mv-spin" />
          <span>加载中</span>
        </div>
        <div v-else-if="filteredMore" ref="filteredLoadMoreTrigger" class="mv-library__sentinel" aria-hidden="true" />
        </section>
      </template>
    </template>

    <CommentModal
      v-model:show="commentState.visible"
      :title="activeMv?.title || 'MV 评论'"
      :subtitle="activeMv?.artist || ''"
      :total="commentState.total"
      :hot-comments="commentState.hotComments"
      :comments="commentState.comments"
      :loading="commentState.loading"
      :error="commentState.error"
      :has-more="commentState.more"
      @load-more="loadMoreComments"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onDeactivated, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Heart,
  LoaderCircle,
  Maximize,
  MessageCircle,
  Pause,
  PictureInPicture2,
  Play,
  RefreshCw,
  Share2,
  SkipBack,
  SkipForward,
  User,
  Video,
  Volume2,
  VolumeX
} from 'lucide-vue-next'
import CommentModal from '../components/CommentModal.vue'
import DanmakuLayer from '../components/DanmakuLayer.vue'
import { useLoadMoreTrigger } from '../composables/useLoadMoreTrigger'
import { useVirtualRows } from '../composables/useVirtualRows'
import {
  getFilteredMvsData,
  getMvCommentsData,
  getMvPlaybackData,
  getMvPlaybackUrlData,
  getVideoCenterData,
  toggleMvLikeData,
  toggleMvSubscribeData
} from '../services/netease'
import { useAuthStore } from '../stores/auth'
import { usePlayerStore } from '../stores/player'
import { createLruCache } from '../utils/lruCache'
import { createKugouMvRouteTarget, createMvRouteQuery as createSharedMvRouteQuery } from '../utils/mv'
import { isAbortError } from '../utils/request'
import { parseDuration } from '../utils/time'
import '../styles/mv.css'

const PAGE_SIZE = 24
const areas = ['全部', '内地', '港台', '欧美', '日本', '韩国']
const types = ['全部', '官方版', '原生', '现场版', '酷狗出品']
const orders = ['上升最快', '最热', '最新']
const browseTabs = [
  { label: '推荐', value: 'recommend' },
  { label: '视频库', value: 'library' }
]

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const player = usePlayerStore()
const message = useMessage()
const viewRoot = ref(null)
const playerSection = ref(null)
const playerStage = ref(null)
const videoElement = ref(null)
const filteredLoadMoreTrigger = ref(null)
const filteredVirtualList = ref(null)
const mvPreviewVideo = ref(null)
const activeBrowseTab = ref('recommend')
const loading = ref(false)
const filteredLoading = ref(false)
const likeLoading = ref(false)
const subscribeLoading = ref(false)
const errorMessage = ref('')
const shouldPlayAfterLoad = ref(false)
const controlsVisible = ref(true)
const qualityMenuVisible = ref(false)
const danmakuEnabled = ref(true)
const activePayload = ref(null)
const recommendedMvs = ref([])
const firstMvs = ref([])
const exclusiveMvs = ref([])
const topMvs = ref([])
const filteredMvs = ref([])
const subscribedMvs = ref([])
const followArtistNewMvs = ref([])
const similarMvs = ref([])
const artistMvs = ref([])
const filteredTotal = ref(0)
const filteredMore = ref(false)
const filteredOffset = ref(0)
const filteredGridColumns = ref(getFilteredGridColumnCount())
const filteredGridRowHeight = ref(FILTERED_GRID_DEFAULT_ROW_HEIGHT)
const filters = reactive({
  area: '全部',
  type: '全部',
  order: '上升最快'
})
const videoState = reactive({
  isPlaying: false,
  isReady: false,
  currentTime: 0,
  duration: 0,
  durationText: '--:--',
  error: '',
  recoverable: false,
  volume: 1,
  muted: false
})
const mvPreviewState = reactive({
  id: '',
  cardKey: '',
  playbackKey: '',
  url: '',
  loading: false,
  ready: false,
  error: ''
})
const commentState = reactive({
  visible: false,
  loading: false,
  error: '',
  hotComments: [],
  comments: [],
  total: 0,
  more: false,
  offset: 0
})
const danmakuCommentState = reactive({
  trackId: '',
  loading: false,
  error: '',
  hotComments: [],
  comments: [],
  total: 0,
  more: false,
  offset: 0
})

let controlsTimer = null
let controlsHideRefreshAt = 0
let danmakuCommentRequestId = 0
let bootRequestId = 0
let bootRequestController = null
let filteredRequestId = 0
let filteredRequestController = null
let playbackRequestId = 0
let playbackRequestController = null
let qualityRequestId = 0
let qualityRequestController = null
let filteredGridMetricsFrame = 0
let nextMvPrefetchTimer = 0
let nextMvPrefetchController = null
let nextMvPrefetchKey = ''
let mvPreviewTimer = 0
let mvPreviewController = null
let mvPreviewElement = null
const nextMvPlaybackUrlCache = createLruCache(8)
const mvPreviewPlaybackUrlCache = createLruCache(18)
const DANMAKU_COMMENT_PAGE_SIZE = 24
const CONTROLS_HIDE_DELAY_MS = 2200
const CONTROLS_HIDE_REFRESH_INTERVAL_MS = 350
const FILTERED_GRID_DEFAULT_ROW_HEIGHT = 230
const FILTERED_GRID_COLUMN_GAP = 18
const FILTERED_GRID_ROW_GAP = 28
const FILTERED_GRID_OVERSCAN_ROWS = 4
const FILTERED_GRID_FALLBACK_ROWS = 8
const NEXT_MV_PREFETCH_DELAY_MS = 700
const MV_CARD_PREVIEW_DELAY_MS = 420
const MV_CARD_PREVIEW_QUALITY = 720

const activeMv = computed(() => activePayload.value?.mv ?? null)
const activeVideoUrl = computed(() => normalizePlayableUrl(activeMv.value?.url))
const isKugouMvRoute = computed(() => route.name === 'kugou-video' || route.meta?.mvPlatform === 'kugou')
const routeMvId = computed(() => normalizeRouteValue(isKugouMvRoute.value ? route.params.id ?? route.query.mvId : route.query.mvId))
const routeMvHash = computed(() => normalizeRouteValue(route.query.mvHash))
const isWatchMode = computed(() => Boolean(routeMvId.value))
const isVideoPlaying = computed(() => videoState.isPlaying)
const progressPercent = computed(() => {
  const duration = videoState.duration || parseDuration(activeMv.value?.duration)
  return duration ? Math.min(100, (videoState.currentTime / duration) * 100) : 0
})
const heroMvs = computed(() =>
  uniqueMvs([...recommendedMvs.value, ...topMvs.value, ...firstMvs.value, ...exclusiveMvs.value]).slice(0, 3)
)
const browseSections = computed(() => [
  { id: 'rank', title: '排行榜', items: topMvs.value },
  { id: 'latest', title: '最新', items: firstMvs.value.slice(0, 5), moreTarget: 'library' },
  { id: 'collection', title: '合集', items: exclusiveMvs.value.slice(0, 5), moreTarget: 'library' },
  { id: 'recommend', title: '推荐', items: recommendedMvs.value.slice(0, 5), moreTarget: 'library' }
].filter((section) => section.items.length))
const browseSkeletonVisible = computed(() =>
  !isWatchMode.value &&
  loading.value &&
  !heroMvs.value.length &&
  !browseSections.value.length &&
  !filteredMvs.value.length
)
const watchRelatedSections = computed(() => [
  ...similarMvs.value,
  ...artistMvs.value,
  ...topMvs.value,
  ...firstMvs.value
])
const watchRelatedMvs = computed(() =>
  uniqueMvs(watchRelatedSections.value).filter((mv) => String(mv.id) !== String(activeMv.value?.id)).slice(0, 5)
)
const playbackQueue = computed(() =>
  uniqueMvs([
    ...filteredMvs.value,
    ...topMvs.value,
    ...firstMvs.value,
    ...recommendedMvs.value,
    ...exclusiveMvs.value,
    ...similarMvs.value,
    ...artistMvs.value
  ])
)
const nextPlaybackCandidate = computed(() => {
  const queue = playbackQueue.value

  if (!activeMv.value?.id || queue.length < 2) {
    return null
  }

  const currentIndex = queue.findIndex((mv) => String(mv.id) === String(activeMv.value.id))

  if (currentIndex < 0) {
    return null
  }

  return queue[(currentIndex + 1) % queue.length] ?? null
})
const qualityOptions = computed(() => {
  const values = extractQualityValues(activeMv.value?.brs)
  const currentQuality = Number(activeMv.value?.urlQuality)

  if (Number.isFinite(currentQuality) && currentQuality > 0) {
    values.push(currentQuality)
  }

  return [...new Set(values.filter(Boolean))].sort((current, next) => next - current)
})
const recoveryQuality = computed(() => {
  const currentQuality = Number(activeMv.value?.urlQuality)
  const qualities = qualityOptions.value.map(Number).filter((quality) => Number.isFinite(quality) && quality > 0)

  if (!qualities.length) {
    return null
  }

  const lowerQuality = qualities.find((quality) => quality < currentQuality)
  return lowerQuality ?? qualities.find((quality) => quality !== currentQuality) ?? null
})
const videoRecoveryVisible = computed(() =>
  Boolean(activeMv.value && videoState.error && videoState.recoverable)
)
const filteredGridRows = computed(() => createMvGridRows(filteredMvs.value, filteredGridColumns.value))
const {
  offsetY: filteredVirtualOffsetY,
  scheduleRangeUpdate: scheduleFilteredVirtualRangeUpdate,
  totalHeight: filteredVirtualTotalHeight,
  updateRange: updateFilteredVirtualRange,
  visibleItems: visibleFilteredMvRows
} = useVirtualRows(filteredGridRows, {
  root: viewRoot,
  list: filteredVirtualList,
  rowHeight: filteredGridRowHeight,
  overscan: FILTERED_GRID_OVERSCAN_ROWS,
  fallbackCount: FILTERED_GRID_FALLBACK_ROWS
})
const filteredLoadMoreController = useLoadMoreTrigger({
  trigger: filteredLoadMoreTrigger,
  canLoad: () =>
    activeBrowseTab.value === 'library' &&
    !isWatchMode.value &&
    !filteredLoading.value &&
    filteredMore.value,
  loadMore: () => loadFiltered(),
  getRoot: () => viewRoot.value,
  rootMargin: '420px 0px 420px',
  scrollThreshold: 320,
  threshold: 0
})
const playbackStatusText = computed(() => {
  if (loading.value) {
    return '加载播放信息'
  }
  if (videoState.error) {
    return videoState.error
  }
  if (videoState.isPlaying) {
    return '正在播放'
  }
  if (activeVideoUrl.value) {
    return videoState.isReady ? '已就绪' : '准备播放'
  }
  return activeMv.value ? '等待播放地址' : '等待 MV'
})

onMounted(() => {
  window.addEventListener('resize', scheduleFilteredGridMetrics, { passive: true })
  scheduleFilteredGridMetrics()
  loadBootData()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', scheduleFilteredGridMetrics)
  cancelFilteredGridMetricsFrame()
  cancelPendingMvRequests()
  releaseActiveVideo()
  clearControlsTimer()
})

onDeactivated(() => {
  cancelPendingMvRequests()
  releaseActiveVideo()
  clearControlsTimer()
})

onBeforeRouteLeave(() => {
  cancelPendingMvRequests()
  releaseActiveVideo()
  clearControlsTimer()
})

watch(
  () => [route.name, route.params.id, route.query.mvId, route.query.mvHash],
  () => {
    const routeMv = getCurrentRouteMv()

    if (routeMv?.id) {
      if (hasActiveRouteMvChanged(routeMv)) {
        selectMv(routeMv, { replace: true, autoplay: true })
      }
      return
    }

    cancelPlaybackRequest()
    cancelQualityRequest()
    releaseActiveVideo()
    resetVideoState()

    if (!isKugouMvRoute.value && !hasBrowseData() && !loading.value) {
      loadBootData()
    }
  }
)

watch(activeBrowseTab, async (tab) => {
  stopMvPreview()

  if (tab !== 'library') {
    return
  }

  await nextTick()
  filteredLoadMoreController.setup()
  scheduleFilteredGridMetrics()
})

watch(
  () => [nextPlaybackCandidate.value?.id, activeMv.value?.urlQuality],
  () => {
    scheduleNextMvPrefetch()
  },
  { flush: 'post' }
)

function handleViewScroll() {
  scheduleFilteredVirtualRangeUpdate()
}

function scheduleFilteredGridMetrics() {
  if (filteredGridMetricsFrame || typeof window === 'undefined') {
    return
  }

  filteredGridMetricsFrame = window.requestAnimationFrame(() => {
    filteredGridMetricsFrame = 0
    updateFilteredGridMetrics()
  })
}

function cancelFilteredGridMetricsFrame() {
  if (!filteredGridMetricsFrame || typeof window === 'undefined') {
    return
  }

  window.cancelAnimationFrame(filteredGridMetricsFrame)
  filteredGridMetricsFrame = 0
}

function updateFilteredGridMetrics() {
  const nextColumns = getFilteredGridColumnCount()
  const columnsChanged = nextColumns !== filteredGridColumns.value
  filteredGridColumns.value = nextColumns

  const firstRow = filteredVirtualList.value?.querySelector('.mv-grid--virtual-row')
  const measuredHeight = columnsChanged || !firstRow
    ? getEstimatedFilteredGridRowHeight()
    : getElementOuterHeight(firstRow)

  if (measuredHeight > 0 && Math.abs(measuredHeight - filteredGridRowHeight.value) > 1) {
    filteredGridRowHeight.value = measuredHeight
  }

  updateFilteredVirtualRange()

  if (columnsChanged) {
    nextTick(scheduleFilteredGridMetrics)
  }
}

function getMvPreviewCardKey(scope, mv = {}) {
  const id = String(mv?.id ?? mv?.hash ?? mv?.mvHash ?? '')
  return `${scope || 'mv'}:${id}`
}

function getMvPreviewPlaybackKey(mv = {}) {
  const source = withCurrentMvPlatform(mv)
  return getMvPlaybackPrefetchKey(source?.id, MV_CARD_PREVIEW_QUALITY, getMvPlaybackPlatform(source))
}

function getMvPreviewCoverClass(mv, cardKey) {
  return {
    'is-previewing': isMvPreviewActive(mv, cardKey),
    'is-preview-loading': isMvPreviewLoading(mv, cardKey),
    'is-preview-ready': isMvPreviewReady(mv, cardKey)
  }
}

function isMvPreviewActive(mv, cardKey) {
  return Boolean(
    cardKey &&
      mvPreviewState.cardKey === cardKey &&
      mvPreviewState.playbackKey === getMvPreviewPlaybackKey(mv)
  )
}

function isMvPreviewLoading(mv, cardKey) {
  return isMvPreviewActive(mv, cardKey) && mvPreviewState.loading
}

function isMvPreviewReady(mv, cardKey) {
  return isMvPreviewActive(mv, cardKey) && mvPreviewState.ready
}

function queueMvPreview(mv, cardKey) {
  if (typeof window === 'undefined') {
    return
  }

  const source = withCurrentMvPlatform(mv)
  const playbackKey = getMvPreviewPlaybackKey(source)

  if (!source?.id || !cardKey || !playbackKey) {
    return
  }

  if (
    mvPreviewState.cardKey === cardKey &&
    mvPreviewState.playbackKey === playbackKey &&
    (mvPreviewState.loading || mvPreviewState.url)
  ) {
    return
  }

  stopMvPreview()

  mvPreviewState.id = String(source.id)
  mvPreviewState.cardKey = cardKey
  mvPreviewState.playbackKey = playbackKey
  mvPreviewState.url = ''
  mvPreviewState.loading = true
  mvPreviewState.ready = false
  mvPreviewState.error = ''

  const cachedPlaybackUrl =
    mvPreviewPlaybackUrlCache.get(playbackKey) ?? nextMvPlaybackUrlCache.get(playbackKey)

  if (cachedPlaybackUrl?.url) {
    applyMvPreviewUrl(cachedPlaybackUrl, playbackKey)
    return
  }

  mvPreviewTimer = window.setTimeout(() => {
    mvPreviewTimer = 0
    loadMvPreview(source, playbackKey)
  }, MV_CARD_PREVIEW_DELAY_MS)
}

async function loadMvPreview(source, playbackKey) {
  if (!source?.id || mvPreviewState.playbackKey !== playbackKey) {
    return
  }

  const controller = new AbortController()
  mvPreviewController = controller

  try {
    const playbackUrl = await getMvPlaybackUrlData(
      source.id,
      MV_CARD_PREVIEW_QUALITY,
      source,
      { signal: controller.signal }
    )

    if (controller.signal.aborted || mvPreviewState.playbackKey !== playbackKey) {
      return
    }

    if (playbackUrl?.url) {
      mvPreviewPlaybackUrlCache.set(playbackKey, playbackUrl)
      applyMvPreviewUrl(playbackUrl, playbackKey)
    } else {
      markMvPreviewError(playbackKey)
    }
  } catch (error) {
    if (!isAbortError(error)) {
      console.debug('Failed to load MV card preview:', error)
      markMvPreviewError(playbackKey)
    }
  } finally {
    if (mvPreviewController === controller) {
      mvPreviewController = null
    }
  }
}

function applyMvPreviewUrl(playbackUrl, playbackKey) {
  if (mvPreviewState.playbackKey !== playbackKey) {
    return
  }

  const url = normalizePlayableUrl(playbackUrl?.url)

  if (!url) {
    markMvPreviewError(playbackKey)
    return
  }

  mvPreviewState.url = url
  mvPreviewState.loading = true
  mvPreviewState.ready = false
  mvPreviewState.error = ''
  nextTick(() => playMvPreviewVideo(playbackKey))
}

function handleMvPreviewReady(mv, cardKey, event) {
  if (!isMvPreviewActive(mv, cardKey)) {
    return
  }

  mvPreviewElement = event?.target ?? mvPreviewElement
  mvPreviewState.loading = false
  mvPreviewState.ready = true
  playMvPreviewVideo(mvPreviewState.playbackKey)
}

function handleMvPreviewError(mv, cardKey, event) {
  const video = event?.target

  if (video && !video.currentSrc && !video.src) {
    return
  }

  if (isMvPreviewActive(mv, cardKey)) {
    markMvPreviewError(mvPreviewState.playbackKey)
  }
}

async function playMvPreviewVideo(playbackKey) {
  await nextTick()

  if (mvPreviewState.playbackKey !== playbackKey || !mvPreviewState.url) {
    return
  }

  const video = getMvPreviewVideoElement()

  if (!video) {
    return
  }

  mvPreviewElement = video
  video.muted = true
  video.volume = 0

  try {
    await video.play()
  } catch (error) {
    if (mvPreviewState.playbackKey === playbackKey) {
      mvPreviewState.loading = false
    }
  }
}

function getMvPreviewVideoElement() {
  return Array.isArray(mvPreviewVideo.value)
    ? mvPreviewVideo.value.find(Boolean) ?? null
    : mvPreviewVideo.value
}

function markMvPreviewError(playbackKey) {
  if (mvPreviewState.playbackKey !== playbackKey) {
    return
  }

  mvPreviewState.loading = false
  mvPreviewState.ready = false
  mvPreviewState.error = 'preview-failed'
}

function stopMvPreview(mv = null, cardKey = '') {
  if (mv && cardKey && !isMvPreviewActive(mv, cardKey)) {
    return
  }

  cancelMvPreviewTimer()

  if (mvPreviewController) {
    mvPreviewController.abort()
    mvPreviewController = null
  }

  releaseMvPreviewVideo()
  resetMvPreviewState()
}

function cancelMvPreviewTimer() {
  if (mvPreviewTimer && typeof window !== 'undefined') {
    window.clearTimeout(mvPreviewTimer)
    mvPreviewTimer = 0
  }
}

function releaseMvPreviewVideo() {
  const video = mvPreviewElement ?? getMvPreviewVideoElement()

  if (!video) {
    mvPreviewElement = null
    return
  }

  try {
    if (!video.paused) {
      video.pause()
    }

    video.removeAttribute('src')
    video.load()
  } catch (error) {
    console.debug('Failed to release MV card preview:', error)
  } finally {
    mvPreviewElement = null
  }
}

function resetMvPreviewState() {
  mvPreviewState.id = ''
  mvPreviewState.cardKey = ''
  mvPreviewState.playbackKey = ''
  mvPreviewState.url = ''
  mvPreviewState.loading = false
  mvPreviewState.ready = false
  mvPreviewState.error = ''
}

function scheduleNextMvPrefetch() {
  const candidate = withCurrentMvPlatform(nextPlaybackCandidate.value)
  const quality = getPreferredMvPlaybackQuality()
  const key = getMvPlaybackPrefetchKey(candidate?.id, quality, getMvPlaybackPlatform(candidate))

  if (!candidate?.id || !key) {
    cancelNextMvPrefetch()
    return
  }

  if (nextMvPlaybackUrlCache.has(key)) {
    if (nextMvPrefetchKey && nextMvPrefetchKey !== key) {
      cancelNextMvPrefetch()
    }
    return
  }

  if (nextMvPrefetchKey === key) {
    return
  }

  cancelNextMvPrefetch()

  if (typeof window === 'undefined') {
    return
  }

  nextMvPrefetchKey = key
  nextMvPrefetchTimer = window.setTimeout(() => {
    nextMvPrefetchTimer = 0
    prefetchNextMvPlayback(candidate, quality, key)
  }, NEXT_MV_PREFETCH_DELAY_MS)
}

function cancelNextMvPrefetch() {
  if (nextMvPrefetchTimer && typeof window !== 'undefined') {
    window.clearTimeout(nextMvPrefetchTimer)
    nextMvPrefetchTimer = 0
  }

  if (nextMvPrefetchController) {
    nextMvPrefetchController.abort()
    nextMvPrefetchController = null
  }

  nextMvPrefetchKey = ''
}

async function prefetchNextMvPlayback(candidate, quality, key) {
  if (!candidate?.id || !key || nextMvPlaybackUrlCache.has(key)) {
    nextMvPrefetchKey = ''
    return
  }

  const controller = new AbortController()
  nextMvPrefetchController = controller

  try {
    const playbackUrl = await getMvPlaybackUrlData(candidate.id, quality, candidate, {
      signal: controller.signal
    })

    if (!controller.signal.aborted && playbackUrl?.url) {
      nextMvPlaybackUrlCache.set(key, playbackUrl)
      prefetchMvPoster(candidate.coverUrl)
    }
  } catch (error) {
    if (!isAbortError(error)) {
      console.debug('Failed to prefetch next MV playback:', error)
    }
  } finally {
    if (nextMvPrefetchController === controller) {
      nextMvPrefetchController = null
    }

    if (nextMvPrefetchKey === key) {
      nextMvPrefetchKey = ''
    }
  }
}

function cancelPendingMvRequests() {
  cancelBootRequest()
  cancelFilteredRequest()
  cancelPlaybackRequest()
  cancelQualityRequest()
  cancelNextMvPrefetch()
  stopMvPreview()
  danmakuCommentRequestId += 1
}

function cancelBootRequest() {
  bootRequestId += 1

  if (bootRequestController) {
    bootRequestController.abort()
    bootRequestController = null
  }

  loading.value = false
}

function cancelFilteredRequest() {
  filteredRequestId += 1

  if (filteredRequestController) {
    filteredRequestController.abort()
    filteredRequestController = null
  }

  filteredLoading.value = false
}

function cancelPlaybackRequest() {
  playbackRequestId += 1

  if (playbackRequestController) {
    playbackRequestController.abort()
    playbackRequestController = null
  }

  loading.value = false
}

function cancelQualityRequest() {
  qualityRequestId += 1

  if (qualityRequestController) {
    qualityRequestController.abort()
    qualityRequestController = null
  }

  loading.value = false
}

function normalizeRouteValue(value) {
  const firstValue = Array.isArray(value) ? value[0] : value

  return firstValue === undefined || firstValue === null || firstValue === '' ? '' : String(firstValue)
}

function getCurrentRouteMv() {
  if (!routeMvId.value) {
    return null
  }

  return withCurrentMvPlatform({
    id: routeMvId.value,
    ...(routeMvHash.value ? { hash: routeMvHash.value, mvHash: routeMvHash.value } : {})
  })
}

function hasActiveRouteMvChanged(routeMv = {}) {
  if (!activeMv.value?.id) {
    return true
  }

  if (String(routeMv.id) !== String(activeMv.value.id)) {
    return true
  }

  const routeHash = routeMv.hash || routeMv.mvHash || ''
  const activeHash = activeMv.value.hash || activeMv.value.mvHash || ''

  if (routeHash && String(routeHash) !== String(activeHash)) {
    return true
  }

  return getMvPlaybackPlatform(routeMv, { includeRoute: false }) !== getMvPlaybackPlatform(activeMv.value, { includeRoute: false })
}

function withCurrentMvPlatform(mv = {}) {
  if (!mv || typeof mv !== 'object') {
    return mv
  }

  return getMvPlaybackPlatform(mv) === 'kugou' ? markKugouMv(mv) : mv
}

function normalizePlaybackPayload(data = {}, sourceMv = {}) {
  if (getMvPlaybackPlatform(sourceMv, { includeRoute: false }) !== 'kugou') {
    return data
  }

  return {
    ...data,
    mv: markKugouMv(data.mv ?? sourceMv),
    similar: (data.similar ?? []).map(markKugouMv),
    artistMvs: (data.artistMvs ?? []).map(markKugouMv)
  }
}

function markKugouMv(mv = {}) {
  if (!mv || typeof mv !== 'object') {
    return mv
  }

  return {
    ...mv,
    platform: 'kugou',
    sourcePlatform: 'kugou'
  }
}

function getMvPlaybackPlatform(mv = {}, { includeRoute = true } = {}) {
  if (mv?.platform === 'kugou' || mv?.sourcePlatform === 'kugou') {
    return 'kugou'
  }

  return includeRoute && isKugouMvRoute.value ? 'kugou' : 'netease'
}

function createMvRouteTarget(mv = {}) {
  const source = withCurrentMvPlatform(mv)
  const routeMeta = {
    mvId: source?.id,
    mvHash: source?.hash || source?.mvHash
  }

  if (getMvPlaybackPlatform(source, { includeRoute: false }) === 'kugou') {
    return createKugouMvRouteTarget(routeMeta, source)
  }

  const query = createSharedMvRouteQuery(routeMeta, source)

  return query ? { name: 'video', query } : { name: 'video' }
}

function hasBrowseData() {
  return Boolean(
    recommendedMvs.value.length ||
      firstMvs.value.length ||
      exclusiveMvs.value.length ||
      topMvs.value.length ||
      filteredMvs.value.length
  )
}

async function loadBootData() {
  cancelBootRequest()
  const requestId = ++bootRequestId
  const controller = new AbortController()
  bootRequestController = controller
  loading.value = true
  errorMessage.value = ''

  try {
    const initialRouteMv = getCurrentRouteMv()

    if (initialRouteMv?.id) {
      await selectMv(initialRouteMv, { replace: true, silent: true, autoplay: true })
      return
    }

    const data = await getVideoCenterData({
      area: filters.area,
      type: filters.type,
      order: filters.order,
      limit: PAGE_SIZE,
      offset: 0
    }, {
      signal: controller.signal
    })

    if (requestId !== bootRequestId || controller.signal.aborted) {
      return
    }

    recommendedMvs.value = data.recommended
    firstMvs.value = data.first
    exclusiveMvs.value = data.exclusive
    topMvs.value = data.top
    filteredMvs.value = data.all
    subscribedMvs.value = data.subscribed
    followArtistNewMvs.value = data.followArtistNew
    filteredTotal.value = data.total
    filteredMore.value = data.more
    filteredOffset.value = data.all.length
    await nextTick()
    scheduleFilteredGridMetrics()

    const routeMv = getCurrentRouteMv()
    if (routeMv?.id && hasActiveRouteMvChanged(routeMv)) {
      await selectMv(routeMv, { replace: true, silent: true, autoplay: true })
    } else if (data.active?.mv) {
      setActivePayload(data.active)
    }
  } catch (error) {
    if (isAbortError(error) || requestId !== bootRequestId) {
      return
    }

    console.warn('Failed to load MV center:', error)
    errorMessage.value = error?.message || 'MV 内容加载失败'
    message.error(errorMessage.value)
  } finally {
    if (requestId === bootRequestId && !controller.signal.aborted) {
      loading.value = false
    }

    if (bootRequestController === controller) {
      bootRequestController = null
    }
  }
}

async function setFilter(key, value) {
  if (filters[key] === value) {
    return
  }

  filters[key] = value
  await reloadFiltered()
}

function openMore(tab) {
  activeBrowseTab.value = tab
}

async function reloadFiltered() {
  stopMvPreview()
  filteredLoadMoreController.cleanup()
  cancelFilteredRequest()
  filteredOffset.value = 0
  filteredMvs.value = []
  updateFilteredVirtualRange()
  await loadFiltered({ reset: true })
}

async function loadFiltered({ reset = false } = {}) {
  if (filteredLoading.value) {
    return
  }

  const requestId = ++filteredRequestId
  const controller = new AbortController()
  filteredRequestController = controller
  const requestOffset = reset ? 0 : filteredOffset.value
  filteredLoading.value = true

  try {
    const data = await getFilteredMvsData({
      area: filters.area,
      type: filters.type,
      order: filters.order,
      limit: PAGE_SIZE,
      offset: requestOffset
    }, {
      signal: controller.signal
    })

    if (requestId !== filteredRequestId || controller.signal.aborted) {
      return
    }

    const previousMvCount = filteredMvs.value.length

    filteredMvs.value = reset ? data.items : uniqueMvs([...filteredMvs.value, ...data.items])
    filteredTotal.value = data.total
    filteredMore.value = Boolean(
      data.more &&
      data.items.length &&
      (reset || filteredMvs.value.length > previousMvCount)
    )
    filteredOffset.value = filteredMvs.value.length
    await nextTick()
    scheduleFilteredGridMetrics()
  } catch (error) {
    if (isAbortError(error) || requestId !== filteredRequestId) {
      return
    }

    console.warn('Failed to load filtered MVs:', error)
    message.error(error?.message || '筛选 MV 加载失败')
  } finally {
    if (requestId === filteredRequestId && !controller.signal.aborted) {
      filteredLoading.value = false
    }

    if (filteredRequestController === controller) {
      filteredRequestController = null
    }
  }

  if (requestId === filteredRequestId && !controller.signal.aborted && activeBrowseTab.value === 'library') {
    await nextTick()
    filteredLoadMoreController.setup()
  }
}

async function selectMv(mv, options = {}) {
  const sourceMv = withCurrentMvPlatform(mv)
  const id = sourceMv?.id
  if (!id) {
    return
  }

  stopMvPreview()
  cancelPlaybackRequest()
  cancelQualityRequest()
  const requestId = ++playbackRequestId
  const controller = new AbortController()
  playbackRequestController = controller
  loading.value = true
  errorMessage.value = ''
  releaseActiveVideo()
  resetVideoState()
  shouldPlayAfterLoad.value = Boolean(options.autoplay)
  setActivePayload(createPendingPlaybackPayload(sourceMv))

  try {
    if (!options.replace) {
      await router.replace(createMvRouteTarget(sourceMv))
    }
    if (!options.silent) {
      scrollToPlayer()
    }

    const quality = options.quality || 1080
    const prefetchedPlaybackUrl = getCachedMvPlaybackUrl(id, quality, sourceMv)
    const applyDetailPayload = (detailData) => {
      if (requestId !== playbackRequestId || controller.signal.aborted) {
        return
      }

      setActivePayload(normalizePlaybackPayload(detailData, sourceMv))
    }
    const data = await getMvPlaybackData(id, quality, {
      signal: controller.signal,
      onDetail: applyDetailPayload
    }, prefetchedPlaybackUrl, sourceMv)

    if (requestId !== playbackRequestId || controller.signal.aborted) {
      return
    }

    const payload = normalizePlaybackPayload(data, sourceMv)
    setActivePayload(payload)
    if (!options.replace) {
      router.replace(createMvRouteTarget(payload.mv ?? sourceMv))
    }
    await nextTick()
    applyVideoVolume()
    if (options.autoplay) {
      await playActiveMv({ skipScroll: true })
    }
  } catch (error) {
    if (isAbortError(error) || requestId !== playbackRequestId) {
      return
    }

    console.warn('Failed to load MV playback:', error)
    errorMessage.value = error?.message || 'MV 播放信息加载失败'
    message.error(errorMessage.value)
  } finally {
    if (requestId === playbackRequestId && !controller.signal.aborted) {
      loading.value = false
    }

    if (playbackRequestController === controller) {
      playbackRequestController = null
    }
  }
}

function createPendingPlaybackPayload(sourceMv = {}) {
  const title = sourceMv.title || sourceMv.name || 'MV 播放'

  return {
    mv: {
      ...sourceMv,
      title,
      name: sourceMv.name || title,
      artist: sourceMv.artist || '未知艺人',
      description: sourceMv.description || sourceMv.desc || '',
      stats: sourceMv.stats ?? {},
      encyclopedia: sourceMv.encyclopedia ?? {}
    },
    similar: [],
    artistMvs: [],
    comments: {
      hotComments: [],
      comments: [],
      total: 0,
      more: false
    }
  }
}

function setActivePayload(data) {
  activePayload.value = data
  similarMvs.value = data.similar ?? []
  artistMvs.value = data.artistMvs ?? []
  commentState.hotComments = data.comments?.hotComments ?? []
  commentState.comments = data.comments?.comments ?? []
  commentState.total = data.comments?.total ?? 0
  commentState.more = data.comments?.more ?? false
  commentState.offset = commentState.comments.length
  commentState.error = ''
  resetDanmakuCommentStream(data.mv?.id, data.comments)
}

async function toggleActivePlayback() {
  if (videoState.isPlaying) {
    pauseActiveVideo()
    return
  }

  await playActiveMv()
}

async function playActiveMv({ skipScroll = false } = {}) {
  if (!activeMv.value?.id) {
    return false
  }

  if (!skipScroll) {
    scrollToPlayer()
  }

  videoState.error = ''
  videoState.recoverable = false
  shouldPlayAfterLoad.value = true

  if (!activeVideoUrl.value) {
    await reloadActiveMv({ autoplay: true })
    return false
  }

  await nextTick()
  const video = videoElement.value
  if (!video) {
    return false
  }

  try {
    if (player.state.isPlaying) {
      await player.togglePlay()
    }
    applyVideoVolume()
    await video.play()
    shouldPlayAfterLoad.value = false
    showControls()
    return true
  } catch (error) {
    console.warn('Failed to play MV:', error)
    videoState.error = '浏览器阻止自动播放，请点击播放'
    videoState.recoverable = false
    return false
  }
}

async function reloadActiveMv(options = {}) {
  if (activeMv.value?.id) {
    await selectMv(activeMv.value, { replace: true, ...options })
  }
}

async function retryActiveMvPlayback() {
  const quality = Number(activeMv.value?.urlQuality) || Number(qualityOptions.value[0]) || 1080
  await applyActiveMvPlaybackUrl({
    quality,
    autoplay: true,
    resumeAt: videoState.currentTime,
    failureMessage: '播放地址刷新失败'
  })
}

async function selectQuality(quality, options = {}) {
  qualityMenuVisible.value = false
  if (!activeMv.value?.id || (!options.force && Number(activeMv.value.urlQuality) === Number(quality))) {
    return
  }

  await applyActiveMvPlaybackUrl({
    quality,
    autoplay: options.autoplay ?? videoState.isPlaying,
    resumeAt: options.resumeAt ?? videoState.currentTime,
    failureMessage: '清晰度切换失败'
  })
}

async function applyActiveMvPlaybackUrl({
  quality = 1080,
  autoplay = false,
  resumeAt = 0,
  failureMessage = '播放地址加载失败'
} = {}) {
  if (!activeMv.value?.id) {
    return false
  }

  cancelQualityRequest()
  const requestId = ++qualityRequestId
  const controller = new AbortController()
  qualityRequestController = controller
  const currentMv = withCurrentMvPlatform(activeMv.value)
  loading.value = true
  videoState.error = ''
  videoState.recoverable = false

  try {
    const playbackUrl = await getMvPlaybackUrlData(currentMv.id, quality, currentMv, {
      signal: controller.signal
    })

    if (
      requestId !== qualityRequestId ||
      controller.signal.aborted ||
      String(activeMv.value?.id ?? '') !== String(currentMv.id)
    ) {
      return
    }

    releaseActiveVideo()
    resetVideoState()
    activePayload.value = {
      ...activePayload.value,
      mv: {
        ...currentMv,
        url: playbackUrl.url,
        urlQuality: playbackUrl.quality
      }
    }

    await nextTick()

    if (videoElement.value && resumeAt > 0) {
      videoElement.value.currentTime = resumeAt
      videoState.currentTime = resumeAt
    }

    if (autoplay) {
      await playActiveMv({ skipScroll: true })
    }

    return true
  } catch (error) {
    if (isAbortError(error) || requestId !== qualityRequestId) {
      return false
    }

    console.warn('Failed to refresh MV playback url:', error)
    videoState.error = failureMessage
    videoState.recoverable = true
    message.error(error?.message || failureMessage)
    return false
  } finally {
    if (requestId === qualityRequestId && !controller.signal.aborted) {
      loading.value = false
    }

    if (qualityRequestController === controller) {
      qualityRequestController = null
    }
  }
}

function openActiveVideoExternally() {
  if (!activeVideoUrl.value) {
    return
  }

  const opened = window.open(activeVideoUrl.value, '_blank', 'noopener,noreferrer')

  if (!opened) {
    message.warning('外部窗口打开失败，可以先下载或复制页面链接')
  }
}

function pauseActiveVideo() {
  const video = videoElement.value
  if (video && !video.paused) {
    video.pause()
  }
  videoState.isPlaying = false
}

function releaseActiveVideo() {
  const video = videoElement.value
  shouldPlayAfterLoad.value = false

  if (!video) {
    videoState.isPlaying = false
    return
  }

  if (typeof document !== 'undefined' && document.pictureInPictureElement === video) {
    document.exitPictureInPicture().catch(() => {})
  }

  if (!video.paused) {
    video.pause()
  }

  video.removeAttribute('src')
  video.load()
  videoState.isPlaying = false
  videoState.isReady = false
}

function playRelativeMv(offset) {
  const queue = playbackQueue.value
  if (!queue.length) {
    return
  }

  const currentIndex = Math.max(0, queue.findIndex((mv) => String(mv.id) === String(activeMv.value?.id)))
  const nextIndex = (currentIndex + offset + queue.length) % queue.length
  selectMv(queue[nextIndex], { autoplay: true, quality: getPreferredMvPlaybackQuality() })
}

function handleVideoMetadata(event) {
  const video = event.target
  const duration = Number.isFinite(video.duration) ? video.duration : parseDuration(activeMv.value?.duration)
  videoState.isReady = true
  videoState.duration = duration
  videoState.durationText = formatVideoClock(duration)
  applyVideoVolume()

  if (shouldPlayAfterLoad.value) {
    playActiveMv({ skipScroll: true })
  }
}

function handleVideoTimeUpdate(event) {
  videoState.currentTime = Number.isFinite(event.target.currentTime) ? event.target.currentTime : 0
}

function handleVideoPlay() {
  videoState.isPlaying = true
  videoState.error = ''
  videoState.recoverable = false
  if (player.state.isPlaying) {
    player.togglePlay()
  }
  hideControlsSoon()
}

function handleVideoPause() {
  videoState.isPlaying = false
  showControls()
}

function handleVideoEnded() {
  videoState.isPlaying = false
  playRelativeMv(1)
}

function handleVideoError(event) {
  if (event?.target && !event.target.currentSrc && !event.target.src) {
    return
  }

  videoState.isPlaying = false
  videoState.error = getVideoElementErrorMessage(event?.target?.error)
  videoState.recoverable = true
  showControls()
}

function seekFromProgress(event) {
  const video = videoElement.value
  const duration = videoState.duration || video?.duration || 0
  if (!video || !duration) {
    return
  }

  const rect = event.currentTarget.getBoundingClientRect()
  const percent = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  const nextTime = duration * percent
  video.currentTime = nextTime
  videoState.currentTime = nextTime
}

function setVolume(event) {
  videoState.volume = Number(event.target.value)
  videoState.muted = videoState.volume === 0
  applyVideoVolume()
}

function toggleMute() {
  videoState.muted = !videoState.muted
  applyVideoVolume()
}

function applyVideoVolume() {
  const video = videoElement.value
  if (!video) {
    return
  }

  video.volume = Math.min(1, Math.max(0, videoState.volume))
  video.muted = videoState.muted
}

function toggleDanmaku() {
  danmakuEnabled.value = !danmakuEnabled.value

  if (danmakuEnabled.value) {
    loadMoreDanmakuComments()
  }
}

async function togglePictureInPicture() {
  const video = videoElement.value
  if (!video || !document.pictureInPictureEnabled) {
    message.warning('当前浏览器不支持画中画')
    return
  }

  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture()
    } else {
      await video.requestPictureInPicture()
    }
  } catch (error) {
    console.warn('Failed to toggle picture in picture:', error)
    message.error('画中画打开失败')
  }
}

async function toggleFullscreen() {
  const target = playerStage.value
  if (!target) {
    return
  }

  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await target.requestFullscreen()
    }
  } catch (error) {
    console.warn('Failed to toggle fullscreen:', error)
    message.error('全屏打开失败')
  }
}

function handleStagePointerMove() {
  showControls({ throttle: true })
}

function showControls({ throttle = false } = {}) {
  const now = Date.now()
  controlsVisible.value = true

  if (throttle && now - controlsHideRefreshAt < CONTROLS_HIDE_REFRESH_INTERVAL_MS) {
    return
  }

  hideControlsSoon(now)
}

function hideControlsSoon(refreshAt = Date.now()) {
  const requestedAt = typeof refreshAt === 'number' ? refreshAt : Date.now()
  clearControlsTimer()
  if (!videoState.isPlaying) {
    return
  }
  controlsHideRefreshAt = requestedAt
  controlsTimer = window.setTimeout(() => {
    controlsVisible.value = false
  }, CONTROLS_HIDE_DELAY_MS)
}

function clearControlsTimer() {
  if (controlsTimer) {
    window.clearTimeout(controlsTimer)
    controlsTimer = null
  }
  controlsHideRefreshAt = 0
}

function backToBrowse() {
  stopMvPreview()
  releaseActiveVideo()
  resetVideoState()
  router.replace({ name: 'video' })
}

async function toggleLike() {
  if (!activeMv.value) {
    return
  }

  if (!auth.state.isLoggedIn) {
    auth.openLoginModal()
    return
  }

  likeLoading.value = true
  const nextLiked = !activeMv.value.stats?.liked

  try {
    await toggleMvLikeData({ id: activeMv.value.id, like: nextLiked })
    activePayload.value = {
      ...activePayload.value,
      mv: {
        ...activeMv.value,
        stats: {
          ...(activeMv.value.stats ?? {}),
          liked: nextLiked,
          likedCount: Math.max(0, (activeMv.value.stats?.likedCount ?? 0) + (nextLiked ? 1 : -1))
        }
      }
    }
    message.success(nextLiked ? '已点赞 MV' : '已取消点赞')
  } catch (error) {
    console.warn('Failed to toggle MV like:', error)
    message.error(error?.message || '点赞状态同步失败')
  } finally {
    likeLoading.value = false
  }
}

async function toggleSubscribe() {
  if (!activeMv.value) {
    return
  }

  if (!auth.state.isLoggedIn) {
    auth.openLoginModal()
    return
  }

  subscribeLoading.value = true
  const nextSubed = !activeMv.value.subed

  try {
    await toggleMvSubscribeData({ id: activeMv.value.id, subscribe: nextSubed })
    activePayload.value = {
      ...activePayload.value,
      mv: {
        ...activeMv.value,
        subed: nextSubed
      }
    }
    message.success(nextSubed ? '已收藏 MV' : '已取消收藏')
  } catch (error) {
    console.warn('Failed to toggle MV subscription:', error)
    message.error(error?.message || '收藏状态同步失败')
  } finally {
    subscribeLoading.value = false
  }
}

function downloadActiveMv() {
  if (!activeVideoUrl.value) {
    return
  }

  const link = document.createElement('a')
  link.href = activeVideoUrl.value
  link.download = `${activeMv.value.title || 'mv'}.mp4`
  link.target = '_blank'
  link.rel = 'noopener'
  link.click()
}

async function shareActiveMv() {
  if (!activeMv.value) {
    return
  }

  try {
    await navigator.clipboard.writeText(window.location.href)
    message.success('MV 链接已复制')
  } catch {
    message.warning('复制失败，可以从地址栏手动复制')
  }
}

function openComments() {
  commentState.visible = true
}

async function loadMoreComments() {
  if (!activeMv.value || commentState.loading || !commentState.more) {
    return
  }

  commentState.loading = true
  commentState.error = ''

  try {
    const data = await getMvCommentsData({
      id: activeMv.value.id,
      limit: 20,
      offset: commentState.offset
    })
    commentState.comments = [...commentState.comments, ...data.comments]
    commentState.total = data.total
    commentState.more = data.more
    commentState.offset = commentState.comments.length
  } catch (error) {
    console.warn('Failed to load MV comments:', error)
    commentState.error = error?.message || '评论加载失败'
  } finally {
    commentState.loading = false
  }
}

function resetDanmakuCommentStream(trackId = activeMv.value?.id, data = null) {
  const id = String(trackId ?? '')

  danmakuCommentRequestId += 1
  danmakuCommentState.trackId = id
  danmakuCommentState.loading = false
  danmakuCommentState.error = ''
  danmakuCommentState.hotComments = data?.hotComments ?? []
  danmakuCommentState.comments = data?.comments ?? []
  danmakuCommentState.total = data?.total ?? 0
  danmakuCommentState.offset = data?.comments?.length ?? 0
  danmakuCommentState.more = Boolean(id && (data?.more ?? true))
}

async function loadMoreDanmakuComments() {
  const id = String(activeMv.value?.id ?? danmakuCommentState.trackId ?? '')

  if (
    !id ||
    !danmakuEnabled.value ||
    danmakuCommentState.loading ||
    !danmakuCommentState.more ||
    String(danmakuCommentState.trackId) !== id
  ) {
    return
  }

  const requestId = ++danmakuCommentRequestId
  danmakuCommentState.loading = true
  danmakuCommentState.error = ''

  try {
    const data = await getMvCommentsData({
      id,
      limit: DANMAKU_COMMENT_PAGE_SIZE,
      offset: danmakuCommentState.offset
    })

    if (requestId !== danmakuCommentRequestId || id !== String(activeMv.value?.id ?? '')) {
      return
    }

    danmakuCommentState.hotComments = danmakuCommentState.offset === 0 ? data.hotComments : []
    danmakuCommentState.comments = data.comments
    danmakuCommentState.total = data.total
    danmakuCommentState.offset += data.comments.length
    danmakuCommentState.more = Boolean(data.more && data.comments.length)
  } catch (error) {
    if (requestId === danmakuCommentRequestId) {
      console.warn('Failed to load MV danmaku comments:', error)
      danmakuCommentState.error = error?.message || '弹幕评论加载失败'
      danmakuCommentState.more = false
    }
  } finally {
    if (requestId === danmakuCommentRequestId) {
      danmakuCommentState.loading = false
    }
  }
}

function resetVideoState() {
  videoState.isPlaying = false
  videoState.isReady = false
  videoState.currentTime = 0
  videoState.duration = 0
  videoState.durationText = '--:--'
  videoState.error = ''
  videoState.recoverable = false
  controlsVisible.value = true
}

function scrollToPlayer() {
  nextTick(() => {
    playerSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function extractQualityValues(brs) {
  if (!brs) {
    return []
  }

  if (Array.isArray(brs)) {
    return brs
      .map((item) => Number(item?.br ?? item?.r ?? item?.quality ?? item))
      .filter((item) => Number.isFinite(item) && item > 0)
  }

  return Object.keys(brs)
    .map(Number)
    .filter((item) => Number.isFinite(item) && item > 0)
}

function normalizePlayableUrl(url) {
  if (typeof url !== 'string') {
    return ''
  }

  const value = url.trim()

  if (!value) {
    return ''
  }

  return value.startsWith('//') ? `https:${value}` : value
}

function getPreferredMvPlaybackQuality() {
  return Number(activeMv.value?.urlQuality) || Number(qualityOptions.value[0]) || 1080
}

function getMvPlaybackPrefetchKey(id, quality = 1080, platform = 'netease') {
  const normalizedId = String(id ?? '')

  if (!normalizedId) {
    return ''
  }

  return `${platform || 'netease'}:${normalizedId}:${Number(quality) || 1080}`
}

function getCachedMvPlaybackUrl(id, quality = 1080, mv = {}) {
  const key = getMvPlaybackPrefetchKey(id, quality, getMvPlaybackPlatform(mv))
  return nextMvPlaybackUrlCache.get(key) ?? mvPreviewPlaybackUrlCache.get(key) ?? null
}

function prefetchMvPoster(coverUrl) {
  if (!coverUrl || typeof Image === 'undefined') {
    return
  }

  const image = new Image()
  image.decoding = 'async'
  image.src = coverUrl
}

function getVideoElementErrorMessage(error) {
  switch (error?.code) {
    case 2:
      return '视频网络加载失败'
    case 3:
      return '视频解码失败'
    case 4:
      return '当前播放地址不可用'
    case 1:
      return '视频加载已中断'
    default:
      return '视频播放失败'
  }
}

function createMvGridRows(items = [], columns = 1) {
  const normalizedColumns = Math.max(1, Number(columns) || 1)
  const rows = []

  for (let index = 0; index < items.length; index += normalizedColumns) {
    const rowItems = items.slice(index, index + normalizedColumns)
    rows.push({
      key: rowItems.map((item) => item.id).join('-') || `mv-row-${index}`,
      items: rowItems
    })
  }

  return rows
}

function getFilteredGridColumnCount() {
  if (typeof window === 'undefined') {
    return 5
  }

  if (window.innerWidth <= 1240) {
    return 3
  }

  if (window.innerWidth <= 1500) {
    return 4
  }

  return 5
}

function getEstimatedFilteredGridRowHeight() {
  const listWidth = filteredVirtualList.value?.clientWidth || viewRoot.value?.clientWidth || 0
  const columns = Math.max(1, filteredGridColumns.value)

  if (!listWidth) {
    return FILTERED_GRID_DEFAULT_ROW_HEIGHT
  }

  const cardWidth = (listWidth - FILTERED_GRID_COLUMN_GAP * (columns - 1)) / columns
  const coverHeight = Math.max(0, cardWidth) * 9 / 16

  return Math.ceil(coverHeight + 42 + FILTERED_GRID_ROW_GAP)
}

function getElementOuterHeight(element) {
  const styles = window.getComputedStyle(element)
  const marginBottom = Number.parseFloat(styles.marginBottom) || 0

  return Math.ceil(element.getBoundingClientRect().height + marginBottom)
}

function uniqueMvs(items = []) {
  const seen = new Set()
  return items.filter((item) => {
    const id = String(item?.id ?? '')
    if (!id || seen.has(id)) {
      return false
    }
    seen.add(id)
    return true
  })
}

function formatCount(value = 0) {
  const count = Number(value) || 0
  if (count >= 100000000) {
    return `${Number((count / 100000000).toFixed(1))}亿`
  }
  if (count >= 10000) {
    return `${Number((count / 10000).toFixed(1))}万`
  }
  return String(count)
}

function formatVideoClock(value = 0) {
  const totalSeconds = Math.max(0, Math.floor(Number(value) || 0))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')

  return `${minutes}:${seconds}`
}
</script>
