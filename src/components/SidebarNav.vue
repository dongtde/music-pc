<template>
  <aside class="sidebar" :class="{ 'sidebar--compact': compact }">
    <div class="profile-card">
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
          <small v-if="!auth.state.isLoggedIn">扫码登录同步账号</small>
        </span>
        <ChevronRight :size="18" />
      </button>
      <button class="vip-button profile-vip-button" type="button" aria-label="开通 VIP">
        <Crown :size="13" />
        <span>开通VIP</span>
      </button>
    </div>

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
          :aria-label="item.label"
          :title="compact ? item.label : undefined"
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
  Crown,
  Heart,
  History,
  House,
  MicVocal,
  Music2,
  Radio,
  Users,
  Video
} from 'lucide-vue-next'
import { sidebarGroups } from '../data/music'
import { useAuthStore } from '../stores/auth'

defineProps({
  compact: {
    type: Boolean,
    default: false
  }
})

const route = useRoute()
const auth = useAuthStore()
const displayName = auth.displayName
const avatarUrl = auth.avatarUrl
const icons = { CloudDownload, Compass, Heart, History, House, MicVocal, Music2, Radio, Users, Video }

function isActive(item) {
  return item.activeMatch ? route.path.startsWith(item.activeMatch) : route.path === item.to
}
</script>
