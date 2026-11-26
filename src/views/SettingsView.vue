<template>
  <div class="view settings-view">
    <header class="settings-header">
      <div>
        <span class="settings-kicker">偏好设置</span>
        <h1>整理你的听歌界面</h1>
        <p>把颜色、主题和弹窗动效调成顺手的样子。</p>
      </div>
    </header>

    <section class="settings-layout">
      <div class="settings-panel">
        <div class="setting-block">
          <div class="setting-block__head">
            <Palette :size="22" />
            <div>
              <h2>主题模式</h2>
              <p>切换适合当前环境的显示方式。</p>
            </div>
          </div>

          <div class="theme-choice">
            <button
              type="button"
              :class="{ active: theme.state.mode === 'dark' }"
              @click="theme.setTheme('dark')"
            >
              <Moon :size="22" />
              <span>
                <strong>深色主题</strong>
                <small>适合夜间和沉浸播放</small>
              </span>
            </button>
            <button
              type="button"
              :class="{ active: theme.state.mode === 'light' }"
              @click="theme.setTheme('light')"
            >
              <Sun :size="22" />
              <span>
                <strong>浅色主题</strong>
                <small>适合白天浏览和整理</small>
              </span>
            </button>
          </div>
        </div>

        <div class="setting-block">
          <div class="setting-block__head">
            <Paintbrush :size="22" />
            <div>
              <h2>主题色</h2>
              <p>用于导航、按钮、进度和选中状态。</p>
            </div>
          </div>

          <div class="color-choice">
            <button
              v-for="color in theme.colors"
              :key="color.value"
              type="button"
              :class="{ active: theme.state.primaryColor === color.value }"
              :style="{ '--swatch-color': color.value }"
              @click="theme.setThemeColor(color.value)"
            >
              <span class="color-swatch" />
              <strong>{{ color.label }}</strong>
              <small>{{ color.value }}</small>
            </button>
            <label class="custom-color">
              <span>自定义</span>
              <input
                type="color"
                :value="theme.state.primaryColor"
                aria-label="自定义主题色"
                @change="theme.setThemeColor($event.target.value)"
              />
            </label>
          </div>
        </div>

        <div class="setting-block">
          <div class="setting-block__head">
            <Wand2 :size="22" />
            <div>
              <h2>过渡效果</h2>
              <p>选择切换主题时使用的动画。</p>
            </div>
          </div>

          <div class="effect-list">
            <button
              v-for="effect in theme.effects"
              :key="effect.value"
              type="button"
              :class="{ active: theme.state.transition === effect.value }"
              @click="theme.setTransition(effect.value)"
            >
              <strong>{{ effect.label }}</strong>
              <small>{{ effect.desc }}</small>
            </button>
          </div>
        </div>

        <div class="setting-block">
          <div class="setting-block__head">
            <ListMusic :size="22" />
            <div>
              <h2>播放列表动效</h2>
              <p>打开播放器右侧列表时使用的弹窗过渡。</p>
            </div>
          </div>

          <div class="effect-list">
            <button
              v-for="effect in theme.queueEffects"
              :key="effect.value"
              type="button"
              :class="{ active: theme.state.queueTransition === effect.value }"
              @click="theme.setQueueTransition(effect.value)"
            >
              <strong>{{ effect.label }}</strong>
              <small>{{ effect.desc }}</small>
            </button>
          </div>
        </div>

        <div class="setting-block">
          <div class="setting-block__head">
            <ArrowUpFromLine :size="22" />
            <div>
              <h2>大播放器动效</h2>
              <p>{{ theme.state.reducedMotion ? '已开启减少动效，以下动画暂不播放。' : '手机端点击底部播放器时的展开与收起效果，选择后自动保存。' }}</p>
            </div>
          </div>

          <div class="effect-list" role="group" aria-label="大播放器动效">
            <button
              v-for="effect in theme.fullPlayerEffects"
              :key="effect.value"
              type="button"
              :class="{ active: theme.state.fullPlayerTransition === effect.value }"
              :aria-pressed="theme.state.fullPlayerTransition === effect.value"
              @click="theme.setFullPlayerTransition(effect.value)"
            >
              <strong>{{ effect.label }}</strong>
              <small>{{ effect.desc }}</small>
            </button>
          </div>
        </div>

        <div class="setting-block">
          <div class="setting-block__head">
            <Timer :size="22" />
            <div>
              <h2>过渡动画时间</h2>
              <p id="transition-duration-description">统一控制页面切换、播放器显隐、播放列表和主题切换的时长，修改后自动保存。</p>
            </div>
          </div>

          <div class="transition-duration-setting">
            <label class="transition-duration-setting__value" for="transition-duration-slider">
              <span>动画时长</span>
              <strong>{{ theme.state.transitionDuration }} 毫秒</strong>
            </label>
            <input
              id="transition-duration-slider"
              class="transition-duration-setting__slider"
              type="range"
              :min="TRANSITION_DURATION_LIMITS.min"
              :max="TRANSITION_DURATION_LIMITS.max"
              :step="TRANSITION_DURATION_LIMITS.step"
              :value="theme.state.transitionDuration"
              :aria-valuetext="`${theme.state.transitionDuration} 毫秒`"
              aria-describedby="transition-duration-description"
              @input="theme.setTransitionDuration($event.target.value)"
            />
            <label class="transition-duration-setting__input">
              <input
                type="number"
                inputmode="numeric"
                :min="TRANSITION_DURATION_LIMITS.min"
                :max="TRANSITION_DURATION_LIMITS.max"
                :step="TRANSITION_DURATION_LIMITS.step"
                :value="theme.state.transitionDuration"
                aria-label="过渡动画时间（毫秒）"
                @change="theme.setTransitionDuration($event.target.value)"
              />
              <span>毫秒</span>
            </label>
            <div class="transition-duration-setting__hint">
              <small>{{ theme.state.reducedMotion ? '减少动效已开启，动画将直接完成。' : '0 毫秒为立即切换，最大 2000 毫秒。' }}</small>
              <button type="button" @click="theme.setTransitionDuration(SETTINGS_DEFAULTS.theme.transitionDuration)">恢复默认</button>
            </div>
          </div>
        </div>

        <div class="setting-block">
          <div class="setting-block__head">
            <Gauge :size="22" />
            <div>
              <h2>减少动效</h2>
              <p>关闭主题切换、页面切换和播放器弹层动画，降低低端设备的渲染压力。</p>
            </div>
          </div>

          <label
            class="motion-toggle"
            :class="{ active: theme.state.reducedMotion }"
          >
            <input
              type="checkbox"
              :checked="theme.state.reducedMotion"
              @change="theme.setReducedMotion($event.target.checked)"
            />
            <span class="motion-toggle__switch" aria-hidden="true" />
            <span class="motion-toggle__text">
              <strong>低动效模式</strong>
              <small>仍保留布局变化和功能状态，只移除非必要动画。</small>
            </span>
          </label>
        </div>

        <div class="setting-block">
          <div class="setting-block__head">
            <Gift :size="22" />
            <div>
              <h2>概念版 VIP</h2>
              <p>领取一天 VIP 后自动升级，并同步当前权益状态。</p>
            </div>
          </div>

          <div class="vip-claim-panel">
            <div class="vip-status-line">
              <span
                class="vip-status-dot"
                :class="{ active: svipActive }"
              />
              <strong>{{ vipStatusText }}</strong>
            </div>

            <button
              class="vip-claim-button"
              type="button"
              :class="{ 'is-active': svipActive }"
              :disabled="vipActionDisabled"
              @click="handleVipClaimClick"
            >
              <Gift :size="18" />
              <span>{{ vipActionText }}</span>
            </button>

            <p v-if="vipExpireText" class="vip-claim-note">{{ vipExpireText }}</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import { ArrowUpFromLine, Gauge, Gift, ListMusic, Moon, Paintbrush, Palette, Sun, Timer, Wand2 } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { useThemeStore } from '../stores/theme'
import { SETTINGS_DEFAULTS, TRANSITION_DURATION_LIMITS } from '../config/app'
import '../styles/settings.css'

const auth = useAuthStore()
const theme = useThemeStore()
const message = useMessage()

const vipActionDisabled = computed(() => auth.state.vip.loading || auth.state.vip.claiming || svipActive.value)
const vipActionText = computed(() => {
  if (auth.state.vip.claiming) {
    return '领取中'
  }

  if (auth.state.vip.loading) {
    return '检测中'
  }

  return svipActive.value ? 'SVIP已开通' : '领取并升级 VIP'
})
const busiVipList = computed(() => {
  const list = auth.state.vip.raw?.data?.busi_vip

  return Array.isArray(list) ? list : []
})
const svipBusiVip = computed(() => {
  return busiVipList.value.find((item) => isSvipBusiVip(item)) ?? null
})
const svipActive = computed(() => {
  const vip = svipBusiVip.value

  return Boolean(vip && (Number(vip.is_vip) > 0 || isFutureTime(vip.vip_end_time)))
})
const vipExpireTime = computed(() => {
  return svipBusiVip.value?.vip_end_time || ''
})
const vipStatusText = computed(() => {
  if (!auth.state.isLoggedIn || auth.isGuest.value) {
    return '未登录'
  }

  if (auth.state.vip.claiming) {
    return '正在领取并升级'
  }

  if (auth.state.vip.loading) {
    return '正在检测权益'
  }

  if (svipActive.value) {
    return 'SVIP 已开通'
  }

  if (auth.state.vip.active) {
    return '普通 VIP 已开通，可继续升级 SVIP'
  }

  return auth.state.vip.error || '未开通'
})
const vipExpireText = computed(() => {
  if (!svipActive.value || !vipExpireTime.value) {
    return ''
  }

  return `到期时间 ${vipExpireTime.value}`
})

onMounted(() => {
  if (auth.state.isLoggedIn && !auth.isGuest.value && !auth.state.vip.loaded && !auth.state.vip.loading) {
    auth.refreshVipStatus({ automatic: true })
  }
})

async function handleVipClaimClick() {
  if (!auth.state.isLoggedIn || auth.isGuest.value) {
    auth.openLoginModal()
    message.info('请先登录酷狗账号')
    return
  }

  const result = await auth.claimDailyVip({ skipIfActive: false })

  if (result?.ok) {
    message.success(svipActive.value ? 'SVIP 已开通' : '已提交 VIP 领取请求')
  } else if (result?.reason !== 'login-required') {
    message.error(result?.error?.message || 'VIP 领取失败，请稍后再试')
  }
}

function isSvipBusiVip(item) {
  return isValidBusiVip(item) && String(item.product_type || '').toLowerCase() === 'svip'
}

function isValidBusiVip(item) {
  return Boolean(item && typeof item === 'object')
}

function isFutureTime(value) {
  if (!value) {
    return false
  }

  const time = new Date(String(value).replace(' ', 'T')).getTime()
  return Number.isFinite(time) && time > Date.now()
}
</script>
