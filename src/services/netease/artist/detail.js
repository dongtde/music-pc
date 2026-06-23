import {
  getArtistAlbums,
  getArtistDesc,
  getArtistDetail,
  getArtistDynamic,
  getArtistHotSongs,
  getArtistSongs,
  getArtistVideos
} from '../../../api/modules/netease'
import { isAbortError } from '../../../utils/request'
import { mapAlbumCard, mapArtist, mapArtistDetail, mapArtistVideo, mapPlaylistTrack } from './mappers'

export async function getArtistDetailData(id, options = {}) {
  const [detailResponse, songsResponse, dynamicResponse] = await Promise.all([
    getArtistDetail({ id }, options),
    getArtistHotSongs({ id }, options).catch(toOptionalArtistResponse),
    getArtistDynamic({ id }, options).catch(toOptionalArtistResponse)
  ])
  const detail = detailResponse.data ?? {}
  const artist = detail.artist ?? songsResponse.artist

  if (!artist) {
    throw new Error('Artist detail is empty')
  }

  const hotSongs = Array.isArray(songsResponse.hotSongs)
    ? songsResponse.hotSongs
    : Array.isArray(songsResponse.songs)
      ? songsResponse.songs
      : []

  return {
    artist: mapArtistDetail(artist, { ...detail, dynamic: dynamicResponse }, songsResponse.artist),
    tracks: hotSongs.map(mapPlaylistTrack)
  }
}

export async function getArtistSongsData({ id, limit = 30, offset = 0, order = 'hot' } = {}, options = {}) {
  const response = await getArtistSongs({
    id,
    limit,
    offset,
    order
  }, options)
  const songs = response.songs ?? []
  const total = response.total ?? songs.length

  return {
    tracks: songs.map((song, index) => mapPlaylistTrack(song, offset + index)),
    total,
    more: Boolean(response.more || (total && offset + songs.length < total))
  }
}

export async function getArtistAlbumsData({ id, limit = 30, offset = 0 } = {}, options = {}) {
  const response = await getArtistAlbums({
    id,
    limit,
    offset
  }, options)
  const albums = response.hotAlbums ?? []

  return {
    albums: albums.map((album, index) => mapAlbumCard(album, offset + index)),
    artist: response.artist ? mapArtist(response.artist, 0) : null,
    more: Boolean(response.more),
    total: response.total ?? response.artist?.albumSize ?? albums.length
  }
}

export async function getArtistVideosData({ id, size = 24, cursor = 0, order = 0 } = {}, options = {}) {
  const response = await getArtistVideos({
    id,
    size,
    cursor,
    order
  }, options)
  const page = response.data?.page ?? {}
  const records = response.data?.records ?? []

  return {
    videos: records.map(mapArtistVideo),
    cursor: page.cursor ?? '',
    more: Boolean(page.more)
  }
}

export async function getArtistIntroData(id, options = {}) {
  const response = await getArtistDesc({ id }, options)
  const detail = response.data ?? response
  const artist = response.artist ?? detail.artist ?? {}
  const sections = Array.isArray(detail.long_intro)
    ? detail.long_intro
    : Array.isArray(artist.longIntro)
      ? artist.longIntro
      : []

  return {
    briefDesc: artist.briefDesc || detail.intro || response.briefDesc || '',
    sections: sections.map((section, index) => ({
      id: `${section.title || section.ti || 'intro'}-${index}`,
      title: section.title || section.ti || '详情',
      text: section.content || section.txt || ''
    })).filter((section) => section.text)
  }
}

function toOptionalArtistResponse(error) {
  if (isAbortError(error)) {
    throw error
  }

  return {}
}
