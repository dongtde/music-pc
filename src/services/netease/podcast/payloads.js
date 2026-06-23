import { asArray } from './shared'

export function getProgramPayload(response = {}) {
  const candidates = [
    response.programs,
    response.toplist,
    response.data?.programs,
    response.data?.list,
    response.data?.toplist,
    response.data?.resources,
    response.data,
    response.list,
    response.resources,
    response.records,
    response.program ? [response.program] : null
  ]
  const items = candidates.find((item) => Array.isArray(item)) ?? []

  return items
    .map((item) => item?.data ?? item?.resource ?? item?.program ?? item)
    .filter(Boolean)
}

export function getSatiResourcePayload(response = {}) {
  const candidates = [
    response.data,
    response.resources,
    response.resourceList,
    response.items,
    response.result,
    response.data?.resources,
    response.data?.resourceList,
    response.data?.list,
    response.data?.items,
    response.data?.result,
    response.list
  ]

  return candidates.find((item) => Array.isArray(item)) ?? []
}

export function getDifmTrackPayload(response = {}) {
  const candidates = [response.data, response.tracks, response.data?.tracks, response.data?.list, response.list]

  return candidates.find((item) => Array.isArray(item)) ?? []
}

export function getBroadcastChannelPayload(response = {}) {
  const candidates = [
    response.data,
    response.channels,
    response.data?.channels,
    response.data?.list,
    response.list,
    response.channelList
  ]

  return candidates.find((item) => Array.isArray(item)) ?? []
}

export function getRadioSongPayload(response = {}) {
  const data = response.data ?? response
  const candidates = [
    data?.songs,
    data?.list,
    data?.items,
    data?.data,
    response.songs,
    response.list,
    response.items
  ]
  const direct = candidates.find((item) => Array.isArray(item))

  if (direct) {
    return direct.map((item) => item.song ?? item.resource ?? item).filter(Boolean)
  }

  return asArray(data).flatMap((item) => asArray(item.songs ?? item.list ?? item.items))
}

export function getRadioSongTotal(response = {}, offset = 0, count = 0) {
  const data = response.data ?? response
  const first = Array.isArray(data) ? data[0] : data
  const total = first?.total ?? first?.count ?? response.total ?? response.count

  return Number(total) || offset + count
}

export function getRadioRecommendPayload(response = {}) {
  return asArray(response.data ?? response.radios ?? response.list ?? response.items)
}
