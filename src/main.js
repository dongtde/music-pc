import { createApp } from 'vue'
import {
  NButton,
  NConfigProvider,
  NInput,
  NInputGroup,
  NMessageProvider,
  NModal
} from 'naive-ui'
import App from './App.vue'
import router from './router'
import './styles/main.css'

const app = createApp(App)

app.component('NButton', NButton)
app.component('NConfigProvider', NConfigProvider)
app.component('NInput', NInput)
app.component('NInputGroup', NInputGroup)
app.component('NMessageProvider', NMessageProvider)
app.component('NModal', NModal)

app.use(router).mount('#app')
