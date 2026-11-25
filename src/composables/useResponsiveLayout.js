import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useEnvironmentStore } from '../stores/environment'

export const MOBILE_MAX_WIDTH = 767
export const COMPACT_MAX_WIDTH = 1099
export const TABLET_PORTRAIT_MAX_WIDTH = 1199

function readViewportWidth() {
  return typeof window === 'undefined' ? 1440 : document.documentElement.clientWidth || window.innerWidth
}

function readViewportHeight() {
  return typeof window === 'undefined' ? 900 : window.innerHeight
}

const viewportWidth = ref(readViewportWidth())
const viewportHeight = ref(readViewportHeight())
const isMobile = computed(() => viewportWidth.value <= MOBILE_MAX_WIDTH)
const isCompact = computed(() => viewportWidth.value > MOBILE_MAX_WIDTH && viewportWidth.value <= COMPACT_MAX_WIDTH)
const isNarrow = computed(() => viewportWidth.value <= COMPACT_MAX_WIDTH)
const isTabletPortrait = computed(() => viewportWidth.value > MOBILE_MAX_WIDTH
  && viewportWidth.value <= TABLET_PORTRAIT_MAX_WIDTH
  && viewportHeight.value > viewportWidth.value)
let subscribers = 0

function updateViewport() {
  viewportWidth.value = readViewportWidth()
  viewportHeight.value = readViewportHeight()
}

export function useResponsiveLayout() {
  const environment = useEnvironmentStore()
  const isMobile2D = computed(() => isMobile.value && environment.state.mode === '2d')
  const isHomeTouch2D = computed(() => environment.state.mode === '2d' && (isMobile.value || isTabletPortrait.value))
  const songRowHeight = computed(() => isMobile2D.value ? 64 : 58)
  let subscribed = false

  onMounted(() => {
    if (subscribers++ === 0) window.addEventListener('resize', updateViewport, { passive: true })
    subscribed = true
    updateViewport()
  })

  onBeforeUnmount(() => {
    if (!subscribed) return
    subscribed = false
    if (--subscribers === 0) window.removeEventListener('resize', updateViewport)
  })

  return { isMobile, isMobile2D, isCompact, isNarrow, isTabletPortrait, isHomeTouch2D, songRowHeight }
}
