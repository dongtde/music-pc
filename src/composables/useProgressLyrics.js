import { computed, ref, unref } from 'vue'
import { getCachedTrackLyrics } from '../services/lyrics'
import { isNeteaseTrackId } from '../utils/lyrics'

const DEFAULT_PREVIEW_TEXT = '暂无歌词'

export function useProgressLyrics(options = {}) {
  const {
    previewTime,
    fallbackText = DEFAULT_PREVIEW_TEXT
  } = options

  const lines = ref([])
  let requestId = 0
  let loadedTrackId = ''
  let loadingTrackId = ''

  const previewLine = computed(() => findLineAt(unref(previewTime)))
  const previewText = computed(() => previewLine.value?.text || fallbackText)

  function reset() {
    requestId += 1
    loadedTrackId = ''
    loadingTrackId = ''
    lines.value = []
  }

  async function load(track) {
    const normalizedTrackId = String(track?.id ?? track ?? '')

    if (
      !normalizedTrackId ||
      loadedTrackId === normalizedTrackId ||
      loadingTrackId === normalizedTrackId
    ) {
      return
    }

    requestId += 1
    const currentRequestId = requestId
    loadingTrackId = normalizedTrackId
    lines.value = []

    if (!isNeteaseTrackId(normalizedTrackId)) {
      loadedTrackId = normalizedTrackId
      loadingTrackId = ''
      return
    }

    try {
      const lyricLines = await getCachedTrackLyrics(
        track && typeof track === 'object' ? track : normalizedTrackId
      )

      if (currentRequestId !== requestId) {
        return
      }

      lines.value = lyricLines.filter((line) => !line.placeholder)
      loadedTrackId = normalizedTrackId
    } catch (error) {
      if (currentRequestId !== requestId) {
        return
      }

      console.warn('Failed to load progress lyrics:', error)
      lines.value = []
    } finally {
      if (currentRequestId === requestId) {
        loadingTrackId = ''
      }
    }
  }

  function findLineAt(time) {
    const currentLines = lines.value

    if (!currentLines.length) {
      return null
    }

    let low = 0
    let high = currentLines.length - 1
    let currentIndex = 0

    while (low <= high) {
      const middle = Math.floor((low + high) / 2)

      if (currentLines[middle].seconds <= time + 0.16) {
        currentIndex = middle
        low = middle + 1
        continue
      }

      high = middle - 1
    }

    return currentLines[currentIndex]
  }

  return {
    lines,
    previewLine,
    previewText,
    reset,
    load,
    findLineAt
  }
}
