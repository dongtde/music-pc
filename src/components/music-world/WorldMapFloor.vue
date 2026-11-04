<template>
  <svg class="world-floor" :class="{'world-floor--compact':compact}" :viewBox="compact ? '98 32 444 550' : '64 12 512 590'" :aria-hidden="compact ? true : undefined" :role="compact ? undefined : 'group'" :aria-label="compact ? undefined : '音乐馆平面地图'">
    <defs>
      <linearGradient :id="`${prefix}-floor`" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#1b3541" /><stop offset="1" stop-color="#122731" /></linearGradient>
      <linearGradient :id="`${prefix}-stage`" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#87deda" stop-opacity=".14" /><stop offset="1" stop-color="#87deda" stop-opacity="0" /></linearGradient>
      <pattern :id="`${prefix}-grid`" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#8dabb7" stroke-opacity=".045" stroke-width=".8" /></pattern>
    </defs>

    <rect class="world-floor__foundation" x="104" y="52" width="432" height="526" rx="34" />
    <rect x="104" y="40" width="432" height="526" rx="34" :fill="`url(#${prefix}-floor)`" class="world-floor__shell" />
    <rect x="116" y="52" width="408" height="502" rx="26" :fill="`url(#${prefix}-grid)`" />
    <path class="world-floor__wall" d="M118 135V80q0-26 26-26h352q26 0 26 26v55M118 182v290M522 182v290M118 505v22q0 26 26 26h109M522 505v22q0 26-26 26H387" />
    <path class="world-floor__window" d="M112 210v44m0 34v44m0 34v44M528 210v44m0 34v44m0 34v44" />
    <path d="M235 85h170l67 119H168Z" :fill="`url(#${prefix}-stage)`" />
    <path class="world-floor__stage-line" d="M190 109q130 53 260 0M174 130q146 60 292 0" />
    <rect class="world-floor__lounge" x="155" y="408" width="330" height="101" rx="28" />
    <path class="world-floor__aisle" d="M286 240v53m68-53v53M286 357v35m68-35v35" />
    <path class="world-floor__entry" d="M283 565h74m-60 7h46" />

    <g v-if="!compact" class="world-floor__zones" aria-hidden="true">
      <text x="320" y="127">主听音厅</text>
      <text x="210" y="186">唱片档案</text><text x="430" y="186">发现展厅</text>
    </g>

    <g v-for="place in destinations" :key="place.id"
      class="world-floor__destination"
      :class="[`is-${place.kind}`, {'is-selected':position.pointId===place.id,'is-preview':previewId===place.id}]"
      :transform="`translate(${mapPoint(place).x} ${mapPoint(place).y})`"
      :role="compact ? undefined : 'button'" :tabindex="compact ? undefined : 0"
      :aria-label="compact ? undefined : destinationTitle(place)" :aria-current="!compact && position.pointId===place.id ? 'location' : undefined"
      @click="!compact && emit('navigate',place.id)" @keydown.enter.prevent="emit('navigate',place.id)" @keydown.space.prevent="emit('navigate',place.id)"
      @pointerenter="!compact && emit('preview',place.id)" @pointerleave="!compact && emit('preview','')" @focus="emit('preview',place.id)" @blur="emit('preview','')">
      <title v-if="!compact">{{ destinationTitle(place) }}</title>
      <template v-if="compact">
        <rect v-if="place.id==='screen'" class="world-floor__mini-object" x="-66" y="-5" width="132" height="10" rx="4" />
        <rect v-else-if="place.kind==='seat'" class="world-floor__mini-object" :x="place.id==='seat-center'?-20:-13" y="-8" :width="place.id==='seat-center'?40:26" height="17" rx="4" />
        <rect v-else-if="place.id==='terminal'" class="world-floor__mini-object" x="-20" y="-9" width="40" height="18" rx="3" />
        <circle v-else class="world-floor__mini-object" r="6" />
      </template>
      <template v-else-if="place.kind==='seat'">
        <rect class="world-floor__hit-area" x="-51" y="-34" width="102" height="66" rx="12" />
        <rect class="world-floor__seat-base" :x="place.id==='seat-center'?-27:-19" y="-7" :width="place.id==='seat-center'?54:38" height="22" rx="7" />
        <rect class="world-floor__seat-cushion" :x="place.id==='seat-center'?-23:-15" y="-10" :width="place.id==='seat-center'?46:30" height="17" rx="5" />
        <path class="world-floor__seat-seam" :d="place.id==='seat-center'?'M0-8V5M-22 10h44':'M-14 10h28'" />
        <text class="world-floor__seat-label" :y="place.id==='seat-center'?31:-20">{{ place.label }}</text>
      </template>
      <template v-else-if="place.id==='screen'">
        <rect class="world-floor__hit-area" x="-88" y="-14" width="176" height="55" rx="10" />
        <path class="world-floor__screen-back" d="M-85 1q85-11 170 0v8q-85-10-170 0Z" />
        <path class="world-floor__screen-edge" d="M-82 0Q0-11 82 0" />
        <text class="world-floor__label" y="31">音乐大屏</text>
      </template>
      <template v-else-if="place.id==='atrium'">
        <path class="world-floor__lobby-line" d="M0 15v37" />
        <g transform="translate(0 72)">
          <rect class="world-floor__tile" x="-55" y="-18" width="110" height="36" rx="9" />
          <AudioLines x="-42" y="-9" :size="18" class="world-floor__icon" />
          <text class="world-floor__tile-label" x="-16" y="4">音乐中庭</text>
        </g>
      </template>
      <template v-else>
        <rect class="world-floor__tile-shadow" x="-52" y="-14" width="104" height="38" rx="9" />
        <rect class="world-floor__tile" x="-52" y="-20" width="104" height="38" rx="9" />
        <component :is="iconFor(place)" x="-42" y="-10" :size="18" class="world-floor__icon" />
        <text class="world-floor__tile-label" x="-16" y="3">{{ place.label }}</text>
      </template>
    </g>

    <g class="world-floor__player" :transform="playerTransform" aria-hidden="true">
      <path v-if="!compact" class="world-floor__view" d="M0 0-24-49Q0-60 24-49Z" />
      <circle :r="compact?14:17" class="world-floor__player-halo" />
      <circle :r="compact?10:12" class="world-floor__player-ring" />
      <path class="world-floor__player-arrow" d="M0-9 6.5 7 0 3-6.5 7Z" />
    </g>
  </svg>
</template>

<script setup>
import { computed, useId } from 'vue'
import { AudioLines, Disc3, ListMusic, MicVocal, SlidersHorizontal, Sparkles, Trophy } from 'lucide-vue-next'
import { WORLD_MAP_DESTINATIONS } from './worldNavigation.js'

const props=defineProps({position:{type:Object,required:true},compact:Boolean,previewId:String,archiveTracks:{type:Array,default:()=>[]}})
const emit=defineEmits(['navigate','preview']),destinations=WORLD_MAP_DESTINATIONS,prefix=`world-plan-${useId()}`
const mapPoint=place=>({x:320+(Number(place.x)||0)*13.5,y:303+(Number(place.z)||0)*12.2})
const playerTransform=computed(()=>{const point=mapPoint(props.position);return `translate(${point.x} ${point.y}) rotate(${-(Number(props.position.yaw)||0)*180/Math.PI})`})
const iconFor=place=>place.kind==='record'?Disc3:({recommend:Sparkles,playlists:ListMusic,artists:MicVocal,charts:Trophy})[place.target]||SlidersHorizontal
function destinationTitle(place){const track=place.kind==='record'?props.archiveTracks[place.target]:null;return `${place.kind==='seat'?'落座':'前往'}${place.label}${track?.name?' · '+track.name:''}`}
</script>

<style scoped>
.world-floor{display:block;width:100%;height:100%;overflow:visible;font-family:'Microsoft YaHei','Segoe UI',sans-serif}
.world-floor__foundation{fill:#071821;stroke:#405762;stroke-width:1}
.world-floor__shell{stroke:#54707b;stroke-width:1.4}
.world-floor__wall{fill:none;stroke:#66818b;stroke-width:3;stroke-linecap:round;opacity:.48}
.world-floor__window{fill:none;stroke:#85bec5;stroke-width:2;opacity:.5}
.world-floor__stage-line{fill:none;stroke:#81cecb;stroke-width:1;opacity:.16}
.world-floor__lounge{fill:#dfc79a;fill-opacity:.035;stroke:#dfc79a;stroke-opacity:.085}
.world-floor__aisle{fill:none;stroke:#9dc6c9;stroke-width:2;opacity:.17}
.world-floor__entry{fill:none;stroke:#657f89;stroke-width:1.4}
.world-floor__zones text{text-anchor:middle;fill:#6d919d;font-size:9px;letter-spacing:2px}
.world-floor__destination{color:#a8c4d1;cursor:pointer;outline:none}
.world-floor__destination.is-record{color:#d7bc95}.world-floor__destination.is-discovery{color:#9ad2ca}
.world-floor__destination.is-selected{color:#f0cd95}.world-floor__destination.is-preview{color:#edf5ed}
.world-floor__tile-shadow{fill:#071820;opacity:.65}
.world-floor__tile{fill:#203b46;stroke:currentColor;stroke-opacity:.24;stroke-width:1;transition:fill .16s,stroke-opacity .16s}
.world-floor__destination.is-record .world-floor__tile{fill:#343d3e}
.world-floor__hit-area{fill:transparent;stroke:transparent;stroke-width:1}
.world-floor__icon{color:inherit;stroke-width:1.6}
.world-floor__tile-label{fill:#d9e7e6;font-size:12px;font-weight:500}
.world-floor__label,.world-floor__seat-label{text-anchor:middle;fill:#b6cbcf;font-size:11px;font-weight:500}
.world-floor__seat-base{fill:#21313b;stroke:#7f929a;stroke-opacity:.3}
.world-floor__seat-cushion{fill:#50616a;stroke:#93a2a6;stroke-opacity:.5}
.world-floor__seat-seam{fill:none;stroke:#9badb1;stroke-opacity:.5;stroke-width:1}
.world-floor__screen-back{fill:#172c35;stroke:#88d8d1;stroke-opacity:.4;stroke-width:1}
.world-floor__screen-edge{fill:none;stroke:#a6eee2;stroke-width:3;stroke-linecap:round}
.world-floor__lobby-line{fill:none;stroke:#698e94;stroke-width:1;stroke-dasharray:2 5;opacity:.5}
.world-floor__destination.is-selected .world-floor__tile,.world-floor__destination.is-preview .world-floor__tile,.world-floor__destination:focus-visible .world-floor__tile{fill:#3d4540;stroke-opacity:.9;stroke-width:1.4}
.world-floor__destination.is-selected .world-floor__hit-area,.world-floor__destination.is-preview .world-floor__hit-area,.world-floor__destination:focus-visible .world-floor__hit-area{fill:currentColor;fill-opacity:.06;stroke:currentColor;stroke-opacity:.45}
.world-floor__destination.is-selected text,.world-floor__destination.is-preview text{fill:currentColor}
.world-floor__destination:focus-visible .world-floor__tile,.world-floor__destination:focus-visible .world-floor__hit-area{stroke:#edf5ed;stroke-width:2}
.world-floor__player{pointer-events:none}.world-floor__view{fill:#9fe8dc;opacity:.07}
.world-floor__player-halo{fill:#a3e8df;fill-opacity:.08}.world-floor__player-ring{fill:#0c303b;stroke:#a3e8df;stroke-width:.8;stroke-opacity:.45}
.world-floor__player-arrow{fill:#b9fff0;stroke:#0b2730;stroke-width:.8;stroke-linejoin:round}
.world-floor__mini-object{fill:#659399;stroke:#a0c4c8;stroke-opacity:.3;stroke-width:1.5}
.world-floor__destination.is-record .world-floor__mini-object{fill:#ac9781}.world-floor__destination.is-seat .world-floor__mini-object{fill:#657c89}
.world-floor__destination.is-selected .world-floor__mini-object{fill:#f0cd95;stroke:#fff0c7;stroke-opacity:1}
.world-floor--compact .world-floor__destination{pointer-events:none}.world-floor--compact .world-floor__wall{stroke-width:4}
@media(max-width:520px){.world-floor__tile-label{font-size:13px}.world-floor__seat-label,.world-floor__label{font-size:12px}.world-floor__zones text{font-size:10px;letter-spacing:1px}}
@media(prefers-reduced-motion:reduce){.world-floor__tile{transition:none}}
</style>
