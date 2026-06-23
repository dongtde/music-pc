import { getSongDownloadList } from '../../api/modules/netease'
import { mapPlaylistTrack } from './shared'

export async function getDownloadedSongsData({ limit = 50, offset = 0 } = {}) {
  const response = await getSongDownloadList({ limit, offset, timestamp: Date.now() })
  const songs = response.data?.list ?? response.list ?? response.songs ?? []

  return Array.isArray(songs)
    ? songs.map((item, index) => mapPlaylistTrack(item.song ?? item, offset + index))
    : []
}
