<template>
  <div class="environment-switch" :class="{ 'environment-switch--world': environment.state.mode === '3d' }" role="group" aria-label="选择音乐环境">
    <button type="button" :aria-pressed="environment.state.mode === '2d'" @click="select('2d')"><PanelsTopLeft :size="14" />2D</button>
    <button type="button" :aria-pressed="environment.state.mode === '3d'" @click="select('3d')"><Box :size="14" />3D<span v-if="environment.state.mode === '2d'">音乐馆</span></button>
  </div>
</template>
<script setup>
import { Box, PanelsTopLeft } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { useEnvironmentStore } from '../stores/environment'
const route = useRoute(), router = useRouter(), environment = useEnvironmentStore()
function select(mode) {
  if (mode === environment.state.mode) return
  if (mode === '3d') { environment.rememberPage(route.fullPath); environment.setMode(mode); router.push('/space') }
  else { environment.setMode(mode); if (route.name === 'space') router.push(environment.state.returnPath || '/home') }
}
</script>
<style>
.environment-switch { position:fixed; z-index:45; top:24px; right:165px; display:flex; gap:3px; padding:4px; border:1px solid #ffffff26; border-radius:22px; background:#101b26d9; box-shadow:0 4px 20px #0002; backdrop-filter:blur(14px); font:12px 'Segoe UI','Microsoft YaHei',sans-serif; color:#acbec9; }
.environment-switch button { display:flex; align-items:center; gap:6px; padding:7px 12px; border:0; border-radius:18px; background:transparent; color:inherit; font:inherit; cursor:pointer; }
.environment-switch button[aria-pressed='true'] { color:#152d36; background:#d3e5e0; }
.environment-switch button:focus-visible { outline:2px solid #ccece2; outline-offset:3px; }
.environment-switch--world { top:25px; right:190px; }
@media(max-width:700px) { .environment-switch,.environment-switch--world { top:19px; right:20px; } .environment-switch button { padding:6px 9px; } .environment-switch span { display:none; } }
</style>
