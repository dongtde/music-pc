<template>
  <n-config-provider :theme="naiveTheme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <router-view v-if="isDesktopLyricsRoute" />
      <main
        v-else
        class="app-shell"
        :class="{
          'theme-is-switching': theme.state.animating,
          'app-shell--layout-switching': isLayoutSwitching,
          'app-shell--immersive': isImmersiveRoute,
          'app-shell--desktop': isDesktopApp,
        }"
      >
        <SidebarNav :compact="isImmersiveRoute" />
        <div
          v-if="isDesktopApp && isImmersiveRoute"
          class="app-window-drag-strip"
          aria-hidden="true"
        />
        <WindowControls
          v-if="isDesktopApp && isImmersiveRoute"
          floating
          class="app-window-controls"
        />
        <section class="main-panel">
          <TopBar :inert="isImmersiveRoute" :aria-hidden="isImmersiveRoute" />
          <div class="route-stage">
            <router-view v-slot="{ Component, route: viewRoute }">
              <Transition :name="routeTransitionName" appear>
                <KeepAlive v-if="Component && shouldKeepRouteAlive(viewRoute)">
                  <component
                    :is="Component"
                    :key="getRouteViewKey(viewRoute)"
                    @home-ready="markHomeBootReady"
                  />
                </KeepAlive>
                <component
                  v-else-if="Component"
                  :is="Component"
                  :key="getRouteViewKey(viewRoute)"
                  @home-ready="markHomeBootReady"
                />
                <div
                  v-else
                  key="route-empty"
                  class="route-stage__boot-placeholder"
                  aria-hidden="true"
                />
              </Transition>
            </router-view>
          </div>
        </section>
        <Transition name="app-boot">
          <div
            v-if="appBootVisible && isImmersiveRoute"
            class="app-boot-overlay"
            aria-hidden="true"
            inert
          >
            <SidebarNav compact boot />
            <section class="main-panel">
              <div class="route-stage">
                <HomeBootSkeleton />
              </div>
            </section>
          </div>
        </Transition>
        <PlayerBar />
        <ThemeTransitionOverlay />
        <div
          v-if="appUpdateAvailable"
          class="app-update-banner"
          role="status"
          aria-live="polite"
        >
          <span>新版本已准备好</span>
          <button type="button" @click="reloadForAppUpdate">刷新</button>
          <button type="button" aria-label="稍后提醒" @click="dismissAppUpdate">稍后</button>
        </div>
        <LoginModal
          v-if="auth.state.loginModalVisible"
          v-model:show="auth.state.loginModalVisible"
        />
      </main>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup>
import { computed, defineAsyncComponent, h, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { darkTheme } from 'naive-ui';
import SidebarNav from './components/SidebarNav.vue';
import HomeBootSkeleton from './components/HomeBootSkeleton.vue';
import TopBar from './components/TopBar.vue';
import ThemeTransitionOverlay from './components/ThemeTransitionOverlay.vue';
import WindowControls from './components/WindowControls.vue';
import { useAuthStore } from './stores/auth';
import { useThemeStore } from './stores/theme';

const PlayerBar = defineAsyncComponent({
  loader: () => import('./components/PlayerBar.vue'),
  loadingComponent: {
    name: 'PlayerBarLoading',
    setup() {
      return () => h('footer', { class: 'player player--loading', 'aria-hidden': 'true' });
    },
  },
  delay: 0,
});
const LoginModal = defineAsyncComponent(() => import('./components/LoginModal.vue'));
const auth = useAuthStore();
const theme = useThemeStore();
const route = useRoute();
const initialRoutePath = getInitialRoutePath();
theme.initTheme();
auth.initAuth();

const naiveTheme = computed(() =>
  theme.state.mode === 'dark' ? darkTheme : null,
);
const isDesktopLyricsRoute = computed(() =>
  route.meta.desktopLyrics || (!route.name && initialRoutePath.startsWith('/desktop-lyrics')),
);
const isImmersiveRoute = computed(() =>
  route.name === 'home' || (!route.name && isHomePath(initialRoutePath)),
);
const isDesktopApp = computed(() =>
  typeof window !== 'undefined' && Boolean(window.mappicDesktop?.windowControls),
);
const routeTransitionName = ref('route-soft');
const isLayoutSwitching = ref(false);
const appUpdateAvailable = ref(false);
const appBootVisible = ref(isHomePath(initialRoutePath));
const PODCAST_TAB_ROUTE_NAMES = new Set([
  'podcast',
  'podcast-rank',
  'podcast-sleep',
  'podcast-radio',
]);
let layoutSwitchTimer = 0;
let appUpdateRegistration = null;

function isHomeRoute(routeName) {
  return routeName === 'home';
}

function getRouteViewKey(viewRoute) {
  const routeName = String(viewRoute.name || '');

  if (PODCAST_TAB_ROUTE_NAMES.has(routeName)) {
    return 'podcast-tabs';
  }

  return String(viewRoute.name || viewRoute.path);
}

function shouldKeepRouteAlive(viewRoute) {
  return Boolean(viewRoute.meta.keepAlive);
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

function markHomeBootReady() {
  appBootVisible.value = false;
}

function clearBootRouteMarker() {
  if (typeof document === 'undefined') {
    return;
  }

  delete document.documentElement.dataset.bootRoute;
}

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.clearTimeout(layoutSwitchTimer);
    window.removeEventListener('lanyin:app-update-available', handleAppUpdateAvailable);
  }
});

onMounted(() => {
  clearBootRouteMarker();
  window.addEventListener('lanyin:app-update-available', handleAppUpdateAvailable);
  notifyRendererReady();
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

function handleAppUpdateAvailable(event) {
  appUpdateRegistration = event.detail?.registration ?? null;
  appUpdateAvailable.value = true;
}

function reloadForAppUpdate() {
  const waitingWorker = appUpdateRegistration?.waiting;

  if (!waitingWorker) {
    window.location.reload();
    return;
  }

  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
}

function dismissAppUpdate() {
  appUpdateAvailable.value = false;
}

function getInitialRoutePath() {
  if (typeof window === 'undefined') {
    return '/';
  }

  const hashPath = window.location.hash.replace(/^#/, '');

  if (hashPath) {
    return hashPath.startsWith('/') ? hashPath : `/${hashPath}`;
  }

  return window.location.pathname || '/';
}

function isHomePath(path) {
  return path === '/' || path === '/home' || path.startsWith('/home?') || path.startsWith('/home/');
}

function notifyRendererReady() {
  if (typeof window === 'undefined') {
    return;
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      document.documentElement.dataset.appReady = 'true';
      window.mappicDesktop?.app?.ready?.();
    });
  });
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
