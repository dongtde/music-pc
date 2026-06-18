import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'

const PodcastView = () => import('../views/PodcastView.vue')

const routes = [
  { path: '/', redirect: '/home' },
  {
    path: '/home',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
    meta: { title: '音乐流', icon: 'House' }
  },
  {
    path: '/discover/:tab?',
    name: 'discover',
    component: () => import('../views/DiscoverView.vue'),
    meta: { title: '发现音乐' }
  },
  {
    path: '/fm',
    name: 'fm',
    redirect: '/podcast'
  },
  {
    path: '/podcast',
    name: 'podcast',
    component: PodcastView,
    meta: { title: '电台', icon: 'RadioTower' }
  },
  {
    path: '/podcast/rank',
    name: 'podcast-rank',
    component: PodcastView,
    meta: { title: '电台榜单', icon: 'RadioTower' }
  },
  {
    path: '/podcast/sleep',
    name: 'podcast-sleep',
    component: PodcastView,
    meta: { title: '乐库电台', icon: 'RadioTower' }
  },
  {
    path: '/podcast/radio',
    name: 'podcast-radio',
    component: PodcastView,
    meta: { title: '全部电台', icon: 'RadioTower' }
  },
  {
    path: '/podcast/:id',
    name: 'podcast-detail',
    component: () => import('../views/PodcastDetailView.vue'),
    meta: { title: '电台详情', icon: 'RadioTower' }
  },
  {
    path: '/mv',
    name: 'video',
    alias: '/video',
    component: () => import('../views/VideoView.vue'),
    meta: { title: '视频', icon: 'Video' }
  },
  {
    path: '/friends',
    name: 'friends',
    component: () => import('../views/SimpleView.vue'),
    meta: { title: '朋友', icon: 'Users' }
  },
  {
    path: '/library/:type',
    name: 'library',
    component: () => import('../views/LibraryView.vue'),
    meta: { title: '我的音乐', icon: 'Music' }
  },
  {
    path: '/playlist/:id',
    name: 'playlist',
    component: () => import('../views/PlaylistDetailView.vue'),
    meta: { title: '歌单', icon: 'ListMusic' }
  },
  {
    path: '/album/:id',
    name: 'album',
    component: () => import('../views/AlbumDetailView.vue'),
    meta: { title: '专辑', icon: 'Disc3' }
  },
  {
    path: '/artist/:id',
    name: 'artist',
    component: () => import('../views/ArtistDetailView.vue'),
    meta: { title: '歌手', icon: 'User' }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsView.vue'),
    meta: { title: '设置', icon: 'Settings' }
  },
  {
    path: '/desktop-lyrics',
    name: 'desktop-lyrics',
    component: () => import('../views/DesktopLyricsView.vue'),
    meta: { title: '桌面歌词', desktopLyrics: true }
  }
]

export default createRouter({
  history: import.meta.env.MODE === 'desktop' ? createWebHashHistory() : createWebHistory(),
  routes
})
