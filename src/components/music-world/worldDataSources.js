import { getHomeDiscoverData, getPlaylistDiscoveryData, getArtistsDiscoveryData, getChartsDiscoveryData, getPlaylistTracksData, getArtistSongsData } from '../../services/netease'

const withKind = (items = [], kind) => items.map(item => ({ ...item, kind }))
export async function loadWorldScreen(id, detail, offset = 0, { initial = -1 } = {}) {
  const options = { timeoutMs: 8000 }, limit = 24
  if (detail) {
    const result = detail.kind === 'artist'
      ? await getArtistSongsData({ id: detail.id, offset, limit }, options)
      : await getPlaylistTracksData({ id: detail.id, listid: detail.listid || '', offset, limit }, options)
    return { items: withKind(result.tracks, 'song'), more: result.more }
  }
  if (id === 'recommend') {
    const result = await getHomeDiscoverData(options)
    return { items: withKind(result.recommendedSingles, 'song'), more: false }
  }
  if (id === 'playlists') {
    const result = await getPlaylistDiscoveryData(undefined, { limit, offset }, options)
    return { items: withKind(result.playlists, 'playlist'), more: result.more }
  }
  if (id === 'artists') {
    const result = await getArtistsDiscoveryData({ limit, offset, initial }, options)
    return { items: withKind(result.artists, 'artist'), more: result.more }
  }
  const result = await getChartsDiscoveryData()
  return { items: withKind([...(result.officialCharts || []), ...(result.globalCharts || [])], 'playlist'), more: false }
}
