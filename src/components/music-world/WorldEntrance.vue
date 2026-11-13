<template>
  <Transition
    name="world-entrance"
    :duration="{ enter: 0, leave: reducedMotion ? 180 : 1800 }"
    @after-leave="$emit('opened')"
  >
    <div
      v-show="!ready || failed"
      class="world-entrance"
      :class="[`world-entrance--${theme.id}`, { 'is-ready': ready && !failed, 'is-failed': failed, 'is-paused': paused }]"
      :style="{ '--entrance-progress': percentage / 100 }"
      @keydown.stop
    >
      <div class="world-entrance__veil" aria-hidden="true" />

      <div v-for="side in ['left', 'right']" :key="side" class="world-entrance__door" :class="`world-entrance__door--${side}`" aria-hidden="true">
        <div class="world-entrance__glass" />
        <div class="world-entrance__sheen" />
        <div class="world-entrance__transom" />
        <div class="world-entrance__grille" />
        <svg v-if="theme.id === 'stage'" class="world-entrance__portal" viewBox="0 0 700 900" preserveAspectRatio="none" fill="none">
          <path d="M685 86H182L87 182V718L182 814H685" />
          <path d="M685 110H194L113 193V707L194 790H685" />
          <path d="M685 134H207L139 204V696L207 766H685" />
        </svg>
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
        <div v-if="!failed" class="world-entrance__progress" role="progressbar" :aria-label="`${theme.name}加载进度`" :aria-valuenow="percentage" aria-valuemin="0" aria-valuemax="100">
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
import { getWorldScene } from './worldScenes.js'

const props = defineProps({
  ready: Boolean,
  failed: Boolean,
  progress: { type: Number, default: 0 },
  scene: { type: String, default: 'rain' },
  reducedMotion: Boolean,
  paused: Boolean,
})
defineEmits(['opened', 'retry', 'exit'])

const waveHeights = [8, 16, 27, 18, 38, 50, 30, 50, 38, 18, 27, 16, 8]
const theme = computed(() => getWorldScene(props.scene))
// Model download completion precedes scene preparation. Reserve 100% for readiness.
const percentage = computed(() => props.ready && !props.failed ? 100 : Math.round(Math.min(1, Math.max(0, Number(props.progress) || 0)) * 98))
const statusText = computed(() => {
  if (props.failed) return '音乐馆暂时无法打开'
  if (props.ready) return '澜音已就绪 · 为你开门'
  if (props.progress >= 0.98) return '正在点亮空间'
  if (props.progress >= 0.65) return '正在布置空间'
  return `正在准备${theme.value.name}`
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
  --entrance-accent: 180 217 229;
  --entrance-trim: 107 132 145;
  --entrance-dark: #09141e;
  --entrance-label: #263e4d;
  --entrance-label-edge: #11232f;
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
  stroke: var(--entrance-light);
  stroke-width: 1;
  opacity: .055;
  mask-image: linear-gradient(#000, transparent 58%, #000);
  pointer-events: none;
}
.world-entrance__door--right .world-entrance__reflection { transform: scaleX(-1); }
.world-entrance__frame {
  position: absolute;
  inset: var(--frame-inset);
  border: 1px solid rgb(var(--entrance-trim) / .32);
  box-shadow: 0 0 0 3px var(--entrance-panel), 0 0 0 4px #0005, 0 0 0 6px rgb(var(--entrance-trim) / .16), inset 0 0 0 2px var(--entrance-dark), inset 0 0 18px #0004;
}
.world-entrance__door--left .world-entrance__frame { right: 16px; }
.world-entrance__door--right .world-entrance__frame { left: 16px; }
.world-entrance__edge {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(90deg, var(--entrance-dark), rgb(var(--entrance-trim) / .4), var(--entrance-ink));
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
  background: radial-gradient(circle, var(--entrance-ink) 57%, var(--entrance-panel) 64%, var(--entrance-dark) 69%, rgb(var(--entrance-trim) / .32) 70%, var(--entrance-ink) 72%);
  box-shadow: 0 18px 45px #0006, 0 0 70px rgb(var(--entrance-accent) / .04);
}
.world-entrance__door--left .world-entrance__record { right: calc(var(--record-size) / -2); }
.world-entrance__door--right .world-entrance__record { left: calc(var(--record-size) / -2); }
.world-entrance__record-rim {
  position: absolute;
  inset: 0;
  border: 1px solid rgb(var(--entrance-accent) / .36);
  border-radius: inherit;
  box-shadow: 0 0 0 3px var(--entrance-dark), 0 0 0 5px rgb(var(--entrance-trim) / .44), 0 0 0 7px var(--entrance-dark), 0 0 0 8px rgb(var(--entrance-trim) / .18), inset 0 0 0 3px var(--entrance-dark);
}
.world-entrance__grooves {
  position: absolute;
  inset: 13%;
  border: 1px solid rgb(var(--entrance-trim) / .2);
  border-radius: inherit;
  background: repeating-radial-gradient(circle, transparent 0 5px, rgb(var(--entrance-accent) / .08) 5px 6px, transparent 6px 9px);
  mask-image: radial-gradient(circle, transparent 35%, #000 36% 68%, transparent 70%);
}
.world-entrance__record-progress { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
.world-entrance__record-progress circle {
  stroke: var(--entrance-light);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-dasharray: 1;
  stroke-dashoffset: calc(1 - var(--entrance-progress));
  filter: drop-shadow(0 0 3px rgb(var(--entrance-accent) / .5));
  transition: stroke-dashoffset .5s ease;
}
.world-entrance__label {
  position: absolute;
  inset: 25%;
  display: grid;
  place-items: center;
  border: 1px solid rgb(var(--entrance-trim) / .3);
  border-radius: inherit;
  background: radial-gradient(circle at 50% 25%, var(--entrance-label), var(--entrance-label-edge) 70%);
  box-shadow: 0 0 0 5px var(--entrance-dark), 0 0 0 6px rgb(var(--entrance-trim) / .15), inset 0 2px 12px rgb(var(--entrance-accent) / .04);
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
  background: linear-gradient(transparent 8%, var(--entrance-light) 44%, transparent 92%);
  box-shadow: 0 0 14px 1px rgb(var(--entrance-accent) / .38), 0 0 46px 8px rgb(var(--entrance-accent) / .1);
  opacity: .13;
  pointer-events: none;
}
.world-entrance__title { position: absolute; top: calc(var(--record-center) + var(--record-size) / 2 + 36px); left: 50%; width: max-content; text-align: center; transform: translateX(-50%); }
.world-entrance__title h1 { margin: 0 0 14px; padding-left: .4em; font: 300 clamp(28px, 3.3vh, 36px)/1.3 'Microsoft YaHei UI', 'Microsoft YaHei', 'PingFang SC', sans-serif; letter-spacing: .4em; text-shadow: 0 0 24px rgb(var(--entrance-accent) / .1); }
.world-entrance__title p { margin: 0; color: var(--entrance-muted); font-size: 11px; letter-spacing: .2em; }
.world-entrance__loading { position: absolute; top: var(--record-center); left: 50%; width: var(--record-size); height: var(--record-size); transform: translate(-50%, -50%); text-align: center; pointer-events: none; }
.world-entrance__status { position: absolute; top: 79%; left: 10%; width: 80%; margin: 0; color: var(--entrance-muted); font-size: clamp(9px, calc(var(--record-size) * .032), 11px); line-height: 1.5; letter-spacing: .08em; }
.world-entrance__progress { position: absolute; top: 55%; left: 50%; transform: translate(-50%, -50%); }
.world-entrance__percentage { color: var(--entrance-paper); font-size: clamp(18px, calc(var(--record-size) * .082), 28px); line-height: 1; font-weight: 300; font-variant-numeric: tabular-nums; letter-spacing: .04em; white-space: nowrap; }
.world-entrance__percentage small { margin-left: 4px; color: var(--entrance-muted); font-size: 10px; }
.world-entrance__recovery { position: absolute; bottom: 60px; left: 50%; width: min(340px, calc(100% - 40px)); transform: translateX(-50%); }
.world-entrance__recovery p { margin: 0 0 16px; color: var(--entrance-muted); text-align: center; font-size: 11px; line-height: 1.8; }
.world-entrance__recovery > div { display: flex; justify-content: center; gap: 12px; }
.world-entrance__recovery button { padding: 10px 16px; border: 1px solid rgb(var(--entrance-trim) / .4); border-radius: 3px; background: rgb(var(--entrance-accent) / .06); color: var(--entrance-paper); font-size: 12px; }
.world-entrance__recovery button:hover { background: rgb(var(--entrance-accent) / .16); }
.world-entrance__recovery button:focus-visible { outline: 2px solid var(--entrance-paper); outline-offset: 4px; }
.world-entrance__recovery button span { margin-left: 10px; color: var(--entrance-light); }
.is-failed .world-entrance__status { color: var(--entrance-paper); }
.is-failed .world-entrance__wave-bar,
.is-ready .world-entrance__wave-bar,
.is-paused .world-entrance__wave-bar { animation-play-state: paused; }

/* Studio: walnut joinery, inset acoustic fabric and a brass record hub. */
.world-entrance--studio {
  --entrance-ink: #241b16;
  --entrance-panel: #443125;
  --entrance-dark: #19130f;
  --entrance-steel: #9f8054;
  --entrance-light: #ecc58c;
  --entrance-paper: #f0e3cf;
  --entrance-muted: #af987e;
  --entrance-accent: 236 197 140;
  --entrance-trim: 171 136 86;
  --entrance-label: #604631;
  --entrance-label-edge: #302218;
}
.world-entrance--studio .world-entrance__door {
  background: linear-gradient(90deg, #160e0ac9, #51362380 50%, #170e0ac9), url('/models/sky-lounge/walnut-color.jpg') center / 540px 100%;
}
.world-entrance--studio .world-entrance__glass {
  background: radial-gradient(ellipse at var(--door-light) 42%, #ac79572a, transparent 65%), repeating-linear-gradient(0deg, #dec09d05 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, #0001 0 1px, transparent 1px 3px), #302823;
  box-shadow: inset 0 0 55px #100b0780;
}
.world-entrance--studio .world-entrance__sheen { background: linear-gradient(180deg, #d4a76b06, transparent 25% 70%, #08050260); }
.world-entrance--studio .world-entrance__transom {
  background: linear-gradient(#21150d60, #27180c80), url('/models/sky-lounge/walnut-color.jpg') center / 480px 250px;
}
.world-entrance--studio .world-entrance__grille {
  width: clamp(54px, 10vw, 180px);
  border-color: #be98513d;
  background: linear-gradient(180deg, #efbb6720, transparent 35% 70%, #140c0870), repeating-linear-gradient(90deg, #130e0a 0 10px, #5e402a 10px 13px, #9c704c 13px 14px, #442d1e 14px 22px, #1c130d 22px 26px);
}
.world-entrance--studio .world-entrance__rail { height: 9px; background: linear-gradient(#ab865040, #49341f 20%, #21160e 75%, #95704260); }
.world-entrance--studio .world-entrance__jamb-light { background: linear-gradient(transparent, #edb9728c 16% 84%, transparent); box-shadow: 0 0 12px #c38d4040; }
.world-entrance--studio .world-entrance__reflection { display: none; }
.world-entrance--studio .world-entrance__grooves { inset: 9%; }

/* Stage: three nested lighting portals and perforated black rigging. */
.world-entrance--stage {
  --entrance-ink: #080d19;
  --entrance-panel: #192132;
  --entrance-dark: #050811;
  --entrance-steel: #597089;
  --entrance-light: #7ae8ef;
  --entrance-paper: #e2f1f6;
  --entrance-muted: #8b9eb4;
  --entrance-accent: 83 223 238;
  --entrance-trim: 91 118 147;
  --entrance-label: #20324a;
  --entrance-label-edge: #0a1726;
}
.world-entrance--stage .world-entrance__door { background: linear-gradient(90deg, #060912, #131a2a 50%, #080b15); }
.world-entrance--stage .world-entrance__glass {
  background: radial-gradient(ellipse at var(--door-light) 43%, #34406c4a, transparent 58%), radial-gradient(ellipse at 0% 100%, #26809716, transparent 55%), #0b1020;
}
.world-entrance--stage .world-entrance__door--right .world-entrance__glass { background: radial-gradient(ellipse at 0% 43%, #50346840, transparent 58%), radial-gradient(ellipse at 100% 100%, #913b8b19, transparent 55%), #0c1020; }
.world-entrance--stage .world-entrance__sheen { background: linear-gradient(160deg, #526d9308, transparent 32% 68%, #0b041b30); }
.world-entrance--stage .world-entrance__transom { background: radial-gradient(circle, #5c749122 .7px, transparent 1px) 0 0 / 7px 7px, #080e18; }
.world-entrance--stage .world-entrance__grille {
  width: clamp(28px, 3vw, 52px);
  top: 25%; bottom: 25%;
  background: repeating-linear-gradient(145deg, #090e19 0 16px, #334358 17px 19px, #182332 20px 23px, #070c17 24px 39px);
  border-color: #526e923b;
}
.world-entrance--stage .world-entrance__rail { opacity: .3; }
.world-entrance--stage .world-entrance__jamb-light { background: linear-gradient(transparent, #52dfed90, transparent); box-shadow: 0 0 14px #41e5f43b; }
.world-entrance--stage .world-entrance__door--right .world-entrance__jamb-light { background: linear-gradient(transparent, #d965eb90, transparent); box-shadow: 0 0 14px #d965eb3b; }
.world-entrance--stage .world-entrance__reflection { display: none; }
.world-entrance__portal { position: absolute; inset: 0; width: 100%; height: 100%; stroke: #65dce8; stroke-width: 1.4; pointer-events: none; }
.world-entrance__portal path { vector-effect: non-scaling-stroke; opacity: .35; }
.world-entrance__portal path:nth-child(2) { opacity: .15; }
.world-entrance__portal path:nth-child(3) { opacity: .065; }
.world-entrance__door--right .world-entrance__portal { transform: scaleX(-1); stroke: #ca7cdd; }

/* Lounge: honed stone pilasters, champagne trim and sunset smoked glass. */
.world-entrance--sky-lounge {
  --entrance-ink: #292725;
  --entrance-panel: #514b41;
  --entrance-dark: #211f1c;
  --entrance-steel: #bca47c;
  --entrance-light: #f0d4a6;
  --entrance-paper: #f4e9d7;
  --entrance-muted: #c4b59d;
  --entrance-accent: 240 212 166;
  --entrance-trim: 194 167 118;
  --entrance-label: #665a48;
  --entrance-label-edge: #353029;
}
.world-entrance--sky-lounge .world-entrance__door { background: linear-gradient(90deg, #242321c9, #61584c88 50%, #2b2926c9), url('/models/sky-lounge/marble-color.jpg') center / cover; }
.world-entrance--sky-lounge .world-entrance__glass {
  background: radial-gradient(ellipse at var(--door-light) 22%, #cfac7440, transparent 63%), linear-gradient(180deg, #5b554b, #3b3b38 45%, #292d2c 78%, #373932);
  box-shadow: inset 0 0 60px #15161066;
}
.world-entrance--sky-lounge .world-entrance__sheen { background: linear-gradient(116deg, transparent 20%, #ead7b309 20.2% 34%, transparent 34.2% 49%, #ead7b304 49.2% 56%, transparent 56.2%), linear-gradient(180deg, #e9c49314, transparent 45% 75%, #12181535); }
.world-entrance--sky-lounge .world-entrance__transom { background: linear-gradient(180deg, #b99e6d18, #342f284a); }
.world-entrance--sky-lounge .world-entrance__grille {
  width: clamp(62px, 10vw, 188px);
  top: calc(var(--frame-inset) + 18px); bottom: calc(var(--frame-inset) + 18px);
  border-color: #d6b87942;
  background: linear-gradient(90deg, #222420b3, #685f4d70 40%, #2e302a80), url('/models/sky-lounge/marble-color.jpg') center / auto 100%;
  box-shadow: inset 0 0 0 4px #171e1930, 5px 0 18px #10151150;
}
.world-entrance--sky-lounge .world-entrance__rail { height: 3px; background: linear-gradient(#ead4aa66, #9384654d, #202522); }
.world-entrance--sky-lounge .world-entrance__rail--top { top: 22%; }
.world-entrance--sky-lounge .world-entrance__rail--bottom { bottom: 22%; }
.world-entrance--sky-lounge .world-entrance__jamb-light { top: 20%; bottom: 20%; background: linear-gradient(transparent, #f0d4a6bb 16% 84%, transparent); box-shadow: 0 0 12px #f0ca8d45; }
.world-entrance--sky-lounge .world-entrance__reflection { opacity: .12; }

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
  .world-entrance .world-entrance__grille { left: calc(var(--frame-inset) + 14px); width: 24px; opacity: .55; }
  .world-entrance__door--right .world-entrance__grille { left: auto; right: calc(var(--frame-inset) + 14px); }
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
