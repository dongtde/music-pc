import { shallowReactive } from 'vue'
import { getCachedCoverTint, sampleCoverTint } from './coverPalette'

const previews = shallowReactive(new Map())
const MAX_PREVIEWS = 80

export function getPlaylistPreview(id) {
  return previews.get(String(id ?? '')) ?? null
}

export function rememberPlaylistPreview(playlist) {
  if (playlist?.id == null) return null
  const id = String(playlist.id)
  const previous = previews.get(id)
  const coverUrl = playlist.coverUrl || playlist.coverImgUrl || playlist.picUrl || ''
  const preview = {
    id,
    title: playlist.title || playlist.name || '',
    coverUrl,
    coverType: playlist.coverType || playlist.type || 'stage',
    tint: getCachedCoverTint(coverUrl) || (previous?.coverUrl === coverUrl ? previous.tint : '')
  }
  if (previous && Object.keys(preview).every(key => preview[key] === previous[key])) return previous
  previews.set(id, preview)
  while (previews.size > MAX_PREVIEWS) previews.delete(previews.keys().next().value)
  return preview
}

// Start after an image is visible, or on navigation intent, rather than fetching
// artwork for every offscreen card. The existing sampler shares pending work.
export async function preparePlaylistCover(playlist) {
  const preview = rememberPlaylistPreview(playlist)
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
    // Keep the artwork metadata when a remote image disallows color sampling.
  }
  return previews.get(preview.id) ?? null
}
