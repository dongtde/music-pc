<template>
  <div
    v-if="theme.state.animating && !theme.state.usingViewTransition"
    :key="theme.state.animationKey"
    class="theme-overlay"
    :class="`theme-overlay--${theme.state.transition}`"
    aria-hidden="true"
  />
</template>

<script setup>
import { useThemeStore } from '../stores/theme'

const theme = useThemeStore()
</script>
