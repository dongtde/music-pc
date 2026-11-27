import { shallowReactive } from 'vue'
import { getCachedCoverTint, sampleCoverTint } from './coverPalette'

const previews = shallowReactive(new Map())
const MAX_PREVIEWS = 80

export function getPodcastPreview(id) {
  return previews.get(String(id ?? '')) ?? null
}

export function rememberPodcastPreview(podcast) {
  if (podcast?.id == null) return null
  const id = String(podcast.id)
  const previous = previews.get(id)
  const coverUrl = podcast.coverUrl || podcast.coverImgUrl || podcast.picUrl || ''
  const preview = {
    id,
    title: podcast.title || podcast.name || '',
    coverUrl,
    coverType: podcast.coverType || podcast.type || 'stage',
    tint: getCachedCoverTint(coverUrl) || (previous?.coverUrl === coverUrl ? previous.tint : '')
  }
  if (previous && Object.keys(preview).every(key => preview[key] === previous[key])) return previous
  previews.set(id, preview)
  while (previews.size > MAX_PREVIEWS) previews.delete(previews.keys().next().value)
  return preview
}

export async function preparePodcastCover(podcast) {
  const preview = rememberPodcastPreview(podcast)
  if (!preview?.coverUrl || preview.tint) return preview
  try {
    const tint = await sampleCoverTint(preview.coverUrl)
    const current = previews.get(preview.id)
    if (current?.coverUrl === preview.coverUrl) {
      const ready = { ...current, tint }
      previews.set(preview.id, ready)
      return ready
    }
  } catch {
    // Keep the radio's built-in cover color when image sampling is unavailable.
  }
  return previews.get(preview.id) ?? null
}
