import { computed, onScopeDispose, ref, toValue, watch } from 'vue'
import { getCachedCoverTint, sampleCoverTint } from '../utils/coverPalette'

// Match the built-in artwork when a playlist has no image or sampling fails.
const COVER_STYLE_TINTS = {
  sunset: '204, 75, 73',
  neon: '83, 52, 149',
  lofi: '132, 93, 67',
  stage: '57, 92, 111',
  piano: '172, 117, 58'
}

export function useDetailCoverTheme(source) {
  const tint = ref('')
  let requestId = 0

  watch(
    [() => toValue(source)?.path, () => toValue(source)?.coverUrl, () => toValue(source)?.coverType, () => toValue(source)?.tint],
    async ([path, coverUrl, coverType, previewTint], [previousPath] = []) => {
      const request = ++requestId
      const cachedTint = previewTint || getCachedCoverTint(coverUrl)
      if (!path) tint.value = ''
      else if (cachedTint) tint.value = cachedTint
      else if (path !== previousPath || !tint.value) {
        tint.value = COVER_STYLE_TINTS[coverUrl ? 'stage' : coverType] || COVER_STYLE_TINTS.stage
      }
      if (!path || !coverUrl || cachedTint) return

      try {
        const sampledTint = await sampleCoverTint(coverUrl)
        if (request === requestId) tint.value = sampledTint
      } catch {
        // Keep the current playlist's built-in artwork color as the fallback.
      }
    },
    { immediate: true }
  )

  onScopeDispose(() => { requestId += 1 })

  return {
    coverThemeActive: computed(() => Boolean(toValue(source))),
    coverThemeStyle: computed(() => tint.value ? { '--detail-cover-tint': `rgb(${tint.value})` } : {})
  }
}
