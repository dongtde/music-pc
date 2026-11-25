<template><span hidden aria-hidden="true" /></template>

<script setup>
import { onActivated, onDeactivated, onMounted, onUnmounted, ref, watch } from 'vue'
import { recommendedSingles } from '../../data/music'
import { getMusicFeedData } from '../../services/netease'
import { usePlayerStore } from '../../stores/player'
import { RECOMMENDATION_LIMIT } from './homeConstants'
import { applyMoodQueue, prepareQueue } from './homeUtils'

// The phone player owns lyrics, comments, transport and track-ended handling.
// This controller only supplies the same daily recommendations as desktop Home.
const props = defineProps({ active: { type: Boolean, default: false } })
const emit = defineEmits(['ready'])
const player = usePlayerStore()
const songs = ref(applyMoodQueue(prepareQueue(recommendedSingles), 'daily'))
let viewActive = true
let disposed = false

function syncQueue() {
  if (!viewActive || !props.active || !songs.value.length) return
  const queue = [...songs.value]
  const current = player.state.currentTrack
  if (current?.id) {
    const index = queue.findIndex(song => String(song.id) === String(current.id))
    // Entering Home must not interrupt the current song or lose its position.
    if (index >= 0) queue[index] = { ...queue[index], ...current }
    else queue.unshift(current)
  }
  player.setQueue(queue, { type: 'home-music', id: 'daily' })
}

async function loadRecommendations() {
  try {
    const data = await getMusicFeedData({ limit: RECOMMENDATION_LIMIT })
    if (disposed) return
    songs.value = applyMoodQueue(prepareQueue(data.songs?.length ? data.songs : recommendedSingles), 'daily')
    if (player.state.queueSource?.type === 'home-music') syncQueue()
  } catch (error) {
    if (!disposed) console.warn('Mobile Home recommendations unavailable; retaining local recommendations.', error)
  } finally {
    if (!disposed) emit('ready')
  }
}

watch(() => props.active, active => { if (active) syncQueue() })
onMounted(() => { syncQueue(); void loadRecommendations() })
onActivated(() => { viewActive = true; syncQueue() })
onDeactivated(() => { viewActive = false })
onUnmounted(() => { disposed = true; viewActive = false })
</script>
