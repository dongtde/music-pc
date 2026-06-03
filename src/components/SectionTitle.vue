<template>
  <h2 class="section-title" :class="{ compact }">
    {{ title }}
    <ChevronRight :size="22" />
  </h2>
</template>

<script setup>
import { ChevronRight } from 'lucide-vue-next'

defineProps({
  title: {
    type: String,
    required: true
  },
  compact: {
    type: Boolean,
    default: false
  }
})
</script>
