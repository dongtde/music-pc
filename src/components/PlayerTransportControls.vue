<template>
  <button type="button" aria-label="上一首" @click="$emit('previous')">
    <SkipBack :size="19" />
  </button>
  <button
    class="play-button"
    type="button"
    :class="{ 'play-button--loading': loading }"
    :aria-label="playButtonLabel"
    :aria-busy="loading"
    :disabled="loading"
    @click="$emit('toggle-play')"
  >
    <span v-if="loading" class="play-button__loading-dots" aria-hidden="true">
      <span v-for="dot in 3" :key="dot" />
    </span>
    <Pause v-else-if="playing" :size="22" fill="currentColor" />
    <Play v-else :size="22" fill="currentColor" />
  </button>
  <button type="button" aria-label="下一首" @click="$emit('next')">
    <SkipForward :size="19" />
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-vue-next'

const props = defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  playing: {
    type: Boolean,
    default: false
  }
})

defineEmits(['previous', 'toggle-play', 'next'])

const playButtonLabel = computed(() => {
  if (props.loading) {
    return '音乐加载中'
  }

  return props.playing ? '暂停' : '播放'
})
</script>
