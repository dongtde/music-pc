<template>
  <button type="button" class="environment-switch" aria-label="进入 3D 音乐馆" title="进入 3D 音乐馆" @click="enterWorld">
    <svg v-if="iconOnly" class="environment-switch__3d-icon" width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true" focusable="false">
      <circle cx="18" cy="18" r="15" stroke="currentColor" stroke-width="2" />
      <text x="18" y="22" fill="currentColor" font-family="Arial, sans-serif" font-size="11" font-weight="800" letter-spacing="-.5" text-anchor="middle">3D</text>
    </svg>
    <template v-else>
      <Box :size="20" aria-hidden="true" />
      <span>3D</span>
    </template>
  </button>
</template>
<script setup>
import { Box } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { useEnvironmentStore } from '../stores/environment'
defineProps({ iconOnly: Boolean })
const route = useRoute(), router = useRouter(), environment = useEnvironmentStore()
function enterWorld() {
  if (environment.state.mode === '3d') return
  environment.rememberPage(route.fullPath)
  environment.setMode('3d')
  router.push('/space')
}
</script>
<style>
.environment-switch { position:fixed; z-index:45; left:20px; bottom:calc(92px + 20px + env(safe-area-inset-bottom, 0px)); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; width:56px; height:56px; padding:0; box-sizing:border-box; border:1px solid var(--theme-badge-border); border-radius:50%; background:var(--control-bg); box-shadow:0 4px 20px var(--shadow-color); backdrop-filter:blur(14px); font:600 11px 'Segoe UI','Microsoft YaHei',sans-serif; line-height:1; color:var(--theme-badge-color); cursor:pointer; transition:background-color .18s ease, border-color .18s ease, color .18s ease, box-shadow .18s ease; }
.environment-switch__3d-icon { display:block; flex:0 0 auto; width:36px; height:36px; }
.environment-switch:hover { background:var(--control-bg-hover); border-color:var(--theme-badge-strong-border); }
.environment-switch:active { background:color-mix(in srgb, var(--accent) 16%, var(--control-bg)); }
.environment-switch:focus-visible { outline:2px solid var(--accent); outline-offset:3px; }
.app-shell--immersive > .environment-switch { bottom:calc(24px + env(safe-area-inset-bottom, 0px)); }
@media(max-width:700px) { .environment-switch { left:16px; width:52px; height:52px; } }
</style>
