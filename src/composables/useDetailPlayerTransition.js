import { nextTick, onBeforeUnmount, ref } from 'vue'

// Hide the shared player before changing layouts and reveal it after the new
// route has entered. Keep the target route so cancelled navigations cannot
// reveal the controls during a newer transition.
export function useDetailPlayerTransition(router, { enabled, getDuration }) {
  const hidden = ref(false)
  let targetRoute = null
  let hideTimer = 0
  let resolveHide = null

  function finishHideWait() {
    window.clearTimeout(hideTimer)
    hideTimer = 0
    const resolve = resolveHide
    resolveHide = null
    resolve?.()
  }

  function reset() {
    finishHideWait()
    targetRoute = null
    hidden.value = false
  }

  const removeGuard = router.beforeEach(async (to, from) => {
    finishHideWait()
    if (!enabled() || !from.name || to.path === from.path || !(to.meta.detail || from.meta.detail)) {
      reset()
      return
    }

    targetRoute = to
    hidden.value = true
    await nextTick()
    if (targetRoute !== to) return

    const duration = getDuration()
    if (duration > 0) {
      await new Promise(resolve => {
        resolveHide = resolve
        hideTimer = window.setTimeout(finishHideWait, duration)
      })
    }
  })

  const removeAfterHook = router.afterEach((to, from, failure) => {
    if (failure && targetRoute === to) reset()
  })
  const removeErrorHook = router.onError((error, to) => {
    if (targetRoute === to) reset()
  })

  function finishEnter(element, path) {
    if (element.isConnected && targetRoute?.fullPath === path && router.currentRoute.value.fullPath === path) {
      reset()
    }
  }

  onBeforeUnmount(() => {
    removeGuard()
    removeAfterHook()
    removeErrorHook()
    reset()
  })

  return { hidden, finishEnter }
}
