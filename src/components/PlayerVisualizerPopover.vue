<template>
  <div v-if="visible" class="control-popover-wrap visualizer-popover-wrap">
    <button
      class="icon-button"
      type="button"
      :aria-label="buttonLabel"
      :title="buttonLabel"
      :aria-pressed="open"
      :class="{ active: open }"
      @click="$emit('toggle')"
    >
      <Settings2 :size="18" />
    </button>
    <div v-if="open" class="player-popover visualizer-popover">
      <button
        v-for="mode in modes"
        :key="mode.value"
        class="visualizer-option"
        type="button"
        :aria-pressed="activeValue === mode.value"
        :class="{ active: activeValue === mode.value }"
        @click="$emit('select', mode.value)"
      >
        <component :is="mode.icon" :size="18" />
        <span>{{ mode.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Settings2 } from 'lucide-vue-next'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
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

const buttonLabel = computed(() => `频谱效果：${props.activeMode.label}`)
</script>
