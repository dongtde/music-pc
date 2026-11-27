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
          'app-shell--discover-header-hidden': route.name === 'discover' && isDiscoverHeaderHidden,
          'app-shell--desktop': isDesktopApp,
          'app-shell--world': isWorld,
          'app-shell--player-expanded': fullPlayerVisible,
          'app-shell--home-player': isMobileHomeMusic,
          'app-shell--playlist-detail': isMobilePlaylist,
          'app-shell--detail-page': Boolean(mainRoute.meta.detail),
          'app-shell--cover-detail': coverThemeActive,
          'app-shell--player-transition': detailPlayerHidden,
          'app-shell--mobile-detail': mobileDetailActive,
        }"
        :style="coverThemeStyle"
      >
        <MusicWorld v-if="isWorld" :suspended="fullPlayerVisible || auth.state.loginModalVisible" />
        <EnvironmentSwitch v-if="!isWorld && !isMobile && !fullPlayerVisible && !isNarrowHome && !isMobilePlaylist && !mobileDetailActive" />
        <SidebarNav v-if="!isWorld && !isNarrowHome" :compact="isImmersiveRoute || isNarrow" />
        <div
          v-if="isDesktopApp && (isImmersiveRoute || isWorld)"
          class="app-window-drag-strip"
          aria-hidden="true"
        />
        <WindowControls
          v-if="isDesktopApp && (isImmersiveRoute || isWorld)"
          floating
          class="app-window-controls"
        />
        <button v-if="showWorldRoutePanel" type="button" class="world-route-close" @click="router.push('/space')">返回音乐馆 ↗</button>
        <RouteScope :route="mainRoute">
        <section
          class="main-panel"
          :class="{
            'main-panel--world-hidden': isWorld && !showWorldRoutePanel,
            'main-panel--drawer-covered': mobileDetailOpen,
          }"
          :inert="isMobile && (fullPlayerVisible || mobileDetailActive)"
          :aria-hidden="mobileDetailActive || undefined"
        >
          <TopBar
            :inert="isImmersiveRoute"
            :aria-hidden="isImmersiveRoute"
            :playlist-header="playlistHeader"
            :show-environment-switch="isMobile && !isWorld && !fullPlayerVisible && !isNarrowHome && !isMobilePlaylist && !mobileDetailActive"
          />
          <div class="route-stage">
            <router-view :route="mainRoute" v-slot="{ Component, route: viewRoute }">
              <Transition
                :name="routeTransitionName"
                appear
                @before-leave="saveCachedRouteScroll"
                @enter="restoreCachedRouteScroll"
                @after-enter="!mobileDetailActive && finishDetailPlayerEnter($event, viewRoute.fullPath)"
              >
                <KeepAlive>
                  <component
                    v-if="Component && shouldKeepRouteAlive(viewRoute)"
                    :is="Component"
                    :key="getRouteViewKey(viewRoute)"
                    v-bind="isHomeRoute(viewRoute.name) ? { mobilePlayerSection: homeSection } : {}"
                    @discover-scroll-state="handleDiscoverScrollState"
                    @home-ready="markHomeBootReady"
                    @home-page-change="homeMusicPage = $event"
                    @home-section-change="homeSection = $event"
                    @playlist-header-change="updatePlaylistHeader"
                  />
                </KeepAlive>
              </Transition>
              <Transition
                :name="routeTransitionName"
                appear
                @after-enter="!mobileDetailActive && finishDetailPlayerEnter($event, viewRoute.fullPath)"
              >
                <component
                  v-if="Component && !shouldKeepRouteAlive(viewRoute)"
                  :is="Component"
                  :key="getRouteViewKey(viewRoute)"
                  v-bind="isHomeRoute(viewRoute.name) ? { mobilePlayerSection: homeSection } : {}"
                  @discover-scroll-state="handleDiscoverScrollState"
                  @home-ready="markHomeBootReady"
                  @home-page-change="homeMusicPage = $event"
                  @home-section-change="homeSection = $event"
                  @playlist-header-change="updatePlaylistHeader"
                />
                <div
                  v-else-if="!Component"
                  key="route-empty"
                  class="route-stage__boot-placeholder"
                  aria-hidden="true"
                />
              </Transition>
            </router-view>
          </div>
        </section>
        </RouteScope>
        <MobileDetailDrawer
          v-if="mobileDetailEnabled"
          :open="mobileDetailOpen"
          :route="mobileDetailRoute"
          :transition-name="mobileDetailTransition"
          :duration="theme.getTransitionDuration()"
          :back="backFromMobileDetail"
          :inert="fullPlayerVisible"
          @entered="finishDetailPlayerEnter"
          @closed="handleMobileDetailClose"
          @playlist-header-change="updatePlaylistHeader"
        />
        <Transition name="app-boot">
          <div
            v-if="appBootVisible && isImmersiveRoute && !mobileDetailActive"
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
        <PlayerBar
          :home-player="isMobileHomeMusic"
          :hidden="isWorld || (isNarrowHome && !isMobileHomeMusic && !mobileDetailActive)"
          :route-hidden="detailPlayerHidden"
          :detail-cover-style="coverThemeActive ? coverThemeStyle : null"
          @full-player-change="fullPlayerVisible = $event"
          @home-section-change="homeSection = $event"
          @home-navigation="mobileNavigation?.openNavigation()"
        />
        <MobileTabBar
          ref="mobileNavigation"
          v-if="!isWorld && (isMobile || isNarrowHome) && !isMobileHomeLyrics && !isMobilePlaylist"
          v-show="!fullPlayerVisible || isMobileHomeMusic"
          :collapsible="isNarrowHome"
          :route-hidden="detailPlayerHidden || mobileDetailActive"
        />
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
import { useRoute, useRouter } from 'vue-router';
import { darkTheme } from 'naive-ui';
import SidebarNav from './components/SidebarNav.vue';
import HomeBootSkeleton from './components/HomeBootSkeleton.vue';
import TopBar from './components/TopBar.vue';
import MobileTabBar from './components/MobileTabBar.vue';
import RouteScope from './components/RouteScope.vue';
import MobileDetailDrawer from './components/MobileDetailDrawer.vue';
import { useMobileDetailRoutes } from './composables/useMobileDetailRoutes';
import { useResponsiveLayout } from './composables/useResponsiveLayout';
import { useDetailPlayerTransition } from './composables/useDetailPlayerTransition';
import { useDetailCoverTheme } from './composables/useDetailCoverTheme';
import { getDetailCoverSource } from './utils/detailCoverSource';
import ThemeTransitionOverlay from './components/ThemeTransitionOverlay.vue';
import WindowControls from './components/WindowControls.vue';
import { useAuthStore } from './stores/auth';
import { useThemeStore } from './stores/theme';
import { useEnvironmentStore } from './stores/environment';
import { useListeningRoomStore } from './stores/listeningRoom';
import EnvironmentSwitch from './components/EnvironmentSwitch.vue';
import WorldBootstrap from './components/music-world/WorldBootstrap.vue';
const MusicWorld = defineAsyncComponent({
  loader: () => import('./components/MusicWorld.vue'),
  loadingComponent: WorldBootstrap,
  errorComponent: WorldBootstrap,
  delay: 0,
});

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
const fullPlayerVisible = ref(false);
const isDiscoverHeaderHidden = ref(false);
const playlistHeader = ref({ title: '', visible: false, collapsed: false });
const homeMusicPage = ref(1);
const homeSection = ref('music');
const mobileNavigation = ref(null);
const router = useRouter();
const environment = useEnvironmentStore();
const { isMobile, isCompact, isNarrow, isTabletPortrait, isHomeTouch2D } = useResponsiveLayout();
const isWorld = computed(() => environment.state.mode === '3d' && !isDesktopLyricsRoute.value);
const isMobilePlaylist = computed(() => isMobile.value && !isWorld.value && Boolean(mainRoute.value.meta.coverDetail));
const initialRoutePath = getInitialRoutePath();
const initialRoute = router.resolve(initialRoutePath);
const isSpaceRoute = computed(() => route.name === 'space' || (!route.name && initialRoute.name === 'space'));
// Home redirects to /space in 3D mode; neither it nor an unresolved route is a panel.
const showWorldRoutePanel = computed(() => isWorld.value && Boolean(route.name) && !['space', 'home'].includes(route.name));
theme.initTheme();
auth.initAuth();

const naiveTheme = computed(() =>
  theme.state.mode === 'dark' ? darkTheme : null,
);
const isDesktopLyricsRoute = computed(() =>
  route.meta.desktopLyrics || (!route.name && initialRoutePath.startsWith('/desktop-lyrics')),
);
const mobileDetailEnabled = computed(() => isMobile.value && !isWorld.value && !isDesktopLyricsRoute.value);
const {
  mainRoute,
  detailRoute: mobileDetailRoute,
  open: mobileDetailOpen,
  active: mobileDetailActive,
  transitionName: mobileDetailTransition,
  back: backFromMobileDetail,
  finishClose: finishMobileDetailClose,
} = useMobileDetailRoutes(router, mobileDetailEnabled);
const isImmersiveRoute = computed(() =>
  !isWorld.value && (mainRoute.value.name === 'home' || (!mainRoute.value.name && isHomePath(initialRoutePath))),
);
const isNarrowHome = computed(() => isImmersiveRoute.value && (isNarrow.value || isHomeTouch2D.value));
const isMobileHomeMusic = computed(() => isImmersiveRoute.value && isMobile.value && homeSection.value === 'music' && !mobileDetailActive.value);
const isMobileHomeLyrics = computed(() => !mobileDetailActive.value && !isMobileHomeMusic.value && isImmersiveRoute.value && isHomeTouch2D.value && homeMusicPage.value === 2);
const isDesktopApp = computed(() =>
  typeof window !== 'undefined' && Boolean(window.mappicDesktop?.windowControls),
);
const { coverThemeActive, coverThemeStyle } = useDetailCoverTheme(() => {
  const viewedRoute = mobileDetailActive.value ? mobileDetailRoute.value : route;
  return isWorld.value ? null : getDetailCoverSource(viewedRoute, playlistHeader.value);
});
const routeTransitionName = ref('route-soft');
const { hidden: detailPlayerHidden, finishEnter: finishDetailPlayerEnter } = useDetailPlayerTransition(router, {
  enabled: () => !isWorld.value && !isDesktopLyricsRoute.value,
  getDuration: theme.getTransitionDuration,
});
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
let previousHistoryPosition = router.options.history.state.position;
let appUpdateRegistration = null;
const cachedRouteScrollPositions = new WeakMap();

function updatePlaylistHeader(header) {
  if (header.path === route.path) playlistHeader.value = header;
}

function handleDiscoverScrollState(hidden) {
  isDiscoverHeaderHidden.value = route.name === 'discover' && hidden;
}
function handleMobileDetailClose(element) {
  finishMobileDetailClose();
  finishDetailPlayerEnter(element, mainRoute.value.fullPath);
}

function isHomeRoute(routeName) {
  return routeName === 'home';
}

function getRouteViewKey(viewRoute) {
  if (viewRoute.meta.detail) {
    return viewRoute.path;
  }

  const routeName = String(viewRoute.name || '');

  if (PODCAST_TAB_ROUTE_NAMES.has(routeName)) {
    return 'podcast-tabs';
  }

  return String(viewRoute.name || viewRoute.path);
}

function shouldKeepRouteAlive(viewRoute) {
  return Boolean(viewRoute.meta.keepAlive);
}

function saveCachedRouteScroll(root) {
  const positions = [root, ...root.querySelectorAll('*')]
    .filter((element) => element.scrollTop || element.scrollLeft)
    .map((element) => ({ element, top: element.scrollTop, left: element.scrollLeft }));
  cachedRouteScrollPositions.set(root, positions);
}

function restoreCachedRouteScroll(root) {
  for (const { element, top, left } of cachedRouteScrollPositions.get(root) || []) {
    element.scrollTo({ top, left, behavior: 'instant' });
  }
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
  removeRouteTransitionHook();
  if (typeof window !== 'undefined') {
    window.clearTimeout(layoutSwitchTimer);
    window.removeEventListener('lanyin:app-update-available', handleAppUpdateAvailable);
  }
});

onMounted(() => {
  if (!isDesktopLyricsRoute.value) void useListeningRoomStore().restore();
  clearBootRouteMarker();
  window.addEventListener('lanyin:app-update-available', handleAppUpdateAvailable);
  notifyRendererReady();
  router.isReady().then(() => {
    if (environment.state.mode === '3d' && !isDesktopLyricsRoute.value && route.name === 'home') router.replace('/space');
  });
});

watch([isWorld, isDesktopLyricsRoute, isMobile, isCompact, fullPlayerVisible], () => {
  document.documentElement.dataset.layout = isDesktopLyricsRoute.value
    ? 'desktop-lyrics'
    : isWorld.value
      ? 'world'
      : isMobile.value
        ? 'mobile-2d'
        : isCompact.value ? 'compact-2d' : 'desktop-2d';
  document.documentElement.dataset.playerExpanded = String(fullPlayerVisible.value);
}, { immediate: true });

watch([isImmersiveRoute, isTabletPortrait], () => {
  document.documentElement.dataset.homeLayout = isImmersiveRoute.value && isTabletPortrait.value ? 'tablet' : '';
}, { immediate: true });

watch([() => route.fullPath, isMobile, isCompact], () => {
  isDiscoverHeaderHidden.value = false;
});
watch(() => environment.state.mode, (mode) => {
  document.documentElement.dataset.environment = mode;
  if (mode === '3d') appBootVisible.value = false;
}, { immediate: true });
watch(isSpaceRoute, (isSpace) => {
  if (isSpace) environment.setMode('3d');
}, { immediate: true });

const removeRouteTransitionHook = router.afterEach((to, from, failure) => {
  if (failure) return;

  const historyPosition = router.options.history.state.position;
  const isBackNavigation = Number.isFinite(historyPosition)
    && Number.isFinite(previousHistoryPosition)
    && historyPosition < previousHistoryPosition;
  previousHistoryPosition = historyPosition;

  if (!from.name || to.path === from.path) return;
  if (mobileDetailEnabled.value && (to.meta.detail || from.meta.detail)) return;

  const wasImmersive = isHomeRoute(from.name);
  const willBeImmersive = isHomeRoute(to.name);

  if (to.meta.detail || from.meta.detail) {
    routeTransitionName.value = to.meta.detail && (!from.meta.detail || !isBackNavigation)
      ? 'route-detail-forward'
      : 'route-detail-back';
  } else {
    routeTransitionName.value = wasImmersive === willBeImmersive
      ? 'route-soft'
      : willBeImmersive
        ? 'route-to-immersive'
        : 'route-from-immersive';
  }

  if (wasImmersive !== willBeImmersive) {
    markLayoutSwitching();
  }
});

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
