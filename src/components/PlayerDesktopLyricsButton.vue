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
  border: 1.5px solid color-mix(in srgb, var(--text-muted) 48%, transparent);
  border-radius: 5px;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--control-bg) 54%, transparent);
  font-family:
    'Microsoft YaHei',
    'PingFang SC',
    'Noto Sans CJK SC',
    sans-serif;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  transition:
    border-color 180ms ease,
    color 180ms ease,
    background-color 180ms ease;
}

.desktop-lyrics-button:hover .desktop-lyrics-button__icon {
  border-color: rgba(var(--accent-rgb), 0.42);
  color: var(--accent);
  background: rgba(var(--accent-rgb), 0.08);
}

.desktop-lyrics-button.active .desktop-lyrics-button__icon {
  border-color: var(--theme-badge-border);
  color: var(--theme-badge-color);
  background: var(--theme-badge-bg);
}

.desktop-lyrics-button.active,
.desktop-lyrics-button.active:hover {
  color: var(--accent);
  background: transparent;
  box-shadow: none;
}
</style>
