<template>
  <n-modal
    v-model:show="modalVisible"
    preset="card"
    class="login-modal"
    :bordered="false"
    :mask-closable="true"
    transform-origin="center"
  >
    <template #header>
      <div class="login-modal__title">
        <span>{{ auth.state.isLoggedIn ? '账号信息' : '登录账号' }}</span>
        <small>{{ headerSubtitle }}</small>
      </div>
    </template>

    <section v-if="auth.state.isLoggedIn" class="login-profile">
      <span class="login-profile__avatar">
        <img
          v-if="auth.avatarUrl.value"
          :src="auth.avatarUrl.value"
          :alt="auth.displayName.value"
          loading="lazy"
          decoding="async"
        />
        <template v-else>{{ auth.displayName.value.slice(0, 1) }}</template>
      </span>
      <div class="login-profile__body">
        <strong>{{ auth.displayName.value }}</strong>
        <small>{{ auth.isGuest.value ? '游客模式' : `ID ${auth.userId.value || '未知'}` }}</small>
      </div>
      <div class="login-profile__actions">
        <button
          class="login-modal__button"
          type="button"
          :disabled="auth.state.loading"
          @click="auth.refreshCurrentLogin"
        >
          <RefreshCw :size="15" :class="{ spin: auth.state.loading }" />
          <span>{{ auth.state.loading ? '刷新中...' : '刷新状态' }}</span>
        </button>
        <button class="login-modal__button" type="button" :disabled="auth.state.loading" @click="auth.logout">
          <LogOut :size="15" />
          <span>{{ auth.state.loading ? '退出中...' : '退出登录' }}</span>
        </button>
      </div>
    </section>

    <section v-else class="login-panel">
      <nav class="login-methods" aria-label="登录方式">
        <button
          v-for="method in loginMethods"
          :key="method.value"
          type="button"
          :class="{ active: loginMethod === method.value }"
          @click="loginMethod = method.value"
        >
          <component :is="method.icon" :size="15" />
          <span>{{ method.label }}</span>
        </button>
      </nav>

      <section v-if="loginMethod === 'qr'" class="login-qr">
        <div class="login-qr__box">
          <div v-if="auth.state.qr.loading" class="login-qr__loading">二维码生成中...</div>
          <img
            v-else-if="auth.state.qr.image"
            class="login-qr__image"
            :src="auth.state.qr.image"
            loading="lazy"
            decoding="async"
            alt="登录二维码"
          />
          <div v-else class="login-qr__loading">二维码暂不可用</div>
        </div>

        <strong
          class="login-qr__status"
          :class="{
            'login-qr__status--confirm': auth.state.qr.status === 802,
            'login-qr__status--expired': auth.state.qr.status === 800 || auth.state.error,
          }"
        >
          {{ auth.state.error || auth.state.qr.message || '等待扫码' }}
        </strong>
        <p>打开 App，扫描二维码完成登录。</p>

        <button class="login-modal__button" type="button" :disabled="auth.state.qr.loading" @click="refreshQr">
          <RefreshCw :size="15" :class="{ spin: auth.state.qr.loading }" />
          <span>{{ auth.state.qr.loading ? '刷新中...' : '刷新二维码' }}</span>
        </button>
      </section>

      <form v-else-if="loginMethod === 'sms'" class="login-form" @submit.prevent="submitSmsLogin">
        <label class="login-field">
          <span>国家码</span>
          <n-input v-model:value="phoneForm.countrycode" placeholder="86" clearable />
        </label>
        <label class="login-field">
          <span>手机号</span>
          <n-input v-model:value="phoneForm.phone" placeholder="请输入手机号" clearable />
        </label>
        <label class="login-field">
          <span>短信验证码</span>
          <n-input-group>
            <n-input v-model:value="phoneForm.captcha" placeholder="请输入验证码" clearable />
            <button
              class="login-send-button"
              type="button"
              :disabled="auth.state.captchaLoading || captchaCooldown > 0"
              @click="sendCaptchaCode"
            >
              {{ captchaButtonText }}
            </button>
          </n-input-group>
        </label>
        <button class="login-modal__button login-modal__button--primary" type="submit" :disabled="auth.state.formLoading">
          <LogIn :size="15" />
          <span>{{ auth.state.formLoading ? '登录中...' : '验证码登录' }}</span>
        </button>
      </form>

      <form v-else-if="loginMethod === 'phone'" class="login-form" @submit.prevent="submitPhoneLogin">
        <label class="login-field">
          <span>国家码</span>
          <n-input v-model:value="phoneForm.countrycode" placeholder="86" clearable />
        </label>
        <label class="login-field">
          <span>手机号</span>
          <n-input v-model:value="phoneForm.phone" placeholder="请输入手机号" clearable />
        </label>
        <label class="login-field">
          <span>密码</span>
          <n-input
            v-model:value="phoneForm.password"
            type="password"
            show-password-on="click"
            placeholder="请输入密码"
            clearable
          />
        </label>
        <button class="login-modal__button login-modal__button--primary" type="submit" :disabled="auth.state.formLoading">
          <Smartphone :size="15" />
          <span>{{ auth.state.formLoading ? '登录中...' : '手机号登录' }}</span>
        </button>
      </form>

      <form v-else-if="loginMethod === 'email'" class="login-form" @submit.prevent="submitEmailLogin">
        <label class="login-field">
          <span>邮箱</span>
          <n-input v-model:value="emailForm.email" placeholder="请输入 163 邮箱" clearable />
        </label>
        <label class="login-field">
          <span>密码</span>
          <n-input
            v-model:value="emailForm.password"
            type="password"
            show-password-on="click"
            placeholder="请输入密码"
            clearable
          />
        </label>
        <button class="login-modal__button login-modal__button--primary" type="submit" :disabled="auth.state.formLoading">
          <Mail :size="15" />
          <span>{{ auth.state.formLoading ? '登录中...' : '邮箱登录' }}</span>
        </button>
      </form>

      <form v-else class="login-form" @submit.prevent="submitCookieLogin">
        <label class="login-field">
          <span>Cookie</span>
          <n-input
            v-model:value="cookieValue"
            type="textarea"
            placeholder="MUSIC_U=..."
            :autosize="{ minRows: 3, maxRows: 5 }"
            clearable
          />
        </label>
        <button class="login-modal__button login-modal__button--primary" type="submit" :disabled="auth.state.formLoading">
          <KeyRound :size="15" />
          <span>{{ auth.state.formLoading ? '登录中...' : '导入 Cookie' }}</span>
        </button>
      </form>

      <p v-if="auth.state.error || auth.state.notice" class="login-feedback" :class="{ error: auth.state.error }">
        {{ auth.state.error || auth.state.notice }}
      </p>

      <button class="login-guest-button" type="button" :disabled="auth.state.formLoading" @click="auth.loginAsGuest">
        <UserRound :size="15" />
        <span>{{ auth.state.formLoading ? '登录中...' : '游客登录' }}</span>
      </button>
    </section>
  </n-modal>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import {
  LogIn,
  LogOut,
  KeyRound,
  Mail,
  MessageCircle,
  QrCode,
  RefreshCw,
  Smartphone,
  UserRound
} from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import '../styles/auth.css'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})
const emit = defineEmits(['update:show'])
const auth = useAuthStore()
const loginMethod = ref('qr')
const cookieValue = ref('')
const phoneForm = reactive({
  countrycode: '86',
  phone: '',
  password: '',
  captcha: ''
})
const emailForm = reactive({
  email: '',
  password: ''
})
const captchaCooldown = ref(0)
let qrTimer = 0
let captchaTimer = 0

const loginMethods = [
  { label: '扫码', value: 'qr', icon: QrCode },
  { label: '验证码', value: 'sms', icon: MessageCircle },
  { label: '手机号', value: 'phone', icon: Smartphone },
  { label: '邮箱', value: 'email', icon: Mail },
  { label: 'Cookie', value: 'cookie', icon: KeyRound }
]

const modalVisible = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

const headerSubtitle = computed(() => {
  if (auth.state.isLoggedIn) {
    return auth.isGuest.value ? '已连接游客凭证' : '已连接账号'
  }

  const subtitles = {
    qr: '使用 App 扫码',
    sms: '使用手机短信验证码',
    phone: '使用手机号和密码',
    email: '使用网易邮箱和密码',
    cookie: '导入已有 MUSIC_U 凭证'
  }

  return subtitles[loginMethod.value]
})

const captchaButtonText = computed(() =>
  captchaCooldown.value > 0 ? `${captchaCooldown.value}s` : auth.state.captchaLoading ? '发送中...' : '发送验证码'
)

watch(
  () => props.show,
  async (show) => {
    if (!show) {
      stopQrPolling()
      return
    }

    await auth.initAuth()

    if (!auth.state.isLoggedIn && loginMethod.value === 'qr') {
      await ensureQrLogin()
    }
  }
)

watch(loginMethod, async (method) => {
  stopQrPolling()

  if (props.show && !auth.state.isLoggedIn && method === 'qr') {
    await ensureQrLogin()
  }
})

watch(
  () => auth.state.isLoggedIn,
  (isLoggedIn) => {
    if (isLoggedIn) {
      stopQrPolling()
    }
  }
)

onBeforeUnmount(() => {
  stopQrPolling()
  stopCaptchaCooldown()
})

async function ensureQrLogin(force = false) {
  if (force || !auth.state.qr.key || auth.state.qr.status === 800) {
    await auth.createQrLogin()
  }

  startQrPolling()
}

async function refreshQr() {
  stopQrPolling()
  await ensureQrLogin(true)
}

async function sendCaptchaCode() {
  const sent = await auth.sendLoginCaptcha(phoneForm)

  if (sent) {
    startCaptchaCooldown()
  }
}

async function submitSmsLogin() {
  const verified = await auth.verifyLoginCaptcha(phoneForm)

  if (!verified) {
    return
  }

  await auth.loginWithCellphone({
    phone: phoneForm.phone,
    countrycode: phoneForm.countrycode,
    captcha: phoneForm.captcha
  })
}

async function submitPhoneLogin() {
  await auth.loginWithCellphone({
    phone: phoneForm.phone,
    countrycode: phoneForm.countrycode,
    password: phoneForm.password
  })
}

async function submitEmailLogin() {
  await auth.loginWithEmail(emailForm)
}

async function submitCookieLogin() {
  await auth.loginWithCookie(cookieValue.value)
}

function startQrPolling() {
  stopQrPolling()

  if (!auth.state.qr.key || auth.state.isLoggedIn || loginMethod.value !== 'qr') {
    return
  }

  qrTimer = window.setInterval(async () => {
    const status = await auth.checkQrLogin()

    if (status === 800 || status === 803 || !props.show || loginMethod.value !== 'qr') {
      stopQrPolling()
    }
  }, 2200)
}

function stopQrPolling() {
  if (qrTimer) {
    window.clearInterval(qrTimer)
    qrTimer = 0
  }
}

function startCaptchaCooldown() {
  stopCaptchaCooldown()
  captchaCooldown.value = 60
  captchaTimer = window.setInterval(() => {
    captchaCooldown.value -= 1

    if (captchaCooldown.value <= 0) {
      stopCaptchaCooldown()
    }
  }, 1000)
}

function stopCaptchaCooldown() {
  if (captchaTimer) {
    window.clearInterval(captchaTimer)
    captchaTimer = 0
  }

  captchaCooldown.value = 0
}
</script>
