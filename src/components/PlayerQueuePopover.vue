<template>
  <div class="control-popover-wrap queue-popover-wrap">
    <button
      ref="trigger"
      class="icon-button with-dot"
      type="button"
      aria-label="播放列表"
      :aria-expanded="open"
      :aria-controls="queueId"
      :aria-haspopup="isMobile ? 'dialog' : undefined"
      :class="{ active: open }"
      @click="$emit('toggle')"
    >
      <ListMusic :size="19" />
    </button>
    <Teleport to="body" :disabled="!isMobile">
      <Transition name="queue-backdrop">
        <button
          v-if="open && isMobile"
          class="mobile-queue-backdrop"
          type="button"
          tabindex="-1"
          aria-label="收起播放列表"
          @pointerdown.stop
          @click="$emit('close')"
        />
      </Transition>
      <Transition
        :name="isMobile ? 'queue-drawer' : transitionName"
        @after-enter="focusDrawer"
        @after-leave="resetDrawer"
      >
        <div
          v-if="open"
          :id="queueId"
          ref="panel"
          class="player-popover queue-popover"
          :class="{
            'queue-popover--drawer': isMobile,
            'queue-popover--immersive': isMobile && immersive,
            'queue-popover--cover-detail': isMobile && !immersive && Boolean(detailCoverStyle),
            'queue-popover--dragging': dragging
          }"
          :style="isMobile ? drawerStyle : undefined"
          :role="isMobile ? 'dialog' : undefined"
          :aria-modal="isMobile ? 'true' : undefined"
          aria-label="播放列表"
          tabindex="-1"
          @keydown="handleDrawerKeydown"
        >
          <div
            v-if="isMobile"
            class="queue-popover__drag"
            aria-hidden="true"
            @pointerdown="startDrag"
            @pointermove="moveDrag"
            @pointerup="endDrag"
            @pointercancel="cancelDrag"
            @lostpointercapture="cancelDrag"
          ><span /></div>
          <header class="queue-popover__head">
            <div class="queue-popover__title">
              <strong>播放列表</strong>
              <small>{{ tracks.length }} 首歌曲</small>
            </div>
            <div class="queue-popover__actions">
              <button type="button" @click="$emit('clear')">清空</button>
            </div>
          </header>
          <div class="queue-popover__list">
            <p v-if="!tracks.length" class="mobile-queue-empty">播放队列还是空的<br /><span>挑一首喜欢的音乐，开始聆听吧。</span></p>
            <SongListRow
              v-for="track in tracks"
              :key="track.queueKey"
              :track="track"
              compact
              :queue-layout="isMobile"
              :show-play-icon="!isMobile"
              :show-vip-playback-warning="false"
              @play="$emit('play-track', $event)"
            />
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, ref, useId } from 'vue'
import { ListMusic } from 'lucide-vue-next'
import { useResponsiveLayout } from '../composables/useResponsiveLayout'
import SongListRow from './SongListRow.vue'

const props = defineProps({
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
  },
  immersive: {
    type: Boolean,
    default: false
  },
  detailCoverStyle: {
    type: Object,
    default: null
  },
  coverStyle: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['toggle', 'close', 'play-track', 'clear'])
const { isMobile2D: isMobile } = useResponsiveLayout()
const queueId = useId()
const trigger = ref(null)
const panel = ref(null)
const dragging = ref(false)
const dragOffset = ref(0)
let dragStartY = 0
let dragPointerId = null

const drawerStyle = computed(() => ({
  ...(props.immersive ? props.coverStyle : props.detailCoverStyle || {}),
  '--queue-drag-offset': `${dragOffset.value}px`
}))

function focusDrawer() {
  if (isMobile.value) panel.value?.focus({ preventScroll: true })
}

function resetDrawer() {
  cancelDrag()
  if (isMobile.value && !props.open) trigger.value?.focus({ preventScroll: true })
}

function startDrag(event) {
  if (!event.isPrimary || event.button !== 0) return
  dragStartY = event.clientY
  dragPointerId = event.pointerId
  dragging.value = true
  event.currentTarget.setPointerCapture(event.pointerId)
}

function moveDrag(event) {
  if (!dragging.value || event.pointerId !== dragPointerId) return
  dragOffset.value = Math.max(0, event.clientY - dragStartY)
}

function endDrag(event) {
  if (!dragging.value || event.pointerId !== dragPointerId) return
  moveDrag(event)
  const dismiss = dragOffset.value >= 72
  dragging.value = false
  dragPointerId = null
  if (dismiss) emit('close')
  else dragOffset.value = 0
}

function cancelDrag() {
  if (!dragging.value && !props.open) dragOffset.value = 0
  if (!dragging.value) return
  dragging.value = false
  dragPointerId = null
  dragOffset.value = 0
}

function handleDrawerKeydown(event) {
  if (!isMobile.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    emit('close')
    return
  }
  if (event.key !== 'Tab') return
  const controls = [...panel.value.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')]
    .filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length)
  const first = controls[0]
  const last = controls.at(-1)
  if (!first || (event.shiftKey && (document.activeElement === first || document.activeElement === panel.value))) {
    event.preventDefault()
    ;(last ?? panel.value).focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
</script>
