import { getBroadcastChannelList, getBroadcastCollectList, getBroadcastCurrentInfo, updateBroadcastSubscribe } from '../../../api/modules/netease'
import { mapBroadcastChannel } from './mappers'
import { getBroadcastChannelPayload } from './payloads'

export async function getBroadcastChannelsData({ categoryId = 0, regionId = 0 } = {}) {
  const response = await getBroadcastChannelList({
    categoryId,
    regionId
  })

  return getBroadcastChannelPayload(response).map(mapBroadcastChannel)
}

export async function getBroadcastChannelDetailData(id) {
  const response = await getBroadcastCurrentInfo({ id })

  return mapBroadcastChannel(response.data ?? response.channel ?? response)
}

export async function getBroadcastCollectedChannelsData(limit = 99999) {
  const response = await getBroadcastCollectList({ limit })

  return getBroadcastChannelPayload(response).map(mapBroadcastChannel)
}

export async function toggleBroadcastSubscribeData({ id, subscribe }) {
  return updateBroadcastSubscribe({
    id,
    t: subscribe ? 1 : 0,
    timestamp: Date.now()
  })
}
