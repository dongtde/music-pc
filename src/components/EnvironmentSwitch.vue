<template>
  <button type="button" class="environment-switch" aria-label="进入 3D 音乐馆" title="进入 3D 音乐馆" @click="enterWorld">
    <Box :size="20" aria-hidden="true" />
    <span>3D</span>
  </button>
</template>
<script setup>
import { Box } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { useEnvironmentStore } from '../stores/environment'
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
.environment-switch:hover { background:var(--control-bg-hover); border-color:var(--theme-badge-strong-border); }
.environment-switch:active { background:color-mix(in srgb, var(--accent) 16%, var(--control-bg)); }
.environment-switch:focus-visible { outline:2px solid var(--accent); outline-offset:3px; }
.app-shell--immersive > .environment-switch { bottom:calc(24px + env(safe-area-inset-bottom, 0px)); }
@media(max-width:700px) { .environment-switch { left:16px; width:52px; height:52px; } }
</style>
