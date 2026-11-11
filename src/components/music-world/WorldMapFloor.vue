<template>
  <svg
    ref="floor"
    class="world-floor"
    :class="{ 'world-floor--compact': compact, 'world-floor--wide': wide }"
    :viewBox="viewBox"
    :aria-hidden="compact ? true : undefined"
    :role="compact ? undefined : 'group'"
    :aria-label="compact ? undefined : '音乐馆平面地图'"
  >
    <defs>
      <linearGradient :id="prefix + '-floor'" x1="0" y1="0" x2=".8" y2="1">
        <stop stop-color="#203b43" />
        <stop offset="1" stop-color="#142a33" />
      </linearGradient>
      <linearGradient :id="prefix + '-stage'" x1="0" y1="0" x2="0" y2="1">
        <stop stop-color="#a8e7df" stop-opacity=".14" />
        <stop offset="1" stop-color="#a8e7df" stop-opacity="0" />
      </linearGradient>
      <pattern :id="prefix + '-grid'" width="24" height="24" patternUnits="userSpaceOnUse">
        <path d="M24 0H0V24" fill="none" stroke="#a8c8cb" stroke-opacity=".035" stroke-width=".7" />
      </pattern>
    </defs>

    <g class="world-floor__architecture" :transform="wide ? 'translate(-160 0) scale(1.5 1)' : undefined" aria-hidden="true">
      <rect class="world-floor__foundation" x="104" y="48" width="432" height="526" rx="36" />
      <rect class="world-floor__shell" x="104" y="40" width="432" height="526" rx="36" :fill="'url(#' + prefix + '-floor)'" />
      <rect x="119" y="55" width="402" height="495" rx="24" :fill="'url(#' + prefix + '-grid)'" />
      <path class="world-floor__wall" d="M118 135V82q0-28 28-28h348q28 0 28 28v53M118 184v288M522 184v288M118 508v17q0 28 28 28h107M522 508v17q0 28-28 28H387" />
      <path class="world-floor__window" d="M112 211v40m0 38v40m0 38v40M528 211v40m0 38v40m0 38v40" />
      <path d="M235 84h170l57 125H178Z" :fill="'url(#' + prefix + '-stage)'" />
      <path class="world-floor__stage-line" d="M194 112q126 53 252 0M178 135q142 57 284 0" />
      <rect class="world-floor__gallery world-floor__gallery--records" x="145" y="193" width="129" height="226" rx="18" />
      <rect class="world-floor__gallery world-floor__gallery--discovery" x="366" y="193" width="129" height="226" rx="18" />
      <circle class="world-floor__hub" cx="320" cy="321" r="47" />
      <circle class="world-floor__hub world-floor__hub--inner" cx="320" cy="321" r="38" />
      <path class="world-floor__aisle" d="M320 236v28m0 114v28" />
      <rect class="world-floor__lounge" x="165" y="414" width="310" height="81" rx="25" />
      <path class="world-floor__entry" d="M283 565h74m-59 5h44" />
    </g>

    <g
      v-for="place in destinations"
      :key="place.id"
      class="world-floor__destination"
      :class="['is-' + place.kind, { 'is-selected': position.pointId === place.id, 'is-terminal': place.id === 'terminal' }]"
      :data-destination="place.id"
      :transform="destinationTransform(place)"
      :role="compact ? undefined : 'button'"
      :tabindex="compact ? undefined : 0"
      :aria-label="compact ? undefined : destinationTitle(place)"
      :aria-current="!compact && position.pointId === place.id ? 'location' : undefined"
      @click="navigate(place)"
      @keydown.enter.prevent="navigate(place)"
      @keydown.space.prevent="navigate(place)"
    >
      <title v-if="!compact">{{ destinationTitle(place) }}</title>
      <template v-if="compact">
        <rect v-if="place.id === 'screen'" class="world-floor__mini-object" x="-66" y="-5" width="132" height="10" rx="4" />
        <rect v-else-if="place.kind === 'seat'" class="world-floor__mini-object" :x="place.id === 'seat-center' ? -20 : -13" y="-8" :width="place.id === 'seat-center' ? 40 : 26" height="17" rx="4" />
        <rect v-else-if="place.id === 'terminal'" class="world-floor__mini-object" x="-20" y="-9" width="40" height="18" rx="4" />
        <circle v-else class="world-floor__mini-object" r="6" />
      </template>

      <template v-else-if="place.kind === 'seat'">
        <rect class="world-floor__hit-area" :x="place.id === 'seat-center' ? -40 : -48" :y="place.id === 'seat-center' ? -14 : -38" :width="place.id === 'seat-center' ? 80 : 96" height="58" rx="12" />
        <rect class="world-floor__seat-base" :x="place.id === 'seat-center' ? -28 : -20" y="-6" :width="place.id === 'seat-center' ? 56 : 40" height="23" rx="7" />
        <rect class="world-floor__seat-cushion" :x="place.id === 'seat-center' ? -24 : -16" y="-11" :width="place.id === 'seat-center' ? 48 : 32" height="19" rx="5" />
        <path class="world-floor__seat-seam" :d="place.id === 'seat-center' ? 'M0-8V5M-23 11h46' : 'M-15 11h30'" />
        <text class="world-floor__seat-label" :y="place.id === 'seat-center' ? 34 : -24">{{ place.label }}</text>
      </template>

      <template v-else-if="place.id === 'screen'">
        <rect class="world-floor__hit-area" :x="wide ? -140 : -90" y="-13" :width="wide ? 280 : 180" height="58" rx="14" />
        <path class="world-floor__screen-back" :d="wide ? 'M-130 1q130-13 260 0v9q-130-12-260 0Z' : 'M-85 1q85-11 170 0v9q-85-10-170 0Z'" />
        <path class="world-floor__screen-edge" :d="wide ? 'M-126 0Q0-13 126 0' : 'M-82 0Q0-11 82 0'" />
        <text class="world-floor__label" y="33">{{ place.label }}</text>
      </template>

      <template v-else-if="place.id === 'atrium'">
        <path class="world-floor__lobby-line" d="M0 18v32" />
        <g transform="translate(0 72)">
          <rect class="world-floor__tile" x="-62" y="-20" width="124" height="40" rx="12" />
          <AudioLines x="-49" y="-10" :size="20" class="world-floor__icon" />
          <text class="world-floor__tile-label" x="-20" y="0" dominant-baseline="central">{{ place.label }}</text>
        </g>
      </template>

      <template v-else>
        <rect class="world-floor__tile-shadow" :x="wide ? -72 : -52" y="-17" :width="wide ? 144 : 104" height="42" rx="11" />
        <rect class="world-floor__tile" :x="wide ? -72 : -52" y="-21" :width="wide ? 144 : 104" height="42" rx="11" />
        <component :is="iconFor(place)" :x="wide ? -56 : -42" y="-10" :size="wide ? 20 : 18" class="world-floor__icon" />
        <text class="world-floor__tile-label" :x="wide ? -25 : -16" y="0" dominant-baseline="central">{{ place.label }}</text>
      </template>
    </g>

    <g class="world-floor__player" :transform="playerTransform" aria-hidden="true">
      <path v-if="!compact" class="world-floor__view" d="M0-2-23-43Q0-55 23-43Z" />
      <circle :r="compact ? 16 : 19" class="world-floor__player-halo" />
      <circle :r="compact ? 11 : 13" class="world-floor__player-ring" />
      <path class="world-floor__player-arrow" d="M0-8.5 6 7 0 3-6 7Z" />
    </g>
  </svg>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { AudioLines, Disc3, ListMusic, MicVocal, SlidersHorizontal, Sparkles, Trophy, UsersRound } from 'lucide-vue-next'
import { WORLD_MAP_DESTINATIONS, WORLD_LOBBY_DISPLAY } from './worldNavigation.js'

const props = defineProps({
  position: { type: Object, required: true },
  compact: Boolean,
  archiveTracks: { type: Array, default: () => [] },
})
const emit = defineEmits(['navigate'])
const destinations = WORLD_MAP_DESTINATIONS
const prefix = 'world-plan-' + useId()
const floor = ref(null)
const availableWidth = ref(0)
const wide = computed(() => !props.compact && availableWidth.value >= 600)
const viewBox = computed(() => props.compact ? '98 32 444 550' : wide.value ? '-32 22 704 558' : '92 22 456 558')
let observer

// Widen only the horizontal layout; all destinations retain their world coordinates.
function mapPoint(place) {
  return {
    x: 320 + (Number(place.x) || 0) * (wide.value ? 20.25 : 13.5),
    y: 303 + (Number(place.z) || 0) * 12.2,
  }
}

function destinationTransform(place) {
  const point = mapPoint(place)
  return 'translate(' + point.x + ' ' + point.y + ')'
}

const playerTransform = computed(() => {
  const point = mapPoint(props.position)
  const yaw = Number(props.position.yaw) || 0
  const heading = Math.atan2(-Math.sin(yaw) * (wide.value ? 20.25 : 13.5), Math.cos(yaw) * 12.2) * 180 / Math.PI
  return 'translate(' + point.x + ' ' + point.y + ') rotate(' + heading + ')'
})

function iconFor(place) {
  if (place.id === 'lobby') return UsersRound
  if (place.kind === 'record') return Disc3
  return { recommend: Sparkles, playlists: ListMusic, artists: MicVocal, charts: Trophy }[place.target] || SlidersHorizontal
}

function destinationTitle(place) {
  const track = place.kind === 'record' ? props.archiveTracks[place.target>WORLD_LOBBY_DISPLAY.index?place.target-1:place.target] : null
  return (place.kind === 'seat' ? '落座' : '前往') + place.label + (track?.name ? ' · ' + track.name : '')
}

function navigate(place) {
  if (!props.compact) emit('navigate', place.id)
}

onMounted(() => {
  if (props.compact || !floor.value) return
  observer = new ResizeObserver(([entry]) => { availableWidth.value = entry.contentRect.width })
  observer.observe(floor.value)
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<style scoped>
.world-floor {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
}
.world-floor__foundation { fill: #091a23; stroke: #334e58; stroke-width: 1; }
.world-floor__shell { stroke: #7c9b9e; stroke-opacity: .5; stroke-width: 1.3; }
.world-floor__wall { fill: none; stroke: #7c9b9e; stroke-width: 2.7; stroke-linecap: round; opacity: .4; }
.world-floor__window { fill: none; stroke: #a8e7df; stroke-width: 2; stroke-linecap: round; opacity: .45; }
.world-floor__stage-line { fill: none; stroke: #a8e7df; stroke-width: .9; opacity: .12; }
.world-floor__gallery { stroke-width: .8; }
.world-floor__gallery--records { fill: #d7bb8e; fill-opacity: .025; stroke: #d7bb8e; stroke-opacity: .08; }
.world-floor__gallery--discovery { fill: #a8e7df; fill-opacity: .025; stroke: #a8e7df; stroke-opacity: .08; }
.world-floor__hub { fill: #a8e7df; fill-opacity: .018; stroke: #a8e7df; stroke-width: .8; stroke-opacity: .09; }
.world-floor__hub--inner { fill: none; stroke-opacity: .05; }
.world-floor__aisle { fill: none; stroke: #a8c8cb; stroke-width: 1.2; stroke-dasharray: 2 6; opacity: .22; }
.world-floor__lounge { fill: #a8c8cb; fill-opacity: .025; stroke: #a8c8cb; stroke-opacity: .07; }
.world-floor__entry { fill: none; stroke: #7c9b9e; stroke-width: 1.2; stroke-linecap: round; opacity: .6; }

.world-floor__destination { color: #a8c8cb; cursor: pointer; outline: none; }
.world-floor__destination.is-record { color: #d7bb8e; }
.world-floor__destination.is-discovery { color: #a8e7df; }
.world-floor__destination.is-terminal { color: #d7bb8e; }
.world-floor__tile-shadow { fill: #06141c; opacity: .4; }
.world-floor__tile {
  fill: #25434c;
  stroke: currentColor;
  stroke-opacity: .26;
  stroke-width: 1;
  transition: fill 160ms, stroke-opacity 160ms;
}
.world-floor__destination.is-record .world-floor__tile { fill: #353e3e; }
.world-floor__destination.is-terminal .world-floor__tile { fill: #354343; stroke-opacity: .55; }
.world-floor__hit-area { fill: transparent; stroke: transparent; stroke-width: 1; transition: fill-opacity 160ms; }
.world-floor__icon { color: inherit; stroke-width: 1.6; pointer-events: none; }
.world-floor__tile-label { fill: #e5f0ec; font-size: 16px; font-weight: 500; pointer-events: none; }
.world-floor__label, .world-floor__seat-label { text-anchor: middle; fill: #c5d8d8; font-size: 15px; font-weight: 400; pointer-events: none; }
.world-floor__seat-base { fill: #172b34; stroke: #a8c8cb; stroke-opacity: .22; }
.world-floor__seat-cushion { fill: #476068; stroke: #a8c8cb; stroke-opacity: .36; }
.world-floor__seat-seam { fill: none; stroke: #a8c8cb; stroke-opacity: .38; stroke-width: .8; }
.world-floor__screen-back { fill: #28474e; stroke: #a8e7df; stroke-opacity: .3; stroke-width: .8; }
.world-floor__screen-edge { fill: none; stroke: #a8e7df; stroke-width: 3; stroke-linecap: round; }
.world-floor__lobby-line { fill: none; stroke: #a8c8cb; stroke-width: 1; stroke-dasharray: 2 6; opacity: .3; }

.world-floor__destination.is-selected { color: #efd0a0; }
.world-floor__destination.is-selected .world-floor__tile { fill: #434b43; stroke-opacity: .95; stroke-width: 1.5; }
.world-floor__destination.is-selected .world-floor__hit-area { fill: #d7bb8e; fill-opacity: .07; stroke: #d7bb8e; stroke-opacity: .6; }
.world-floor__destination.is-selected text { fill: #efd0a0; }
.world-floor:not(.world-floor--compact) .world-floor__destination:is(:hover, :focus-visible) .world-floor__tile { fill: #3b5455; stroke-opacity: .9; }
.world-floor:not(.world-floor--compact) .world-floor__destination:is(:hover, :focus-visible) .world-floor__hit-area { fill: #a8e7df; fill-opacity: .06; stroke: #a8e7df; stroke-opacity: .5; }
.world-floor__destination:focus-visible .world-floor__tile,
.world-floor__destination:focus-visible .world-floor__hit-area { stroke: #e5f0ec; stroke-width: 2; }

.world-floor__player { pointer-events: none; }
.world-floor__view { fill: #a8e7df; opacity: .08; }
.world-floor__player-halo { fill: #a8e7df; fill-opacity: .07; }
.world-floor__player-ring { fill: #143640; stroke: #a8e7df; stroke-width: 1; stroke-opacity: .65; }
.world-floor__player-arrow { fill: #baffee; stroke: #102a33; stroke-width: .8; stroke-linejoin: round; }
.world-floor__mini-object { fill: #779ba0; stroke: #a8c8cb; stroke-opacity: .35; stroke-width: 1.5; }
.world-floor__destination.is-record .world-floor__mini-object { fill: #b5a181; }
.world-floor__destination.is-seat .world-floor__mini-object { fill: #6c8791; }
.world-floor__destination.is-selected .world-floor__mini-object { fill: #efd0a0; stroke: #efd0a0; stroke-opacity: 1; }
.world-floor--compact .world-floor__destination { pointer-events: none; }
.world-floor--compact .world-floor__wall { stroke-width: 4; }
.world-floor--compact .world-floor__gallery, .world-floor--compact .world-floor__hub { display: none; }
.world-floor--wide .world-floor__tile-label { font-size: 15.5px; }

@media (max-width: 600px) {
  .world-floor__tile-label { font-size: 16px; }
  .world-floor__label, .world-floor__seat-label { font-size: 15.5px; }
}
@media (prefers-reduced-motion: reduce) {
  .world-floor__tile, .world-floor__hit-area { transition: none; }
}
</style>
