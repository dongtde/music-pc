import { getSatiMoreResources, getSatiResources, getSatiSubscribedResources, updateSatiSubscribe } from '../../../api/modules/netease'
import { mapSatiResourceTrack } from './mappers'
import { getSatiResourcePayload } from './payloads'

export async function getSatiResourcesData(tag = 'RCMD') {
  const response = await getSatiResources({ tag })

  return getSatiResourcePayload(response).map(mapSatiResourceTrack)
}

export async function getSatiMoreResourcesData(id) {
  const response = await getSatiMoreResources({ id })

  return getSatiResourcePayload(response).map(mapSatiResourceTrack)
}

export async function getSatiSubscribedResourcesData() {
  const response = await getSatiSubscribedResources()

  return getSatiResourcePayload(response).map(mapSatiResourceTrack)
}

export async function toggleSatiResourceSubscribeData({ id, cancel = false }) {
  return updateSatiSubscribe({
    id,
    cancel: cancel || undefined,
    timestamp: Date.now()
  })
}
