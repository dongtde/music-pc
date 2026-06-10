import { nextTick, reactive } from 'vue'
import { STORAGE_KEYS } from '../config/app'
import { readJsonStorage, writeJsonStorage } from '../utils/storage'

export const defaultThemeColor = '#ff3f73'

export const themeColorPresets = [
  { label: '玫瑰粉', value: '#ff3f73' },
  { label: '电音紫', value: '#8a5cff' },
  { label: '湖水青', value: '#1dbf9f' },
  { label: '海岸蓝', value: '#3f8cff' },
  { label: '日落橙', value: '#ff8a3d' },
  { label: '荧光绿', value: '#52c96f' }
]

export const transitionEffects = [
  {
    label: '柔和淡入',
    value: 'fade',
    desc: '用透明度变化完成切换'
  },
  {
    label: '横向幕布',
    value: 'wipe',
    desc: '从左到右扫过页面，适合干净利落的切换'
  },
  {
    label: '圆形扩散',
    value: 'circle',
    desc: '从右上角向外扩散，强调开关触发点'
  },
  {
    label: '滑动翻页',
    value: 'slide',
    desc: '像切换唱片页一样横向滑过'
  },
  {
    label: '模糊光晕',
    value: 'blur',
    desc: '用短暂模糊和光晕弱化颜色跳变'
  }
]

export const queueTransitionEffects = [
  {
    label: '右侧滑入',
    value: 'slide-left',
    desc: '播放列表从右侧进入'
  },
  {
    label: '柔和淡入',
    value: 'fade',
    desc: '用透明度显示播放列表'
  },
  {
    label: '轻微上浮',
    value: 'rise',
    desc: '从底部轻轻浮出'
  },
  {
    label: '缩放展开',
    value: 'scale',
    desc: '从右下角展开面板'
  }
]

function readPreferences() {
  return readJsonStorage(STORAGE_KEYS.themePreferences, {})
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

const state = reactive({
  mode: saved.mode || 'dark',
  transition: saved.transition || 'fade',
  queueTransition: saved.queueTransition || 'slide-left',
  primaryColor: normalizeHex(saved.primaryColor || defaultThemeColor),
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
    primaryColor: state.primaryColor
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

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
    previewTransition
  }
}
