import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { routes } from './routes'

export default createRouter({
  history: import.meta.env.MODE === 'desktop' ? createWebHashHistory() : createWebHistory(),
  routes
})
