<template>
  <button
    v-if="available"
    class="icon-button desktop-lyrics-button"
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
  border: 1.5px solid var(--theme-badge-border);
  border-radius: 5px;
  color: var(--theme-badge-color);
  background: var(--theme-badge-bg);
  font-family:
    'Microsoft YaHei',
    'PingFang SC',
    'Noto Sans CJK SC',
    sans-serif;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
}

.desktop-lyrics-button.active,
.desktop-lyrics-button.active:hover {
  color: var(--accent);
  background: transparent;
  box-shadow: none;
}
</style>
