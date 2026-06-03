<template>
  <aside class="sidebar">
    <router-link class="profile" to="/discover/recommend">
      <span class="profile-avatar" aria-hidden="true">
        <span />
      </span>
      <span class="profile__text">
        <strong>MusicLover_99</strong>
        <small>Lv.8</small>
      </span>
      <ChevronRight :size="18" />
    </router-link>

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

const route = useRoute()
const icons = { CloudDownload, Compass, Heart, History, Music2, Radio, Users, Video }

function isActive(item) {
  return item.activeMatch ? route.path.startsWith(item.activeMatch) : route.path === item.to
}
</script>
