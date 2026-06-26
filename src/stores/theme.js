import { nextTick, reactive } from 'vue'
import {
  QUEUE_TRANSITION_EFFECTS,
  SETTINGS_DEFAULTS,
  STORAGE_KEYS,
  THEME_COLOR_PRESETS,
  THEME_MODE_OPTIONS,
  THEME_TRANSITION_EFFECTS
} from '../config/app'
import { readJsonStorage, writeJsonStorage } from '../utils/storage'

export const defaultThemeColor = SETTINGS_DEFAULTS.theme.primaryColor
export const themeColorPresets = THEME_COLOR_PRESETS
export const transitionEffects = THEME_TRANSITION_EFFECTS
export const queueTransitionEffects = QUEUE_TRANSITION_EFFECTS

function readPreferences() {
  return readJsonStorage(STORAGE_KEYS.themePreferences, {})
}

function includesValue(options, value) {
  return options.some((option) => option.value === value)
}

function normalizeChoice(value, options, fallback) {
  return includesValue(options, value) ? value : fallback
}

function normalizeHex(color) {
  if (typeof color !== 'string') {
    return defaultThemeColor
  }

  const value = color.trim()
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : defaultThemeColor
}

function hexToRgb(color) {
  const value = normalizeHex(color).slice(1)
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16)
  ]
}

function toHex(value) {
  return Math.round(value).toString(16).padStart(2, '0')
}

function mixColor(color, target, amount) {
  const sourceRgb = hexToRgb(color)
  const targetRgb = hexToRgb(target)
  const nextRgb = sourceRgb.map((channel, index) => channel + (targetRgb[index] - channel) * amount)
  return `#${nextRgb.map(toHex).join('')}`
}

const saved = readPreferences()
const themeDefaults = SETTINGS_DEFAULTS.theme

const state = reactive({
  mode: normalizeChoice(saved.mode, THEME_MODE_OPTIONS, themeDefaults.mode),
  transition: normalizeChoice(saved.transition, transitionEffects, themeDefaults.transition),
  queueTransition: normalizeChoice(saved.queueTransition, queueTransitionEffects, themeDefaults.queueTransition),
  primaryColor: normalizeHex(saved.primaryColor || themeDefaults.primaryColor),
  reducedMotion: Boolean(saved.reducedMotion ?? themeDefaults.reducedMotion),
  animating: false,
  usingViewTransition: false,
  animationKey: 0
})

let timer = null

function persistPreferences() {
  writeJsonStorage(STORAGE_KEYS.themePreferences, {
    mode: state.mode,
    transition: state.transition,
    queueTransition: state.queueTransition,
    primaryColor: state.primaryColor,
    reducedMotion: state.reducedMotion
  })
}

function applyTheme(mode) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = mode
  }
}

function applyThemeColor(color) {
  if (typeof document === 'undefined') {
    return
  }

  const nextColor = normalizeHex(color)
  const [red, green, blue] = hexToRgb(nextColor)
  document.documentElement.style.setProperty('--accent', nextColor)
  document.documentElement.style.setProperty('--accent-rgb', `${red}, ${green}, ${blue}`)
  document.documentElement.style.setProperty('--accent-hover', mixColor(nextColor, '#ffffff', 0.18))
  document.documentElement.style.setProperty('--accent-pressed', mixColor(nextColor, '#000000', 0.18))
}

function applyReducedMotion(enabled) {
  if (typeof document === 'undefined') {
    return
  }

  if (enabled) {
    document.documentElement.dataset.reducedMotion = 'true'
    return
  }

  delete document.documentElement.dataset.reducedMotion
}

function prefersReducedMotion() {
  return (
    state.reducedMotion ||
    (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  )
}

function canUseViewTransition() {
  return (
    typeof document !== 'undefined' &&
    typeof document.startViewTransition === 'function' &&
    !prefersReducedMotion()
  )
}

function playFallbackTransition() {
  if (typeof window === 'undefined') {
    return
  }

  window.clearTimeout(timer)
  state.animating = false
  state.usingViewTransition = false

  if (prefersReducedMotion()) {
    return
  }

  state.animationKey += 1

  window.requestAnimationFrame(() => {
    state.animating = true
    timer = window.setTimeout(() => {
      state.animating = false
    }, 760)
  })
}

function finishViewTransition() {
  if (typeof document !== 'undefined') {
    delete document.documentElement.dataset.viewTransition
  }

  state.animating = false
  state.usingViewTransition = false
}

async function runViewTransition(update) {
  if (!canUseViewTransition()) {
    update()
    await nextTick()
    playFallbackTransition()
    return
  }

  window.clearTimeout(timer)
  document.documentElement.dataset.viewTransition = state.transition
  state.animating = true
  state.usingViewTransition = true
  state.animationKey += 1

  const transition = document.startViewTransition(async () => {
    update()
    await nextTick()
  })

  transition.finished.then(finishViewTransition).catch(finishViewTransition)
}

export function useThemeStore() {
  function initTheme() {
    applyTheme(state.mode)
    applyThemeColor(state.primaryColor)
    applyReducedMotion(state.reducedMotion)
  }

  function setTheme(mode) {
    if (state.mode === mode) {
      playFallbackTransition()
      return
    }

    runViewTransition(() => {
      state.mode = mode
      applyTheme(mode)
      persistPreferences()
    })
  }

  function toggleTheme() {
    setTheme(state.mode === 'dark' ? 'light' : 'dark')
  }

  function setThemeColor(color) {
    const nextColor = normalizeHex(color)

    if (state.primaryColor === nextColor) {
      playFallbackTransition()
      return
    }

    runViewTransition(() => {
      state.primaryColor = nextColor
      applyThemeColor(nextColor)
      persistPreferences()
    })
  }

  function setTransition(effect) {
    state.transition = effect
    persistPreferences()
  }

  function setQueueTransition(effect) {
    state.queueTransition = effect
    persistPreferences()
  }

  function setReducedMotion(enabled) {
    const nextValue = Boolean(enabled)

    if (state.reducedMotion === nextValue) {
      return
    }

    state.reducedMotion = nextValue
    applyReducedMotion(nextValue)

    if (nextValue) {
      if (typeof window !== 'undefined') {
        window.clearTimeout(timer)
      }

      finishViewTransition()
    }

    persistPreferences()
  }

  function previewTransition() {
    playFallbackTransition()
  }

  return {
    state,
    colors: themeColorPresets,
    effects: transitionEffects,
    queueEffects: queueTransitionEffects,
    initTheme,
    setTheme,
    toggleTheme,
    setThemeColor,
    setTransition,
    setQueueTransition,
    setReducedMotion,
    previewTransition
  }
}
