<template>
  <div
    ref="homeRoot"
    class="view home-view"
    tabindex="-1"
    :class="{
      'home-view--video': activeHomeSection === 'video',
      'home-view--lyrics': isHomeTouch2D && mobilePageIndex === 2,
      'home-view--swiping': isSwiping,
    }"
    @pointerdown.capture="startPageSwipe"
    @pointermove.capture="handlePageSwipe"
    @pointerup.capture="finishPageSwipe"
    @pointercancel.capture="cancelPageSwipe"
    @click.capture="suppressSwipeClick"
    @keydown.capture="handlePageKeydown"
  >
    <nav
      v-show="(!isMobile2D || activeHomeSection === 'video') && (!isHomeTouch2D || mobilePageIndex !== 2)"
      class="soda-feed__tabs"
      aria-label="首页分类"
      :style="{ '--active-tab-index': activeHomeSectionIndex }"
    >
      <button
        v-for="section in homeSections"
        :key="section.value"
        type="button"
        :class="{ active: activeHomeSection === section.value }"
        :aria-pressed="activeHomeSection === section.value"
        :aria-controls="`home-${section.value}-feed`"
        @click="setHomeSection(section.value)"
      >
        {{ section.label }}
      </button>
    </nav>
    <nav
      v-if="!isMobile2D && isHomeTouch2D && activeHomeSection === 'music' && mobilePageIndex !== 2"
      class="home-page-indicators"
      aria-label="听歌页面"
    >
      <button
        v-for="(page, index) in mobilePages"
        :key="page"
        type="button"
        :class="{ active: mobilePageIndex === index }"
        :aria-label="page"
        :aria-pressed="mobilePageIndex === index"
        @click="setMobilePage(index)"
      ><span aria-hidden="true" /></button>
    </nav>

    <HomeMusicFeed
      v-if="!isMobile2D"
      ref="musicFeed"
      :mobile-page-index="mobilePageIndex"
      :swipe-offset="swipeOffset"
      :active="activeHomeSection === 'music'"
      @page-request="setMobilePage"
      @first-data-ready="markHomeDataReady"
    />
    <MobileHomeMusicSource v-if="isMobile2D" :active="activeHomeSection === 'music'" @ready="markHomeDataReady" />
    <HomeVideoFeed :active="activeHomeSection === 'video'" />
  </div>
</template>

<script setup>
import { computed, nextTick, onDeactivated, ref, watch } from 'vue'
import HomeMusicFeed from './home/HomeMusicFeed.vue'
import HomeVideoFeed from './home/HomeVideoFeed.vue'
import MobileHomeMusicSource from './home/MobileHomeMusicSource.vue'
import { HOME_SECTIONS as homeSections } from './home/homeConstants'
import { useResponsiveLayout } from '../composables/useResponsiveLayout'
const props = defineProps({ mobilePlayerSection: { type: String, default: 'music' } })

const { isHomeTouch2D, isMobile2D } = useResponsiveLayout()
const homeRoot = ref(null)
const musicFeed = ref(null)
const mobilePages = ['弹幕', '封面与歌词', '沉浸歌词']
const mobilePageIndex = ref(1)
const swipeOffset = ref(0)
const isSwiping = ref(false)
let pageSwipe = null
let suppressClickUntil = 0
const activeHomeSection = ref('music')
const homeDataReady = ref(false)
const emit = defineEmits(['home-ready', 'home-page-change', 'home-section-change'])

const activeHomeSectionIndex = computed(() =>
  Math.max(0, homeSections.findIndex((section) => section.value === activeHomeSection.value))
)

watch([isHomeTouch2D, activeHomeSection], () => {
  if (!isHomeTouch2D.value || activeHomeSection.value !== 'music') mobilePageIndex.value = 1
  cancelPageSwipe()
})
watch(mobilePageIndex, (index) => {
  emit('home-page-change', index)
  if (index === 2) nextTick(() => homeRoot.value?.focus({ preventScroll: true }))
}, { immediate: true })

onDeactivated(() => {
  mobilePageIndex.value = 1
  cancelPageSwipe()
})
watch(() => props.mobilePlayerSection, (section) => {
  if (isMobile2D.value && homeSections.some(item => item.value === section)) activeHomeSection.value = section
}, { immediate: true })
watch(activeHomeSection, section => emit('home-section-change', section), { immediate: true })

function setMobilePage(index) {
  if (!isHomeTouch2D.value || activeHomeSection.value !== 'music') return
  musicFeed.value?.resetLyricInteraction()
  mobilePageIndex.value = Math.max(0, Math.min(mobilePages.length - 1, index))
}

function startPageSwipe(event) {
  if (!isHomeTouch2D.value || activeHomeSection.value !== 'music'
    || event.pointerType !== 'touch' || !event.isPrimary || event.button > 0) return
  const target = event.target
  if (target.closest?.('button, a, input, textarea, select, [role="slider"]')
    && !target.closest('.soda-lyrics-panel')) return
  pageSwipe = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    axis: null,
    element: event.currentTarget,
    width: event.currentTarget.clientWidth,
  }
}

function handlePageSwipe(event) {
  if (!pageSwipe || event.pointerId !== pageSwipe.pointerId) return
  const dx = event.clientX - pageSwipe.startX
  const dy = event.clientY - pageSwipe.startY
  if (!pageSwipe.axis) {
    if (Math.abs(dy) >= 12 && Math.abs(dy) >= Math.abs(dx)) {
      cancelPageSwipe()
      return
    }
    if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.4) return
    pageSwipe.axis = 'horizontal'
    isSwiping.value = true
    musicFeed.value?.resetLyricInteraction()
    if (event.isTrusted) pageSwipe.element.setPointerCapture(event.pointerId)
  }
  const atEdge = (mobilePageIndex.value === 0 && dx > 0) || (mobilePageIndex.value === 2 && dx < 0)
  const offset = Math.max(-pageSwipe.width, Math.min(pageSwipe.width, dx))
  swipeOffset.value = atEdge ? offset / 3 : offset
  event.preventDefault()
  event.stopPropagation()
}

function finishPageSwipe(event) {
  if (!pageSwipe || event.pointerId !== pageSwipe.pointerId) return
  if (pageSwipe.axis === 'horizontal') {
    const dx = event.clientX - pageSwipe.startX
    const dy = event.clientY - pageSwipe.startY
    if (Math.abs(dx) >= 56 && Math.abs(dx) >= Math.abs(dy) * 1.4) {
      setMobilePage(mobilePageIndex.value + (dx < 0 ? 1 : -1))
    }
    suppressClickUntil = Date.now() + 400
    event.preventDefault()
    event.stopPropagation()
  }
  cancelPageSwipe()
}

function cancelPageSwipe() {
  const swipe = pageSwipe
  pageSwipe = null
  swipeOffset.value = 0
  isSwiping.value = false
  if (swipe?.element.hasPointerCapture?.(swipe.pointerId)) swipe.element.releasePointerCapture(swipe.pointerId)
}

function suppressSwipeClick(event) {
  if (Date.now() < suppressClickUntil) {
    event.preventDefault()
    event.stopPropagation()
  }
}

function handlePageKeydown(event) {
  if (!isHomeTouch2D.value || activeHomeSection.value !== 'music'
    || !['ArrowLeft', 'ArrowRight'].includes(event.key)
    || event.target.closest?.('input, textarea, select, [role="slider"]')) return
  event.preventDefault()
  event.stopPropagation()
  setMobilePage(mobilePageIndex.value + (event.key === 'ArrowRight' ? 1 : -1))
}

function setHomeSection(value) {
  if (value !== activeHomeSection.value) activeHomeSection.value = value
}

function markHomeDataReady() {
  if (homeDataReady.value) return
  homeDataReady.value = true
  emit('home-ready')
}
</script>
