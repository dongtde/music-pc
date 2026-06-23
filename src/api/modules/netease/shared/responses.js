import {
  extractSongItems,
  firstArray,
  firstObject,
  normalizeAlbum,
  normalizeArtist,
  normalizeComment,
  normalizeKugouImage,
  normalizePlaylist,
  normalizeRank,
  normalizeSong,
  normalizeTimestamp,
  toMilliseconds
} from './base'

export function toSongListResponse(response = {}) {
  const data = response.data ?? response
  const songs = extractSongItems(data).map(normalizeSong)

  return {
    ...response,
    result: songs,
    songs,
    data: songs,
    total: response.total ?? data.total ?? data.count ?? songs.length,
    more: Boolean(data.has_next || data.more || response.more)
  }
}

export function toPlaylistListResponse(response = {}) {
  const data = response.data ?? response
  const playlistItems = firstArray(
    data.special_list,
    data.list,
    data.lists,
    data.info,
    data.playlists,
    data
  ).flatMap((item) => {
    const nestedItems = firstArray(item?.special_list, item?.list, item?.lists)

    return nestedItems.length ? nestedItems : item
  })
  const playlists = playlistItems.filter(Boolean).map(normalizePlaylist)

  return {
    ...response,
    result: playlists,
    playlists,
    data: playlists,
    total: data.total ?? data.count ?? data.total_count ?? playlists.length,
    more: Boolean(data.has_next || data.more)
  }
}

export function toBannerResponse(response = {}) {
  const data = response.data ?? response
  const ads = firstArray(
    data.banner,
    data.banners,
    data.banner_list,
    data.bannerList,
    data.ads,
    data.data,
    response.ads,
    data
  )

  return {
    ...response,
    banners: ads.map((banner, index) => ({
      imageUrl: normalizeKugouImage(
        banner.img_url ||
          banner.imgurl ||
          banner.image ||
          banner.pic ||
          banner.code ||
          banner.cover ||
          banner.sizable_cover ||
          banner.banner,
        1200
      ),
      bigImageUrl: normalizeKugouImage(
        banner.img_url ||
          banner.imgurl ||
          banner.big_image ||
          banner.bigImageUrl ||
          banner.image ||
          banner.pic ||
          banner.code ||
          banner.cover ||
          banner.sizable_cover ||
          banner.banner,
        1200
      ),
      typeTitle: banner.title || banner.name || banner.fmname || '酷狗推荐',
      targetType: 0,
      targetId: banner.id ?? banner.fmid ?? banner.fm_id ?? index,
      url: banner.extra?.url || banner.url || ''
    }))
  }
}

export function toToplistResponse(response = {}) {
  const ranks = firstArray(response.data?.info, response.info, response.data).map(normalizeRank)

  return {
    ...response,
    list: ranks
  }
}

export function toPlaylistDetailResponse(response = {}) {
  const data = response.data ?? response
  const detailCandidates = [
    data.list_info,
    data.info,
    data.playlist,
    data.special,
    data.list,
    data.lists,
    data
  ]
  const rawPlaylist =
    detailCandidates.find((item) => item && typeof item === 'object' && !Array.isArray(item)) ??
    detailCandidates.find((item) => Array.isArray(item))?.[0] ??
    {}
  const playlist = normalizePlaylist(
    rawPlaylist,
    0
  )
  const songs = firstArray(
    data.songs,
    data.songinfo,
    data.tracks,
    data.list_info?.songs,
    data.list_info?.songinfo,
    data.list_info?.info,
    playlist.songs,
    playlist.songinfo,
    playlist.tracks
  ).map(normalizeSong)

  return {
    ...response,
    playlist: {
      ...playlist,
      tracks: songs
    },
    songs,
    total: data.total ?? data.count ?? data.songcount ?? playlist.trackCount ?? songs.length
  }
}

export function toPlaylistTracksResponse(response = {}, id) {
  const data = response.data ?? response
  const songs = extractSongItems(data).map(normalizeSong)
  const total = data.total ?? data.count ?? data.songcount ?? response.total ?? songs.length
  const page = Number(data.page ?? response.page ?? 1)
  const pageSize = Number(data.pageSize ?? data.pagesize ?? data.page_size ?? response.pageSize ?? response.pagesize ?? songs.length)

  return {
    ...response,
    playlist: {
      id,
      tracks: songs,
      trackCount: total
    },
    songs,
    total,
    more: Boolean(data.has_next || data.more || (total && pageSize && page * pageSize < total))
  }
}

export function toRankTracksResponse(response = {}, id, metaResponse = {}) {
  const data = response.data ?? response
  const meta = metaResponse.data ?? metaResponse
  const songs = firstArray(data.songlist, data.songs, data.info, data.list, data).map(normalizeSong)
  const rankInfo = firstObject(data.rankinfo, data.rank_info, meta.rankinfo, meta.rank_info, meta, data)
  const total = data.total ?? data.count ?? rankInfo.extra?.resp?.all_total ?? songs.length

  return {
    ...response,
    playlist: {
      id,
      name: data.rankname || rankInfo.rankname || rankInfo.name || '酷狗榜单',
      description: data.intro || rankInfo.intro || '',
      playCount: data.play_times ?? rankInfo.play_times ?? 0,
      updateTime: normalizeTimestamp(data.rank_id_publish_date ?? rankInfo.rank_id_publish_date),
      tags: ['排行榜', rankInfo.update_frequency || data.update_frequency].filter(Boolean),
      rankCid: data.rank_cid ?? rankInfo.rank_cid ?? '',
      zone: data.zone ?? rankInfo.zone ?? '',
      coverImgUrl: normalizeKugouImage(
        data.imgurl ||
          data.img_cover ||
          data.banner_9 ||
          data.album_img_9 ||
          rankInfo.imgurl ||
          rankInfo.img_cover ||
          rankInfo.banner_9 ||
          rankInfo.album_img_9,
        480
      ),
      tracks: songs,
      trackCount: total
    },
    songs,
    total,
    more: Boolean(data.has_next || data.more)
  }
}

export function toArtistListResponse(response = {}) {
  const data = response.data ?? response
  const groups = firstArray(data.info, data.list, data.artists, data)
  const groupList = groups.map((group) => ({
    title: group?.title || '',
    artists: firstArray(group?.singer, group?.artists, group?.list, Array.isArray(group) ? group : [])
      .map(normalizeArtist)
  }))
  const artists = groupList.flatMap((group) => group.artists)

  return {
    ...response,
    artists,
    groups: groupList,
    list: {
      artists
    },
    more: Boolean(data.has_next)
  }
}

export function toArtistDetailResponse(response = {}) {
  const data = response.data ?? response
  const artist = normalizeArtist(firstObject(data.base, data.info, data.author, data), 0)

  return {
    ...response,
    data: {
      ...data,
      artist
    },
    artist
  }
}

export function toArtistSongsResponse(response = {}) {
  const data = response.data ?? response
  const songs = firstArray(data.songs, data.list, data).map(normalizeSong)
  const total = response.total ?? data.total ?? data.count ?? response.extra?.page_total ?? data.extra?.page_total ?? songs.length
  const page = Number(response.params?.page ?? data.page ?? 1)
  const pageSize = Number(response.params?.pageSize ?? response.params?.pagesize ?? data.pageSize ?? data.pagesize ?? songs.length)

  return {
    ...response,
    songs,
    hotSongs: songs,
    total,
    more: Boolean(data.has_next || data.more || (total && pageSize && page * pageSize < total))
  }
}

export function toArtistAlbumsResponse(response = {}) {
  const data = response.data ?? response
  const albums = firstArray(data.albums, data.list, data).map(normalizeAlbum)
  const total = response.total ?? data.total ?? data.count ?? response.extra?.page_total ?? data.extra?.page_total ?? albums.length
  const page = Number(response.params?.page ?? data.page ?? 1)
  const pageSize = Number(response.params?.pageSize ?? response.params?.pagesize ?? data.pageSize ?? data.pagesize ?? albums.length)

  return {
    ...response,
    hotAlbums: albums,
    albums,
    artist: albums[0]?.artist ?? null,
    total,
    more: Boolean(data.has_next || data.more || (total && pageSize && page * pageSize < total))
  }
}

export function toArtistVideosResponse(response = {}) {
  const data = response.data ?? response
  const videos = firstArray(data.videos, data.list, data).map((item, index) => ({
    id: item.id ?? item.video_id ?? item.hash,
    name: item.name || item.title || item.filename || '视频',
    cover: normalizeKugouImage(item.cover || item.imgurl || item.sizable_cover, 640),
    artistName: item.author_name || item.singername || '',
    duration: toMilliseconds(item.duration || item.timelength),
    playCount: item.play_count ?? item.playCount ?? 0,
    rank: index + 1,
    hash: item.hash,
    name: item.video_name || item.name || item.title || item.filename || '视频',
    cover: normalizeKugouImage(item.hdpic || item.cover || item.imgurl || item.sizable_cover, 640),
    playCount: item.play_count ?? item.playCount ?? item.history_heat ?? item.heat ?? 0,
    hash: item.hash || item.mkv_sd_hash || item.audio_hash,
    publishTime: item.publish_date || '',
    desc: item.remark || item.topic || item.intro || ''
  }))
  const total = response.total ?? data.total ?? data.count ?? response.extra?.page_total ?? data.extra?.page_total ?? videos.length
  const page = Number(response.params?.page ?? data.page ?? 1)
  const pageSize = Number(response.params?.pageSize ?? response.params?.pagesize ?? data.pageSize ?? data.pagesize ?? videos.length)
  const cursor = pageSize ? page * pageSize : videos.length

  return {
    ...response,
    data: {
      page: {
        cursor,
        more: Boolean(data.has_next || data.more || (total && pageSize && cursor < total))
      },
      records: videos
    },
    total
  }
}

export function toMvListResponse(response = {}) {
  const data = response.data ?? response
  const items = firstArray(data.videos, data.list, data.mvs, data.info, data)
  const mvs = items
    .flatMap((item) => Array.isArray(item?.videos) ? item.videos : item)
    .map((item, index) => ({
      ...item,
      id: item.id ?? item.video_id ?? item.mvid ?? item.hash,
      name: item.name || item.title || item.filename || '未命名 MV',
      picUrl: normalizeKugouImage(item.cover || item.imgurl || item.pic || item.sizable_cover, 640),
      cover: normalizeKugouImage(item.cover || item.imgurl || item.pic || item.sizable_cover, 640),
      artistName: item.author_name || item.singername || item.artist_name || '',
      playCount: item.play_count ?? item.playCount ?? item.heat ?? 0,
      duration: toMilliseconds(item.duration || item.timelength || item.video_timelength),
      hash: item.hash || item.video_hash || item.mvhash,
      rank: index + 1
    }))

  return {
    ...response,
    result: mvs,
    mvs,
    data: mvs,
    count: data.total ?? data.count ?? mvs.length,
    total: data.total ?? data.count ?? mvs.length
  }
}

export function toAlbumListResponse(response = {}) {
  const data = response.data ?? response
  const albums = getAlbumListItems(data, response.params?.type).map(normalizeAlbum)
  const total = response.total ?? data.total ?? data.count ?? response.extra?.page_total ?? data.extra?.page_total ?? albums.length
  const page = Number(response.params?.page ?? data.page ?? 1)
  const pageSize = Number(response.params?.pageSize ?? response.params?.pagesize ?? data.pageSize ?? data.pagesize ?? albums.length)

  return {
    ...response,
    albums,
    total,
    more: Boolean(data.has_next || data.more || (total && pageSize && page * pageSize < total))
  }
}

export function getAlbumListItems(data = {}, type) {
  const groupedAlbums = getTopAlbumGroupedItems(data, type)

  if (groupedAlbums.length) {
    return groupedAlbums
  }

  return firstArray(
    data.albums,
    data.list,
    data.info,
    data.album_list,
    data.albumList,
    data
  )
}

export function getTopAlbumGroupedItems(data = {}, type) {
  const groupMap = {
    1: 'chn',
    2: 'eur',
    3: 'jpn',
    4: 'kor'
  }
  const groupKey = groupMap[String(type ?? '')]

  if (groupKey) {
    return firstArray(data[groupKey])
  }

  return ['chn', 'eur', 'jpn', 'kor'].flatMap((key) => firstArray(data[key]))
}

export function toAlbumDetailResponse(response = {}) {
  const data = response.data ?? response
  const rawAlbum = firstObject(
    data.info,
    data.album,
    data.album_info,
    firstArray(data.info, data.album, data.album_info, data)[0],
    data
  )
  const album = normalizeAlbum(rawAlbum, 0)
  const songs = firstArray(
    data.songs,
    data.songlist,
    data.song_list,
    data.list,
    data.info?.songs,
    data.info?.songlist,
    data.album?.songs,
    data.album?.songlist
  ).map(normalizeSong)
  const total = data.total ?? data.count ?? album.size ?? songs.length

  return {
    ...response,
    album,
    songs,
    total,
    more: Boolean(data.has_next || data.more)
  }
}

export function toAlbumInfoResponse(response = {}) {
  const data = response.data ?? response
  const albums = firstArray(data.info, data.albums, data.list, data)
    .map((item) => item.album ?? item.album_info ?? item)
    .map(normalizeAlbum)
  const singleAlbum = normalizeAlbum(firstObject(data.info, data.album, data.album_info, data), 0)
  const album = albums.find((item) => item.id) ?? (singleAlbum.id ? singleAlbum : null)

  return {
    ...response,
    album,
    albums
  }
}

export function toCommentResponse(response = {}) {
  const comments = firstArray(response.list, response.comments, response.data?.list).map(normalizeComment)

  return {
    ...response,
    comments,
    hotComments: response.current_page <= 1 ? comments.slice(0, 3) : [],
    total: response.count ?? response.total ?? response.data?.count ?? comments.length,
    more: Boolean(response.maxPage && response.current_page < response.maxPage)
  }
}

export function toCommentCountResponse(response = {}) {
  const data = response.data ?? response
  const keyedCount = Object.values(data).find((value) => Number.isFinite(Number(value)))

  return {
    ...response,
    data: {
      count: data.count ?? data.comment_count ?? response.count ?? keyedCount ?? 0,
      countDesc: ''
    }
  }
}
