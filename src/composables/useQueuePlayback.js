import { computed, unref } from 'vue'
import { usePlayerStore } from '../stores/player'

export function useQueuePlayback(options = {}) {
  const {
    queue,
    player = usePlayerStore(),
    message,
    emptyMessage = 'No playable tracks',
    errorMessage = 'Track cannot be played'
  } = options

  const tracks = computed(() => unref(queue) ?? [])
  const isPlaying = computed(() =>
    tracks.value.some((track) => String(track.id) === String(player.state.currentTrack.id)) &&
    player.state.isPlaying
  )

  async function playAll() {
    if (!tracks.value.length) {
      message?.warning?.(emptyMessage)
      return false
    }

    player.setQueue(tracks.value)
    return playWithFeedback(tracks.value[0])
  }

  async function playTrack(track) {
    player.setQueue(tracks.value)

    if (String(player.state.currentTrack.id) === String(track?.id)) {
      await player.togglePlay()
      return true
    }

    return playWithFeedback(track)
  }

  async function playWithFeedback(track) {
    const played = await player.playTrack(track)

    if (!played) {
      message?.error?.(player.state.error?.message || errorMessage)
    }

    return played
  }

  return {
    isPlaying,
    playAll,
    playTrack
  }
}

