<template>
  <div class="control-popover-wrap queue-popover-wrap">
    <button
      class="icon-button with-dot"
      type="button"
      aria-label="播放列表"
      :class="{ active: open }"
      @click="$emit('toggle')"
    >
      <ListMusic :size="19" />
    </button>
    <Transition :name="transitionName">
      <div v-if="open" class="player-popover queue-popover">
        <header class="queue-popover__head">
          <div>
            <strong>播放列表</strong>
            <small>{{ tracks.length }} 首歌曲</small>
          </div>
          <button type="button" @click="$emit('clear')">清空</button>
        </header>
        <div class="queue-popover__list">
          <SongListRow
            v-for="track in tracks"
            :key="track.queueKey"
            :track="track"
            compact
            :show-vip-playback-warning="false"
            @play="$emit('play-track', $event)"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ListMusic } from 'lucide-vue-next'
import SongListRow from './SongListRow.vue'

defineProps({
  open: {
    type: Boolean,
    default: false
  },
  tracks: {
    type: Array,
    default: () => []
  },
  transitionName: {
    type: String,
    default: 'queue-slide'
  }
})

defineEmits(['toggle', 'play-track', 'clear'])
</script>
