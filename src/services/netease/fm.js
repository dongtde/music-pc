import { getPersonalFm, getPersonalFmByMode, sendFmTrash } from '../../api/modules/netease'
import { extractPersonalFmSongs, mapFmTrack } from './shared'

export async function getPersonalFmData({ mode = 'DEFAULT', submode = '', timestamp = Date.now() } = {}) {
  const normalizedMode = String(mode || 'DEFAULT')
  const params = {
    timestamp
  }
  let response

  if (normalizedMode === 'DEFAULT' && !submode) {
    response = await getPersonalFm(params)
  } else {
    response = await getPersonalFmByMode({
      ...params,
      mode: normalizedMode,
      submode: submode || undefined
    })
  }

  return {
    tracks: extractPersonalFmSongs(response).map(mapFmTrack)
  }
}

export async function movePersonalFmSongToTrash(id) {
  return sendFmTrash({
    id,
    timestamp: Date.now()
  })
}
