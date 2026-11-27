import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { loadRouteLocation } from 'vue-router'

const BACKGROUND_STATE_KEY = 'mobileDetailBackground'

export function useMobileDetailRoutes(router, enabled) {
  const backgroundRoute = shallowRef(router.currentRoute.value)
  const detailRoute = shallowRef(null)
  const open = ref(false)
  const active = ref(false)
  const transitionName = ref('mobile-detail-forward')
  const mainRoute = computed(() => enabled.value ? backgroundRoute.value : router.currentRoute.value)
  let previousPosition = router.options.history.state.position
  let backgroundRequest = 0

  function rememberBackground(path) {
    // Preserve Vue Router's own history fields and the current URL.
    window.history.replaceState({ ...window.history.state, [BACKGROUND_STATE_KEY]: path }, '')
  }

  async function restoreBackground() {
    const request = ++backgroundRequest
    const savedPath = window.history.state?.[BACKGROUND_STATE_KEY]
    let fallback = router.resolve(typeof savedPath === 'string' && savedPath.startsWith('/') ? savedPath : '/home')
    if (!fallback.name || fallback.meta.detail || fallback.meta.desktopLyrics || fallback.name === 'space') {
      fallback = router.resolve('/home')
    }
    // Direct links may never have loaded the background route's lazy component.
    try {
      const loaded = await loadRouteLocation(fallback)
      if (enabled.value && active.value && request === backgroundRequest) {
        backgroundRoute.value = loaded
        rememberBackground(loaded.fullPath)
      }
    } catch {
      // A background load failure must not prevent the detail from opening.
    }
  }

  function syncRoute(to, from, failure) {
    if (failure) return
    const position = router.options.history.state.position
    const goingBack = Number.isFinite(position) && Number.isFinite(previousPosition) && position < previousPosition
    previousPosition = position

    if (!enabled.value) {
      backgroundRequest += 1
      backgroundRoute.value = to
      detailRoute.value = null
      open.value = false
      active.value = false
      return
    }

    if (to.meta.detail) {
      transitionName.value = goingBack ? 'mobile-detail-back' : 'mobile-detail-forward'
      if (!open.value) {
        if (from?.name && !from.meta.detail && !from.meta.desktopLyrics && from.name !== 'space') {
          backgroundRequest += 1
          backgroundRoute.value = from
        } else {
          // Keep unresolved lazy routes out of RouterView until they are loaded.
          backgroundRoute.value = { ...to, matched: [], name: undefined, meta: {} }
          void restoreBackground()
        }
      }
      if (backgroundRoute.value.name) rememberBackground(backgroundRoute.value.fullPath)
      detailRoute.value = to
      active.value = true
      open.value = true
      return
    }

    backgroundRequest += 1
    backgroundRoute.value = to
    open.value = false
  }

  function finishClose() {
    if (open.value) return
    active.value = false
    detailRoute.value = null
  }

  function back() {
    if (!open.value) return
    if (router.options.history.state.back) {
      router.back()
    } else {
      void router.replace(backgroundRoute.value.name ? backgroundRoute.value.fullPath : '/home')
    }
  }

  const removeHook = router.afterEach(syncRoute)
  watch(enabled, () => syncRoute(router.currentRoute.value), { immediate: true })
  onBeforeUnmount(() => {
    backgroundRequest += 1
    removeHook()
  })

  return { mainRoute, detailRoute, open, active, transitionName, back, finishClose }
}
