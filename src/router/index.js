import { createRouter, createWebHistory } from 'vue-router'

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
    component: () => import('../views/FMView.vue'),
    meta: { title: '私人 FM', icon: 'Radio' }
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
    component: () => import('../views/SimpleView.vue'),
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
  }
]

export default createRouter({
  history: createWebHistory(),
  routes
})
