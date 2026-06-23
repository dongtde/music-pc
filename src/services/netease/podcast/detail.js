import { getDjProgramDetail, getRadioSongs } from '../../../api/modules/netease'
import { getRadioCatalogData } from './catalog'
import { mapPodcastProgramTrack, mapRadioCard, mapRadioDetail, mapRadioSongTrack } from './mappers'
import { getRadioSongPayload, getRadioSongTotal } from './payloads'

export async function getPodcastDetailData({ id, fmtype = 2, limit = 40, offset = 0 } = {}) {
  const catalog = await getRadioCatalogData()
  const radio = catalog.radiosById.get(String(id)) ?? mapRadioCard({ fmid: id, fmtype })
  const songResponse = await getRadioSongs({
    fmid: id,
    fmtype: radio.fmtype ?? fmtype,
    fmoffset: offset,
    fmsize: limit
  })
  const songs = getRadioSongPayload(songResponse)
  const programs = songs.map((song, index) => mapRadioSongTrack(song, index + offset, radio))
  const total = getRadioSongTotal(songResponse, offset, programs.length, limit)

  return {
    podcast: mapRadioDetail(radio, total),
    programs,
    total,
    more: programs.length >= limit
  }
}

export async function getPodcastProgramsData({ id, fmtype = 2, limit = 40, offset = 0 } = {}) {
  const catalog = await getRadioCatalogData()
  const radio = catalog.radiosById.get(String(id)) ?? mapRadioCard({ fmid: id, fmtype })
  const response = await getRadioSongs({
    fmid: id,
    fmtype: radio.fmtype ?? fmtype,
    fmoffset: offset,
    fmsize: limit
  })
  const programs = getRadioSongPayload(response).map((song, index) => mapRadioSongTrack(song, index + offset, radio))
  const total = getRadioSongTotal(response, offset, programs.length, limit)

  return {
    programs,
    total,
    more: programs.length >= limit
  }
}

export async function getPodcastProgramDetailData(id) {
  const response = await getDjProgramDetail({ id })
  const program = response.program ?? response.data ?? response

  return mapPodcastProgramTrack(program)
}

export async function togglePodcastSubscribeData({ id, subscribe }) {
  return {
    id,
    subscribe,
    skipped: true
  }
}
