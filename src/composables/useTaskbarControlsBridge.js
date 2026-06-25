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
  let mediaSessionHandlersInstalled = false
  const handledCommandIds = new Set()
  const handledCommandIdOrder = []

  watch(
    () => [
      currentTrack?.value?.id,
      currentTrack?.value?.name,
      currentTrack?.value?.artist,
      currentTrack?.value?.coverUrl,
      player?.state?.isPlaying,
      player?.state?.isLoading,
      player?.state?.playMode,
      player?.state?.queueVersion,
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
    publishTaskbarState()
    publishMediaSessionState()
  }

  function publishTaskbarState() {
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
      controls: {
        canPrevious: canPlayRelative(-1),
        canNext: canPlayRelative(1),
      },
      thumbnailClip: normalizeThumbnailClip(getThumbnailClip?.()),
    })
  }

  function publishMediaSessionState() {
    const mediaSession = getMediaSession()

    if (!mediaSession) {
      return
    }

    const track = currentTrack?.value ?? {}
    const hasTrack = Boolean(track.id || track.name)

    try {
      if (hasTrack && typeof window.MediaMetadata === 'function') {
        mediaSession.metadata = new window.MediaMetadata({
          title: cleanMetadataText(track.name, '\u6f9c\u97f3'),
          artist: cleanMetadataText(track.artist, ''),
          album: cleanMetadataText(track.album, ''),
          artwork: createMediaArtwork(track),
        })
      } else {
        mediaSession.metadata = null
      }

      mediaSession.playbackState = player?.state?.isPlaying
        ? 'playing'
        : hasTrack
          ? 'paused'
          : 'none'
    } catch (error) {
      console.warn('Failed to publish media session state:', error)
    }
  }

  async function handleCommand(command) {
    const payload = normalizeCommandPayload(command)
    const action = payload.action

    if (!action) {
      completeCommand(payload, false)
      return
    }

    if (isDuplicateCommand(payload.id)) {
      return
    }

    let handled = false

    try {
      handled = await runCommand(action)
    } catch (error) {
      console.warn('Failed to handle taskbar command:', error)
      handled = false
    } finally {
      completeCommand(payload, handled)
    }
  }

  async function runCommand(action) {
    if (action === 'play') {
      if (!currentTrack?.value?.id) {
        const canStartPlayback = canPlayRelative(1)
        if (!canStartPlayback) {
          publishState()
          return false
        }

        await playNextTrack?.()
        publishState()
        return true
      }

      if (!player?.state?.isPlaying) {
        const played = await player?.togglePlay?.()
        onPlaybackError?.(played)
        publishState()
        return Boolean(played)
      }

      publishState()
      return true
    }

    if (action === 'pause') {
      if (player?.state?.isPlaying) {
        const paused = await player?.togglePlay?.()
        onPlaybackError?.(paused)
        publishState()
        return Boolean(paused)
      }

      publishState()
      return true
    }

    if (action === 'toggle-play') {
      if (!currentTrack?.value?.id) {
        const canStartPlayback = canPlayRelative(1)
        if (!canStartPlayback) {
          publishState()
          return false
        }

        await playNextTrack?.()
        publishState()
        return true
      }

      const toggled = await player?.togglePlay?.()
      onPlaybackError?.(toggled)
      publishState()
      return Boolean(toggled)
    }

    if (action === 'previous') {
      if (!canPlayRelative(-1)) {
        publishState()
        return false
      }

      await playPreviousTrack?.()
      publishState()
      return true
    }

    if (action === 'next') {
      if (!canPlayRelative(1)) {
        publishState()
        return false
      }

      await playNextTrack?.()
      publishState()
      return true
    }

    return false
  }

  function installMediaSessionHandlers() {
    const mediaSession = getMediaSession()

    if (!mediaSession || mediaSessionHandlersInstalled) {
      return
    }

    mediaSessionHandlersInstalled = true
    setMediaActionHandler(mediaSession, 'play', () => runCommand('play'))
    setMediaActionHandler(mediaSession, 'pause', () => runCommand('pause'))
    setMediaActionHandler(mediaSession, 'previoustrack', () =>
      runCommand('previous')
    )
    setMediaActionHandler(mediaSession, 'nexttrack', () => runCommand('next'))
    setMediaActionHandler(mediaSession, 'stop', () => runCommand('pause'))
  }

  function uninstallMediaSessionHandlers() {
    const mediaSession = getMediaSession()

    if (!mediaSession || !mediaSessionHandlersInstalled) {
      return
    }

    const actions = ['play', 'pause', 'previoustrack', 'nexttrack', 'stop']
    actions.forEach((action) => {
      setMediaActionHandler(mediaSession, action, null)
    })
    mediaSessionHandlersInstalled = false
  }

  onMounted(() => {
    if (available.value) {
      removeCommandListener =
        window.mappicDesktop.taskbarControls.onCommand(handleCommand)
      window.addEventListener('resize', schedulePublish)
    }

    window.addEventListener('lanyin:taskbar-command', handleWindowCommand)
    installMediaSessionHandlers()
    nextTick(() => schedulePublish())
  })

  onUnmounted(() => {
    window.removeEventListener('resize', schedulePublish)
    window.removeEventListener('lanyin:taskbar-command', handleWindowCommand)
    if (publishFrame) {
      window.cancelAnimationFrame(publishFrame)
      publishFrame = 0
    }

    removeCommandListener?.()
    removeCommandListener = null
    uninstallMediaSessionHandlers()
  })

  return {
    available,
    publishState,
  }

  function handleWindowCommand(event) {
    handleCommand(event?.detail)
  }

  function canPlayRelative(direction) {
    if (typeof player?.getRelativeQueueTrack !== 'function') {
      return false
    }

    return Boolean(player.getRelativeQueueTrack(direction))
  }

  function completeCommand(payload, handled) {
    const id = cleanMetadataText(payload?.id)

    if (!id) {
      return
    }

    window.mappicDesktop?.taskbarControls?.completeCommand?.({
      id,
      action: payload.action,
      handled: Boolean(handled),
      trackId: currentTrack?.value?.id ?? null,
    })
  }

  function isDuplicateCommand(id) {
    const commandId = cleanMetadataText(id)

    if (!commandId) {
      return false
    }

    if (handledCommandIds.has(commandId)) {
      return true
    }

    handledCommandIds.add(commandId)
    handledCommandIdOrder.push(commandId)

    while (handledCommandIdOrder.length > 40) {
      const oldId = handledCommandIdOrder.shift()
      handledCommandIds.delete(oldId)
    }

    return false
  }
}

function normalizeCommandPayload(command) {
  if (typeof command === 'string') {
    return {
      id: '',
      action: command,
    }
  }

  return {
    id: cleanMetadataText(command?.id),
    action: cleanMetadataText(command?.action || command?.type),
  }
}

function getMediaSession() {
  if (typeof navigator === 'undefined' || !navigator.mediaSession) {
    return null
  }

  return navigator.mediaSession
}

function setMediaActionHandler(mediaSession, action, handler) {
  try {
    mediaSession.setActionHandler(action, handler)
  } catch (error) {
    if (handler) {
      console.debug(`Media session action is unavailable: ${action}`, error)
    }
  }
}

function cleanMetadataText(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function createMediaArtwork(track = {}) {
  const src = cleanMetadataText(track.coverUrl || track.thumbnailUrl)

  if (!src) {
    return []
  }

  return [
    { src, sizes: '96x96' },
    { src, sizes: '128x128' },
    { src, sizes: '192x192' },
    { src, sizes: '512x512' },
  ]
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
