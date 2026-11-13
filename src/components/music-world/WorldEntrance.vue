<template>
  <Transition
    name="world-entrance"
    :duration="{ enter: 0, leave: reducedMotion ? 180 : 1800 }"
    @after-leave="$emit('opened')"
  >
    <div
      v-show="!ready || failed"
      class="world-entrance"
      :class="{ 'is-ready': ready && !failed, 'is-failed': failed, 'is-paused': paused }"
      :style="{ '--entrance-progress': percentage / 100 }"
      @keydown.stop
    >
      <div class="world-entrance__veil" aria-hidden="true" />

      <div v-for="side in ['left', 'right']" :key="side" class="world-entrance__door" :class="`world-entrance__door--${side}`" aria-hidden="true">
        <div class="world-entrance__sheen" />
        <svg class="world-entrance__echoes" viewBox="-800 -800 1600 1600" fill="none">
          <circle v-for="radius in echoRadii" :key="radius" :r="radius" />
          <path class="world-entrance__echo-accent" d="M-370 0a370 370 0 0 1 370-370M0 509a509 509 0 0 0 509-509" />
        </svg>
        <svg class="world-entrance__soundfield" viewBox="0 -100 520 200" preserveAspectRatio="none" fill="none">
          <path class="world-entrance__sound-axis" d="M0 0H520" />
          <path v-for="(line, index) in soundLines" :key="index" :d="line" :style="{ opacity: 1 - Math.abs(index - 3) * .17 }" />
          <circle cx="42" cy="0" r="2" />
          <circle cx="482" cy="0" r="2" />
        </svg>
        <div class="world-entrance__frame" />
        <div class="world-entrance__record">
          <div class="world-entrance__record-rim" />
          <div class="world-entrance__grooves" />
          <svg class="world-entrance__record-progress" viewBox="0 0 300 300" fill="none">
            <circle cx="150" cy="150" r="140" pathLength="1" />
          </svg>
          <div class="world-entrance__label">
            <svg class="world-entrance__wave" viewBox="0 0 160 80" fill="none">
              <path d="M0 40H23M137 40H160" />
              <path
                v-for="(height, index) in waveHeights"
                :key="index"
                class="world-entrance__wave-bar"
                :d="`M${32 + index * 8} ${40 - height / 2}v${height}`"
                :style="{ animationDelay: `${index * -0.13}s` }"
              />
            </svg>
          </div>
          <i class="world-entrance__record-tick world-entrance__record-tick--top" />
          <i class="world-entrance__record-tick world-entrance__record-tick--bottom" />
        </div>
        <i class="world-entrance__edge" />
      </div>

      <div class="world-entrance__seam" aria-hidden="true" />

      <div class="world-entrance__title">
        <h1>澜音</h1>
        <p>让音乐，拥有空间。</p>
      </div>

      <div class="world-entrance__loading">
        <p class="world-entrance__status" role="status" aria-live="polite">{{ statusText }}</p>
        <div v-if="!failed" class="world-entrance__progress" role="progressbar" aria-label="澜音加载进度" :aria-valuenow="percentage" aria-valuemin="0" aria-valuemax="100">
          <span class="world-entrance__percentage" aria-hidden="true">{{ String(percentage).padStart(2, '0') }}<small>%</small></span>
        </div>
      </div>

      <div v-if="failed" class="world-entrance__recovery">
        <p>你可以重新进入，或返回 2D 继续听歌。</p>
        <div>
          <button type="button" @click="$emit('retry')">重新进入 <span aria-hidden="true">↗</span></button>
          <button type="button" @click="$emit('exit')">返回 2D</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  ready: Boolean,
  failed: Boolean,
  progress: { type: Number, default: 0 },
  reducedMotion: Boolean,
  paused: Boolean,
})
defineEmits(['opened', 'retry', 'exit'])

const waveHeights = [8, 16, 27, 18, 38, 50, 30, 50, 38, 18, 27, 16, 8]
const echoRadii = [265, 274, 288, 370, 382, 398, 480, 493, 509, 620, 634, 650, 758]
// Etched sound ribbons stay fixed to each door, including during the reveal.
const soundLines = Array.from({ length: 7 }, (_, line) =>
  Array.from({ length: 131 }, (_, point) => {
    const x = point * 4, t = x / 520
    const envelope = Math.sin(Math.PI * t) ** 1.5
    const y = envelope * (Math.sin(t * Math.PI * 3 + line * .2) * (36 + line * 7) + (line - 3) * 8)
    return `${point ? 'L' : 'M'}${x} ${y.toFixed(2)}`
  }).join(' '),
)
// Model download completion precedes scene preparation. Reserve 100% for readiness.
const percentage = computed(() => props.ready && !props.failed ? 100 : Math.round(Math.min(1, Math.max(0, Number(props.progress) || 0)) * 98))
const statusText = computed(() => {
  if (props.failed) return '音乐馆暂时无法打开'
  if (props.ready) return '澜音已就绪 · 为你开门'
  if (props.progress >= 0.98) return '正在点亮空间'
  if (props.progress >= 0.65) return '正在布置空间'
  return '正在准备音乐馆'
})
</script>

<style scoped>
.world-entrance {
  --entrance-ink: #101f29;
  --entrance-panel: #152a33;
  --entrance-highlight: #263c42;
  --entrance-gold: #c5ad84;
  --entrance-paper: #eee5d4;
  --entrance-muted: #889a9d;
  --record-size: clamp(216px, 36vh, 360px);
  --record-center: 42%;
  position: absolute;
  z-index: 8;
  inset: 0;
  overflow: hidden;
  isolation: isolate;
  color: var(--entrance-paper);
  font-family: 'Bahnschrift', 'Segoe UI', 'Microsoft YaHei', sans-serif;
}
.world-entrance__veil { position: absolute; inset: 0; background: var(--entrance-ink); }
.world-entrance__door {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 50%;
  overflow: hidden;
  background:
    repeating-linear-gradient(90deg, #c5ad8402 0 1px, transparent 1px 4px),
    radial-gradient(ellipse at var(--door-light) 42%, var(--entrance-highlight), transparent 68%),
    linear-gradient(180deg, var(--entrance-panel), var(--entrance-ink));
}
.world-entrance__door--left { --door-light: 100%; left: 0; }
.world-entrance__door--right { --door-light: 0%; right: 0; }
.world-entrance__sheen {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(115deg, transparent 12%, #c5ad8407 31%, transparent 49%),
    repeating-linear-gradient(90deg, transparent 0 47px, #c5ad8405 47px 48px, #101f2912 48px 49px, transparent 49px 96px);
  mask-image: linear-gradient(transparent, #000 18% 82%, transparent);
  pointer-events: none;
}
.world-entrance__door--right .world-entrance__sheen { transform: scaleX(-1); }
.world-entrance__echoes {
  position: absolute;
  top: var(--record-center);
  width: max(100vw, 900px);
  height: max(100vw, 900px);
  transform: translateY(-50%);
  stroke: var(--entrance-gold);
  stroke-width: .65;
  opacity: .12;
  mask-image: radial-gradient(circle, transparent 19%, #000 27% 59%, transparent 72%);
  pointer-events: none;
}
.world-entrance__door--left .world-entrance__echoes { right: min(-50vw, -450px); }
.world-entrance__door--right .world-entrance__echoes { left: min(-50vw, -450px); }
.world-entrance__echo-accent { stroke-width: 1.4; }
.world-entrance__soundfield {
  position: absolute;
  top: var(--record-center);
  left: 8%;
  width: calc(92% - var(--record-size) / 2 - 48px);
  height: clamp(110px, 19vh, 200px);
  transform: translateY(-50%);
  stroke: var(--entrance-gold);
  stroke-width: .8;
  opacity: .24;
  mask-image: linear-gradient(90deg, transparent, #000 14% 80%, transparent);
  pointer-events: none;
}
.world-entrance__soundfield path, .world-entrance__soundfield circle { vector-effect: non-scaling-stroke; }
.world-entrance__soundfield .world-entrance__sound-axis { stroke-width: .5; opacity: .5; }
.world-entrance__soundfield circle { fill: var(--entrance-gold); stroke: none; }
.world-entrance__door--right .world-entrance__soundfield { left: auto; right: 8%; transform: translateY(-50%) scaleX(-1); }
.world-entrance__frame {
  position: absolute;
  inset: 24px;
  border: 1px solid #c5ad841c;
  box-shadow: 0 0 0 5px #101f2930, inset 0 0 35px #101f2940;
}
.world-entrance__door--left .world-entrance__frame { right: 16px; }
.world-entrance__door--right .world-entrance__frame { left: 16px; }
.world-entrance__edge {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: linear-gradient(transparent 4%, #c5ad8440 24%, #eee5d4a0 42%, #c5ad8440 68%, transparent 96%);
  box-shadow: 0 0 16px #c5ad8425;
}
.world-entrance__door--left .world-entrance__edge { right: 0; }
.world-entrance__door--right .world-entrance__edge { left: 0; }
.world-entrance__record {
  position: absolute;
  top: var(--record-center);
  width: var(--record-size);
  height: var(--record-size);
  transform: translateY(-50%);
  border-radius: 50%;
  background: radial-gradient(circle, #101f2940 34%, #101f2900 35%), conic-gradient(from 30deg, #c5ad8400, #c5ad840a, #c5ad8400 30%, #c5ad840b 55%, #c5ad8400 75%);
  box-shadow: 0 0 90px #c5ad8405;
}
.world-entrance__door--left .world-entrance__record { right: calc(var(--record-size) / -2); }
.world-entrance__door--right .world-entrance__record { left: calc(var(--record-size) / -2); }
.world-entrance__record-rim {
  position: absolute;
  inset: 0;
  border: 1px solid #c5ad8430;
  border-radius: inherit;
  box-shadow: 0 0 0 10px #c5ad8403, 0 0 0 11px #c5ad840b, 0 0 0 35px #c5ad8402, 0 0 0 36px #c5ad8407;
}
.world-entrance__grooves {
  position: absolute;
  inset: 10%;
  border: 1px solid #c5ad8420;
  border-radius: inherit;
  background: repeating-radial-gradient(circle, transparent 0 5px, #c5ad8414 5px 6px, transparent 6px 9px);
  mask-image: radial-gradient(circle, transparent 35%, #000 36% 68%, transparent 70%);
}
.world-entrance__record-progress { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
.world-entrance__record-progress circle {
  stroke: var(--entrance-gold);
  stroke-width: .8;
  stroke-dasharray: 1;
  stroke-dashoffset: calc(1 - var(--entrance-progress));
  opacity: .75;
  transition: stroke-dashoffset .5s ease;
}
.world-entrance__label {
  position: absolute;
  inset: 25%;
  display: grid;
  place-items: center;
  border: 1px solid #c5ad8440;
  border-radius: inherit;
  background: radial-gradient(circle at 50% 35%, var(--entrance-highlight), var(--entrance-panel));
  box-shadow: 0 0 0 6px #101f2940, 0 0 0 7px #c5ad8418, 0 8px 30px #101f2960;
}
.world-entrance__wave { position: absolute; top: 8%; left: 14%; width: 72%; height: 44%; overflow: visible; color: var(--entrance-gold); }
.world-entrance__wave path { stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; }
.world-entrance__wave-bar { transform-box: fill-box; transform-origin: center; animation: entrance-wave 1.8s ease-in-out infinite; }
.world-entrance__record-tick { position: absolute; left: calc(50% - .5px); width: 1px; height: 9px; background: var(--entrance-gold); }
.world-entrance__record-tick--top { top: -4px; }
.world-entrance__record-tick--bottom { bottom: -4px; }
.world-entrance__seam {
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(50% - 1px);
  width: 2px;
  background: linear-gradient(transparent 5%, #eee5d4 42%, transparent 95%);
  box-shadow: 0 0 18px 2px #c5ad8460, 0 0 64px 10px #c5ad8420;
  opacity: .18;
  pointer-events: none;
}
.world-entrance__title { position: absolute; top: calc(var(--record-center) + var(--record-size) / 2 + 31px); left: 50%; width: max-content; text-align: center; transform: translateX(-50%); }
.world-entrance__title h1 { margin: 0 0 14px; padding-left: .32em; font: 400 clamp(30px, 3.6vh, 40px)/1.3 'STSong', 'SimSun', serif; letter-spacing: .32em; }
.world-entrance__title p { margin: 0; color: #b7bcaf; font-size: 11px; letter-spacing: .2em; }
.world-entrance__loading { position: absolute; top: var(--record-center); left: 50%; width: var(--record-size); height: var(--record-size); transform: translate(-50%, -50%); text-align: center; pointer-events: none; }
.world-entrance__status { position: absolute; top: 79%; left: 10%; width: 80%; margin: 0; color: var(--entrance-muted); font-size: clamp(9px, calc(var(--record-size) * .032), 11px); line-height: 1.5; letter-spacing: .08em; }
.world-entrance__progress { position: absolute; top: 55%; left: 50%; transform: translate(-50%, -50%); }
.world-entrance__percentage { color: var(--entrance-paper); font-size: clamp(18px, calc(var(--record-size) * .082), 28px); line-height: 1; font-weight: 300; font-variant-numeric: tabular-nums; letter-spacing: .04em; white-space: nowrap; }
.world-entrance__percentage small { margin-left: 4px; color: var(--entrance-gold); font-size: 10px; }
.world-entrance__recovery { position: absolute; bottom: 60px; left: 50%; width: min(340px, calc(100% - 40px)); transform: translateX(-50%); }
.world-entrance__recovery p { margin: 0 0 16px; color: var(--entrance-muted); text-align: center; font-size: 11px; line-height: 1.8; }
.world-entrance__recovery > div { display: flex; justify-content: center; gap: 12px; }
.world-entrance__recovery button { padding: 10px 16px; border: 1px solid #c5ad8450; border-radius: 3px; background: #c5ad8410; color: var(--entrance-paper); font-size: 12px; }
.world-entrance__recovery button:hover { background: #c5ad8428; }
.world-entrance__recovery button:focus-visible { outline: 2px solid var(--entrance-paper); outline-offset: 4px; }
.world-entrance__recovery button span { margin-left: 10px; color: var(--entrance-gold); }
.is-failed .world-entrance__status { color: var(--entrance-paper); }
.is-failed .world-entrance__wave-bar,
.is-ready .world-entrance__wave-bar,
.is-paused .world-entrance__wave-bar { animation-play-state: paused; }

/* Let the seam brighten before both record halves travel with their doors. */
.world-entrance-leave-active .world-entrance__door { transition: transform 1.45s cubic-bezier(.65, 0, .22, 1) .3s; will-change: transform; }
.world-entrance-leave-to .world-entrance__door--left { transform: translateX(-100%); }
.world-entrance-leave-to .world-entrance__door--right { transform: translateX(100%); }
.world-entrance-leave-active .world-entrance__veil { transition: opacity .8s ease .3s; }
.world-entrance-leave-to .world-entrance__veil { opacity: 0; }
.world-entrance-leave-active .world-entrance__seam { animation: entrance-unseal .85s ease both; }
.world-entrance-leave-active .world-entrance__title,
.world-entrance-leave-active .world-entrance__loading,
.world-entrance-leave-active .world-entrance__recovery { transition: opacity .3s ease .12s; }
.world-entrance-leave-to .world-entrance__title,
.world-entrance-leave-to .world-entrance__loading,
.world-entrance-leave-to .world-entrance__recovery { opacity: 0; }
@keyframes entrance-wave { 0%, 100% { transform: scaleY(.52); opacity: .55; } 50% { transform: scaleY(1); opacity: 1; } }
@keyframes entrance-unseal { 0% { opacity: .18; } 35% { opacity: .95; } 100% { opacity: 0; } }

@media (max-width: 600px) {
  .world-entrance { --record-size: clamp(190px, 56vw, 260px); --record-center: 38%; }
  .world-entrance__echoes { opacity: .09; }
  .world-entrance__soundfield { display: none; }
  .world-entrance__frame { inset: 14px; }
  .world-entrance__door--left .world-entrance__frame { right: 9px; }
  .world-entrance__door--right .world-entrance__frame { left: 9px; }
  .world-entrance__recovery { bottom: 80px; }
}
@media (max-height: 640px) {
  .world-entrance { --record-size: clamp(120px, 31vh, 190px); --record-center: 35%; }
  .world-entrance__title { top: calc(var(--record-center) + var(--record-size) / 2 + 18px); }
  .world-entrance__title h1 { margin: 0 0 8px; font-size: 27px; }
  .is-failed .world-entrance__title p { visibility: hidden; }
  .world-entrance__recovery { bottom: 28px; }
}
@media (max-height: 420px) {
  .world-entrance { --record-center: 36%; --record-size: 140px; }
  .world-entrance__title p { display: none; }
  .world-entrance__title h1 { font-size: 24px; }
  .is-failed .world-entrance__title { display: none; }
  .world-entrance__recovery { bottom: 22px; }
}
@media (prefers-reduced-motion: reduce) {
  .world-entrance__wave-bar { animation: none; }
  .world-entrance__record-progress circle { transition: none; }
  .world-entrance-leave-active { transition: opacity .18s ease; }
  .world-entrance-leave-to { opacity: 0; }
  .world-entrance-leave-active .world-entrance__door,
  .world-entrance-leave-active .world-entrance__veil,
  .world-entrance-leave-active .world-entrance__title,
  .world-entrance-leave-active .world-entrance__loading,
  .world-entrance-leave-active .world-entrance__recovery { transition: none; }
  .world-entrance-leave-to .world-entrance__door { transform: none; }
  .world-entrance-leave-to .world-entrance__veil,
  .world-entrance-leave-to .world-entrance__title,
  .world-entrance-leave-to .world-entrance__loading,
  .world-entrance-leave-to .world-entrance__recovery { opacity: 1; }
  .world-entrance-leave-active .world-entrance__seam { animation: none; }
}
</style>
