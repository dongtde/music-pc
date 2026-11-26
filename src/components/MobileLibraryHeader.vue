<template>
  <header class="mobile-library-header" aria-label="我的音乐与账号">
    <div class="mobile-library-header__account">
      <button class="mobile-library-profile" type="button" @click="auth.openLoginModal">
        <span class="mobile-library-profile__avatar" aria-hidden="true">
          <img v-if="avatarUrl" :src="avatarUrl" alt="" decoding="async" />
          <UserRound v-else :size="23" />
        </span>
        <span class="mobile-library-profile__text">
          <strong>{{ displayName }}</strong>
          <small>{{ hasAccount ? '我的音乐资料库' : '登录同步音乐与歌单' }}</small>
        </span>
        <ChevronRight :size="18" aria-hidden="true" />
      </button>
      <RouterLink class="mobile-library-settings" to="/settings" aria-label="设置">
        <Settings :size="22" />
      </RouterLink>
    </div>

    <nav class="mobile-library-shortcuts" aria-label="我的音乐">
      <RouterLink
        v-for="item in shortcuts"
        :key="item.to"
        :to="item.to"
        class="mobile-library-shortcut"
      >
        <component :is="item.icon" :size="22" aria-hidden="true" />
        <strong>{{ item.label }}</strong>
        <small>{{ item.count }} 首</small>
      </RouterLink>
    </nav>

    <section class="mobile-library-playlists" aria-label="我的歌单">
      <div class="mobile-library-playlists__head">
        <h2>我的歌单</h2>
        <button
          class="mobile-library-create"
          type="button"
          :disabled="creatingPlaylist"
          :aria-expanded="showCreateForm"
          aria-controls="mobile-library-create-form"
          @click="openCreateForm"
        >
          <Plus :size="17" aria-hidden="true" />
          <span>新建歌单</span>
        </button>
      </div>

      <form
        v-if="showCreateForm"
        id="mobile-library-create-form"
        class="mobile-library-form"
        :aria-busy="creatingPlaylist"
        @submit.prevent="createPlaylist"
        @keydown.esc="closeCreateForm"
      >
        <label for="mobile-library-playlist-name">歌单名称</label>
        <input
          id="mobile-library-playlist-name"
          ref="playlistNameInput"
          v-model="playlistName"
          type="text"
          autocomplete="off"
          placeholder="输入歌单名称"
          :disabled="creatingPlaylist"
          required
        />
        <div class="mobile-library-form__actions">
          <button type="button" :disabled="creatingPlaylist" @click="closeCreateForm">取消</button>
          <button class="mobile-library-form__submit" type="submit" :disabled="creatingPlaylist || !playlistName.trim()">
            {{ creatingPlaylist ? '创建中…' : '创建歌单' }}
          </button>
        </div>
      </form>

      <details v-for="group in playlistGroups" :key="group.key" class="mobile-library-group">
        <summary>
          <Music2 :size="18" aria-hidden="true" />
          <span>{{ group.label }}</span>
          <small>{{ group.playlists.length }}</small>
          <ChevronDown class="mobile-library-group__chevron" :size="17" aria-hidden="true" />
        </summary>
        <nav v-if="group.playlists.length" :aria-label="group.label" class="mobile-library-group__items">
          <RouterLink
            v-for="playlist in group.playlists"
            :key="playlist.id"
            :to="`/playlist/${playlist.id}`"
            class="mobile-library-playlist"
            @pointerdown="preparePlaylistCover(playlist)"
            @focus="preparePlaylistCover(playlist)"
            @click="preparePlaylistCover(playlist)"
          >
            <span class="mobile-library-playlist__cover" aria-hidden="true">
              <img v-if="playlist.coverUrl" :src="playlist.coverUrl" alt="" loading="lazy" decoding="async" @load="preparePlaylistCover(playlist)" />
              <Music2 v-else :size="20" />
            </span>
            <span class="mobile-library-playlist__title">{{ playlist.title }}</span>
            <ChevronRight :size="16" aria-hidden="true" />
          </RouterLink>
        </nav>
        <p v-else class="mobile-library-group__empty">
          {{ hasAccount ? (group.key === 'created' ? '还没有创建的歌单' : '还没有收藏的歌单') : '登录后同步账号歌单' }}
        </p>
      </details>
    </section>
  </header>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronDown, ChevronRight, CloudDownload, Heart, History, Music2, Plus, Settings, UserRound } from 'lucide-vue-next'
import { useMessage } from 'naive-ui'
import { useAuthStore } from '../stores/auth'
import { useLibraryStore } from '../stores/library'
import { createUserPlaylistData, getUserPlaylistLibraryData } from '../services/netease'
import { preparePlaylistCover } from '../utils/playlistPreview'

const auth = useAuthStore()
const library = useLibraryStore()
const message = useMessage()
const displayName = auth.displayName
const avatarUrl = auth.avatarUrl
const hasAccount = computed(() => auth.state.isLoggedIn && !auth.isGuest.value)
const creatingPlaylist = ref(false)
const showCreateForm = ref(false)
const playlistName = ref('')
const playlistNameInput = ref(null)
const shortcuts = computed(() => [
  { label: '我喜欢', to: '/library/liked', icon: Heart, count: library.likedCount.value },
  { label: '最近播放', to: '/library/recent', icon: History, count: library.state.recentTracks.length },
  { label: '本地与下载', to: '/library/local', icon: CloudDownload, count: library.state.localTracks.length }
])
const playlistGroups = computed(() => [
  { key: 'created', label: '创建的歌单', playlists: hasAccount.value ? library.state.createdPlaylists : [] },
  { key: 'collected', label: '收藏的歌单', playlists: hasAccount.value ? library.state.collectedPlaylists : [] }
])

async function openCreateForm() {
  if (!hasAccount.value || !auth.userId.value) {
    auth.openLoginModal()
    message.info('请先登录酷狗账号')
    return
  }

  showCreateForm.value = true
  await nextTick()
  playlistNameInput.value?.focus()
}

function closeCreateForm() {
  if (!creatingPlaylist.value) {
    showCreateForm.value = false
    playlistName.value = ''
  }
}

async function createPlaylist() {
  if (creatingPlaylist.value || !playlistName.value.trim()) {
    return
  }

  if (!hasAccount.value || !auth.userId.value) {
    await openCreateForm()
    return
  }

  const uid = auth.userId.value
  const name = playlistName.value.trim()
  let created = false
  creatingPlaylist.value = true

  try {
    await createUserPlaylistData({ name })
    created = true
    showCreateForm.value = false
    playlistName.value = ''

    if (!isCurrentAccount(uid)) {
      return
    }

    // SidebarNav retains the account-sync watcher; refresh only after this mutation.
    const data = await getUserPlaylistLibraryData(uid)
    if (isCurrentAccount(uid)) {
      library.replaceRemotePlaylists(data)
      message.success('歌单已创建')
    }
  } catch (error) {
    console.warn('Failed to create user playlist:', error)
    if (created) {
      message.warning('歌单已创建，列表刷新失败')
    } else {
      message.error(error?.message || '歌单创建失败')
    }
  } finally {
    creatingPlaylist.value = false
  }
}

function isCurrentAccount(uid) {
  return hasAccount.value && String(auth.userId.value) === String(uid)
}
</script>

<style scoped>
.mobile-library-header { display: grid; min-width: 0; gap: 24px; margin-bottom: 28px; color: var(--mobile-text); }
.mobile-library-header a { color: inherit; text-decoration: none; }
.mobile-library-header :is(button, input) { box-sizing: border-box; font: inherit; }
.mobile-library-header button { cursor: pointer; }
.mobile-library-header button:disabled { cursor: wait; opacity: .55; }
.mobile-library-header :is(button, a, input, summary):focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }

.mobile-library-header__account { display: flex; min-width: 0; align-items: center; gap: 12px; padding-block: 4px; }
.mobile-library-profile { display: flex; min-width: 0; min-height: 68px; flex: 1; align-items: center; gap: 14px; padding: 0; border: 0; color: inherit; background: transparent; text-align: left; }
.mobile-library-profile__avatar { display: grid; width: 64px; height: 64px; flex: 0 0 64px; place-items: center; overflow: hidden; border-radius: 50%; color: var(--mobile-text-soft); background: var(--mobile-surface-soft); }
.mobile-library-profile__avatar img,
.mobile-library-playlist__cover img { width: 100%; height: 100%; object-fit: cover; }
.mobile-library-profile__text { display: grid; min-width: 0; flex: 1; gap: 6px; }
.mobile-library-profile__text strong { overflow: hidden; color: var(--mobile-text); font-size: 22px; font-weight: 650; line-height: 1.3; text-overflow: ellipsis; white-space: nowrap; }
.mobile-library-profile__text small { color: var(--mobile-muted); font-size: 12px; line-height: 1.4; }
.mobile-library-profile > svg { color: var(--mobile-muted); }
.mobile-library-settings { display: grid; width: 44px; height: 44px; flex: 0 0 44px; place-items: center; border: 0; border-radius: 12px; color: var(--mobile-text-soft); background: var(--mobile-surface-soft); }

.mobile-library-shortcuts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; padding: 6px; border-radius: 18px; background: var(--mobile-surface); }
.mobile-library-shortcut { position: relative; display: grid; min-width: 0; min-height: 92px; align-content: center; justify-items: center; gap: 6px; border: 0; border-radius: 12px; background: transparent; }
.mobile-library-shortcut svg { color: var(--mobile-text-soft); }
.mobile-library-shortcut strong { font-size: 13px; font-weight: 550; line-height: 1.4; }
.mobile-library-shortcut small { color: var(--mobile-muted); font-size: 11px; }
.mobile-library-shortcut.router-link-active { color: var(--accent); background: rgba(var(--accent-rgb), .075); }
.mobile-library-shortcut.router-link-active svg { color: var(--accent); }

.mobile-library-playlists { min-width: 0; }
.mobile-library-playlists__head,
.mobile-library-group summary { display: flex; min-height: 48px; align-items: center; gap: 10px; }
.mobile-library-playlists__head { justify-content: space-between; margin-bottom: 6px; }
.mobile-library-playlists__head h2 { margin: 0; color: var(--mobile-text); font-size: 20px; font-weight: 650; letter-spacing: -.3px; }
.mobile-library-header .mobile-library-create { display: inline-flex; min-height: 44px; align-items: center; gap: 4px; padding: 0 4px; border: 0; border-radius: 8px; color: var(--accent); background: transparent; font-size: 13px; font-weight: 500; }
.mobile-library-group { border-bottom: 1px solid var(--mobile-border); }
.mobile-library-group summary { min-height: 54px; list-style: none; cursor: pointer; color: var(--mobile-text-soft); font-size: 15px; }
.mobile-library-group summary::-webkit-details-marker { display: none; }
.mobile-library-group summary > span { flex: 1; }
.mobile-library-group summary > svg:first-child { color: var(--mobile-muted); }
.mobile-library-group summary > small { min-width: 22px; color: var(--mobile-muted); font-size: 12px; text-align: center; }
.mobile-library-group__chevron { color: var(--mobile-muted); transition: transform 180ms ease; }
.mobile-library-group:not([open]) .mobile-library-group__chevron { transform: rotate(-90deg); }
.mobile-library-group__items { display: grid; gap: 4px; padding: 4px 0 12px; }
.mobile-library-playlist { display: flex; min-width: 0; min-height: 60px; align-items: center; gap: 12px; border-radius: 12px; }
.mobile-library-playlist__cover { display: grid; width: 44px; height: 44px; flex: 0 0 44px; place-items: center; overflow: hidden; border-radius: 10px; color: var(--mobile-muted); background: var(--mobile-surface-soft); }
.mobile-library-playlist__title { min-width: 0; flex: 1; overflow: hidden; font-size: 15px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.mobile-library-playlist > svg { color: var(--mobile-muted); }
.mobile-library-group__empty { margin: 4px 0 16px 28px; color: var(--mobile-muted); font-size: 13px; line-height: 1.7; }

.mobile-library-form { display: grid; gap: 12px; margin: 8px 0 16px; padding: 16px; border: 0; border-radius: 16px; background: var(--mobile-surface); }
.mobile-library-form label { font-size: 14px; font-weight: 500; }
.mobile-library-form input { width: 100%; min-width: 0; min-height: 44px; padding: 0 12px; border: 1px solid var(--mobile-border-strong); border-radius: 10px; color: var(--mobile-text); background: var(--mobile-bg); font-size: 16px; }
.mobile-library-form__actions { display: flex; justify-content: flex-end; gap: 8px; }
.mobile-library-form__actions button { min-width: 64px; min-height: 44px; padding: 0 16px; border: 0; border-radius: 10px; color: var(--mobile-text); background: var(--mobile-surface-soft); }
.mobile-library-form__actions .mobile-library-form__submit { color: #fff; background: var(--accent); font-weight: 550; }
.mobile-library-header :is(a, button, summary):active { opacity: .7; }
@media (prefers-reduced-motion: reduce) { .mobile-library-group__chevron { transition: none; } }
</style>
