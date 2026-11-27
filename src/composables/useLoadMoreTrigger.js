import { nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, unref, watch } from 'vue'

export function useLoadMoreTrigger(options = {}) {
  const {
    trigger,
    canLoad = true,
    loadMore,
    getRoot = (element) => element?.closest?.('.view') ?? null,
    rootMargin = '240px 0px',
    threshold = 0.01,
    scrollThreshold = 360
  } = options

  let observer = null
  let scrollRoot = null
  let isActive = true

  function canRequestLoad() {
    return resolveValue(canLoad) !== false
  }

  function requestLoad(force = false) {
    if (!isActive) {
      return
    }

    if (!force && !canRequestLoad()) {
      return
    }

    loadMore?.()
  }

  function setup() {
    cleanup()

    if (!isActive) {
      return
    }

    const element = unref(trigger)

    if (!element) {
      return
    }

    scrollRoot = getRoot(element)

    if (scrollRoot) {
      scrollRoot.addEventListener('scroll', handleScroll, { passive: true })
    }

    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(handleIntersect, {
        root: scrollRoot,
        rootMargin,
        threshold
      })
      observer.observe(element)
    }

    handleScroll()
  }

  function cleanup() {
    observer?.disconnect()
    observer = null

    if (scrollRoot) {
      scrollRoot.removeEventListener('scroll', handleScroll)
      scrollRoot = null
    }
  }

  function handleIntersect(entries) {
    if (entries.some((entry) => entry.isIntersecting)) {
      requestLoad()
    }
  }

  function handleScroll() {
    if (!scrollRoot) {
      return
    }

    const remaining =
      scrollRoot.scrollHeight - scrollRoot.scrollTop - scrollRoot.clientHeight

    if (remaining < scrollThreshold) {
      requestLoad()
    }
  }

  function deactivate() {
    isActive = false
    cleanup()
  }

  onMounted(() => nextTick(setup))
  onActivated(() => {
    isActive = true
    nextTick(setup)
  })
  onDeactivated(deactivate)
  onBeforeUnmount(deactivate)
  watch(() => unref(trigger), () => nextTick(setup))

  return {
    setup,
    cleanup,
    check: requestLoad
  }
}

function resolveValue(value) {
  const resolved = unref(value)

  return typeof resolved === 'function' ? resolved() : resolved
}
