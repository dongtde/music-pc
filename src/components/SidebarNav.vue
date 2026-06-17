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
      <n-tooltip
        v-if="showVipButton"
        raw
        trigger="hover"
        placement="bottom-start"
        :show-arrow="false"
        content-class="profile-vip-tooltip-popover"
        :disabled="!vipTooltipText"
      >
        <template #trigger>
          <span class="profile-vip-button-wrap">
            <button
              class="vip-button profile-vip-button"
              :class="{
                'is-active': auth.state.vip.active,
                'is-busy': auth.state.vip.loading || auth.state.vip.claiming
              }"
              type="button"
              :aria-label="vipTooltipText || vipButtonText"
              :disabled="vipButtonDisabled"
              @click="handleVipButtonClick"
            >
              <Crown :size="13" />
              <span>{{ vipButtonText }}</span>
            </button>
          </span>
        </template>
        <div v-if="vipTooltipText" class="profile-vip-tooltip">
          {{ vipTooltipText }}
        </div>
      </n-tooltip>
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
import { useMessage } from 'naive-ui'
import {
  ChevronRight,
  CloudDownload,
  Compass,
  Crown,
  Heart,
  History,
  House,
  Music2,
  Radio,
  RadioTower,
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
const message = useMessage()
const displayName = auth.displayName
const avatarUrl = auth.avatarUrl
const icons = { CloudDownload, Compass, Heart, History, House, Music2, Radio, RadioTower, Users, Video }
const endTimeLabel = '\u5230\u671f'
const showVipButton = computed(() => auth.state.isLoggedIn && !auth.isGuest.value)
const vipButtonText = computed(() => {
  if (auth.state.vip.claiming) {
    return '领取中'
  }

  if (auth.state.vip.loading) {
    return '检测中'
  }

  return auth.state.vip.active ? 'SVIP\u5df2\u5f00\u901a' : '\u5f00\u901aSVIP'
})
const vipButtonDisabled = computed(() => auth.state.vip.loading || auth.state.vip.claiming)
const busiVipList = computed(() => {
  const busiVipList = auth.state.vip.raw?.data?.busi_vip

  return Array.isArray(busiVipList) ? busiVipList : []
})
const activeBusiVip = computed(() => {
  return busiVipList.value.find((item) => {
    return isValidBusiVip(item) && Number(item.is_vip) > 0
  }) ?? busiVipList.value.find((item) => {
    return isValidBusiVip(item) && isFutureTime(item.vip_end_time)
  }) ?? null
})
const secondBusiVip = computed(() => {
  const item = busiVipList.value[1]

  return isValidBusiVip(item) ? item : null
})
const vipTooltipText = computed(() => {
  const vip = activeBusiVip.value

  if (!vip) {
    return ''
  }

  const endTime = secondBusiVip.value?.vip_end_time || vip.vip_end_time || ''

  return endTime ? `${endTimeLabel} ${endTime}` : ''
})
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
      { label: '电台', to: '/podcast', icon: 'RadioTower', activeMatch: '/podcast' },
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

async function handleVipButtonClick() {
  if (!auth.state.isLoggedIn || auth.isGuest.value) {
    auth.openLoginModal()
    message.info('请先登录酷狗账号')
    return
  }

  if (!auth.state.vip.loaded && !auth.state.vip.loading) {
    await auth.refreshVipStatus()
  }

  if (auth.state.vip.active) {
    message.success('VIP 已开通')
    return
  }

  const result = await auth.claimDailyVip()

  if (result?.ok) {
    message.success(auth.state.vip.active ? 'VIP 已开通' : '已提交 VIP 领取请求')
  } else if (result?.reason !== 'login-required') {
    message.error(result?.error?.message || 'VIP 领取失败，请稍后再试')
  }
}

function formatBadge(value) {
  return Number(value || 0).toLocaleString('en-US')
}

function isValidBusiVip(item) {
  return Boolean(item && typeof item === 'object')
}

function isFutureTime(value) {
  if (!value) {
    return false
  }

  const time = new Date(String(value).replace(' ', 'T')).getTime()
  return Number.isFinite(time) && time > Date.now()
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
