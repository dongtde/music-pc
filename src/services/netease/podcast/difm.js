import { getDifmPlayingTracks } from '../../../api/modules/netease'
import { mapDifmTrack } from './mappers'
import { getDifmTrackPayload } from './payloads'

export async function getDifmChannelTracksData({ source = 0, channelId, limit = 12 } = {}) {
  const response = await getDifmPlayingTracks({
    source,
    channelId,
    limit
  })

  return getDifmTrackPayload(response).map(mapDifmTrack)
}
