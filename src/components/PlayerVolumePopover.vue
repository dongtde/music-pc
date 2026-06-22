<template>
  <div class="control-popover-wrap">
    <button
      class="volume-button"
      type="button"
      aria-label="音量"
      :class="{ active: open }"
      @click="$emit('toggle')"
    >
      <component :is="icon" :size="20" />
    </button>
    <div v-if="open" class="player-popover volume-popover">
      <div class="volume-control">
        <span class="volume-rail" aria-hidden="true">
          <span class="volume-fill" :style="{ height: `${modelValue}%` }" />
        </span>
        <button class="volume-step-button" type="button" aria-label="提高音量" @click="$emit('increase')">
          <Plus :size="12" />
        </button>
        <input
          :value="modelValue"
          class="volume-slider"
          type="range"
          min="0"
          max="100"
          aria-label="音量大小"
          @input="$emit('update:modelValue', Number($event.target.value))"
        />
      </div>
      <div class="volume-value-row">
        <strong>{{ modelValue }}%</strong>
      </div>
      <span class="volume-divider" />
      <button
        class="volume-mute-button"
        type="button"
        :aria-label="modelValue > 0 ? '静音' : '恢复音量'"
        @click="$emit('toggle-mute')"
      >
        <component :is="icon" :size="22" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { Plus } from 'lucide-vue-next'

defineProps({
  open: {
    type: Boolean,
    default: false
  },
  modelValue: {
    type: Number,
    required: true
  },
  icon: {
    type: [Object, Function],
    required: true
  }
})

defineEmits(['toggle', 'update:modelValue', 'increase', 'toggle-mute'])
</script>
