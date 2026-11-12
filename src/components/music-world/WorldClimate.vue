<template>
  <div ref="root" class="world-climate" @keydown.stop @pointerdown.stop>
    <button ref="trigger" type="button" class="world-climate__trigger" :aria-expanded="expanded" aria-controls="world-climate-panel" aria-label="天气与时间" @click="expanded ? close() : open()">
      <component :is="weatherIcon" :size="17" :stroke-width="1.5" />
      <span>{{ formatLoungeTime(displayHour) }}</span><i />
      <span>{{ weatherLabel }}</span><ChevronDown :size="13" :class="{ 'is-open': expanded }" />
    </button>
    <section v-if="expanded" id="world-climate-panel" class="world-climate__panel" aria-label="云端会所天气与时间" @keydown.esc.prevent="close">
      <header><div><small>云端会所</small><h2>天气与时间</h2></div><button type="button" aria-label="关闭天气面板" @click="close"><X :size="17" /></button></header>
      <div class="world-climate__clock"><span>{{ formatLoungeTime(displayHour) }}</span><small>{{ modeLabel }}</small></div>
      <div class="world-climate__presets" role="group" aria-label="时段">
        <button v-for="time in LOUNGE_TIMES" :key="time.hour" type="button" :aria-pressed="modelValue.mode === 'manual' && modelValue.hour === time.hour" @click="change({ hour: time.hour, mode: 'manual' })">{{ time.label }}</button>
      </div>
      <label class="world-climate__slider"><span class="sr-only">时间</span><input type="range" min="0" max="23.75" step="0.25" :value="displayHour" :aria-valuetext="formatLoungeTime(displayHour)" @input="change({ hour: Number($event.target.value), mode: 'manual' })" /></label>
      <div class="world-climate__hours" aria-hidden="true"><span>00:00</span><span>12:00</span><span>24:00</span></div>
      <fieldset><legend>窗外天气</legend><div class="world-climate__weather">
        <button v-for="weather in LOUNGE_WEATHERS" :key="weather.id" type="button" :aria-pressed="modelValue.weather === weather.id" @click="change({ weather: weather.id })"><component :is="icons[weather.id]" :size="18" :stroke-width="1.4" />{{ weather.label }}</button>
      </div></fieldset>
      <label class="world-climate__mode"><span>时间模式</span><select :value="modelValue.mode" aria-label="时间模式" @change="change({ mode: $event.target.value, hour: displayHour })"><option value="manual">手动调节</option><option value="local">跟随本地时间</option><option value="cycle">自动昼夜流转</option></select></label>
      <p>{{ modelValue.mode === 'cycle' ? '12 分钟，从日出走到星夜。' : modelValue.mode === 'local' ? '与你设备上的时间保持同步。' : '选一个时刻，让音乐慢下来。' }}</p>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ChevronDown, Cloud, CloudFog, CloudRain, Moon, Sun, X } from 'lucide-vue-next'
import { formatLoungeTime, LOUNGE_TIMES, LOUNGE_WEATHERS } from './loungeClimate.js'

const props = defineProps({ modelValue: { type: Object, required: true }, currentHour: Number })
const emit = defineEmits(['update:modelValue', 'open'])
const root = ref(null), trigger = ref(null), expanded = ref(false)
const icons = { clear: Sun, cloudy: Cloud, rain: CloudRain, fog: CloudFog }
const displayHour = computed(() => props.modelValue.mode === 'manual' ? props.modelValue.hour : props.currentHour ?? props.modelValue.hour)
const weatherLabel = computed(() => LOUNGE_WEATHERS.find(item => item.id === props.modelValue.weather)?.label)
const weatherIcon = computed(() => props.modelValue.weather === 'clear' && (displayHour.value < 6 || displayHour.value >= 20) ? Moon : icons[props.modelValue.weather])
const modeLabel = computed(() => ({ manual: '此刻的光线，由你选择', local: '本地时间', cycle: '昼夜流转中' })[props.modelValue.mode])
function change(patch) { emit('update:modelValue', { ...props.modelValue, ...patch }) }
async function open() { expanded.value = true; emit('open'); await nextTick(); root.value?.querySelector('section button')?.focus({ preventScroll: true }) }
function close() { expanded.value = false; trigger.value?.focus({ preventScroll: true }) }
function outside(event) { if (expanded.value && !root.value?.contains(event.target)) expanded.value = false }
onMounted(() => document.addEventListener('pointerdown', outside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
defineExpose({ open })
</script>

<style scoped>
.world-climate { position: absolute; top: 24px; left: 24px; z-index: 5; color: #e2e9e4; font: 12px 'Segoe UI', 'Microsoft YaHei', sans-serif; }
.world-climate button, .world-climate select { font: inherit; cursor: pointer; color: inherit; }
.world-climate button { border: 1px solid transparent; }
.world-climate button:focus-visible, .world-climate select:focus-visible, .world-climate input:focus-visible { outline: 2px solid #b2ded6; outline-offset: 3px; }
.world-climate__trigger { display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-color: #abc8ca33 !important; border-radius: 12px; background: #162d36e8; box-shadow: 0 5px 22px #0002; backdrop-filter: blur(16px); }
.world-climate__trigger > svg:first-child { color: #e6c99a; }
.world-climate__trigger i { width: 1px; height: 11px; background: #b5c9c733; }
.world-climate__trigger > svg:last-child { color: #a2b7b7; transition: transform .18s; }
.world-climate__trigger .is-open { transform: rotate(180deg); }
.world-climate__panel { box-sizing: border-box; position: absolute; top: 54px; left: 0; width: 302px; max-height: calc(100dvh - 114px); overflow: auto; padding: 22px; border: 1px solid #b5cdca30; border-radius: 18px; background: #142a33f5; box-shadow: 0 18px 60px #0005; backdrop-filter: blur(20px); }
.world-climate__panel header { display: flex; align-items: center; justify-content: space-between; }
.world-climate__panel header small { color: #91aaa9; font-size: 10px; letter-spacing: .12em; }
.world-climate__panel h2 { margin: 5px 0 0; font-size: 16px; font-weight: 500; letter-spacing: .04em; }
.world-climate__panel header button { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border-radius: 50%; background: #b5cdca0a; color: #9eb7b9; }
.world-climate__clock { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 25px 0 18px; }
.world-climate__clock > span { font: 30px Bahnschrift, 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums; color: #efdbbb; }
.world-climate__clock small { color: #93aaa9; font-size: 10px; }
.world-climate__presets { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
.world-climate__presets button { min-height: 34px; padding: 6px 0; border-radius: 7px; background: #abc8ca09; color: #b2c7c6; }
.world-climate button[aria-pressed=true] { border-color: #d5b98966; background: #d5b98918; color: #ecd2aa; }
.world-climate button:hover { border-color: #abc8ca55; }
.world-climate__slider { display: block; padding: 17px 0 4px; }
.world-climate__slider input { display: block; appearance: none; width: 100%; height: 5px; margin: 8px 0; border-radius: 5px; background: linear-gradient(90deg, #213758, #a38b98 25%, #b9d7df 50%, #d6ab7d 73%, #213758); cursor: pointer; }
.world-climate__slider input::-webkit-slider-thumb { appearance: none; width: 14px; height: 14px; border: 2px solid #e9e4d1; border-radius: 50%; background: #53767e; box-shadow: 0 0 0 4px #d1e5df10; }
.world-climate__slider input::-moz-range-thumb { width: 11px; height: 11px; border: 2px solid #e9e4d1; border-radius: 50%; background: #53767e; }
.world-climate__hours { display: flex; justify-content: space-between; color: #829c9e; font-size: 9px; font-variant-numeric: tabular-nums; }
.world-climate fieldset { margin: 24px 0 20px; padding: 0; border: 0; }
.world-climate legend { margin-bottom: 11px; padding: 0; color: #a5bcba; font-size: 11px; }
.world-climate__weather { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.world-climate__weather button { display: flex; align-items: center; gap: 12px; min-height: 42px; padding: 10px 16px; background: #abc8ca08; border-color: #abc8ca13; border-radius: 9px; color: #b8cecc; }
.world-climate__mode { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid #abc8ca17; padding-top: 18px; color: #a5bcba; font-size: 11px; }
.world-climate__mode select { max-width: 155px; padding: 7px 8px; border: 1px solid #abc8ca25; border-radius: 6px; background: #1c353e; color-scheme: dark; }
.world-climate__panel p { margin: 14px 0 0; color: #7f9a9d; font-size: 10px; line-height: 1.6; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (max-width: 600px) { .world-climate { top: 14px; left: 14px; } .world-climate__panel { width: min(302px, calc(100vw - 28px)); max-height: calc(100dvh - 94px); } }
@media (prefers-reduced-motion: reduce) { .world-climate__trigger > svg:last-child { transition: none; } }
</style>
