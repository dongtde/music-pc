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
      </div>
    </section>
  </div>
</template>

<script setup>
import { ListMusic, Moon, Paintbrush, Palette, Sun, Wand2 } from 'lucide-vue-next'
import { useThemeStore } from '../stores/theme'
import '../styles/settings.css'

const theme = useThemeStore()
</script>
