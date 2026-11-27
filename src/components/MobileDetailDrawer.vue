<template>
  <Transition
    name="mobile-detail"
    :duration="duration"
    @after-enter="finishEnter"
    @after-leave="finishClose"
  >
    <div v-if="route" v-show="open" ref="layer" class="mobile-detail-layer" :inert="!open || inert" :aria-hidden="!open || inert || undefined" @keydown.esc="handleEscape">
      <div class="mobile-detail-backdrop" aria-hidden="true" />
      <div class="mobile-detail-drawer">
        <Transition
          :name="transitionName"
          :duration="duration"
          @before-leave="saveScroll"
          @enter="restoreScroll"
          @after-enter="finishEnter"
        >
          <KeepAlive :max="6">
            <MobileDetailPage v-if="route" :key="route.path" :route="route" :back="back" @playlist-header-change="$emit('playlist-header-change', $event)" />
          </KeepAlive>
        </Transition>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'
import MobileDetailPage from './MobileDetailPage.vue'

const props = defineProps({
  open: Boolean,
  inert: Boolean,
  route: { type: Object, default: null },
  transitionName: { type: String, default: 'mobile-detail-forward' },
  duration: { type: Number, default: 400 },
  back: { type: Function, required: true }
})
const emit = defineEmits(['entered', 'closed', 'playlist-header-change'])
const layer = ref(null)
const scrollPositions = new WeakMap()
let returnFocus = null

watch(() => props.open, (open) => {
  if (open) returnFocus = document.activeElement
})

function saveScroll(root) {
  root.inert = true
  scrollPositions.set(root, [root, ...root.querySelectorAll('*')]
    .filter(element => element.scrollTop || element.scrollLeft)
    .map(element => ({ element, top: element.scrollTop, left: element.scrollLeft })))
}

function restoreScroll(root) {
  root.inert = false
  for (const { element, top, left } of scrollPositions.get(root) || []) {
    element.scrollTo({ top, left, behavior: 'instant' })
  }
}

function focusCurrentPage() {
  if (!props.open || props.inert) return
  const page = [...(layer.value?.querySelectorAll('.mobile-detail-page') || [])]
    .find(element => element.dataset.detailPath === props.route?.path)
  page?.focus({ preventScroll: true })
}

function finishEnter(element) {
  if (!props.open || layer.value?.classList.contains('mobile-detail-enter-active')) return
  if (element.dataset.detailPath && element.dataset.detailPath !== props.route?.path) return
  focusCurrentPage()
  emit('entered', element, props.route.fullPath)
}

async function finishClose(element) {
  if (props.open) return
  const target = returnFocus
  returnFocus = null
  emit('closed', element)
  await nextTick()
  if (!props.open && target?.isConnected) target.focus({ preventScroll: true })
}

function handleEscape(event) {
  if (!event.defaultPrevented) {
    event.preventDefault()
    props.back()
  }
}
</script>
