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
        <div class="world-entrance__glass" />
        <div class="world-entrance__sheen" />
        <div class="world-entrance__transom" />
        <div class="world-entrance__grille" />
        <div class="world-entrance__rail world-entrance__rail--top" />
        <div class="world-entrance__rail world-entrance__rail--bottom" />
        <div class="world-entrance__jamb-light" />
        <svg class="world-entrance__reflection" viewBox="0 0 700 900" preserveAspectRatio="none" fill="none">
          <path d="M-80 95L650 -45M-80 123L650 -17M70 -60L565 700M90 -60L585 700" />
          <path d="M100 900L565 640M160 900L590 663" />
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
  --entrance-ink: #0b151f;
  --entrance-panel: #182934;
  --entrance-steel: #49616e;
  --entrance-light: #b4d9e5;
  --entrance-paper: #e3edf1;
  --entrance-muted: #8199a7;
  --frame-inset: clamp(18px, 2.4vw, 44px);
  --record-size: clamp(216px, 32vh, 326px);
  --record-center: 44%;
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
  background: linear-gradient(90deg, #111d27, #1c2b35 48%, #101c26);
  box-shadow: inset 0 0 40px #020a1290;
}
.world-entrance__door--left { --door-light: 100%; left: 0; }
.world-entrance__door--right { --door-light: 0%; right: 0; }
.world-entrance__glass {
  position: absolute;
  inset: var(--frame-inset) 16px;
  background:
    radial-gradient(ellipse at var(--door-light) 45%, #28425170, transparent 57%),
    linear-gradient(164deg, #263b4830 5%, transparent 28% 62%, #4461710c 78%, transparent),
    linear-gradient(180deg, #13232f, #152734 48%, #0c1923);
  box-shadow: inset 0 0 55px #030b1480;
}
.world-entrance__door--left .world-entrance__glass { left: var(--frame-inset); }
.world-entrance__door--right .world-entrance__glass { right: var(--frame-inset); }
.world-entrance__sheen {
  position: absolute;
  inset: var(--frame-inset) 18px;
  background:
    linear-gradient(116deg, transparent 16%, #b4d9e505 17%, #b4d9e50b 25%, transparent 25.2% 39%, #b4d9e504 39.2% 45%, transparent 45.2%),
    linear-gradient(180deg, #d7edf508, transparent 23% 72%, #01081060);
  mask-image: linear-gradient(transparent, #000 12% 90%, transparent);
  pointer-events: none;
}
.world-entrance__door--right .world-entrance__sheen { transform: scaleX(-1); }
.world-entrance__transom {
  position: absolute;
  top: var(--frame-inset);
  left: var(--frame-inset);
  right: 18px;
  height: calc(17% - var(--frame-inset));
  background:
    repeating-linear-gradient(90deg, transparent 0 calc(25% - 4px), #030a1260 calc(25% - 4px) calc(25% - 2px), #7893a026 calc(25% - 2px) calc(25% - 1px), #101c25 calc(25% - 1px) 25%),
    linear-gradient(#26394650, #0b182370);
}
.world-entrance__door--right .world-entrance__transom { left: 18px; right: var(--frame-inset); }
.world-entrance__grille {
  position: absolute;
  top: 17%;
  bottom: 17%;
  left: calc(var(--frame-inset) + 21px);
  width: clamp(42px, 7.2vw, 138px);
  border-inline: 1px solid #718c9a24;
  background:
    linear-gradient(180deg, #b4d9e506, transparent 20% 70%, #01081070),
    repeating-linear-gradient(90deg, #07121c 0 9px, #2d414e 9px 11px, #526c7a85 11px 12px, #1b2d39 12px 16px, #040c1490 16px 18px);
  box-shadow: -7px 0 14px #030a1438, 7px 0 14px #030a1438;
}
.world-entrance__door--right .world-entrance__grille { left: auto; right: calc(var(--frame-inset) + 21px); }
.world-entrance__rail {
  position: absolute;
  left: var(--frame-inset);
  right: 16px;
  height: 7px;
  background: linear-gradient(#69818d55, #304551 15%, #152430 44%, #0a151f 70%, #607a8830);
  box-shadow: 0 3px 8px #02081060;
}
.world-entrance__door--right .world-entrance__rail { left: 16px; right: var(--frame-inset); }
.world-entrance__rail--top { top: 17%; }
.world-entrance__rail--bottom { bottom: 17%; }
.world-entrance__jamb-light {
  position: absolute;
  top: 25%;
  bottom: 25%;
  left: calc(var(--frame-inset) + 8px);
  width: 2px;
  background: linear-gradient(transparent, #b4d9e599 16% 84%, transparent);
  box-shadow: 0 0 9px #8cbdd560, 0 0 24px #8cbdd520;
}
.world-entrance__door--right .world-entrance__jamb-light { left: auto; right: calc(var(--frame-inset) + 8px); }
.world-entrance__reflection {
  position: absolute;
  inset: var(--frame-inset);
  width: calc(100% - var(--frame-inset) * 2);
  height: calc(100% - var(--frame-inset) * 2);
  stroke: #b4d9e5;
  stroke-width: 1;
  opacity: .055;
  mask-image: linear-gradient(#000, transparent 58%, #000);
  pointer-events: none;
}
.world-entrance__door--right .world-entrance__reflection { transform: scaleX(-1); }
.world-entrance__frame {
  position: absolute;
  inset: var(--frame-inset);
  border: 1px solid #6b849150;
  box-shadow: 0 0 0 3px #172630, 0 0 0 4px #020b1680, 0 0 0 6px #52677328, inset 0 0 0 2px #06111b, inset 0 0 18px #01071045;
}
.world-entrance__door--left .world-entrance__frame { right: 16px; }
.world-entrance__door--right .world-entrance__frame { left: 16px; }
.world-entrance__edge {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(90deg, #010811, #69869460, #101d28);
  box-shadow: 0 0 12px #0007;
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
  background: radial-gradient(circle, #101f2b 57%, #182c3a 64%, #0b1823 69%, #56707e50 70%, #101c26 72%);
  box-shadow: 0 18px 45px #01071180, 0 0 70px #83b5cb09;
}
.world-entrance__door--left .world-entrance__record { right: calc(var(--record-size) / -2); }
.world-entrance__door--right .world-entrance__record { left: calc(var(--record-size) / -2); }
.world-entrance__record-rim {
  position: absolute;
  inset: 0;
  border: 1px solid #a5c2d05c;
  border-radius: inherit;
  box-shadow: 0 0 0 3px #09141e, 0 0 0 5px #526c7a70, 0 0 0 7px #0a151f, 0 0 0 8px #6c85932e, inset 0 0 0 3px #0a1621;
}
.world-entrance__grooves {
  position: absolute;
  inset: 13%;
  border: 1px solid #819eac30;
  border-radius: inherit;
  background: repeating-radial-gradient(circle, transparent 0 5px, #92b4c514 5px 6px, transparent 6px 9px);
  mask-image: radial-gradient(circle, transparent 35%, #000 36% 68%, transparent 70%);
}
.world-entrance__record-progress { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
.world-entrance__record-progress circle {
  stroke: var(--entrance-light);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-dasharray: 1;
  stroke-dashoffset: calc(1 - var(--entrance-progress));
  filter: drop-shadow(0 0 3px #9ac7db80);
  transition: stroke-dashoffset .5s ease;
}
.world-entrance__label {
  position: absolute;
  inset: 25%;
  display: grid;
  place-items: center;
  border: 1px solid #8daab83b;
  border-radius: inherit;
  background: radial-gradient(circle at 50% 25%, #263e4d, #11232f 70%);
  box-shadow: 0 0 0 5px #0b1923, 0 0 0 6px #728c9924, inset 0 2px 12px #aecfdf08;
}
.world-entrance__wave { position: absolute; top: 8%; left: 14%; width: 72%; height: 44%; overflow: visible; color: var(--entrance-light); }
.world-entrance__wave path { stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; }
.world-entrance__wave-bar { transform-box: fill-box; transform-origin: center; animation: entrance-wave 1.8s ease-in-out infinite; }
.world-entrance__record-tick { position: absolute; left: calc(50% - .5px); width: 1px; height: 7px; background: var(--entrance-steel); }
.world-entrance__record-tick--top { top: -4px; }
.world-entrance__record-tick--bottom { bottom: -4px; }
.world-entrance__seam {
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(50% - 1px);
  width: 2px;
  background: linear-gradient(transparent 8%, #b4d9e5 44%, transparent 92%);
  box-shadow: 0 0 14px 1px #9ac7db60, 0 0 46px 8px #9ac7db18;
  opacity: .13;
  pointer-events: none;
}
.world-entrance__title { position: absolute; top: calc(var(--record-center) + var(--record-size) / 2 + 36px); left: 50%; width: max-content; text-align: center; transform: translateX(-50%); }
.world-entrance__title h1 { margin: 0 0 14px; padding-left: .4em; font: 300 clamp(28px, 3.3vh, 36px)/1.3 'Microsoft YaHei UI', 'Microsoft YaHei', 'PingFang SC', sans-serif; letter-spacing: .4em; text-shadow: 0 0 24px #b4d9e518; }
.world-entrance__title p { margin: 0; color: var(--entrance-muted); font-size: 11px; letter-spacing: .2em; }
.world-entrance__loading { position: absolute; top: var(--record-center); left: 50%; width: var(--record-size); height: var(--record-size); transform: translate(-50%, -50%); text-align: center; pointer-events: none; }
.world-entrance__status { position: absolute; top: 79%; left: 10%; width: 80%; margin: 0; color: var(--entrance-muted); font-size: clamp(9px, calc(var(--record-size) * .032), 11px); line-height: 1.5; letter-spacing: .08em; }
.world-entrance__progress { position: absolute; top: 55%; left: 50%; transform: translate(-50%, -50%); }
.world-entrance__percentage { color: var(--entrance-paper); font-size: clamp(18px, calc(var(--record-size) * .082), 28px); line-height: 1; font-weight: 300; font-variant-numeric: tabular-nums; letter-spacing: .04em; white-space: nowrap; }
.world-entrance__percentage small { margin-left: 4px; color: var(--entrance-muted); font-size: 10px; }
.world-entrance__recovery { position: absolute; bottom: 60px; left: 50%; width: min(340px, calc(100% - 40px)); transform: translateX(-50%); }
.world-entrance__recovery p { margin: 0 0 16px; color: var(--entrance-muted); text-align: center; font-size: 11px; line-height: 1.8; }
.world-entrance__recovery > div { display: flex; justify-content: center; gap: 12px; }
.world-entrance__recovery button { padding: 10px 16px; border: 1px solid #91b6c850; border-radius: 3px; background: #91b6c810; color: var(--entrance-paper); font-size: 12px; }
.world-entrance__recovery button:hover { background: #91b6c828; }
.world-entrance__recovery button:focus-visible { outline: 2px solid var(--entrance-paper); outline-offset: 4px; }
.world-entrance__recovery button span { margin-left: 10px; color: var(--entrance-light); }
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
@keyframes entrance-unseal { 0% { opacity: .13; } 35% { opacity: .95; } 100% { opacity: 0; } }

@media (max-width: 600px) {
  .world-entrance { --frame-inset: 16px; --record-size: clamp(176px, 52vw, 250px); --record-center: 42%; }
  .world-entrance__grille { left: calc(var(--frame-inset) + 14px); width: 24px; opacity: .55; }
  .world-entrance__door--right .world-entrance__grille { right: calc(var(--frame-inset) + 14px); }
  .world-entrance__rail { height: 5px; }
  .world-entrance__jamb-light { opacity: .6; }
  .world-entrance__reflection { opacity: .035; }
  .world-entrance__door--left .world-entrance__frame { right: 9px; }
  .world-entrance__door--right .world-entrance__frame { left: 9px; }
  .world-entrance__recovery { bottom: 80px; }
}
@media (max-height: 640px) {
  .world-entrance { --record-size: clamp(120px, 31vh, 190px); --record-center: 41%; }
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
