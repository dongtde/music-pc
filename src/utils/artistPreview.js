import { shallowReactive } from 'vue'
import { sampleCoverTint } from './coverPalette'

const previews = shallowReactive(new Map())
const MAX_PREVIEWS = 80

export function getArtistPreview(id) {
  return previews.get(String(id ?? '')) ?? null
}

export function prepareArtistCover(artist) {
  const id = String(artist?.id ?? '')
  const coverUrl = artist?.coverUrl
  if (!id || !coverUrl) return

  if (getArtistPreview(id)?.coverUrl !== coverUrl) {
    previews.set(id, { coverUrl })
    while (previews.size > MAX_PREVIEWS) previews.delete(previews.keys().next().value)
  }

  // The detail theme reuses either the cached tint or this in-flight sample.
  void sampleCoverTint(coverUrl).catch(() => {})
}
