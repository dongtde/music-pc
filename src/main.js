import { createApp } from 'vue'
import {
  NButton,
  NConfigProvider,
  NInput,
  NInputGroup,
  NMessageProvider,
  NModal,
  NTooltip
} from 'naive-ui'
import App from './App.vue'
import router from './router'
import { registerServiceWorker } from './registerServiceWorker'
import { syncStoredKugouBrowserCookies } from './utils/kugouAuth'
import './styles/main.css'
import './styles/home.css'
import './styles/world-shell.css'
import './styles/mobile-theme.css'
import './styles/mobile.css'
import './styles/mobile-pages.css'
import './styles/tablet-home.css'
import './styles/typography.css'
import './styles/route-player-transition.css'
import './styles/detail-cover.css'
import './styles/mobile-detail-drawer.css'

const app = createApp(App)

app.component('NButton', NButton)
app.component('NConfigProvider', NConfigProvider)
app.component('NInput', NInput)
app.component('NInputGroup', NInputGroup)
app.component('NMessageProvider', NMessageProvider)
app.component('NModal', NModal)
app.component('NTooltip', NTooltip)

app.use(router)

syncStoredKugouBrowserCookies()
app.mount('#app')

afterFirstPaint(() => {
  syncStoredKugouBrowserCookies()
})

router.isReady().then(() => {
  afterFirstPaint(registerServiceWorker)
})

function afterFirstPaint(callback) {
  if (typeof window === 'undefined') {
    callback()
    return
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(callback)
  })
}
