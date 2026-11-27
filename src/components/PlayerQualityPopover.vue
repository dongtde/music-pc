<template>
  <div class="control-popover-wrap quality-popover-wrap">
    <button
      ref="trigger"
      class="icon-button quality-button"
      type="button"
      :aria-label="buttonLabel"
      :title="buttonLabel"
      :aria-expanded="open"
      :aria-controls="qualityId"
      :aria-haspopup="isMobile ? 'dialog' : undefined"
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
    <Teleport to="body" :disabled="!isMobile">
      <Transition name="quality-backdrop">
        <button
          v-if="open && isMobile"
          class="mobile-quality-backdrop"
          type="button"
          tabindex="-1"
          aria-label="关闭音质选择"
          @pointerdown.stop
          @click="$emit('close')"
        />
      </Transition>
      <Transition
        :name="isMobile ? 'quality-drawer' : 'quality-popover'"
        @after-enter="focusDrawer"
        @after-leave="resetDrawer"
      >
        <div
          v-if="open"
          :id="qualityId"
          ref="panel"
          class="player-popover quality-popover"
          :class="{
            'quality-popover--drawer': isMobile,
            'quality-popover--immersive': isMobile && immersive,
            'quality-popover--dragging': dragging
          }"
          :style="isMobile ? drawerStyle : undefined"
          :role="isMobile ? 'dialog' : undefined"
          :aria-modal="isMobile ? 'true' : undefined"
          :aria-labelledby="isMobile ? `${qualityId}-title` : undefined"
          tabindex="-1"
          @keydown="handleDrawerKeydown"
        >
          <div
            v-if="isMobile"
            class="quality-popover__drag"
            aria-hidden="true"
            @pointerdown="startDrag"
            @pointermove="moveDrag"
            @pointerup="endDrag"
            @pointercancel="cancelDrag"
            @lostpointercapture="cancelDrag"
          ><span /></div>
          <header v-if="isMobile" class="quality-popover__head">
            <h2 :id="`${qualityId}-title`">音质选择</h2>
            <button type="button" aria-label="关闭音质选择" @click="$emit('close')"><X :size="21" /></button>
          </header>
          <div class="quality-popover__options">
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
              <Check v-if="isMobile && option.value === activeValue" class="quality-option__check" :size="21" aria-hidden="true" />
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, useId } from 'vue'
import { Check, X } from 'lucide-vue-next'
import { useResponsiveLayout } from '../composables/useResponsiveLayout'

const props = defineProps({
  open: { type: Boolean, default: false },
  buttonLabel: { type: String, required: true },
  activeQuality: { type: Object, required: true },
  activeValue: { type: String, required: true },
  options: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  immersive: { type: Boolean, default: false },
  coverStyle: { type: Object, default: () => ({}) },
  detailCoverStyle: { type: Object, default: null }
})
const emit = defineEmits(['toggle', 'close', 'select'])
const { isMobile2D: isMobile } = useResponsiveLayout()
const qualityId = useId()
const trigger = ref(null)
const panel = ref(null)
const dragging = ref(false)
const dragOffset = ref(0)
let drag = null
const drawerStyle = computed(() => ({
  ...(props.immersive ? props.coverStyle : props.detailCoverStyle || {}),
  '--quality-drag-offset': `${dragOffset.value}px`
}))

function focusDrawer() {
  if (isMobile.value && props.open) panel.value?.focus({ preventScroll: true })
}

function resetDrawer() {
  cancelDrag()
  if (isMobile.value && !props.open) trigger.value?.focus({ preventScroll: true })
}

function startDrag(event) {
  if (event.isPrimary === false || event.button > 0) return
  drag = { id: event.pointerId, y: event.clientY, element: event.currentTarget }
  dragging.value = true
  event.currentTarget.setPointerCapture(event.pointerId)
  event.preventDefault()
}

function moveDrag(event) {
  if (!drag || event.pointerId !== drag.id) return
  dragOffset.value = Math.max(0, event.clientY - drag.y)
}

function releaseDragPointer() {
  const previous = drag
  drag = null
  dragging.value = false
  if (previous?.element.hasPointerCapture?.(previous.id)) previous.element.releasePointerCapture(previous.id)
}

function endDrag(event) {
  if (!drag || event.pointerId !== drag.id) return
  moveDrag(event)
  const dismiss = dragOffset.value >= 72
  releaseDragPointer()
  if (dismiss) emit('close')
  else dragOffset.value = 0
}

function cancelDrag(event) {
  if (event?.pointerId != null && event.pointerId !== drag?.id) return
  releaseDragPointer()
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
  const controls = [...panel.value.querySelectorAll('button, [tabindex]')]
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

onBeforeUnmount(() => cancelDrag())
</script>

<style scoped>
.mobile-quality-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: rgba(5, 10, 14, .46);
  touch-action: none;
}
.quality-popover--drawer {
  position: fixed;
  inset: auto 0 0;
  z-index: 101;
  box-sizing: border-box;
  display: flex;
  width: 100%;
  max-height: min(76dvh, 680px);
  flex-direction: column;
  padding: 0 0 calc(12px + var(--mobile-bottom-inset));
  overflow: hidden;
  border: 1px solid var(--mobile-border);
  border-bottom: 0;
  border-radius: 24px 24px 0 0;
  color: var(--mobile-text);
  background: var(--mobile-surface);
  box-shadow: 0 -16px 48px rgba(0, 0, 0, .18);
  outline: none;
  transform: translate3d(0, var(--quality-drag-offset, 0px), 0);
  transition: transform var(--transition-duration) cubic-bezier(.22, 1, .36, 1);
}
.quality-popover--drawer::after { display: none; }
.quality-popover--immersive {
  --mobile-surface: color-mix(in srgb, var(--cover-primary, #213245) 48%, #11191d);
  --mobile-text: #f7f8fa;
  --mobile-muted: rgba(255, 255, 255, .58);
  --mobile-border: rgba(255, 255, 255, .08);
  background: linear-gradient(160deg, color-mix(in srgb, var(--cover-primary, #213245) 62%, #1a252b), var(--mobile-surface));
}
.quality-popover__drag {
  display: grid;
  flex: 0 0 28px;
  place-items: center;
  cursor: grab;
  touch-action: none;
}
.quality-popover__drag span { width: 36px; height: 4px; border-radius: 4px; background: var(--mobile-muted); opacity: .45; }
.quality-popover__head { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 12px; padding: 0 20px 8px; }
.quality-popover__head h2 { margin: 0; font-size: 19px; font-weight: 650; }
.quality-popover__head button { display: grid; width: 44px; height: 44px; place-items: center; padding: 0; border: 0; border-radius: 50%; color: var(--mobile-muted); background: transparent; }
.quality-popover--drawer .quality-popover__options { min-height: 0; padding: 0 12px; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
.quality-popover--drawer .quality-option { min-height: 68px; justify-content: space-between; gap: 16px; padding: 12px 16px; border: 0; border-radius: 14px; color: var(--mobile-text); background: transparent; }
.quality-popover--drawer .quality-option:hover,
.quality-popover--drawer .quality-option.active { color: var(--mobile-text); background: rgba(var(--accent-rgb), .09); }
.quality-popover--drawer .quality-option__text { gap: 4px; }
.quality-popover--drawer .quality-option__text strong { font-size: var(--type-body, 14px); font-weight: 550; }
.quality-popover--drawer .quality-option__text small { color: var(--mobile-muted); font-size: var(--type-meta, 11px); line-height: 1.5; white-space: normal; }
.quality-popover--drawer .quality-option__check { flex: 0 0 auto; color: var(--accent); }
.quality-popover--drawer button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.quality-popover--dragging { transition: none; }
.quality-popover--dragging .quality-popover__drag { cursor: grabbing; }
.quality-drawer-enter-active { transition-duration: var(--transition-duration); }
.quality-drawer-leave-active { transition: transform var(--transition-duration) cubic-bezier(.4, 0, 1, 1); }
.quality-drawer-enter-from,
.quality-drawer-leave-to { transform: translate3d(0, 100%, 0); }
.quality-backdrop-enter-active,
.quality-backdrop-leave-active { transition: opacity var(--transition-duration) ease; }
.quality-backdrop-enter-from,
.quality-backdrop-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .quality-popover--drawer,
  .mobile-quality-backdrop { transition-duration: 1ms; }
}
</style>
