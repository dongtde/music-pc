<template>
  <n-config-provider :theme="naiveTheme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <main class="app-shell" :class="{ 'theme-is-switching': theme.state.animating }">
        <SidebarNav />
        <section class="main-panel">
          <TopBar />
          <router-view />
        </section>
        <PlayerBar />
        <ThemeTransitionOverlay />
      </main>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup>
import { computed } from 'vue'
import { darkTheme } from 'naive-ui'
import SidebarNav from './components/SidebarNav.vue'
import TopBar from './components/TopBar.vue'
import PlayerBar from './components/PlayerBar.vue'
import ThemeTransitionOverlay from './components/ThemeTransitionOverlay.vue'
import { useThemeStore } from './stores/theme'

const theme = useThemeStore()
theme.initTheme()

const naiveTheme = computed(() => (theme.state.mode === 'dark' ? darkTheme : null))

function hexToRgb(color) {
  const value = color.replace('#', '')
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

const themeOverrides = computed(() => {
  const isDark = theme.state.mode === 'dark'
  const primaryColor = theme.state.primaryColor
  const primaryColorHover = mixColor(primaryColor, '#ffffff', 0.18)
  const primaryColorPressed = mixColor(primaryColor, '#000000', 0.18)

  return {
    common: {
      primaryColor,
      primaryColorHover,
      primaryColorPressed,
      borderRadius: '8px',
      bodyColor: isDark ? '#101010' : '#f6f7fb',
      cardColor: isDark ? '#181818' : '#ffffff',
      textColorBase: isDark ? '#f5f7fb' : '#172033'
    },
    Input: {
      color: isDark ? '#222222' : '#ffffff',
      colorFocus: isDark ? '#242424' : '#ffffff',
      textColor: isDark ? '#f5f7fb' : '#172033',
      placeholderColor: isDark ? '#7f8794' : '#8a94a6',
      border: isDark ? '1px solid #333333' : '1px solid #d7dce6',
      borderHover: isDark ? '1px solid #484848' : '1px solid #b9c1d2',
      borderFocus: `1px solid ${primaryColorHover}`,
      boxShadowFocus: 'none'
    }
  }
})
</script>
