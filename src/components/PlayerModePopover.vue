<template>
  <div class="control-popover-wrap">
    <button
      class="mode-button"
      type="button"
      :aria-label="activeMode.label"
      :class="{ active: open }"
      @click="$emit('toggle')"
    >
      <component :is="activeMode.icon" :size="19" />
    </button>
    <div v-if="open" class="player-popover mode-popover">
      <button
        v-for="mode in modes"
        :key="mode.value"
        class="mode-option"
        type="button"
        :class="{ active: activeValue === mode.value }"
        @click="$emit('select', mode.value)"
      >
        <component :is="mode.icon" :size="22" />
        <span>{{ mode.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  open: {
    type: Boolean,
    default: false
  },
  activeMode: {
    type: Object,
    required: true
  },
  activeValue: {
    type: String,
    required: true
  },
  modes: {
    type: Array,
    default: () => []
  }
})

defineEmits(['toggle', 'select'])
</script>
