<template>
  <h2 class="section-title" :class="{ compact }">
    {{ title }}
  </h2>
</template>

<script setup>
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
