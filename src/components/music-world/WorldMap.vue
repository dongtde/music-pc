<template>
  <button
    type="button"
    class="world-map"
    aria-label="打开音乐馆大地图"
    aria-haspopup="dialog"
    :aria-expanded="expanded"
    @click="open"
  >
    <WorldMapFloor :position="position" compact />
    <span class="world-map__expand"><Maximize2 :size="13" aria-hidden="true" /></span>
  </button>

  <dialog
    ref="dialog"
    class="world-map-dialog"
    aria-labelledby="world-map-title"
    @keydown.stop
    @cancel.prevent="close"
    @close="onClose"
    @click.self="close"
  >
    <div class="world-map-dialog__body">
      <header class="world-map-dialog__header">
        <div class="world-map-dialog__identity">
          <AudioLines :size="21" :stroke-width="1.5" aria-hidden="true" />
          <h2 id="world-map-title">音乐馆地图</h2>
        </div>
        <button
          type="button"
          class="world-map-dialog__close"
          aria-label="关闭大地图"
          autofocus
          @click="close"
        >
          <X :size="20" :stroke-width="1.6" aria-hidden="true" />
        </button>
      </header>

      <div class="world-map-dialog__floor">
        <WorldMapFloor
          :position="position"
          :archive-tracks="archiveTracks"
          @navigate="navigate"
        />
      </div>
    </div>
  </dialog>
</template>

<script setup>
import { ref } from 'vue'
import { AudioLines, Maximize2, X } from 'lucide-vue-next'
import WorldMapFloor from './WorldMapFloor.vue'

defineProps({
  position: { type: Object, required: true },
  archiveTracks: { type: Array, default: () => [] },
})

const emit = defineEmits(['open', 'navigate'])
const dialog = ref(null)
const expanded = ref(false)

function open() {
  if (!dialog.value || expanded.value) return
  emit('open')
  dialog.value.showModal()
  expanded.value = true
}

function onClose() {
  expanded.value = false
}

function close() {
  dialog.value?.close()
  onClose()
}

function navigate(id) {
  close()
  emit('navigate', id)
}
</script>

<style scoped>
.world-map {
  position: absolute;
  top: 20px;
  right: 22px;
  z-index: 4;
  box-sizing: border-box;
  width: 128px;
  padding: 8px;
  border: 1px solid #a8c8cb38;
  border-radius: 18px;
  background: linear-gradient(145deg, #1b333ce8, #0e2029f2);
  color: #a8e7df;
  box-shadow: 0 8px 30px #0003, inset 0 1px #e5f0ec0d;
  cursor: pointer;
  transition: border-color 180ms, transform 180ms;
}

.world-map:hover {
  border-color: #a8e7df80;
  transform: translateY(-2px);
}

.world-map:focus-visible {
  outline: 2px solid #a8e7df;
  outline-offset: 4px;
}

.world-map .world-floor {
  aspect-ratio: 444 / 550;
  height: auto;
}

.world-map__expand {
  position: absolute;
  right: 9px;
  bottom: 9px;
  display: grid;
  place-items: center;
  width: 25px;
  height: 25px;
  border: 1px solid #a8e7df25;
  border-radius: 8px;
  background: #142d36;
}

.world-map-dialog {
  box-sizing: border-box;
  width: min(860px, calc(100vw - 48px));
  height: min(820px, calc(100dvh - 48px));
  max-width: none;
  max-height: none;
  padding: 0;
  border: 1px solid #afc9cb38;
  border-radius: 26px;
  background: #0e2029;
  color: #e5f0ec;
  box-shadow: 0 32px 100px #0009, inset 0 1px #e5f0ec12;
  overflow: hidden;
  overscroll-behavior: contain;
}

.world-map-dialog[open] {
  animation: map-arrive 220ms ease-out;
}

.world-map-dialog::backdrop {
  background: #050e14b3;
  backdrop-filter: blur(10px);
}

.world-map-dialog__body {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
  min-height: 0;
}

.world-map-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 18px 28px;
  border-bottom: 1px solid #afc9cb12;
  background: #e5f0ec03;
}

.world-map-dialog__identity {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.world-map-dialog__identity > svg {
  flex-shrink: 0;
  color: #a8e7df;
}

.world-map-dialog__header h2 {
  margin: 0;
  font-family: Bahnschrift, 'Microsoft YaHei UI', 'Microsoft YaHei', sans-serif;
  font-size: 17px;
  font-weight: 500;
  letter-spacing: .06em;
  line-height: 1.4;
}

.world-map-dialog__close {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  padding: 0;
  border: 1px solid #afc9cb25;
  border-radius: 50%;
  background: #e5f0ec05;
  color: #a3babc;
  cursor: pointer;
  transition: color 160ms, background 160ms, border-color 160ms;
}

.world-map-dialog__close:hover {
  border-color: #a8e7df55;
  background: #a8e7df12;
  color: #e5f0ec;
}

.world-map-dialog__close:focus-visible {
  outline: 2px solid #a8e7df;
  outline-offset: 4px;
}

.world-map-dialog__floor {
  min-width: 0;
  min-height: 0;
  padding: 26px 34px 30px;
  background: radial-gradient(ellipse at 50% 15%, #2c535941, transparent 70%);
  scrollbar-width: thin;
  scrollbar-color: #648b8e66 transparent;
}

@keyframes map-arrive {
  from { opacity: 0; transform: translateY(10px) scale(.985); }
  to { opacity: 1; transform: none; }
}

@media (max-width: 800px) {
  .world-map { top: 14px; right: 14px; width: 108px; padding: 7px; border-radius: 14px; }
  .world-map-dialog { width: calc(100vw - 28px); height: min(760px, calc(100dvh - 28px)); border-radius: 22px; }
  .world-map-dialog__header { padding: 18px 23px; }
  .world-map-dialog__floor { padding: 15px 20px 20px; }
}

@media (max-width: 600px) {
  .world-map-dialog { width: calc(100vw - 24px); height: fit-content; max-height: calc(100dvh - 24px); border-radius: 20px; }
  .world-map-dialog__body { height: auto; }
  .world-map-dialog__header { padding: 16px 20px; }
  .world-map-dialog__header h2 { font-size: 16px; }
  .world-map-dialog__identity { gap: 10px; }
  .world-map-dialog__identity > svg { width: 22px; }
  .world-map-dialog__close { width: 44px; height: 44px; }
  .world-map-dialog__floor { box-sizing: border-box; aspect-ratio: 456 / 558; padding: 10px 12px 18px; }
}

@media (max-height: 620px) {
  .world-map-dialog { height: calc(100dvh - 24px); max-height: none; }
  .world-map-dialog__body { height: 100%; }
  .world-map-dialog__header { padding-block: 12px; }
  .world-map-dialog__floor { padding-block: 10px; aspect-ratio: auto; overflow: auto; }
  .world-map-dialog__floor :deep(.world-floor) { min-height: 390px; }
}

@media (prefers-reduced-motion: reduce) {
  .world-map, .world-map-dialog__close { transition: none; }
  .world-map-dialog[open] { animation: none; }
}
</style>
