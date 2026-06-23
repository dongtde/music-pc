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
    <span class="desktop-lyrics-button__icon" aria-hidden="true">&#35789;</span>
  </button>
</template>

<script setup>
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

<style scoped>
.desktop-lyrics-button__icon {
  display: grid;
  width: 19px;
  height: 19px;
  place-items: center;
  border: 1.7px solid currentColor;
  border-radius: 5px;
  color: inherit;
  font-family:
    'Microsoft YaHei',
    'PingFang SC',
    'Noto Sans CJK SC',
    sans-serif;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
}
</style>
