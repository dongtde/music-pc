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

const app = createApp(App)

app.component('NButton', NButton)
app.component('NConfigProvider', NConfigProvider)
app.component('NInput', NInput)
app.component('NInputGroup', NInputGroup)
app.component('NMessageProvider', NMessageProvider)
app.component('NModal', NModal)
app.component('NTooltip', NTooltip)

app.use(router)

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
