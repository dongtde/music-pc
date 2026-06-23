import { computed, nextTick, onBeforeUnmount, onMounted, ref, unref, watch } from 'vue'

export function useVirtualRows(items, {
  root,
  list,
  rowHeight,
  overscan = 8,
  fallbackCount = 40
} = {}) {
  const startIndex = ref(0)
  const endIndex = ref(0)
  let frame = 0

  const normalizedRowHeight = Math.max(1, Number(rowHeight) || 1)
  const totalHeight = computed(() => unref(items).length * normalizedRowHeight)
  const offsetY = computed(() => startIndex.value * normalizedRowHeight)
  const visibleItems = computed(() => unref(items).slice(startIndex.value, endIndex.value))

  onMounted(() => {
    window.addEventListener('resize', scheduleRangeUpdate, { passive: true })
    nextTick(updateRange)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', scheduleRangeUpdate)
    cancelFrame()
  })

  watch(
    () => unref(items).length,
    () => {
      nextTick(updateRange)
    }
  )

  function scheduleRangeUpdate() {
    if (frame) {
      return
    }

    frame = window.requestAnimationFrame(() => {
      frame = 0
      updateRange()
    })
  }

  function updateRange() {
    const total = unref(items).length

    if (!total) {
      startIndex.value = 0
      endIndex.value = 0
      return
    }

    const rootElement = unref(root)
    const listElement = unref(list)

    if (!rootElement || !listElement) {
      startIndex.value = 0
      endIndex.value = Math.min(total, fallbackCount)
      return
    }

    const scrollTop = rootElement.scrollTop
    const viewportHeight = rootElement.clientHeight
    const listTop = listElement.offsetTop
    const visibleTop = Math.max(0, scrollTop - listTop)
    const visibleBottom = Math.max(0, scrollTop + viewportHeight - listTop)
    const nextStart = Math.min(
      Math.max(0, total - 1),
      Math.max(
        0,
        Math.floor(visibleTop / normalizedRowHeight) - overscan
      )
    )
    const nextEnd = Math.min(
      total,
      Math.ceil(visibleBottom / normalizedRowHeight) + overscan
    )

    startIndex.value = nextStart
    endIndex.value = Math.max(nextEnd, nextStart + 1)
  }

  function cancelFrame() {
    if (!frame) {
      return
    }

    window.cancelAnimationFrame(frame)
    frame = 0
  }

  return {
    offsetY,
    scheduleRangeUpdate,
    startIndex,
    endIndex,
    totalHeight,
    updateRange,
    visibleItems
  }
}
