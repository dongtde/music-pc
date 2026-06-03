<template>
  <header class="topbar">
    <div class="history-actions">
      <button type="button" aria-label="后退"><ChevronLeft :size="20" /></button>
      <button type="button" aria-label="前进"><ChevronRight :size="20" /></button>
    </div>

    <n-input round clearable placeholder="搜索音乐、歌手、歌词、用户" class="search-input">
      <template #prefix>
        <Search :size="18" />
      </template>
    </n-input>

    <div class="topbar__spacer" />
    <button class="icon-button" type="button" aria-label="消息"><Mail :size="18" /></button>
    <button
      class="icon-button"
      type="button"
      :aria-label="theme.state.mode === 'dark' ? '切换浅色主题' : '切换深色主题'"
      @click="theme.toggleTheme"
    >
      <Sun v-if="theme.state.mode === 'dark'" :size="18" />
      <Moon v-else :size="18" />
    </button>
    <router-link class="icon-button" to="/settings" aria-label="设置">
      <Settings :size="18" />
    </router-link>
    <span class="divider" />
    <button class="vip-button" type="button">开通VIP</button>
    <n-avatar round :size="28" color="#ffa51f">V</n-avatar>
  </header>
</template>

<script setup>
import { ChevronLeft, ChevronRight, Mail, Moon, Search, Settings, Sun } from 'lucide-vue-next'
import { useThemeStore } from '../stores/theme'

const theme = useThemeStore()
</script>
