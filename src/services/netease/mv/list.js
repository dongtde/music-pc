import {
  getAllMvs as getNeteaseAllMvs,
  getExclusiveMvs as getNeteaseExclusiveMvs,
  getFirstMvs as getNeteaseFirstMvs,
  getFollowArtistNewMvs as getNeteaseFollowArtistNewMvs,
  getMvDetail as getNeteaseMvDetail,
  getPersonalizedMvs as getNeteasePersonalizedMvs,
  getSubscribedMvs as getNeteaseSubscribedMvs,
  getTopMvs as getNeteaseTopMvs
} from '../../../api/modules/neteaseLegacy'
import { isAbortError } from '../../../utils/request'
import { getMvPlaybackData } from './playback'
import { getMvListPayload, mapVideoMv } from './mappers'
import { MV_DEFAULT_AREA, MV_DEFAULT_ORDER, MV_DEFAULT_TYPE, UNKNOWN_ARTIST, UNKNOWN_MV } from './shared'

export async function getVideoCenterData({
  area = MV_DEFAULT_AREA,
  type = MV_DEFAULT_TYPE,
  order = MV_DEFAULT_ORDER,
  limit = 18,
  offset = 0
} = {}, options = {}) {
  const [
    recommendedResponse,
    firstResponse,
    exclusiveResponse,
    topResponse,
    allResponse,
    subscribedResponse,
    followNewResponse
  ] = await Promise.all([
    getNeteasePersonalizedMvs({}, options).catch(toOptionalMvResponse),
    getNeteaseFirstMvs({ area, limit: 12 }, options).catch(toOptionalMvResponse),
    getNeteaseExclusiveMvs({ limit: 12, offset: 0 }, options).catch(toOptionalMvResponse),
    getNeteaseTopMvs({ area: area === MV_DEFAULT_AREA ? undefined : area, limit: 10, offset: 0 }, options)
      .catch(toOptionalMvResponse),
    getNeteaseAllMvs({ area, type, order, limit, offset }, options).catch(toOptionalMvResponse),
    getNeteaseSubscribedMvs({}, options).catch(toOptionalMvResponse),
    getNeteaseFollowArtistNewMvs({ limit: 10 }, options).catch(toOptionalMvResponse)
  ])
  const recommended = (recommendedResponse.result ?? []).map(mapVideoMv)
  const first = getMvListPayload(firstResponse).map(mapVideoMv)
  const exclusive = getMvListPayload(exclusiveResponse).map(mapVideoMv)
  const top = await hydrateMissingMvCards(getMvListPayload(topResponse).map(mapVideoMv), options)
  const all = getMvListPayload(allResponse).map(mapVideoMv)
  const subscribed = getMvListPayload(subscribedResponse).map(mapVideoMv)
  const followArtistNew = getMvListPayload(followNewResponse).map(mapVideoMv)
  const hero = top[0] ?? recommended[0] ?? first[0] ?? exclusive[0] ?? all[0] ?? null
  const active = hero ? await getMvPlaybackData(hero.id, 1080, options).catch((error) => {
    if (isAbortError(error)) {
      throw error
    }

    return { mv: hero }
  }) : null

  return {
    recommended,
    first,
    exclusive,
    top,
    all,
    subscribed,
    followArtistNew,
    total: allResponse.count ?? allResponse.total ?? all.length,
    more: getExplicitMore(allResponse) ?? false,
    active
  }
}

export async function getFilteredMvsData({
  area = MV_DEFAULT_AREA,
  type = MV_DEFAULT_TYPE,
  order = MV_DEFAULT_ORDER,
  limit = 18,
  offset = 0
} = {}, options = {}) {
  const response = await getNeteaseAllMvs({ area, type, order, limit, offset }, options)
  const items = getMvListPayload(response).map(mapVideoMv)

  return {
    items,
    total: response.count ?? response.total ?? items.length,
    more: getExplicitMore(response) ?? false
  }
}

function getExplicitMore(source = {}) {
  if (!source || typeof source !== 'object') {
    return null
  }

  if ('hasMore' in source) {
    return Boolean(source.hasMore)
  }

  if ('has_more' in source) {
    return Boolean(source.has_more)
  }

  if ('has_next' in source) {
    return Boolean(source.has_next)
  }

  if ('more' in source) {
    return Boolean(source.more)
  }

  return null
}

async function hydrateMissingMvCards(mvs = [], options = {}) {
  const targets = mvs.filter((mv) => mv?.id && (!mv.coverUrl || !mv.playCountRaw))

  if (!targets.length) {
    return mvs
  }

  const detailResponses = await Promise.all(
    targets.map((mv) => getNeteaseMvDetail({ mvid: mv.id }, options).catch((error) => {
      if (isAbortError(error)) {
        throw error
      }

      return null
    }))
  )
  const detailsById = new Map()

  detailResponses.forEach((response, index) => {
    const detail = response?.data ?? response?.mv

    if (detail) {
      detailsById.set(String(targets[index].id), mapVideoMv(detail, index))
    }
  })

  return mvs.map((mv) => {
    const detail = detailsById.get(String(mv.id))

    if (!detail) {
      return mv
    }

    return {
      ...mv,
      title: mv.title && mv.title !== UNKNOWN_MV ? mv.title : detail.title,
      name: mv.name && mv.name !== UNKNOWN_MV ? mv.name : detail.name,
      artist: mv.artist && mv.artist !== UNKNOWN_ARTIST ? mv.artist : detail.artist,
      artistId: mv.artistId || detail.artistId,
      desc: mv.desc || detail.desc,
      coverUrl: mv.coverUrl || detail.coverUrl,
      playCount: mv.playCountRaw ? mv.playCount : detail.playCount,
      playCountRaw: mv.playCountRaw || detail.playCountRaw,
      duration: mv.duration && mv.duration !== '0:00' ? mv.duration : detail.duration,
      publishTime: mv.publishTime || detail.publishTime
    }
  })
}

function toOptionalMvResponse(error) {
  if (isAbortError(error)) {
    throw error
  }

  return {}
}
