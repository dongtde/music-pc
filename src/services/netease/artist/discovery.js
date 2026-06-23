import { getArtistList, getArtistToplist } from '../../../api/modules/netease'
import { mapArtist, mapRankedArtist } from './mappers'

let artistToplistPromise = null

export async function getArtistsDiscoveryData({
  area = -1,
  type = -1,
  initial = -1,
  limit = 32,
  offset = 0
} = {}) {
  const artistListParams = getKugouArtistListParams({
    area,
    type,
    initial,
    limit,
    offset
  })
  const [artistResponse, toplistResponse] = await Promise.all([
    getArtistList(artistListParams).catch(() => ({})),
    getArtistToplistCached().catch(() => ({}))
  ])
  const artistPage = getKugouArtistPage(artistResponse, {
    initial,
    limit,
    offset
  })

  return {
    artists: artistPage.items.map((artist, index) => mapArtist(artist, offset + index)),
    topArtists: getKugouHotArtists(toplistResponse).slice(0, 10).map(mapRankedArtist),
    more: artistPage.more
  }
}

function getArtistToplistCached() {
  if (!artistToplistPromise) {
    artistToplistPromise = getArtistToplist({ type: 0, sextypes: 0, hotsize: 10 }).catch((error) => {
      artistToplistPromise = null
      throw error
    })
  }

  return artistToplistPromise
}

function getKugouArtistListParams({ area = -1, type = -1, initial = -1, limit = 32, offset = 0 } = {}) {
  const isHot = String(initial) === '-1'

  return {
    type: mapKugouArtistArea(area),
    sextypes: mapKugouArtistSex(type),
    musician: 0,
    hotsize: isHot ? offset + limit + 1 : Math.max(limit, 30)
  }
}

function mapKugouArtistArea(area) {
  const areaMap = {
    '-1': 0,
    7: 1,
    96: 2,
    8: 5,
    16: 6,
    0: 4
  }

  return areaMap[String(area)] ?? 0
}

function mapKugouArtistSex(type) {
  const sexMap = {
    '-1': 0,
    1: 1,
    2: 2,
    3: 3
  }

  return sexMap[String(type)] ?? 0
}

function getKugouArtistPage(response = {}, { initial = -1, limit = 32, offset = 0 } = {}) {
  const source = getKugouArtistGroup(response, initial)
  const items = source.slice(offset, offset + limit)

  return {
    items,
    more: source.length > offset + limit
  }
}

function getKugouHotArtists(response = {}) {
  return getKugouArtistGroup(response, -1)
}

function getKugouArtistGroup(response = {}, initial = -1) {
  const groups = Array.isArray(response.groups) ? response.groups : []
  const target = String(initial).toUpperCase()
  const group = String(initial) === '-1'
    ? groups.find((item) => item.title === '\u70ed\u95e8') || groups[0]
    : groups.find((item) => String(item.title).toUpperCase() === target)

  return group?.artists ?? response.artists ?? []
}
