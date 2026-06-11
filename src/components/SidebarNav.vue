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
          <button
            v-if="group.action"
            class="mini-action"
            type="button"
            :aria-label="group.actionLabel || group.action"
            @click="handleGroupAction(group)"
          >
            {{ group.action }}
          </button>
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
import { computed, watch } from 'vue'
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
import { useAuthStore } from '../stores/auth'
import { useLibraryStore } from '../stores/library'
import { getUserPlaylistLibraryData } from '../services/netease'

defineProps({
  compact: {
    type: Boolean,
    default: false
  }
})

const route = useRoute()
const auth = useAuthStore()
const library = useLibraryStore()
const displayName = auth.displayName
const avatarUrl = auth.avatarUrl
const icons = { CloudDownload, Compass, Heart, History, House, MicVocal, Music2, Radio, Users, Video }
const sidebarGroups = computed(() => [
  {
    title: '发现',
    items: [
      { label: '发现音乐', to: '/home', icon: 'House' },
      {
        label: '音乐厅',
        to: '/discover/recommend',
        icon: 'Compass',
        activeMatch: '/discover'
      },
      { label: '播客', to: '/podcast', icon: 'MicVocal', activeMatch: '/podcast' },
      { label: '视频', to: '/mv', icon: 'Video' },
      { label: '朋友', to: '/friends', icon: 'Users' }
    ]
  },
  {
    title: '我的音乐',
    items: [
      { label: '本地与下载', to: '/library/local', icon: 'CloudDownload' },
      { label: '最近播放', to: '/library/recent', icon: 'History' },
      {
        label: '我喜欢的音乐',
        to: '/library/liked',
        icon: 'Heart',
        badge: formatBadge(library.likedCount.value)
      }
    ]
  },
  {
    title: '创建的歌单',
    action: '+',
    actionLabel: '新建歌单',
    type: 'created',
    items: library.state.createdPlaylists.map((playlist) => ({
      label: playlist.title,
      to: `/playlist/${playlist.id}`,
      icon: 'Music2'
    }))
  },
  {
    title: '收藏的歌单',
    items: library.state.collectedPlaylists.map((playlist) => ({
      label: playlist.title,
      to: `/playlist/${playlist.id}`,
      icon: 'Music2'
    }))
  }
])

watch(
  () => auth.userId.value,
  (uid) => {
    syncRemotePlaylists(uid)
  },
  { immediate: true }
)

function isActive(item) {
  return item.activeMatch ? route.path.startsWith(item.activeMatch) : route.path === item.to
}

function handleGroupAction(group) {
  if (group.type !== 'created') {
    return
  }

  const title = window.prompt('新建歌单名称')

  if (!title?.trim()) {
    return
  }

  library.createPlaylist(title)
}

function formatBadge(value) {
  return Number(value || 0).toLocaleString('en-US')
}

async function syncRemotePlaylists(uid) {
  if (!uid) {
    return
  }

  try {
    const data = await getUserPlaylistLibraryData(uid)
    library.mergeRemotePlaylists(data)
  } catch (error) {
    console.warn('Failed to sync user playlists:', error)
  }
}
</script>
