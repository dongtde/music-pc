<template>
  <div class="control-popover-wrap quality-popover-wrap">
    <button
      class="icon-button quality-button"
      type="button"
      :aria-label="buttonLabel"
      :title="buttonLabel"
      :aria-pressed="open"
      :class="{ active: open }"
      @click="$emit('toggle')"
    >
      <span
        class="quality-button__badge"
        :class="`quality-button__badge--${activeQuality.value}`"
      >
        {{ activeQuality.badgeLabel }}
      </span>
    </button>
    <div v-if="open" class="player-popover quality-popover">
      <button
        v-for="option in options"
        :key="option.value"
        class="quality-option"
        type="button"
        :aria-pressed="option.value === activeValue"
        :class="{ active: option.value === activeValue }"
        :disabled="loading"
        @click="$emit('select', option.value)"
      >
        <span class="quality-option__text">
          <strong>{{ option.label }}</strong>
          <small>{{ option.description }}</small>
        </span>
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
  buttonLabel: {
    type: String,
    required: true
  },
  activeQuality: {
    type: Object,
    required: true
  },
  activeValue: {
    type: String,
    required: true
  },
  options: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

defineEmits(['toggle', 'select'])
</script>
