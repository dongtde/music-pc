import { computed, nextTick, onMounted, onUnmounted, watch } from 'vue'

export function useTaskbarControlsBridge(options = {}) {
  const {
    player,
    currentTrack,
    playPreviousTrack,
    playNextTrack,
    getThumbnailClip,
    onPlaybackError
  } = options

  const available = computed(() =>
    Boolean(
      typeof window !== 'undefined' &&
        window.mappicDesktop?.taskbarControls?.available
    )
  )

  let removeCommandListener = null
  let publishFrame = 0

  watch(
    () => [
      currentTrack?.value?.id,
      currentTrack?.value?.name,
      currentTrack?.value?.artist,
      currentTrack?.value?.coverUrl,
      player?.state?.isPlaying,
      player?.state?.isLoading,
    ],
    schedulePublish,
    { immediate: true }
  )

  function schedulePublish() {
    if (typeof window === 'undefined') {
      return
    }

    if (publishFrame) {
      return
    }

    publishFrame = window.requestAnimationFrame(() => {
      publishFrame = 0
      publishState()
    })
  }

  function publishState() {
    if (!available.value) {
      return
    }

    window.mappicDesktop.taskbarControls.publishState({
      track: {
        id: currentTrack?.value?.id,
        name: currentTrack?.value?.name,
        artist: currentTrack?.value?.artist,
      },
      playback: {
        isPlaying: Boolean(player?.state?.isPlaying),
        isLoading: Boolean(player?.state?.isLoading),
      },
      thumbnailClip: normalizeThumbnailClip(getThumbnailClip?.()),
    })
  }

  async function handleCommand(command) {
    const action = typeof command === 'string' ? command : command?.action

    if (action === 'toggle-play') {
      if (!currentTrack?.value?.id) {
        await playNextTrack?.()
        publishState()
        return
      }

      const toggled = await player?.togglePlay?.()
      onPlaybackError?.(toggled)
      publishState()
      return
    }

    if (action === 'previous') {
      await playPreviousTrack?.()
      publishState()
      return
    }

    if (action === 'next') {
      await playNextTrack?.()
      publishState()
    }
  }

  onMounted(() => {
    if (!available.value) {
      return
    }

    removeCommandListener =
      window.mappicDesktop.taskbarControls.onCommand(handleCommand)
    window.addEventListener('resize', schedulePublish)
    nextTick(() => schedulePublish())
  })

  onUnmounted(() => {
    window.removeEventListener('resize', schedulePublish)
    if (publishFrame) {
      window.cancelAnimationFrame(publishFrame)
      publishFrame = 0
    }

    removeCommandListener?.()
    removeCommandListener = null
  })

  return {
    available,
    publishState,
  }
}

function normalizeThumbnailClip(rect) {
  if (!rect) {
    return null
  }

  const left = Number(rect.left ?? rect.x)
  const top = Number(rect.top ?? rect.y)
  const width = Number(rect.width)
  const height = Number(rect.height)

  if (
    !Number.isFinite(left) ||
    !Number.isFinite(top) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null
  }

  return {
    x: Math.max(0, Math.round(left)),
    y: Math.max(0, Math.round(top)),
    width: Math.round(width),
    height: Math.round(height),
  }
}
