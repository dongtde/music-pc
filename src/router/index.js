import { createRouter, createWebHistory } from 'vue-router'
import AlbumDetailView from '../views/AlbumDetailView.vue'
import ArtistDetailView from '../views/ArtistDetailView.vue'
import DiscoverView from '../views/DiscoverView.vue'
import FMView from '../views/FMView.vue'
import HomeView from '../views/HomeView.vue'
import PlaylistDetailView from '../views/PlaylistDetailView.vue'
import SettingsView from '../views/SettingsView.vue'
import SimpleView from '../views/SimpleView.vue'
import VideoView from '../views/VideoView.vue'

const routes = [
  { path: '/', redirect: '/home' },
  {
    path: '/home',
    name: 'home',
    component: HomeView,
    meta: { title: '音乐流', icon: 'House' }
  },
  {
    path: '/discover/:tab?',
    name: 'discover',
    component: DiscoverView,
    meta: { title: '发现音乐' }
  },
  {
    path: '/fm',
    name: 'fm',
    component: FMView,
    meta: { title: '私人 FM', icon: 'Radio' }
  },
  {
    path: '/mv',
    name: 'video',
    alias: '/video',
    component: VideoView,
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
    path: '/album/:id',
    name: 'album',
    component: AlbumDetailView,
    meta: { title: '专辑', icon: 'Disc3' }
  },
  {
    path: '/artist/:id',
    name: 'artist',
    component: ArtistDetailView,
    meta: { title: '歌手', icon: 'User' }
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
