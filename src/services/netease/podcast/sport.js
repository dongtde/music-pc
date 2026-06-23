import { getSportRadio } from '../../../api/modules/netease'
import { mapPlaylistTrack } from './mappers'

export async function getSportRadioData(bpm = 120) {
  const response = await getSportRadio({ bpm })
  const songs = response.data?.songs ?? response.songs ?? response.data ?? []

  return Array.isArray(songs) ? songs.map(mapPlaylistTrack) : []
}
