import {
  computed,
  nextTick,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  shallowRef,
  watch
} from 'vue'
import { recommendedMvs as fallbackMvs } from '../../data/music'
import {
  getMvPlaybackData,
  getVideoCenterData
} from '../../services/netease'
import { usePlayerStore } from '../../stores/player'
import {
  FEED_DRAG_THRESHOLD as feedDragThreshold,
  HOME_DANMAKU_MAX_ITEMS as homeDanmakuMaxItems,
  HOME_DANMAKU_PREFETCH_THRESHOLD as homeDanmakuPrefetchThreshold,
  MV_RECOMMENDATION_LIMIT as mvRecommendationLimit
} from './homeConstants'
import {
  formatTime,
  isPlaybackSpaceKey,
  normalizeVideoUrl,
  parseDuration,
  prepareMvQueue,
  resizeNeteaseCover,
  shouldIgnorePlaybackShortcut,
  uniqueMvs
} from './homeUtils'
import { useHomeMvEngagement } from './useHomeMvEngagement'

export function useHomeVideoFeed({ active }) {
  const player = usePlayerStore()
  const mvScroller = ref(null)
  const homeVideoElement = ref(null)
  const activeMvIndex = ref(0)
  const mvAutoPlayAfterGesture = ref(false)
  const mvQueue = shallowRef(prepareMvQueue(fallbackMvs))
  const mvQueueLoading = ref(false)
  const activeMvLoading = ref(false)
  const mvDragging = ref(false)
  const homeMvState = reactive({
    isPlaying: false,
    isReady: false,
    currentTime: 0,
    duration: 0,
    error: ''
  })
  const mvDragState = {
    pointerId: null,
    startIndex: 0,
    startY: 0,
    startScrollTop: 0,
    moved: false
  }
  const mvPlaybackCache = new Map()
  const mvPlaybackRequests = new Map()
  let mvScrollFrame = 0
  let mvAutoPlayTimer = 0
  let mvPlaybackRequestId = 0
  let mvQueueLoaded = false
  let mvSnapRequestId = 0

  const activeMv = computed(() => mvQueue.value[activeMvIndex.value])
  const activeMvId = computed(() => String(activeMv.value?.id ?? ''))
  const engagement = useHomeMvEngagement({ activeMv, activeMvId })
  const homeMvCommentSubtitle = computed(() => {
    const mv = activeMv.value

    return mv ? `${mv.title} - ${mv.artist}` : ''
  })

  watch(active, async (enabled) => {
    if (enabled) {
      await loadHomeMvs()
      await snapMvToActiveIndex('auto')
      loadActiveMvPlayback(activeMv.value?.id)
      return
    }

    pauseHomeMv()
  })

  watch(
    () => activeMv.value?.id,
    (id) => {
      if (!active.value) {
        return
      }

      pauseHomeMv()
      resetHomeMvState()
      engagement.restoreHomeMvComments(id)
      engagement.resetHomeMvDanmakuStream(id)
      loadActiveMvPlayback(id, { autoplay: mvAutoPlayAfterGesture.value })
    }
  )

  onMounted(() => {
    bindVideoFeedEffects()

    if (active.value) {
      activateVideoFeed()
    }
  })

  onActivated(() => {
    bindVideoFeedEffects()

    if (active.value) {
      activateVideoFeed()
    }
  })

  onDeactivated(() => {
    unbindVideoFeedEffects()
  })

  onUnmounted(() => {
    mvSnapRequestId += 1
    window.cancelAnimationFrame(mvScrollFrame)
    window.clearTimeout(mvAutoPlayTimer)
    unbindVideoFeedEffects()
  })

  function bindVideoFeedEffects() {
    window.addEventListener('keydown', handleGlobalVideoKeydown)
  }

  function unbindVideoFeedEffects() {
    window.removeEventListener('keydown', handleGlobalVideoKeydown)
    pauseHomeMv()
  }

  async function activateVideoFeed() {
    await loadHomeMvs()
    await snapMvToActiveIndex('auto')
    loadActiveMvPlayback(activeMv.value?.id)
  }

  function handleGlobalVideoKeydown(event) {
    if (!active.value || !isPlaybackSpaceKey(event) || shouldIgnorePlaybackShortcut(event)) {
      return
    }

    event.preventDefault()
    toggleHomeMvPlayback(activeMvIndex.value)
  }

  async function loadHomeMvs({ force = false } = {}) {
    if ((mvQueueLoaded && !force) || mvQueueLoading.value) {
      return
    }

    mvQueueLoading.value = true
    homeMvState.error = ''

    try {
      const data = await getVideoCenterData({ limit: mvRecommendationLimit })
      const mvs = uniqueMvs([
        data.active?.mv,
        ...data.recommended,
        ...data.first,
        ...data.top,
        ...data.exclusive,
        ...data.all
      ])

      mvQueue.value = prepareMvQueue(mvs.length ? mvs : fallbackMvs)
      activeMvIndex.value = Math.min(activeMvIndex.value, Math.max(0, mvQueue.value.length - 1))
      mvQueueLoaded = true

      if (data.active?.mv?.id) {
        rememberHomeMvPayload(data.active)
      }
    } catch (error) {
      console.warn('Failed to load home MV feed:', error)
      homeMvState.error = error?.message || 'MV 加载失败'
      mvQueue.value = prepareMvQueue(fallbackMvs)
    } finally {
      mvQueueLoading.value = false
    }
  }

  async function loadActiveMvPlayback(id, { autoplay = false } = {}) {
    const mvId = String(id ?? '')

    if (!mvId) {
      return
    }

    const requestId = ++mvPlaybackRequestId
    homeMvState.error = ''

    if (mvPlaybackCache.has(mvId)) {
      activeMvLoading.value = false
      rememberHomeMvPayload(mvPlaybackCache.get(mvId))
      await nextTick()

      if (autoplay && requestId === mvPlaybackRequestId) {
        await playCurrentHomeMv({ skipLoad: true })
      }
      return
    }

    activeMvLoading.value = true

    try {
      const payload = await getHomeMvPlayback(mvId)

      if (requestId !== mvPlaybackRequestId || mvId !== activeMvId.value) {
        return
      }

      rememberHomeMvPayload(payload)
      await nextTick()

      if (autoplay) {
        await playCurrentHomeMv({ skipLoad: true })
      }
    } catch (error) {
      if (requestId === mvPlaybackRequestId) {
        console.warn('Failed to load home MV playback:', error)
        homeMvState.error = error?.message || '播放地址加载失败'
      }
    } finally {
      if (requestId === mvPlaybackRequestId) {
        activeMvLoading.value = false
      }
    }
  }

  function getHomeMvPlayback(id) {
    const mvId = String(id)

    if (mvPlaybackCache.has(mvId)) {
      return Promise.resolve(mvPlaybackCache.get(mvId))
    }

    if (mvPlaybackRequests.has(mvId)) {
      return mvPlaybackRequests.get(mvId)
    }

    const request = getMvPlaybackData(mvId)
      .then((payload) => {
        mvPlaybackCache.set(mvId, payload)
        return payload
      })
      .finally(() => {
        mvPlaybackRequests.delete(mvId)
      })

    mvPlaybackRequests.set(mvId, request)
    return request
  }

  function rememberHomeMvPayload(payload) {
    const mv = payload?.mv

    if (!mv?.id) {
      return
    }

    mvPlaybackCache.set(String(mv.id), payload)
    if (payload.comments) {
      engagement.cacheHomeMvComments(mv.id, payload.comments)
    }

    mvQueue.value = mvQueue.value.map((item) =>
      String(item.id) === String(mv.id)
        ? {
            ...item,
            ...mv,
            coverUrl: resizeNeteaseCover(mv.coverUrl ?? item.coverUrl, 960),
            playCount: mv.playCount || item.playCount,
            desc: mv.description || mv.desc || item.desc
          }
        : item
    )

    if (String(mv.id) === activeMvId.value && payload.comments) {
      engagement.applyHomeMvComments(mv.id, payload.comments)
      engagement.resetHomeMvDanmakuStream(mv.id, payload.comments)
      engagement.loadMoreHomeMvDanmaku(mv.id)
    }
  }

  async function snapMvToActiveIndex(behavior = 'auto') {
    const requestId = ++mvSnapRequestId

    await nextTick()
    await waitForLayoutFrame()

    if (requestId !== mvSnapRequestId) {
      return
    }

    scrollToMvIndex(activeMvIndex.value, behavior)
    await waitForLayoutFrame()

    if (requestId === mvSnapRequestId) {
      scrollToMvIndex(activeMvIndex.value, 'auto')
    }
  }

  function handleMvScroll() {
    if (mvScrollFrame) {
      return
    }

    mvScrollFrame = window.requestAnimationFrame(() => {
      mvScrollFrame = 0

      if (!mvScroller.value?.clientHeight || !mvQueue.value.length) {
        return
      }

      const nextIndex = getMvIndexFromScroll()

      if (nextIndex === activeMvIndex.value) {
        return
      }

      activeMvIndex.value = nextIndex

      if (mvAutoPlayAfterGesture.value && !mvDragging.value) {
        scheduleMvAutoPlay()
      }
    })
  }

  function startMvDrag(event) {
    const scroller = mvScroller.value

    if (!scroller || event.button > 0 || shouldIgnoreMvDrag(event)) {
      return
    }

    mvSnapRequestId += 1
    mvDragging.value = true
    mvDragState.pointerId = event.pointerId
    mvDragState.startIndex = activeMvIndex.value
    mvDragState.startY = event.clientY
    mvDragState.startScrollTop = scroller.scrollTop
    mvDragState.moved = false
    scroller.style.scrollSnapType = 'none'
    scroller.setPointerCapture?.(event.pointerId)
    event.preventDefault()
  }

  function handleMvPointerMove(event) {
    const scroller = mvScroller.value

    if (!scroller || !mvDragging.value || event.pointerId !== mvDragState.pointerId) {
      return
    }

    const deltaY = event.clientY - mvDragState.startY

    if (Math.abs(deltaY) < feedDragThreshold && !mvDragState.moved) {
      return
    }

    mvDragState.moved = true
    event.preventDefault()
    scroller.scrollTop = mvDragState.startScrollTop - deltaY
  }

  function stopMvDrag(event) {
    if (!mvDragging.value || event.pointerId !== mvDragState.pointerId) {
      return
    }

    const scroller = mvScroller.value
    const shouldSnap = mvDragState.moved

    scroller?.releasePointerCapture?.(event.pointerId)
    if (scroller) {
      scroller.style.scrollSnapType = ''
    }
    mvDragging.value = false
    mvDragState.pointerId = null

    if (!shouldSnap || !scroller?.clientHeight) {
      return
    }

    const nextIndex = getMvIndexFromScroll()
    activeMvIndex.value = nextIndex
    scrollToMvIndex(nextIndex, 'smooth')

    if (nextIndex !== mvDragState.startIndex) {
      mvAutoPlayAfterGesture.value = true
      scheduleMvAutoPlay()
    }
  }

  function shouldIgnoreMvDrag(event) {
    return Boolean(event.target?.closest?.(
      '.soda-mv-stage, .soda-mv-action-rail, .soda-mv-progress, button, a, input, textarea, select'
    ))
  }

  function handleMvKeydown(event) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return
    }

    event.preventDefault()
    scrollToMvIndex(activeMvIndex.value + (event.key === 'ArrowDown' ? 1 : -1), 'smooth')
  }

  function getMvIndexFromScroll() {
    const scroller = mvScroller.value

    if (!scroller?.clientHeight || !mvQueue.value.length) {
      return activeMvIndex.value
    }

    let nearestIndex = activeMvIndex.value
    let nearestDistance = Number.POSITIVE_INFINITY

    Array.from(scroller.children).forEach((slide, index) => {
      if (!slide.classList?.contains('soda-mv-slide')) {
        return
      }

      const distance = Math.abs(slide.offsetTop - scroller.scrollTop)

      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    })

    return clampMvIndex(nearestIndex)
  }

  function scrollToMvIndex(index, behavior = 'smooth') {
    const scroller = mvScroller.value

    if (!scroller || !mvQueue.value.length) {
      return
    }

    const nextIndex = clampMvIndex(index)

    scroller.scrollTo({
      top: getMvSlideTop(nextIndex),
      behavior
    })
  }

  function getMvSlideTop(index) {
    const scroller = mvScroller.value
    const slide = scroller?.querySelectorAll('.soda-mv-slide')?.[index]

    return slide?.offsetTop ?? index * (scroller?.clientHeight || 0)
  }

  function scheduleMvAutoPlay() {
    window.clearTimeout(mvAutoPlayTimer)
    mvAutoPlayTimer = window.setTimeout(() => {
      loadActiveMvPlayback(activeMv.value?.id, { autoplay: true })
    }, 220)
  }

  async function playMvFromGesture(index) {
    mvAutoPlayAfterGesture.value = true
    const shouldScroll = index !== activeMvIndex.value
    activeMvIndex.value = index
    await nextTick()

    if (shouldScroll) {
      scrollToMvIndex(index, 'smooth')
    }

    if (!shouldScroll && getHomeMvVideoUrl(activeMv.value)) {
      await playCurrentHomeMv({ skipLoad: true })
      return
    }

    await loadActiveMvPlayback(activeMv.value?.id, { autoplay: true })
    await playCurrentHomeMv({ skipLoad: true })
  }

  async function toggleHomeMvPlayback(index = activeMvIndex.value) {
    if (index !== activeMvIndex.value) {
      await playMvFromGesture(index)
      return
    }

    if (homeMvState.isPlaying) {
      pauseHomeMv()
      return
    }

    await playMvFromGesture(index)
  }

  async function goNextMvFromGesture() {
    if (!mvQueue.value.length) {
      return
    }

    mvAutoPlayAfterGesture.value = true
    const nextIndex = (activeMvIndex.value + 1) % mvQueue.value.length
    activeMvIndex.value = nextIndex
    scrollToMvIndex(nextIndex, 'smooth')
    await loadActiveMvPlayback(activeMv.value?.id, { autoplay: true })
  }

  async function playCurrentHomeMv({ skipLoad = false } = {}) {
    const mv = activeMv.value

    if (!mv?.id) {
      return false
    }

    if (!skipLoad && !getHomeMvVideoUrl(mv)) {
      await loadActiveMvPlayback(mv.id, { autoplay: true })
      return false
    }

    await nextTick()
    const video = homeVideoElement.value

    if (!video || !getHomeMvVideoUrl(mv)) {
      return false
    }

    try {
      if (player.state.isPlaying) {
        await player.togglePlay()
      }

      await video.play()
      homeMvState.error = ''
      return true
    } catch (error) {
      console.warn('Failed to play home MV:', error)
      homeMvState.error = '浏览器阻止自动播放，请点击播放'
      return false
    }
  }

  function pauseHomeMv() {
    const video = homeVideoElement.value

    if (video && !video.paused) {
      video.pause()
    }

    homeMvState.isPlaying = false
  }

  function resetHomeMvState() {
    homeVideoElement.value = null
    homeMvState.isPlaying = false
    homeMvState.isReady = false
    homeMvState.currentTime = 0
    homeMvState.duration = 0
    homeMvState.error = ''
  }

  function setHomeVideoElement(element, index) {
    if (element && index === activeMvIndex.value) {
      homeVideoElement.value = element
    }
  }

  function handleHomeMvMetadata(event) {
    const video = event.target
    homeMvState.isReady = true
    homeMvState.duration = Number.isFinite(video.duration)
      ? video.duration
      : parseDuration(activeMv.value?.duration)
  }

  function handleHomeMvTimeUpdate(event) {
    homeMvState.currentTime = Number.isFinite(event.target.currentTime)
      ? event.target.currentTime
      : 0
  }

  function handleHomeMvPlay() {
    homeMvState.isPlaying = true
    homeMvState.error = ''

    if (player.state.isPlaying) {
      player.togglePlay()
    }
  }

  function handleHomeMvPause() {
    homeMvState.isPlaying = false
  }

  function handleHomeMvError() {
    homeMvState.isPlaying = false
    homeMvState.error = '视频播放失败'
  }

  function seekHomeMvFromProgress(event, mv) {
    if (String(mv?.id) !== activeMvId.value) {
      return
    }

    const video = homeVideoElement.value
    const duration = homeMvState.duration || video?.duration || parseDuration(mv.duration)

    if (!video || !duration) {
      return
    }

    const rail = event.currentTarget.querySelector('.soda-slide__progress-rail')
    const rect = (rail ?? event.currentTarget).getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    const nextTime = ratio * duration

    video.currentTime = nextTime
    homeMvState.currentTime = nextTime
  }

  function getHomeMvVideoUrl(mv) {
    return normalizeVideoUrl(mv?.url)
  }

  function isActiveMvLoading(mv) {
    return Boolean(
      activeMvLoading.value &&
      mv?.id &&
      String(mv.id) === activeMvId.value
    )
  }

  function getHomeMvDuration(mv) {
    if (String(mv?.id) === activeMvId.value) {
      return homeMvState.duration || parseDuration(mv.duration)
    }

    return parseDuration(mv?.duration)
  }

  function getHomeMvProgress(mv) {
    const duration = getHomeMvDuration(mv)

    if (String(mv?.id) !== activeMvId.value || !duration) {
      return 0
    }

    return Math.min(100, (homeMvState.currentTime / duration) * 100)
  }

  function getHomeMvProgressNow(mv) {
    return String(mv?.id) === activeMvId.value
      ? Math.floor(homeMvState.currentTime || 0)
      : 0
  }

  function getHomeMvCurrentTimeLabel(mv) {
    return String(mv?.id) === activeMvId.value
      ? formatTime(homeMvState.currentTime)
      : '0:00'
  }

  function getHomeMvDurationLabel(mv) {
    if (String(mv?.id) === activeMvId.value && homeMvState.duration) {
      return formatTime(homeMvState.duration)
    }

    return mv?.duration || '0:00'
  }

  function waitForLayoutFrame() {
    return new Promise((resolve) => {
      window.requestAnimationFrame(resolve)
    })
  }

  function clampMvIndex(index) {
    if (!mvQueue.value.length) {
      return 0
    }

    return Math.min(
      mvQueue.value.length - 1,
      Math.max(0, index)
    )
  }

  return {
    mvScroller,
    mvDragging,
    mvQueue,
    mvQueueLoading,
    activeMvIndex,
    activeMvLoading,
    homeMvState,
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
    getHomeMvDuration,
    getHomeMvProgressNow,
    seekHomeMvFromProgress,
    getHomeMvCurrentTimeLabel,
    getHomeMvProgress,
    getHomeMvDurationLabel,
    ...engagement
  }
}
