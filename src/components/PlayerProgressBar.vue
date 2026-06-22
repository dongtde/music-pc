<template>
  <div class="progress-row">
    <span>{{ currentLabel }}</span>
    <div
      class="player-progress"
      role="slider"
      tabindex="0"
      :aria-valuemin="0"
      :aria-valuemax="ariaMax"
      :aria-valuenow="ariaNow"
      @pointerdown="emitProgressEvent('progress-pointer-down', $event)"
      @pointermove="emitProgressEvent('progress-pointer-move', $event)"
      @pointerup="emitProgressEvent('progress-pointer-up', $event)"
      @pointercancel="emitProgressEvent('progress-pointer-cancel', $event)"
      @pointerleave="$emit('progress-pointer-leave')"
      @keydown="$emit('progress-keydown', $event)"
    >
      <span class="player-progress__rail" aria-hidden="true">
        <span class="player-progress__fill" :style="{ width: `${percentage}%` }" />
        <span class="player-progress__thumb" :style="{ left: `${percentage}%` }" />
      </span>
      <span
        v-if="previewVisible"
        class="player-progress__tooltip"
        :style="{ left: `${previewLeft}%` }"
      >
        <strong>{{ previewText }}</strong>
        <small>{{ previewTimeLabel }}</small>
      </span>
    </div>
    <span>{{ durationLabel }}</span>
  </div>
</template>

<script setup>
const emit = defineEmits([
  'progress-pointer-down',
  'progress-pointer-move',
  'progress-pointer-up',
  'progress-pointer-cancel',
  'progress-pointer-leave',
  'progress-keydown'
])

defineProps({
  currentLabel: {
    type: String,
    required: true
  },
  durationLabel: {
    type: String,
    required: true
  },
  percentage: {
    type: Number,
    default: 0
  },
  ariaMax: {
    type: Number,
    default: 0
  },
  ariaNow: {
    type: Number,
    default: 0
  },
  previewVisible: {
    type: Boolean,
    default: false
  },
  previewLeft: {
    type: Number,
    default: 0
  },
  previewText: {
    type: String,
    default: ''
  },
  previewTimeLabel: {
    type: String,
    default: ''
  }
})

function emitProgressEvent(name, event) {
  emit(name, {
    event,
    bar: event.currentTarget
  })
}
</script>
