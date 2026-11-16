import { getKugou } from '../../api/modules/netease/shared/client'
import { formatDuration, formatPlayCount, resizeNeteaseImage } from '../../services/netease/mv/shared'

// The brush feed carries its own H.264 playback URL; its IDs are not legacy MV IDs.
export function mapWorldMv(item) {
  const media = item.hp_mv_info, song = item.song
  const url = media?.play_info?.src_file?.h264?.play_url
  if (!item.id || !song?.songname || !/^https?:\/\//i.test(url || '')) return null
  return {
    id: String(item.id), title: song.songname, artist: song.author_name || '未知歌手',
    coverUrl: resizeNeteaseImage(media.mv_info?.video_custom_img || song.album_cover, 960),
    duration: formatDuration(item.song_extra?.audio_info?.timelength || 0),
    playCount: formatPlayCount(media.mv_info?.views || 0),
    commentId: String(media.mv_info?.mixsongid || song.mixsongid || song.album_audio_id || ''),
    url, source: 'world-mv-feed',
  }
}

export async function loadWorldMvs({ page = 0 } = {}) {
  let result
  // Recommendations can contain only audio or pictures; skip a bounded number of those pages.
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await getKugou('/brush', { page }, { timeout: 12000 })
    const data = response?.data ?? response
    result = {
      items: (data.list || []).map(mapWorldMv).filter(Boolean),
      more: Boolean(data.has_next),
      nextPage: Number(data.next_page) > page ? Number(data.next_page) : page + 1,
    }
    if (result.items.length || !result.more) return result
    page = result.nextPage
  }
  return result
}
