<template>
  <button
    v-if="available"
    class="icon-button"
    type="button"
    :aria-label="label"
    :aria-pressed="open"
    :title="label"
    :class="{ active: open, locked }"
    @click="$emit('toggle')"
  >
    <Captions :size="18" />
  </button>
</template>

<script setup>
import { Captions } from 'lucide-vue-next'

defineProps({
  available: {
    type: Boolean,
    default: false
  },
  open: {
    type: Boolean,
    default: false
  },
  locked: {
    type: Boolean,
    default: false
  },
  label: {
    type: String,
    required: true
  }
})

defineEmits(['toggle'])
</script>
