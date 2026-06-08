<template>
  <n-config-provider :theme="naiveTheme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <main
        class="app-shell"
        :class="{
          'theme-is-switching': theme.state.animating,
          'app-shell--layout-switching': isLayoutSwitching,
          'app-shell--immersive': isImmersiveRoute,
        }"
      >
        <SidebarNav :compact="isImmersiveRoute" />
        <section class="main-panel">
          <TopBar :inert="isImmersiveRoute" :aria-hidden="isImmersiveRoute" />
          <div class="route-stage">
            <router-view v-slot="{ Component, route: viewRoute }">
              <Transition :name="routeTransitionName" appear>
                <KeepAlive>
                  <component
                    :is="Component"
                    :key="String(viewRoute.name || viewRoute.path)"
                  />
                </KeepAlive>
              </Transition>
            </router-view>
          </div>
        </section>
        <PlayerBar />
        <ThemeTransitionOverlay />
        <LoginModal v-model:show="auth.state.loginModalVisible" />
      </main>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { darkTheme } from 'naive-ui';
import SidebarNav from './components/SidebarNav.vue';
import TopBar from './components/TopBar.vue';
import PlayerBar from './components/PlayerBar.vue';
import LoginModal from './components/LoginModal.vue';
import ThemeTransitionOverlay from './components/ThemeTransitionOverlay.vue';
import { useAuthStore } from './stores/auth';
import { useThemeStore } from './stores/theme';

const auth = useAuthStore();
const theme = useThemeStore();
const route = useRoute();
theme.initTheme();
auth.initAuth();

const naiveTheme = computed(() =>
  theme.state.mode === 'dark' ? darkTheme : null,
);
const isImmersiveRoute = computed(() => route.name === 'home');
const routeTransitionName = ref('route-soft');
const isLayoutSwitching = ref(false);
let layoutSwitchTimer = 0;

function isHomeRoute(routeName) {
  return routeName === 'home';
}

function markLayoutSwitching() {
  if (typeof window === 'undefined') {
    return;
  }

  window.clearTimeout(layoutSwitchTimer);
  isLayoutSwitching.value = true;
  layoutSwitchTimer = window.setTimeout(() => {
    isLayoutSwitching.value = false;
  }, 120);
}

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.clearTimeout(layoutSwitchTimer);
  }
});

watch(
  () => route.name,
  (nextName, previousName) => {
    if (!previousName || nextName === previousName) {
      return;
    }

    const wasImmersive = isHomeRoute(previousName);
    const willBeImmersive = isHomeRoute(nextName);

    routeTransitionName.value =
      wasImmersive === willBeImmersive
        ? 'route-soft'
        : willBeImmersive
          ? 'route-to-immersive'
          : 'route-from-immersive';

    if (wasImmersive !== willBeImmersive) {
      markLayoutSwitching();
    }
  },
);

function hexToRgb(color) {
  const value = color.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function toHex(value) {
  return Math.round(value).toString(16).padStart(2, '0');
}

function mixColor(color, target, amount) {
  const sourceRgb = hexToRgb(color);
  const targetRgb = hexToRgb(target);
  const nextRgb = sourceRgb.map(
    (channel, index) => channel + (targetRgb[index] - channel) * amount,
  );
  return `#${nextRgb.map(toHex).join('')}`;
}

const themeOverrides = computed(() => {
  const isDark = theme.state.mode === 'dark';
  const primaryColor = theme.state.primaryColor;
  const primaryColorHover = mixColor(primaryColor, '#ffffff', 0.18);
  const primaryColorPressed = mixColor(primaryColor, '#000000', 0.18);

  return {
    common: {
      primaryColor,
      primaryColorHover,
      primaryColorPressed,
      borderRadius: '8px',
      bodyColor: isDark ? '#101010' : '#f6f7fb',
      cardColor: isDark ? '#181818' : '#ffffff',
      textColorBase: isDark ? '#f5f7fb' : '#172033',
    },
    Input: {
      color: isDark ? '#222222' : '#ffffff',
      colorFocus: isDark ? '#242424' : '#ffffff',
      textColor: isDark ? '#f5f7fb' : '#172033',
      placeholderColor: isDark ? '#7f8794' : '#8a94a6',
      border: isDark ? '1px solid #333333' : '1px solid #d7dce6',
      borderHover: isDark ? '1px solid #484848' : '1px solid #b9c1d2',
      borderFocus: `1px solid ${primaryColorHover}`,
      boxShadowFocus: 'none',
    },
  };
});
</script>
