import {
  computed,
  nextTick,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  watch
} from 'vue'
import { useMessage } from 'naive-ui'
import { recommendedSingles } from '../../data/music'
import { getMusicFeedData } from '../../services/netease'
import { usePlayerStore } from '../../stores/player'
import {
  EMPTY_SLIDE_STYLE as emptySlideStyle,
  FEED_DRAG_THRESHOLD as feedDragThreshold,
  HOME_DANMAKU_MAX_ITEMS as homeDanmakuMaxItems,
  HOME_DANMAKU_PREFETCH_THRESHOLD as homeDanmakuPrefetchThreshold,
  MOOD_SIGNALS as moodSignals,
  RECOMMENDATION_LIMIT as recommendationLimit,
  SLIDE_HYDRATE_RADIUS as slideHydrateRadius
} from './homeConstants'
import {
  applyMoodQueue,
  createSlideStyle,
  formatTime,
  getFallbackCoverTintRgb,
  isPlaybackSpaceKey,
  prepareQueue,
  sampleCoverTint,
  shouldIgnorePlaybackShortcut
} from './homeUtils'
import { useHomeLyrics } from './useHomeLyrics'
import { useHomeSongEngagement } from './useHomeSongEngagement'

export function useHomeMusicFeed({ active }) {
  const player = usePlayerStore()
  const message = useMessage()
  const feedScroller = ref(null)
  const activeMood = ref('daily')
  const activeIndex = ref(0)
  const musicFeedSettling = ref(false)
  const autoPlayAfterGesture = ref(false)
  const allSongs = shallowRef(prepareQueue(recommendedSingles))
  const recommendationQueue = shallowRef(applyMoodQueue(allSongs.value, activeMood.value))
  const coverTintVersion = ref(0)
  const feedDragging = ref(false)
  const feedDragState = {
    pointerId: null,
    startIndex: 0,
    startY: 0,
    startScrollTop: 0,
    moved: false
  }
  const coverTintCache = new Map()
  const coverTintRequests = new Set()
  let scrollFrame = 0
  let autoPlayTimer = 0
  let sectionSwitchSnapTimer = 0
  let removeTrackEndedListener = null
  let feedScrollLocked = false
  let syncedQueue = null
  let feedSnapRequestId = 0

  const lyrics = useHomeLyrics({ player })
  const activeSong = computed(() => recommendationQueue.value[activeIndex.value])
  const activeSongId = computed(() => String(activeSong.value?.id ?? ''))
  const currentTrackId = computed(() => String(player.state.currentTrack.id ?? ''))
  const hydratedSlideBounds = computed(() => ({
    start: Math.max(0, activeIndex.value - slideHydrateRadius),
    end: Math.min(recommendationQueue.value.length - 1, activeIndex.value + slideHydrateRadius)
  }))
  const engagement = useHomeSongEngagement({
    activeSong,
    allSongs,
    recommendationQueue,
    player
  })

  watch(
    () => player.state.currentTrack.id,
    async (trackId) => {
      const nextIndex = recommendationQueue.value.findIndex((song) => String(song.id) === String(trackId))

      if (nextIndex >= 0 && nextIndex !== activeIndex.value) {
        activeIndex.value = nextIndex
        scrollToIndex(nextIndex, 'smooth')
        return
      }

      if (trackId && String(trackId) === String(activeSong.value?.id)) {
        await nextTick()
        lyrics.loadActiveLyrics(trackId)
      }
    }
  )

  watch(
    () => activeSong.value?.id,
    (trackId) => {
      lyrics.loadActiveLyrics(trackId)
      engagement.loadActiveSongStats(trackId)
      engagement.resetSongDanmakuStream()
      engagement.loadMoreSongDanmaku()
      hydrateVisibleCoverTints()
    },
    { immediate: true }
  )

  watch(active, (enabled) => {
    if (enabled) {
      stabilizeMusicFeedAfterSectionSwitch()
    }
  })

  onMounted(() => {
    activateHomeView()
    bindHomeViewEffects()
    loadRecommendations()
  })

  onActivated(() => {
    activateHomeView()
    bindHomeViewEffects()
  })

  onDeactivated(() => {
    unbindHomeViewEffects()
  })

  onUnmounted(() => {
    feedSnapRequestId += 1
    window.cancelAnimationFrame(scrollFrame)
    window.clearTimeout(autoPlayTimer)
    window.clearTimeout(sectionSwitchSnapTimer)
    lyrics.cleanupLyrics()
    unbindHomeViewEffects()
  })

  function bindHomeViewEffects() {
    if (!removeTrackEndedListener) {
      removeTrackEndedListener = player.onTrackEnded(handleTrackEnded)
    }

    window.addEventListener('keydown', handleGlobalPlaybackKeydown)
  }

  function unbindHomeViewEffects() {
    window.removeEventListener('keydown', handleGlobalPlaybackKeydown)
    removeTrackEndedListener?.()
    removeTrackEndedListener = null
  }

  function activateHomeView() {
    if (!recommendationQueue.value.length) {
      recommendationQueue.value = applyMoodQueue(allSongs.value, activeMood.value)
    }

    restoreActiveTrackPosition()
    syncPlayerQueue()
    hydrateVisibleCoverTints()

    if (active.value) {
      snapFeedToActiveIndex('auto')
    }
  }

  async function loadRecommendations() {
    try {
      const data = await getMusicFeedData({ limit: recommendationLimit })
      const songs = data.songs.length ? data.songs : recommendedSingles
      allSongs.value = prepareQueue(songs)
      recommendationQueue.value = applyMoodQueue(allSongs.value, activeMood.value)
      restoreActiveTrackPosition()
      syncPlayerQueue()
      hydrateVisibleCoverTints()
      await snapFeedToActiveIndex('auto')
    } catch (error) {
      console.warn('Failed to load home recommendations:', error)
    }
  }

  function stabilizeMusicFeedAfterSectionSwitch() {
    const targetIndex = clampSongIndex(activeIndex.value)

    cancelPendingFeedScroll()
    feedDragging.value = false
    feedDragState.pointerId = null
    feedScrollLocked = true
    musicFeedSettling.value = true
    window.clearTimeout(sectionSwitchSnapTimer)

    nextTick(async () => {
      await waitForLayoutFrame()

      if (!active.value) {
        finishMusicFeedSectionSwitch(false)
        return
      }

      activeIndex.value = targetIndex
      scrollToIndex(targetIndex, 'auto')
      await waitForLayoutFrame()

      if (!active.value) {
        finishMusicFeedSectionSwitch(false)
        return
      }

      activeIndex.value = targetIndex
      scrollToIndex(targetIndex, 'auto')

      sectionSwitchSnapTimer = window.setTimeout(() => {
        if (active.value) {
          activeIndex.value = targetIndex
          scrollToIndex(targetIndex, 'auto')
          finishMusicFeedSectionSwitch(true)
          return
        }

        finishMusicFeedSectionSwitch(false)
      }, 80)
    })
  }

  function finishMusicFeedSectionSwitch(visible) {
    if (!visible) {
      musicFeedSettling.value = false
      feedScrollLocked = false
      return
    }

    window.requestAnimationFrame(() => {
      if (active.value) {
        musicFeedSettling.value = false
      }

      feedScrollLocked = false
    })
  }

  function cancelPendingFeedScroll() {
    if (!scrollFrame) {
      return
    }

    window.cancelAnimationFrame(scrollFrame)
    scrollFrame = 0
  }

  function handleGlobalPlaybackKeydown(event) {
    if (!active.value || !isPlaybackSpaceKey(event) || shouldIgnorePlaybackShortcut(event)) {
      return
    }

    event.preventDefault()
    autoPlayAfterGesture.value = true
    playActiveSong()
  }

  function handleFeedScroll() {
    if (feedScrollLocked || !active.value || scrollFrame) {
      return
    }

    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = 0

      if (feedScrollLocked || !active.value) {
        return
      }

      const scroller = feedScroller.value

      if (!scroller?.clientHeight || !recommendationQueue.value.length) {
        return
      }

      const nextIndex = getFeedIndexFromScroll()

      if (nextIndex === activeIndex.value) {
        return
      }

      activeIndex.value = nextIndex

      if (autoPlayAfterGesture.value && !feedDragging.value) {
        scheduleAutoPlay({ restart: true })
      }
    })
  }

  function startFeedDrag(event) {
    const scroller = feedScroller.value

    if (!scroller || event.button > 0 || shouldIgnoreFeedDrag(event)) {
      return
    }

    feedSnapRequestId += 1
    feedDragging.value = true
    feedDragState.pointerId = event.pointerId
    feedDragState.startIndex = activeIndex.value
    feedDragState.startY = event.clientY
    feedDragState.startScrollTop = scroller.scrollTop
    feedDragState.moved = false
    scroller.style.scrollSnapType = 'none'
    scroller.setPointerCapture?.(event.pointerId)
    event.preventDefault()
  }

  function handleFeedPointerMove(event) {
    const scroller = feedScroller.value

    if (!scroller || !feedDragging.value || event.pointerId !== feedDragState.pointerId) {
      return
    }

    const deltaY = event.clientY - feedDragState.startY

    if (Math.abs(deltaY) < feedDragThreshold && !feedDragState.moved) {
      return
    }

    feedDragState.moved = true
    event.preventDefault()
    scroller.scrollTop = feedDragState.startScrollTop - deltaY
  }

  function stopFeedDrag(event) {
    if (!feedDragging.value || event.pointerId !== feedDragState.pointerId) {
      return
    }

    const scroller = feedScroller.value
    const shouldSnap = feedDragState.moved

    scroller?.releasePointerCapture?.(event.pointerId)
    if (scroller) {
      scroller.style.scrollSnapType = ''
    }
    feedDragging.value = false
    feedDragState.pointerId = null

    if (!shouldSnap || !scroller?.clientHeight) {
      return
    }

    const nextIndex = getFeedIndexFromScroll()
    activeIndex.value = nextIndex
    scrollToIndex(nextIndex, 'smooth')

    if (nextIndex !== feedDragState.startIndex) {
      autoPlayAfterGesture.value = true
      scheduleAutoPlay({ restart: true })
    }
  }

  function shouldIgnoreFeedDrag(event) {
    return Boolean(event.target?.closest?.(
      '.soda-lyrics-panel, .soda-action-rail, .soda-slide__progress, button, a, input, textarea, select'
    ))
  }

  function handleFeedKeydown(event) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return
    }

    event.preventDefault()
    scrollToIndex(activeIndex.value + (event.key === 'ArrowDown' ? 1 : -1), 'smooth')
  }

  function syncPlayerQueue() {
    if (syncedQueue === recommendationQueue.value) {
      return
    }

    syncedQueue = recommendationQueue.value
    player.setQueue(syncedQueue)
  }

  function restoreActiveTrackPosition() {
    const currentId = currentTrackId.value
    const nextIndex = recommendationQueue.value.findIndex((song) => String(song.id) === currentId)

    activeIndex.value = nextIndex >= 0 ? nextIndex : 0
  }

  async function snapFeedToActiveIndex(behavior = 'auto') {
    const requestId = ++feedSnapRequestId

    await nextTick()
    await waitForLayoutFrame()

    if (requestId !== feedSnapRequestId) {
      return
    }

    scrollToIndex(activeIndex.value, behavior)
    await waitForLayoutFrame()

    if (requestId === feedSnapRequestId) {
      scrollToIndex(activeIndex.value, 'auto')
    }
  }

  function waitForLayoutFrame() {
    return new Promise((resolve) => {
      window.requestAnimationFrame(resolve)
    })
  }

  function scrollToIndex(index, behavior = 'smooth') {
    const scroller = feedScroller.value

    if (!scroller || !recommendationQueue.value.length) {
      return
    }

    const nextIndex = clampSongIndex(index)

    scroller.scrollTo({
      top: getSlideTop(nextIndex),
      behavior
    })
  }

  function getFeedIndexFromScroll() {
    const scroller = feedScroller.value

    if (!scroller?.clientHeight || !recommendationQueue.value.length) {
      return activeIndex.value
    }

    let nearestIndex = activeIndex.value
    let nearestDistance = Number.POSITIVE_INFINITY

    Array.from(scroller.children).forEach((slide, index) => {
      const distance = Math.abs(slide.offsetTop - scroller.scrollTop)

      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    })

    return clampSongIndex(nearestIndex)
  }

  function getSlideTop(index) {
    const scroller = feedScroller.value
    const slide = scroller?.children[index]

    return slide?.offsetTop ?? index * (scroller?.clientHeight || 0)
  }

  function scheduleAutoPlay(options = {}) {
    window.clearTimeout(autoPlayTimer)
    autoPlayTimer = window.setTimeout(() => {
      playActiveSong({ auto: true, restart: true, ...options })
    }, 180)
  }

  async function playSongFromGesture(index) {
    autoPlayAfterGesture.value = true
    const shouldScroll = index !== activeIndex.value
    activeIndex.value = index
    await nextTick()

    if (shouldScroll) {
      scrollToIndex(index, 'smooth')
    }

    await playActiveSong()
  }

  async function goNextFromGesture() {
    if (!recommendationQueue.value.length) {
      return
    }

    autoPlayAfterGesture.value = true
    const nextIndex = (activeIndex.value + 1) % recommendationQueue.value.length
    activeIndex.value = nextIndex
    scrollToIndex(nextIndex, 'smooth')
    await playActiveSong()
  }

  async function handleTrackEnded() {
    if (!recommendationQueue.value.length) {
      return
    }

    autoPlayAfterGesture.value = true
    activeIndex.value = (activeIndex.value + 1) % recommendationQueue.value.length
    scrollToIndex(activeIndex.value, 'smooth')
    await playActiveSong({ auto: true, restart: true })
  }

  async function playActiveSong(options = {}) {
    const song = recommendationQueue.value[activeIndex.value]

    if (!song) {
      return
    }

    syncPlayerQueue()

    if (String(player.state.currentTrack.id) === String(song.id)) {
      await resumeOrToggleActiveSong(song, options)
      return
    }

    const played = await player.playTrack(song)
    showPlaybackError(played)
  }

  async function resumeOrToggleActiveSong(song, options) {
    if (options.restart) {
      player.seekTo(0)

      if (!player.state.isPlaying) {
        const resumed = await player.togglePlay()
        showPlaybackError(resumed)

        if (!resumed) {
          return
        }
      }

      lyrics.loadActiveLyrics(song.id)
      return
    }

    if (options.auto && player.state.isPlaying) {
      return
    }

    const toggled = await player.togglePlay()
    showPlaybackError(toggled)

    if (toggled) {
      lyrics.loadActiveLyrics(song.id)
    }
  }

  function isActiveSong(song) {
    return Boolean(song?.id && activeSongId.value === String(song.id))
  }

  function isSongPlaying(song) {
    return Boolean(
      song?.id &&
      currentTrackId.value === String(song.id) &&
      player.state.isPlaying
    )
  }

  function getPlayLabel(song) {
    if (player.state.isLoading && isActiveSong(song)) {
      return '音乐加载中'
    }

    return isSongPlaying(song) ? '暂停' : '播放'
  }

  function getSongProgress(song) {
    if (!isActiveSong(song) || !player.state.duration) {
      return 0
    }

    return Math.min(100, (player.state.currentTime / player.state.duration) * 100)
  }

  function getSongProgressNow(song) {
    return isActiveSong(song) ? Math.floor(player.state.currentTime || 0) : 0
  }

  function getCurrentTimeLabel(song) {
    return isActiveSong(song) ? formatTime(player.state.currentTime) : '0:00'
  }

  function getDurationLabel(song) {
    if (isActiveSong(song) && player.state.duration) {
      return formatTime(player.state.duration)
    }

    return song.time || song.duration || '0:00'
  }

  function seekFromProgress(event, song) {
    if (!isActiveSong(song) || !player.state.duration) {
      return
    }

    const rail = event.currentTarget.querySelector('.soda-slide__progress-rail')
    const rect = (rail ?? event.currentTarget).getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    player.seekTo(ratio * player.state.duration)
  }

  function handleProgressKeydown(event, song) {
    if (!isActiveSong(song) || !player.state.duration) {
      return
    }

    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return
    }

    event.preventDefault()
    player.seekTo(player.state.currentTime + (event.key === 'ArrowRight' ? 5 : -5))
  }

  function getMoodSignal(index) {
    const signals = moodSignals[activeMood.value] ?? moodSignals.daily

    return signals[index % signals.length]
  }

  function isSlideHydrated(index) {
    const { start, end } = hydratedSlideBounds.value

    return index >= start && index <= end
  }

  function getSlideStyle(song, index) {
    coverTintVersion.value

    return isSlideHydrated(index)
      ? createSlideStyle(song?.coverUrl, getSongCoverTintRgb(song))
      : emptySlideStyle
  }

  function clampSongIndex(index) {
    if (!recommendationQueue.value.length) {
      return 0
    }

    return Math.min(
      recommendationQueue.value.length - 1,
      Math.max(0, index)
    )
  }

  function hydrateVisibleCoverTints() {
    if (typeof window === 'undefined') {
      return
    }

    const { start, end } = hydratedSlideBounds.value
    recommendationQueue.value.slice(start, end + 1).forEach(loadCoverTintForSong)
  }

  function loadCoverTintForSong(song) {
    if (!song?.coverUrl || coverTintCache.has(song.coverUrl) || coverTintRequests.has(song.coverUrl)) {
      return
    }

    coverTintRequests.add(song.coverUrl)
    sampleCoverTint(song.coverUrl)
      .then((tintRgb) => {
        coverTintCache.set(song.coverUrl, tintRgb)
        coverTintVersion.value += 1
      })
      .catch(() => {
        coverTintCache.set(song.coverUrl, getFallbackCoverTintRgb(song.type))
      })
      .finally(() => {
        coverTintRequests.delete(song.coverUrl)
      })
  }

  function getSongCoverTintRgb(song) {
    if (!song?.coverUrl) {
      return getFallbackCoverTintRgb(song?.type)
    }

    return coverTintCache.get(song.coverUrl) ?? getFallbackCoverTintRgb(song.type)
  }

  function showPlaybackError(success) {
    if (success) {
      return
    }

    message.error(player.state.error?.message || '当前歌曲暂无可播放链接')
  }

  return {
    feedScroller,
    musicFeedSettling,
    feedDragging,
    recommendationQueue,
    activeIndex,
    player,
    homeDanmakuMaxItems,
    homeDanmakuPrefetchThreshold,
    handleFeedScroll,
    handleFeedKeydown,
    startFeedDrag,
    handleFeedPointerMove,
    stopFeedDrag,
    goNextFromGesture,
    playSongFromGesture,
    seekFromProgress,
    handleProgressKeydown,
    isSlideHydrated,
    getSlideStyle,
    isSongPlaying,
    getMoodSignal,
    getPlayLabel,
    isActiveSong,
    getSongProgressNow,
    getCurrentTimeLabel,
    getSongProgress,
    getDurationLabel,
    ...engagement,
    ...lyrics
  }
}
