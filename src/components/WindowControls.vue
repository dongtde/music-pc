<template>
  <div
    v-if="available"
    class="window-controls"
    :class="{ 'window-controls--floating': floating }"
  >
    <button
      class="window-control"
      type="button"
      title="Minimize"
      aria-label="Minimize window"
      @click="minimize"
    >
      <Minus :size="16" :stroke-width="2.2" />
    </button>
    <button
      class="window-control"
      type="button"
      :title="isMaximized ? 'Restore' : 'Maximize'"
      :aria-label="isMaximized ? 'Restore window' : 'Maximize window'"
      @click="toggleMaximize"
    >
      <Minimize2 v-if="isMaximized" :size="15" :stroke-width="2.1" />
      <Maximize2 v-else :size="15" :stroke-width="2.1" />
    </button>
    <button
      class="window-control window-control--close"
      type="button"
      title="Close"
      aria-label="Close window"
      @click="closeWindow"
    >
      <X :size="17" :stroke-width="2.1" />
    </button>
  </div>
</template>

<script setup>
import { Maximize2, Minimize2, Minus, X } from 'lucide-vue-next'
import { onMounted, onUnmounted, ref } from 'vue'

defineProps({
  floating: {
    type: Boolean,
    default: false
  }
})

const desktopWindowControls =
  typeof window !== 'undefined'
    ? window.mappicDesktop?.windowControls
    : null
const available = Boolean(desktopWindowControls)
const isMaximized = ref(false)
let removeStateListener = null

onMounted(() => {
  if (!desktopWindowControls) {
    return
  }

  removeStateListener = desktopWindowControls.onState?.(applyWindowState) ?? null
  syncWindowState()
})

onUnmounted(() => {
  removeStateListener?.()
  removeStateListener = null
})

async function syncWindowState() {
  try {
    applyWindowState(await desktopWindowControls.getState?.())
  } catch (error) {
    console.warn('[window-controls:state]', error)
  }
}

function applyWindowState(state) {
  isMaximized.value = Boolean(state?.isMaximized || state?.isFullScreen)
}

function minimize() {
  desktopWindowControls?.minimize?.()
}

function toggleMaximize() {
  desktopWindowControls?.toggleMaximize?.()
}

function closeWindow() {
  desktopWindowControls?.close?.()
}
</script>
