<template>
  <div class="view settings-view">
    <header class="settings-header">
      <div>
        <span class="settings-kicker">偏好设置</span>
        <h1>主题与过渡</h1>
      </div>
      <n-button round type="primary" @click="theme.previewTransition">
        <template #icon>
          <Sparkles :size="18" />
        </template>
        演示当前效果
      </n-button>
    </header>

    <section class="settings-layout">
      <div class="settings-panel">
        <div class="setting-block">
          <div class="setting-block__head">
            <Palette :size="22" />
            <div>
              <h2>主题模式</h2>
              <p>选择整个音乐客户端的显示主题。</p>
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
                <small>贴近当前播放器视觉</small>
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
                <small>更适合白天浏览</small>
              </span>
            </button>
          </div>
        </div>

        <div class="setting-block">
          <div class="setting-block__head">
            <Paintbrush :size="22" />
            <div>
              <h2>主题色</h2>
              <p>选择全局强调色，导航、按钮、进度和选中态会一起同步。</p>
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
              <p>切换主题时使用选中的动画，也可以单独演示。</p>
            </div>
          </div>

          <div class="effect-list">
            <button
              v-for="effect in theme.effects"
              :key="effect.value"
              type="button"
              :class="{ active: theme.state.transition === effect.value }"
              @click="selectEffect(effect.value)"
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
              <p>点击播放器右侧列表按钮时使用的弹窗过渡。</p>
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
      </div>

      <aside class="transition-demo">
        <div class="demo-player">
          <div class="demo-cover" />
          <div class="demo-copy">
            <span>Theme Preview</span>
            <strong>{{ currentEffect?.label }}</strong>
            <small>{{ currentEffect?.desc }}</small>
          </div>
          <button type="button" @click="theme.previewTransition">
            <Play :size="18" fill="currentColor" />
          </button>
        </div>

        <div
          class="demo-stage"
          :class="[`demo-stage--${theme.state.transition}`, { 'is-playing': theme.state.animating }]"
        >
          <span />
          <span />
          <span />
          <div class="demo-stage__card">
            <strong>{{ theme.state.mode === 'dark' ? 'Dark' : 'Light' }}</strong>
            <span class="theme-color-pill" :style="{ '--swatch-color': theme.state.primaryColor }">
              {{ theme.state.primaryColor }}
            </span>
            <small>点击左侧选项或这里的播放按钮查看过渡</small>
          </div>
        </div>
      </aside>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ListMusic, Moon, Paintbrush, Palette, Play, Sparkles, Sun, Wand2 } from 'lucide-vue-next'
import { useThemeStore } from '../stores/theme'
import '../styles/settings.css'

const theme = useThemeStore()
const currentEffect = computed(() => theme.effects.find((effect) => effect.value === theme.state.transition))

function selectEffect(effect) {
  theme.setTransition(effect)
  theme.previewTransition()
}
</script>
