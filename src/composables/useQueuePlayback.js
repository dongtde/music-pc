import { computed, unref } from 'vue'
import { usePlayerStore } from '../stores/player'
import { getPlaybackErrorDisplay } from '../utils/playbackError'

export function useQueuePlayback(options = {}) {
  const {
    queue,
    player = usePlayerStore(),
    message,
    emptyMessage = 'No playable tracks',
    errorMessage = 'Track cannot be played',
    queueSource = 'queue-playback'
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

    player.setQueue(tracks.value, resolveQueueSource())
    return playWithFeedback(tracks.value[0])
  }

  async function playTrack(track) {
    const source = resolveQueueSource()

    if (String(player.state.currentTrack.id) === String(track?.id)) {
      await player.togglePlay()
      return true
    }

    const played = await playWithFeedback(track)

    if (played) {
      player.appendToQueue(track, source)
    }

    return played
  }

  async function playWithFeedback(track) {
    const played = await player.playTrack(track)

    if (!played) {
      message?.error?.(getPlaybackErrorDisplay(player.state.error, errorMessage))
    }

    return played
  }

  function resolveQueueSource() {
    const source = unref(queueSource)

    return typeof source === 'function' ? source() : source
  }

  return {
    isPlaying,
    playAll,
    playTrack
  }
}

