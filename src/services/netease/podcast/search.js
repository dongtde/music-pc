import { getMyCreatedVoiceList, getVoiceLyric, searchVoiceListPrograms, searchVoiceLists } from '../../../api/modules/netease'
import { parseLyricLines } from '../lyrics'
import { mapPodcastProgramTrack, mapVoiceListSearchResult } from './mappers'
import { getProgramPayload } from './payloads'

export async function searchPodcastsData({ keyword, limit = 18, offset = 0 } = {}) {
  const query = String(keyword ?? '').trim()

  if (!query) {
    return {
      items: [],
      total: 0,
      more: false
    }
  }

  const response = await searchVoiceLists({
    keyword: query,
    limit,
    offset
  })
  const result = response.data ?? response
  const resources = result.resources ?? result.list ?? result.items ?? []

  return {
    items: resources.map(mapVoiceListSearchResult).filter((item) => item.id),
    total: result.totalCount ?? result.total ?? resources.length,
    more: Boolean(result.hasMore || result.more)
  }
}

export async function getMyCreatedVoiceListData(limit = 20) {
  const response = await getMyCreatedVoiceList({ limit })

  return getProgramPayload(response).map(mapPodcastProgramTrack)
}

export async function searchVoiceListProgramsData(params = {}) {
  const response = await searchVoiceListPrograms(params)

  return getProgramPayload(response).map(mapPodcastProgramTrack)
}

export async function getVoiceLyricData(id) {
  const response = await getVoiceLyric({ id })

  return parseLyricLines(response.data?.lyric ?? response.lrc?.lyric ?? response.lyric ?? '')
}
