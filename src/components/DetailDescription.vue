<template>
  <p v-if="text" ref="descriptionRoot" v-bind="$attrs" class="detail-description">
    <button
      class="detail-description__trigger"
      type="button"
      :aria-label="`查看完整${title}`"
      aria-haspopup="dialog"
      :aria-controls="drawerId"
      :aria-expanded="visible"
      @click="openDescription"
    >{{ text }}</button>
  </p>

  <NDrawer
    :id="drawerId"
    v-model:show="visible"
    class="detail-description-drawer"
    :class="{
      'detail-description-drawer--cover': coverTint,
      'detail-description-drawer--dragging': dragging
    }"
    :style="drawerStyle"
    :aria-label="title"
    placement="bottom"
    height="min(72dvh, 640px)"
    :z-index="90"
    :mask-closable="true"
    :close-on-esc="true"
    :trap-focus="true"
    :block-scroll="true"
    to="body"
    @after-leave="resetDrag"
  >
    <div class="detail-description-drawer__body">
      <div
        class="detail-description-drawer__drag"
        aria-hidden="true"
        @pointerdown="startDrag"
        @pointermove="moveDrag"
        @pointerup="endDrag"
        @pointercancel="cancelDrag"
        @lostpointercapture="cancelDrag"
      ><span /></div>
      <div class="detail-description-drawer__scroll" tabindex="0" role="document" :aria-label="title">
        <p class="detail-description-drawer__text">{{ text }}</p>
      </div>
    </div>
  </NDrawer>
</template>

<script setup>
import { computed, onDeactivated, ref, useId, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NDrawer } from 'naive-ui'
import '../styles/detail-description.css'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  text: { type: String, default: '' },
  title: { type: String, default: '简介' },
  subtitle: { type: String, default: '' }
})

const router = useRouter()
const descriptionRoot = ref(null)
const visible = ref(false)
const coverTint = ref('')
const drawerId = `detail-description-${useId()}`
const dragging = ref(false)
const dragOffset = ref(0)
let dragStartY = 0
let dragPointerId = null
const drawerStyle = computed(() => ({
  ...(coverTint.value ? { '--detail-cover-tint': coverTint.value } : {}),
  '--description-drag-offset': `${dragOffset.value}px`
}))

function openDescription() {
  if (!props.text || !descriptionRoot.value) return
  resetDrag()
  coverTint.value = window.getComputedStyle(descriptionRoot.value)
    .getPropertyValue('--detail-cover-tint').trim()
  visible.value = true
}

function closeDescription() {
  visible.value = false
  dragging.value = false
  dragPointerId = null
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
  if (dismiss) visible.value = false
  else dragOffset.value = 0
}

function cancelDrag() {
  if (dragging.value) resetDrag()
}

function resetDrag() {
  dragging.value = false
  dragPointerId = null
  dragOffset.value = 0
}

watch([() => router.currentRoute.value.fullPath, () => props.text, () => props.subtitle], closeDescription)
onDeactivated(closeDescription)
</script>
