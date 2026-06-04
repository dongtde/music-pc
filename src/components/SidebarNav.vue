<template>
  <aside class="sidebar">
    <button class="profile" type="button" @click="auth.openLoginModal">
      <span class="profile-avatar" aria-hidden="true">
        <img
          v-if="avatarUrl"
          :src="avatarUrl"
          :alt="displayName"
          loading="lazy"
          decoding="async"
        />
        <span v-else />
      </span>
      <span class="profile__text">
        <strong>{{ displayName }}</strong>
        <small>{{ auth.state.isLoggedIn ? '网易云音乐' : '扫码登录同步账号' }}</small>
      </span>
      <ChevronRight :size="18" />
    </button>

    <nav class="nav-groups" aria-label="音乐导航">
      <section v-for="group in sidebarGroups" :key="group.title" class="nav-group">
        <div class="nav-title">
          <span>{{ group.title }}</span>
          <button v-if="group.action" class="mini-action" type="button">{{ group.action }}</button>
        </div>
        <router-link
          v-for="item in group.items"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ 'is-active': isActive(item) }"
        >
          <component :is="icons[item.icon]" :size="18" />
          <span>{{ item.label }}</span>
          <em v-if="item.badge">{{ item.badge }}</em>
        </router-link>
      </section>
    </nav>
  </aside>
</template>

<script setup>
import { useRoute } from 'vue-router'
import {
  ChevronRight,
  CloudDownload,
  Compass,
  Heart,
  History,
  Music2,
  Radio,
  Users,
  Video
} from 'lucide-vue-next'
import { sidebarGroups } from '../data/music'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const auth = useAuthStore()
const displayName = auth.displayName
const avatarUrl = auth.avatarUrl
const icons = { CloudDownload, Compass, Heart, History, Music2, Radio, Users, Video }

function isActive(item) {
  return item.activeMatch ? route.path.startsWith(item.activeMatch) : route.path === item.to
}
</script>
