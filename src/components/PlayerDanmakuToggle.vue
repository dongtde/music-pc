<template>
  <button
    v-if="visible"
    class="icon-button"
    type="button"
    :aria-label="enabled ? '关闭弹幕' : '开启弹幕'"
    :title="enabled ? '关闭弹幕' : '开启弹幕'"
    :class="{ active: enabled }"
    @click="$emit('toggle')"
  >
    <Radio :size="18" />
  </button>
</template>

<script setup>
import { Radio } from 'lucide-vue-next'

defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  enabled: {
    type: Boolean,
    default: false
  }
})

defineEmits(['toggle'])
</script>
