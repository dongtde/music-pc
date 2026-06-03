import { createRouter, createWebHistory } from 'vue-router'
import DiscoverView from '../views/DiscoverView.vue'
import PlaylistDetailView from '../views/PlaylistDetailView.vue'
import SettingsView from '../views/SettingsView.vue'
import SimpleView from '../views/SimpleView.vue'

const routes = [
  { path: '/', redirect: '/discover/recommend' },
  {
    path: '/discover/:tab?',
    name: 'discover',
    component: DiscoverView,
    meta: { title: '发现音乐' }
  },
  {
    path: '/fm',
    name: 'fm',
    component: SimpleView,
    meta: { title: '私人 FM', icon: 'Radio' }
  },
  {
    path: '/video',
    name: 'video',
    component: SimpleView,
    meta: { title: '视频', icon: 'Video' }
  },
  {
    path: '/friends',
    name: 'friends',
    component: SimpleView,
    meta: { title: '朋友', icon: 'Users' }
  },
  {
    path: '/library/:type',
    name: 'library',
    component: SimpleView,
    meta: { title: '我的音乐', icon: 'Music' }
  },
  {
    path: '/playlist/:id',
    name: 'playlist',
    component: PlaylistDetailView,
    meta: { title: '歌单', icon: 'ListMusic' }
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsView,
    meta: { title: '设置', icon: 'Settings' }
  }
]

export default createRouter({
  history: createWebHistory(),
  routes
})
