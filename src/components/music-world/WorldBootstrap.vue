<template>
  <WorldEntrance
    class="world-bootstrap"
    :failed="Boolean(error)"
    :paused="suspended"
    :inert="suspended"
    @retry="reload"
    @exit="returnTo2D"
  />
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useEnvironmentStore } from '../../stores/environment.js'
import WorldEntrance from './WorldEntrance.vue'

defineProps({ error: Error, suspended: Boolean })
const route = useRoute(), router = useRouter(), environment = useEnvironmentStore()

function reload() { window.location.reload() }
function returnTo2D() {
  environment.setMode('2d')
  if (route.name === 'space' || !route.name) router.push(environment.state.returnPath || '/home')
}
</script>

<style scoped>
.world-bootstrap { position: fixed; }
</style>
