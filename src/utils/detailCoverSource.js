import { getArtistPreview } from './artistPreview'
import { getPlaylistPreview } from './playlistPreview'
import { getPodcastPreview } from './podcastPreview'

const previewByRoute = {
  artist: getArtistPreview,
  playlist: getPlaylistPreview,
  'podcast-detail': getPodcastPreview
}

export function getDetailCoverSource(route, header) {
  if (!route?.meta.coverDetail) return null
  const preview = previewByRoute[route.name]?.(route.params.id)
  const currentHeader = header?.path === route.path ? header : null
  if (!preview && !currentHeader) return null

  return {
    path: route.path,
    coverUrl: currentHeader?.coverUrl || preview?.coverUrl || '',
    coverType: (currentHeader?.coverUrl ? currentHeader.coverType : preview?.coverType) || currentHeader?.coverType,
    tint: preview?.tint || ''
  }
}
