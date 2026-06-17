import http from '../http'
import { readStoredKugouAuth, toKugouAuthCookie } from '../../utils/kugouAuth'

/**
 * KuGouMusic API compatibility layer.
 *
 * The rest of the application still imports the original function names so the
 * UI can stay unchanged. Each function below now targets an endpoint documented
 * in KuGouMusic-API.md and translates the app's existing pagination/id params.
 */

function getKugou(path, params = {}, config = {}) {
  const normalizedParams = normalizeParams(path, params)
  const requestParams = withStoredKugouSearchCookie(path, normalizedParams, {
    ...config,
    noCookie: config.noCookie ?? params.noCookie
  })

  return http.get(path, {
    ...config,
    noCookie: config.noCookie ?? params.noCookie,
    params: requestParams
  }).then((payload) => attachKugouParams(parseKugouPayload(payload), requestParams))
}

function getKugouRaw(path, params = {}, config = {}) {
  const normalizedParams = normalizeParams(path, params)
  const requestParams = withStoredKugouSearchCookie(path, normalizedParams, {
    ...config,
    noCookie: config.noCookie ?? params.noCookie
  })

  return http.get(path, {
    ...config,
    noCookie: config.noCookie ?? params.noCookie,
    params: requestParams
  }).then((payload) => attachKugouParams(parseKugouPayload(payload), requestParams))
}

function withStoredKugouSearchCookie(path, params = {}, config = {}) {
  if (config.noCookie || params.cookie || !isSearchPath(path)) {
    return params
  }

  const cookie = toKugouAuthCookie(readStoredKugouAuth())

  return cookie ? { ...params, cookie } : params
}

const songRegistry = new Map()
const lyricRequestRegistry = new Map()

function normalizeParams(path, params) {
  const normalized = { ...params }

  if (normalized.pagesize !== undefined && normalized.pageSize === undefined) {
    normalized.pageSize = normalized.pagesize
  }

  if (normalized.limit !== undefined && normalized.pageSize === undefined) {
    normalized.pageSize = normalized.limit
  }

  if (normalized.offset !== undefined && normalized.page === undefined) {
    const pageSize = Number(normalized.pageSize) || 30
    normalized.page = Math.floor(Number(normalized.offset) / pageSize) + 1
  }

  delete normalized.pagesize
  delete normalized.limit
  delete normalized.offset
  delete normalized.level
  delete normalized.noCookie

  if (normalized.keywords === undefined && normalized.keyword !== undefined) {
    normalized.keywords = normalized.keyword
  }

  if (normalized.id !== undefined) {
    if (path === '/playlist/detail' || path === '/playlist/similar') {
      normalized.ids ??= normalized.id
      delete normalized.id
    } else if (path === '/playlist/track/all/new') {
      normalized.listid ??= normalized.id
      delete normalized.id
    } else if (path === '/song/url' || path === '/song/url/new') {
      const knownSong = getKnownSong(normalized.id)
      normalized.hash = normalized.hash || knownSong?.hash || hashFromId(normalized.id)
      normalized.album_audio_id = normalized.album_audio_id || knownSong?.album_audio_id || knownSong?.mixsongid
      normalized.album_id = normalized.album_id || knownSong?.album_id
      delete normalized.id
    } else if (path === '/search/lyric') {
      const knownSong = getKnownSong(normalized.id)
      normalized.hash = normalized.hash || knownSong?.hash || hashFromId(normalized.id)
      normalized.album_audio_id = normalized.album_audio_id || knownSong?.album_audio_id
      normalized.keywords = normalized.keywords || knownSong?.name || knownSong?.songname
      delete normalized.id
    } else if (path === '/comment/music') {
      normalized.mixsongid ??= normalized.id
      delete normalized.id
    } else if (path === '/comment/count') {
      const knownSong = getKnownSong(normalized.id)
      normalized.hash = normalized.hash || knownSong?.hash || hashFromId(normalized.id)
      delete normalized.id
    } else if (path === '/rank/audio' || path === '/rank/info') {
      normalized.rankid ??= normalized.id
      delete normalized.id
    } else if (path === '/youth/channel/detail' || path === '/youth/channel/song') {
      normalized.global_collection_id ??= normalized.id
      delete normalized.id
    }
  }

  if (normalized.phone !== undefined) {
    normalized.mobile ??= normalized.phone
    delete normalized.phone
  }

  if (normalized.captcha !== undefined) {
    normalized.code ??= normalized.captcha
    delete normalized.captcha
  }

  if (path === '/login/cellphone' || path === '/captcha/sent' || path === '/login') {
    delete normalized.countrycode
  }

  if (path === '/search') {
    normalized.type = normalizeSearchType(normalized.type)
  }

  if (path === '/search/complex') {
    delete normalized.type
  }

  if (isSearchPath(path)) {
    if (normalized.pageSize !== undefined && normalized.pagesize === undefined) {
      normalized.pagesize = normalized.pageSize
    }

    delete normalized.pageSize
  }

  if (path === '/artist/audios' || path === '/artist/albums') {
    normalized.sort = normalized.order === 'time' ? 'new' : normalized.sort || 'hot'
    delete normalized.order
  }

  if (path === '/top/album') {
    normalized.type = normalizeAlbumAreaType(normalized.type ?? normalized.area)

    if (!normalized.type) {
      delete normalized.type
    }

    delete normalized.area
  }

  if (path === '/album') {
    normalized.album_id ??= normalized.id
    delete normalized.id
  }

  if (path === '/artist/videos') {
    if (normalized.size !== undefined && normalized.pageSize === undefined) {
      normalized.pageSize = normalized.size
    }

    if (normalized.cursor !== undefined && normalized.page === undefined) {
      const pageSize = Number(normalized.pageSize) || 30
      normalized.page = Math.floor(Number(normalized.cursor) / pageSize) + 1
    }

    delete normalized.size
    delete normalized.cursor
    delete normalized.order
  }

  if (path === '/personal/fm' && normalized.action === undefined && normalized.mode === 'TRASH') {
    normalized.action = 'garbage'
  }

  return Object.fromEntries(
    Object.entries(normalized).filter(([, value]) => value !== undefined && value !== null && value !== '')
  )
}

function normalizeSearchType(type) {
  const typeMap = {
    1: 'song',
    10: 'album',
    100: 'author',
    1000: 'special',
    1002: 'talent',
    1004: 'mv',
    2000: 'lyric'
  }

  return typeMap[type] || type || 'song'
}

function isSearchPath(path = '') {
  return path === '/search' || path.startsWith('/search/')
}

function normalizeAlbumAreaType(type) {
  const typeMap = {
    ZH: 1,
    EA: 2,
    JP: 3,
    KR: 4,
    1: 1,
    2: 2,
    3: 3,
    4: 4
  }

  return typeMap[String(type ?? '').toUpperCase()] || ''
}

function parseKugouPayload(payload) {
  if (typeof payload !== 'string') {
    return payload
  }

  const match = payload.match(/<!--KG_TAG_RES_START-->([\s\S]*?)<!--KG_TAG_RES_END-->/)
  const json = match?.[1] ?? payload

  try {
    return JSON.parse(json)
  } catch {
    return payload
  }
}

function attachKugouParams(payload, params = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload
  }

  return {
    ...payload,
    params
  }
}

function getKnownSong(id) {
  return songRegistry.get(String(id ?? ''))
}

function hashFromId(id) {
  const value = String(id ?? '').trim()

  return value && !/^\d+$/.test(value) ? value : ''
}

function rememberSong(song) {
  if (!song?.id) {
    return song
  }

  songRegistry.set(String(song.id), {
    id: song.id,
    name: song.name,
    songname: song.songname,
    hash: song.hash,
    album_audio_id: song.album_audio_id,
    mixsongid: song.mixsongid,
    album_id: song.album_id,
    audio_id: song.audio_id
  })

  return song
}

function firstArray(...values) {
  return values.find((value) => Array.isArray(value)) ?? []
}

function firstObject(...values) {
  return values.find((value) => value && typeof value === 'object' && !Array.isArray(value)) ?? {}
}

function firstNonEmptyArray(...values) {
  return values.find((value) => Array.isArray(value) && value.length) ?? []
}

function toMilliseconds(value) {
  const number = Number(value)

  if (!Number.isFinite(number) || number <= 0) {
    return 0
  }

  return number > 10000 ? number : number * 1000
}

function normalizeKugouImage(url, size = 480) {
  if (typeof url !== 'string') {
    return ''
  }

  const value = url.trim()

  if (!value) {
    return ''
  }

  if (/^\/\//.test(value)) {
    return `https:${value}`.replace('{size}', String(size))
  }

  if (/^https?:\/\//i.test(value)) {
    return value.replace('{size}', String(size))
  }

  if (/^[\w.-]+\.(?:jpe?g|png|webp|gif)$/i.test(value)) {
    const datePath = value.match(/^(\d{8})/)?.[1]

    return `https://imge.kugou.com/stdmusic/${size}/${datePath ? `${datePath}/` : ''}${value}`
  }

  return value.replace('{size}', String(size))
}

function splitFilename(value = '') {
  const [artist, ...nameParts] = cleanKugouText(value).split(' - ')

  if (!nameParts.length) {
    return { artist: '', name: cleanKugouText(value) }
  }

  return {
    artist: artist.trim(),
    name: nameParts.join(' - ').trim()
  }
}

function mergeSongFields(song = {}) {
  if (!song || typeof song !== 'object' || Array.isArray(song)) {
    return song
  }

  const merged = { ...song }
  const sources = [
    song.resource,
    song.song,
    song.audio,
    song.base,
    song.audio_info,
    song.audioInfo,
    song.song_info,
    song.songInfo
  ]

  sources.forEach((source) => fillMissingSongFields(merged, source))

  return merged
}

function fillMissingSongFields(target, source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return
  }

  Object.entries(source).forEach(([key, value]) => {
    if (isPresentValue(value) && !isPresentValue(target[key])) {
      target[key] = value
    }
  })
}

function isPresentValue(value) {
  return value !== undefined && value !== null && value !== ''
}

function pickField(source = {}, keys = []) {
  for (const key of keys) {
    const value = source?.[key]

    if (isPresentValue(value)) {
      return value
    }
  }

  return undefined
}

function cleanKugouText(value = '') {
  return String(value ?? '')
    .replace(/<\/?em>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim()
}

function normalizeArtistName(song = {}) {
  const source = mergeSongFields(song)
  const authors = firstArray(source.authors, source.singerinfo)

  return (
    source.author_name ||
    source.singername ||
    source.artist_name ||
    source.author ||
    source.singer ||
    authors.map((artist) => artist.author_name || artist.name).filter(Boolean).join(' / ') ||
    splitFilename(source.filename || source.name || source.songname || source.audio_name).artist ||
    '未知歌手'
  )
}

function normalizeSongName(song = {}) {
  const source = mergeSongFields(song)
  const title = source.filename || source.audio_name || source.songname || source.name || source.remark || source.title
  const file = splitFilename(title)
  const plainName = source.name && !splitFilename(source.name).artist ? source.name : ''

  return plainName || file.name || source.audio_name || source.songname || source.name || source.remark || source.title || '未知歌曲'
}

function normalizeSong(song = {}, index = 0) {
  const source = mergeSongFields(song)
  const artistName = normalizeArtistName(source)
  const artistId = source.author_id ?? source.authors?.[0]?.author_id ?? source.authors?.[0]?.id ?? source.singerinfo?.[0]?.id ?? ''
  const albumId = source.album_id ?? source.albuminfo?.id ?? source.album_info?.album_id ?? source.album_info?.id ?? ''
  const albumName = source.album_name ?? source.albuminfo?.name ?? source.album_info?.album_name ?? source.album_info?.name ?? source.remark ?? ''
  const cover = normalizeKugouImage(
    source.cover ||
      source.sizable_cover ||
      source.album_sizable_cover ||
      source.album_info?.sizable_cover ||
      source.album_info?.album_cover ||
      source.album_info?.cover ||
      source.album_info?.picUrl ||
      source.imgurl ||
      source.pic ||
      source.picUrl ||
      source.image ||
      source.album_cover ||
      source.trans_param?.union_cover,
    480
  )
  const id = source.album_audio_id ?? source.mixsongid ?? source.add_mixsongid ?? source.audio_id ?? source.id ?? source.hash
  const duration = toMilliseconds(
    source.timelength ??
      source.timelen ??
      source.duration ??
      source.duration_128 ??
      source.duration_320 ??
      source.duration_high ??
      source.audio_info?.duration_128 ??
      source.audio_info?.duration_320 ??
      source.audio_info?.duration_high ??
      source.deprecated?.duration ??
      source.video_timelength
  )
  const mvId =
    source.video_id ||
    source.video_info?.video_id ||
    source.mv_id ||
    source.mvid ||
    source.mvhash ||
    source.video_hash ||
    source.video_info?.video_hash ||
    source.mv_hash ||
    ''
  const normalized = {
    ...source,
    id,
    name: normalizeSongName(source),
    songname: source.songname ?? normalizeSongName(source),
    hash:
      source.hash ??
      source.file_hash ??
      source.audio_hash ??
      source.hash_128 ??
      source['128hash'] ??
      source.audio_info?.hash_128 ??
      source.audio_info?.hash_320 ??
      source.deprecated?.hash ??
      '',
    album_audio_id: source.album_audio_id ?? source.mixsongid ?? source.add_mixsongid ?? id,
    mixsongid: source.mixsongid ?? source.add_mixsongid ?? source.album_audio_id ?? id,
    audio_id: source.audio_id ?? source.rp_id ?? '',
    album_id: albumId,
    duration,
    dt: duration,
    mv: mvId,
    fee: source.pay_type || source.feetype || 0,
    ar: [{
      id: artistId,
      name: artistName
    }],
    artists: [{
      id: artistId,
      name: artistName
    }],
    al: {
      id: albumId,
      name: albumName || '未知专辑',
      picUrl: cover
    },
    album: {
      id: albumId,
      name: albumName || '未知专辑',
      picUrl: cover,
      blurPicUrl: cover
    },
    picUrl: cover,
    rank: index + 1
  }

  return rememberSong(normalized)
}

function normalizePlaylist(playlist = {}, index = 0) {
  const globalCollectionId =
    playlist.global_collection_id ??
    playlist.globalCollectionId ??
    playlist.global_collectionid ??
    playlist.collection_id ??
    playlist.collectionid ??
    playlist.gid ??
    playlist.list_create_gid ??
    playlist.list_create_gid_v2 ??
    ''
  const listId = playlist.listid ?? playlist.list_id ?? playlist.listId ?? playlist.list_create_listid ?? ''
  const specialId = playlist.specialid ?? playlist.special_id ?? ''
  const id = globalCollectionId || playlist.id || specialId || listId
  const cover = normalizeKugouImage(
    playlist.imgurl ||
      playlist.flexible_cover ||
      playlist.pic ||
      playlist.picUrl ||
      playlist.coverImgUrl ||
      playlist.coverUrl ||
      playlist.cover ||
      playlist.sizable_cover ||
      playlist.cover_img ||
      playlist.image,
    480
  )
  const objectTags = firstNonEmptyArray(playlist.tags, playlist.tag_list, playlist.special_tag)
    .map((tag) => tag.tag_name || tag.name || tag.title || tag)
    .filter(Boolean)
  const stringTags = String(playlist.tags || playlist.tag_names || '').split(',').filter(Boolean)

  return {
    ...playlist,
    id,
    globalCollectionId,
    listid: listId,
    listId,
    specialId,
    name: playlist.specialname || playlist.name || playlist.title || playlist.listname || '未命名歌单',
    description: playlist.intro || playlist.desc || playlist.description || playlist.copywriter || '',
    copywriter: playlist.show || playlist.recommend_reason || playlist.copywriter || '',
    picUrl: cover,
    coverImgUrl: cover,
    playCount:
      playlist.play_count ??
      playlist.playcount ??
      playlist.playCount ??
      playlist.play_cnt ??
      playlist.listen_count ??
      playlist.heat ??
      0,
    trackCount:
      playlist.songcount ??
      playlist.song_count ??
      playlist.count ??
      playlist.total ??
      playlist.trackCount ??
      playlist.track_count ??
      playlist.audio_count ??
      0,
    subscribedCount: playlist.collectcount ?? playlist.collect_total ?? playlist.subscribedCount ?? 0,
    commentCount: playlist.commentcount ?? playlist.comment_count ?? playlist.commentCount ?? 0,
    shareCount: playlist.sharecount ?? playlist.share_count ?? playlist.shareCount ?? 0,
    updateTime: normalizeTimestamp(playlist.update_time ?? playlist.updateTime),
    createTime: normalizeTimestamp(playlist.create_time ?? playlist.createTime),
    tags: objectTags.length ? objectTags : stringTags,
    creator: {
      userId: playlist.userid ?? playlist.user_id ?? playlist.list_create_userid ?? '',
      nickname:
        playlist.nickname ||
        playlist.username ||
        playlist.list_create_username ||
        (typeof playlist.creator === 'string' ? playlist.creator : playlist.creator?.nickname) ||
        '酷狗音乐用户',
      avatarUrl: normalizeKugouImage(
        playlist.user_avatar ||
          playlist.create_user_pic ||
          playlist.avatar ||
          playlist.creator?.avatarUrl ||
          playlist.creatorAvatarUrl ||
          playlist.pic,
        120
      )
    },
    rank: index + 1,
    tracks: firstArray(playlist.songs, playlist.songinfo, playlist.tracks).map(normalizeSong)
  }
}

function normalizeTimestamp(value) {
  const number = Number(value)

  if (!Number.isFinite(number) || number <= 0) {
    return value
  }

  return number < 10000000000 ? number * 1000 : number
}

function normalizeRank(rank = {}, index = 0) {
  const cover = normalizeKugouImage(rank.imgurl || rank.img_cover || rank.banner_9 || rank.album_img_9, 480)

  return {
    ...rank,
    id: rank.rankid ?? rank.id,
    name: rank.rankname || rank.name || '酷狗榜单',
    description: rank.intro || '',
    updateFrequency: rank.update_frequency || rank.updateFrequency || '',
    coverImgUrl: cover,
    playCount: rank.play_times ?? 0,
    trackCount: rank.extra?.resp?.all_total ?? rank.songinfo?.length ?? 0,
    tracks: firstArray(rank.songinfo).map((song, songIndex) => ({
      first: normalizeSongName(song),
      second: song.author || normalizeArtistName(song),
      ...normalizeSong(song, songIndex)
    })),
    rank: index + 1
  }
}

function normalizeArtist(artist = {}, index = 0) {
  const base = artist.base ?? artist
  const id = base.author_id ?? base.id ?? base.singerid ?? base.userid
  const cover = normalizeKugouImage(base.avatar || base.sizable_avatar || base.imgurl || base.pic || base.picUrl, 360)
  const intro = base.intro || base.briefDesc || base.descibe || base.desc || base.description || ''
  const musicSize = base.audio_count ?? base.song_count ?? base.songcount ?? base.musicSize ?? 0
  const albumSize = base.album_count ?? base.albumcount ?? base.albumSize ?? 0
  const mvSize = base.video_count ?? base.mv_count ?? base.mvcount ?? base.mvSize ?? 0

  return {
    ...base,
    id,
    name: base.author_name || base.singername || base.name || '未知歌手',
    picUrl: cover,
    img1v1Url: cover,
    cover,
    avatar: cover,
    briefDesc: intro,
    longIntro: firstArray(base.long_intro, base.longIntro),
    birthday: base.birthday || '',
    musicSize,
    albumSize,
    mvSize,
    videoCount: mvSize,
    fansCount: base.fans_count ?? base.fansnums ?? base.fanscount ?? base.fansCount ?? 0,
    score: base.heat ?? base.score ?? 0,
    rank: index + 1
  }
}

function normalizeAlbum(album = {}, index = 0) {
  const id = album.album_id ?? album.albumid ?? album.id
  const cover = normalizeKugouImage(
    album.sizable_cover ||
      album.cover_url ||
      album.coverUrl ||
      album.picUrl ||
      album.imgurl ||
      album.image ||
      album.album_cover ||
      album.cover ||
      album.pic,
    480
  )
  const authors = firstNonEmptyArray(album.authors, album.singerinfo, album.artists)
  const artistName =
    album.author_name ||
    album.singername ||
    album.artist_name ||
    album.artistname ||
    album.artist?.name ||
    authors.map((artist) => artist.author_name || artist.name).filter(Boolean).join(' / ') ||
    '未知歌手'
  const artistId =
    album.author_id ??
    album.singerid ??
    album.artist_id ??
    album.artist?.id ??
    authors[0]?.author_id ??
    authors[0]?.id ??
    ''

  return {
    ...album,
    id,
    name: album.album_name || album.albumname || album.name || '未知专辑',
    picUrl: cover,
    blurPicUrl: cover,
    publishTime: normalizeTimestamp(album.publish_time || album.publish_date || album.publishTime || album.publishtime),
    company: album.publish_company || album.company || '',
    description: album.intro || album.description || '',
    size: album.audio_count ?? album.song_count ?? album.songcount ?? album.size ?? album.count ?? 0,
    type: album.category || album.type || album.language || '',
    playCount: album.play_count ?? album.playCount ?? album.heat ?? 0,
    artists: [{
      id: artistId,
      name: artistName
    }],
    artist: {
      id: artistId,
      name: artistName
    },
    rank: index + 1
  }
}

function normalizeComment(comment = {}) {
  return {
    commentId: comment.id ?? comment.commentId,
    content: comment.content || '',
    time: normalizeTimestamp(comment.addtime || comment.time),
    likedCount: comment.like?.count ?? comment.like?.likenum ?? comment.likedCount ?? 0,
    user: {
      userId: comment.user_id,
      nickname: comment.user_name || '匿名用户',
      avatarUrl: normalizeKugouImage(comment.user_pic, 120)
    }
  }
}

function extractSongItems(source = {}) {
  const data = source.data ?? source
  const items = firstArray(
    data.songs,
    data.list,
    data.info,
    data.recommend,
    data.resources,
    data.song_list,
    data.lists,
    data
  )

  return items.map(mergeSongFields)
}

function toSongListResponse(response = {}) {
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

function toPlaylistListResponse(response = {}) {
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

function toBannerResponse(response = {}) {
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

function toToplistResponse(response = {}) {
  const ranks = firstArray(response.data?.info, response.info, response.data).map(normalizeRank)

  return {
    ...response,
    list: ranks
  }
}

function toPlaylistDetailResponse(response = {}) {
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

function toPlaylistTracksResponse(response = {}, id) {
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

function toRankTracksResponse(response = {}, id, metaResponse = {}) {
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

function toArtistListResponse(response = {}) {
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

function toArtistDetailResponse(response = {}) {
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

function toArtistSongsResponse(response = {}) {
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

function toArtistAlbumsResponse(response = {}) {
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

function toArtistVideosResponse(response = {}) {
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

function toMvListResponse(response = {}) {
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

function toAlbumListResponse(response = {}) {
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

function getAlbumListItems(data = {}, type) {
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

function getTopAlbumGroupedItems(data = {}, type) {
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

function toAlbumDetailResponse(response = {}) {
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

function toAlbumInfoResponse(response = {}) {
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

function toCommentResponse(response = {}) {
  const comments = firstArray(response.list, response.comments, response.data?.list).map(normalizeComment)

  return {
    ...response,
    comments,
    hotComments: response.current_page <= 1 ? comments.slice(0, 3) : [],
    total: response.count ?? response.total ?? response.data?.count ?? comments.length,
    more: Boolean(response.maxPage && response.current_page < response.maxPage)
  }
}

function toCommentCountResponse(response = {}) {
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

function toHotSearchResponse(response = {}) {
  const groups = firstArray(response.data?.info, response.data?.list, response.data, response.list)
  const items = groups.flatMap(getHotSearchItems)

  return {
    ...response,
    data: items.map((item, index) => ({
      searchWord:
        item.keyword ||
        item.reason ||
        item.searchWord ||
        item.HintInfo ||
        item.name ||
        item.title ||
        `hot-${index}`,
      score: item.score ?? item.Hot ?? item.hot ?? 0,
      content: item.content || item.reason || item.desc || ''
    }))
  }
}

function getHotSearchItems(item) {
  const nestedItems = firstArray(item?.keywords, item?.list, item?.items)

  if (nestedItems.length) {
    return nestedItems
  }

  return item && typeof item === 'object' && !Array.isArray(item) ? [item] : []
}

function toSuggestResponse(response = {}) {
  const groups = firstArray(response.data, response.list)
  const suggestions = groups.flatMap((group) => firstArray(group.RecordDatas, group.records, group.list))
  const singerShortcut = firstObject(response.SingerShortcut, response.data?.SingerShortcut)
  const artistSuggestion = singerShortcut?.id ? normalizeArtist(singerShortcut) : null

  return {
    ...response,
    data: {
      suggests: suggestions.map((item) => ({
        keyword: item.HintInfo || item.keyword || item.name,
        showText: item.HintInfo || item.keyword || item.name,
        resourceName: item.LableName || item.subtitle || '相关搜索'
      }))
    },
    result: {
      songs: [],
      artists: artistSuggestion ? [artistSuggestion] : [],
      albums: [],
      playlists: []
    }
  }
}

function toSearchResponse(response = {}, type = 1) {
  const data = response.data ?? response
  const lists = firstArray(data.lists)
  const groupedLists = lists.filter(isSearchGroup)
  const flatLists = groupedLists.length ? [] : lists
  const byType = new Map(groupedLists.map((item) => [item.type, item]))
  const normalizedType = normalizeSearchType(type)
  const songItems = firstArray(
    data.songs,
    data.info,
    byType.get('song')?.lists,
    data.list,
    normalizedType === 'song' ? flatLists : undefined
  )
  const albumItems = firstArray(
    byType.get('album')?.lists,
    data.albums,
    normalizedType === 'album' ? flatLists : undefined
  )
  const artistItems = firstArray(
    byType.get('author')?.lists,
    data.artists,
    normalizedType === 'author' ? flatLists : undefined
  )
  const playlistItems = firstArray(
    byType.get('collect')?.lists,
    byType.get('special')?.lists,
    data.playlists,
    normalizedType === 'special' ? flatLists : undefined
  )
  const mvItems = firstArray(
    byType.get('mv')?.lists,
    data.mvs,
    normalizedType === 'mv' ? flatLists : undefined
  )
  const userItems = firstArray(
    byType.get('talent')?.lists,
    byType.get('user')?.lists,
    data.userprofiles,
    data.users,
    normalizedType === 'talent' ? flatLists : undefined
  )

  return {
    ...response,
    result: {
      songs: songItems.map(normalizeSearchSong),
      songCount: getSearchResultTotal(data, byType.get('song'), songItems, normalizedType === 'song'),
      albums: albumItems.map(normalizeAlbum),
      albumCount: getSearchResultTotal(data, byType.get('album'), albumItems, normalizedType === 'album'),
      artists: artistItems.map(normalizeSearchArtist),
      artistCount: getSearchResultTotal(data, byType.get('author'), artistItems, normalizedType === 'author'),
      playlists: playlistItems.map(normalizePlaylist),
      playlistCount: getSearchResultTotal(
        data,
        byType.get('collect') ?? byType.get('special'),
        playlistItems,
        normalizedType === 'special'
      ),
      userprofiles: userItems.map(normalizeSearchUser),
      userprofileCount: getSearchResultTotal(
        data,
        byType.get('talent') ?? byType.get('user'),
        userItems,
        normalizedType === 'talent'
      ),
      mvs: mvItems.map(normalizeSearchMv),
      mvCount: getSearchResultTotal(data, byType.get('mv'), mvItems, normalizedType === 'mv'),
      hasMore: Boolean(data.has_next || data.more)
    },
    type
  }
}

function emptySearchResponse(type = 1) {
  return toSearchResponse({ data: { lists: [] } }, type)
}

function isSearchGroup(item) {
  return item && typeof item === 'object' && !Array.isArray(item) && typeof item.type === 'string' && Array.isArray(item.lists)
}

function getSearchResultTotal(data = {}, group = {}, items = [], isActiveType = false) {
  if (group?.total !== undefined) {
    return group.total
  }

  if (isActiveType) {
    return data.total ?? data.count ?? data.page_total ?? data.extra?.page_total ?? items.length
  }

  return items.length
}

function normalizeSearchSong(song = {}, index = 0) {
  const filename = cleanKugouText(pickField(song, ['FileName', 'filename', 'fileName']))
  const fileParts = splitFilename(filename)
  const songName = cleanKugouText(pickField(song, ['SongName', 'songname', 'song_name', 'Name', 'name', 'AudioName', 'audio_name'])) || fileParts.name
  const artistName = cleanKugouText(pickField(song, ['SingerName', 'singername', 'singer_name', 'AuthorName', 'author_name', 'ArtistName', 'artist_name'])) || fileParts.artist
  const albumName = cleanKugouText(pickField(song, ['AlbumName', 'album_name', 'albumname', 'Remark', 'remark']))
  const cover = normalizeKugouImage(
    pickField(song, [
      'Image',
      'Img',
      'ImgUrl',
      'imgurl',
      'pic',
      'Pic',
      'picUrl',
      'cover',
      'Cover',
      'sizable_cover',
      'album_sizable_cover'
    ]) || song.trans_param?.union_cover,
    480
  )
  const normalized = {
    ...song,
    id: pickField(song, ['AlbumAudioID', 'AlbumAudioId', 'album_audio_id', 'MixSongID', 'mixsongid', 'AudioID', 'audio_id', 'ID', 'id', 'FileHash', 'Hash', 'hash']),
    name: songName,
    songname: songName,
    hash: pickField(song, ['FileHash', 'Hash', 'hash', 'HQFileHash', 'SQFileHash', 'ResFileHash', 'file_hash', 'audio_hash']),
    album_audio_id: pickField(song, ['AlbumAudioID', 'AlbumAudioId', 'album_audio_id', 'MixSongID', 'mixsongid']),
    mixsongid: pickField(song, ['MixSongID', 'mixsongid', 'AlbumAudioID', 'album_audio_id']),
    audio_id: pickField(song, ['AudioID', 'AudioId', 'audio_id']),
    album_id: pickField(song, ['AlbumID', 'AlbumId', 'album_id', 'albumid']),
    duration: toMilliseconds(pickField(song, ['Duration', 'duration', 'TimeLength', 'timelength', 'FileTime', 'FileDuration'])),
    dt: toMilliseconds(pickField(song, ['Duration', 'duration', 'TimeLength', 'timelength', 'FileTime', 'FileDuration'])),
    mv: pickField(song, ['MvID', 'MVID', 'mv_id', 'mvid', 'VideoID', 'video_id', 'MvHash', 'MVHash', 'mvhash']),
    ar: [{
      id: pickField(song, ['SingerId', 'SingerID', 'singerid', 'AuthorID', 'author_id']),
      name: artistName || '鏈煡姝屾墜'
    }],
    artists: [{
      id: pickField(song, ['SingerId', 'SingerID', 'singerid', 'AuthorID', 'author_id']),
      name: artistName || '鏈煡姝屾墜'
    }],
    al: {
      id: pickField(song, ['AlbumID', 'AlbumId', 'album_id', 'albumid']),
      name: albumName || '鏈煡涓撹緫',
      picUrl: cover
    },
    album: {
      id: pickField(song, ['AlbumID', 'AlbumId', 'album_id', 'albumid']),
      name: albumName || '鏈煡涓撹緫',
      picUrl: cover,
      blurPicUrl: cover
    },
    picUrl: cover,
    rank: index + 1
  }

  return rememberSong(normalized)
}

function normalizeSearchArtist(artist = {}, index = 0) {
  return normalizeArtist({
    ...artist,
    id: pickField(artist, ['AuthorID', 'AuthorId', 'author_id', 'id', 'SingerID', 'singerid', 'userid']),
    author_id: pickField(artist, ['AuthorID', 'AuthorId', 'author_id', 'id', 'SingerID', 'singerid', 'userid']),
    author_name: cleanKugouText(pickField(artist, ['AuthorName', 'author_name', 'name', 'Name', 'SingerName', 'singername'])),
    avatar: pickField(artist, ['Image', 'Avatar', 'avatar', 'imgurl', 'pic', 'sizable_avatar']),
    audio_count: pickField(artist, ['AudioCount', 'audio_count', 'song_count', 'songcount', 'musicSize']),
    album_count: pickField(artist, ['AlbumCount', 'album_count', 'albumcount', 'albumSize']),
    video_count: pickField(artist, ['VideoCount', 'video_count', 'mv_count', 'mvcount', 'mvSize'])
  }, index)
}

function normalizeSearchUser(user = {}, index = 0) {
  const id = pickField(user, ['userid', 'user_id', 'UserID', 'uid', 'id'])
  const nickname = cleanKugouText(pickField(user, ['nickname', 'nick_name', 'NickName', 'username', 'user_name', 'name', 'Name']))
  const avatarUrl = normalizeKugouImage(pickField(user, ['avatar', 'Avatar', 'avatarUrl', 'user_pic', 'pic', 'Image', 'imgurl']), 240)

  return {
    ...user,
    userId: id,
    id,
    nickname: nickname || '閰风嫍鐢ㄦ埛',
    name: nickname || '閰风嫍鐢ㄦ埛',
    avatarUrl,
    signature: cleanKugouText(pickField(user, ['signature', 'Signature', 'intro', 'desc'])) || '',
    followeds: pickField(user, ['fans_count', 'fansCount', 'FansCount', 'followeds']) ?? 0,
    rank: index + 1
  }
}

function normalizeSearchMv(mv = {}, index = 0) {
  {
    const filename = splitFilename(pickField(mv, ['FileName', 'filename', 'fileName', 'name', 'Name']))
    const cover = normalizeKugouImage(
      pickField(mv, [
        'cover',
        'Cover',
        'pic',
        'Pic',
        'picUrl',
        'imgurl',
        'ImgUrl',
        'Image',
        'sizable_cover',
        'SizableCover',
        'video_cover',
        'VideoCover',
        'hdpic',
        'HDPic'
      ]),
      640
    )

    return {
      ...mv,
      id: pickField(mv, ['id', 'ID', 'video_id', 'VideoID', 'VideoId', 'mvid', 'MVID', 'mv_id', 'MvID', 'hash', 'Hash', 'video_hash']),
      name: cleanKugouText(pickField(mv, ['name', 'Name', 'video_name', 'VideoName', 'title', 'Title'])) || filename.name || '鏈懡鍚?MV',
      artistName:
        cleanKugouText(pickField(mv, ['artistName', 'author_name', 'AuthorName', 'singername', 'SingerName', 'artist_name'])) ||
        filename.artist,
      cover,
      picUrl: cover,
      imgurl: cover,
      playCount: pickField(mv, ['playCount', 'play_count', 'PlayCount', 'history_heat', 'heat', 'Heat']) ?? 0,
      duration: toMilliseconds(pickField(mv, ['duration', 'Duration', 'timelength', 'TimeLength', 'video_timelength', 'VideoTimeLength'])),
      rank: index + 1
    }
  }

  const cover = normalizeKugouImage(
    mv.cover ||
      mv.pic ||
      mv.picUrl ||
      mv.imgurl ||
      mv.sizable_cover ||
      mv.video_cover ||
      mv.hdpic,
    640
  )

  return {
    ...mv,
    id: mv.id ?? mv.video_id ?? mv.mvid ?? mv.mv_id ?? mv.hash ?? mv.video_hash,
    name: mv.name || mv.video_name || mv.title || mv.filename || '鏈懡鍚?MV',
    artistName: mv.artistName || mv.author_name || mv.singername || mv.artist_name || '',
    cover,
    picUrl: cover,
    imgurl: cover,
    playCount: mv.playCount ?? mv.play_count ?? mv.history_heat ?? mv.heat ?? 0,
    duration: toMilliseconds(mv.duration ?? mv.timelength ?? mv.video_timelength),
    rank: index + 1
  }
}

function toSongUrlResponse(response = {}) {
  const data = response.data ?? response
  const entries = Array.isArray(data) ? data : [data]
  const url = entries
    .flatMap((entry) => collectAudioUrlCandidates(entry))
    .map(normalizeAudioUrl)
    .find(Boolean) || ''

  return {
    ...response,
    data: url ? [{ url }] : []
  }
}

function collectAudioUrlCandidates(source, depth = 0) {
  if (!source || depth > 4) {
    return []
  }

  if (typeof source === 'string') {
    return [source]
  }

  if (Array.isArray(source)) {
    return source.flatMap((item) => collectAudioUrlCandidates(item, depth + 1))
  }

  if (typeof source !== 'object') {
    return []
  }

  const directKeys = [
    'url',
    'play_url',
    'playUrl',
    'backup_url',
    'backupUrl',
    'download_url',
    'downloadUrl',
    'audio_url',
    'audioUrl'
  ]
  const nestedKeys = ['data', 'urls', 'url_info', 'urlInfo']

  return [
    ...directKeys.flatMap((key) => collectAudioUrlCandidates(source[key], depth + 1)),
    ...nestedKeys.flatMap((key) => collectAudioUrlCandidates(source[key], depth + 1))
  ]
}

function normalizeAudioUrl(url = '') {
  if (typeof url !== 'string') {
    return ''
  }

  if (url.startsWith('//')) {
    return `https:${url}`
  }

  return url
}

function decodeBase64Utf8(value = '') {
  if (typeof value !== 'string' || !value) {
    return ''
  }

  try {
    const binary = atob(value)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))

    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    return value
  }
}

function toLoginProfileResponse(response = {}) {
  const data = response.data ?? response
  const user = firstObject(data.user, data.profile, data)
  const userId = user.userid ?? user.user_id ?? user.id ?? data.userid ?? data.user_id ?? response.userid ?? ''
  const nickname = user.nickname ?? user.username ?? user.user_name ?? data.nickname ?? '酷狗用户'
  const avatarUrl = normalizeKugouImage(
    user.pic || user.avatar || user.avatarUrl || user.user_pic || data.pic,
    240
  )
  const token = data.token ?? user.token ?? response.token ?? ''
  const dfid = data.dfid ?? user.dfid ?? response.dfid ?? ''
  const cookie = response.cookie || [
    token ? `token=${token}` : '',
    userId ? `userid=${userId}` : '',
    dfid ? `dfid=${dfid}` : ''
  ].filter(Boolean).join(';')

  return {
    ...response,
    cookie,
    account: userId ? {
      id: userId,
      userName: nickname
    } : null,
    profile: userId ? {
      userId,
      nickname,
      avatarUrl
    } : null,
    data: {
      ...data,
      account: userId ? {
        id: userId,
        userName: nickname
      } : null,
      profile: userId ? {
        userId,
        nickname,
        avatarUrl
      } : null
    }
  }
}

function toQrKeyResponse(response = {}) {
  const data = response.data ?? response

  return {
    ...response,
    data: {
      ...data,
      unikey: data.key || data.qrcode || data.uuid || data.unikey || ''
    }
  }
}

function toQrCreateResponse(response = {}) {
  const data = response.data ?? response

  return {
    ...response,
    data: {
      ...data,
      qrimg: data.qrcode_img || data.qrimg || data.base64 || ''
    }
  }
}

function toQrCheckResponse(response = {}) {
  const data = response.data ?? {}
  const rawCode = Number(
    data.status ??
      data.code ??
      response.status ??
      (data.token || response.token ? 4 : response.code) ??
      0
  )
  const codeMap = {
    0: 800,
    1: 801,
    2: 802,
    4: 803
  }

  return {
    ...toLoginProfileResponse(response),
    code: codeMap[rawCode] ?? rawCode,
    message: response.message || response.msg || response.errmsg || ''
  }
}

async function toLyricResponse(params = {}) {
  const knownSong = getKnownSong(params.id)
  const searchParams = createLyricSearchParams(params, knownSong)
  const requestKey = getLyricRequestKey(searchParams)
  const pendingRequest = lyricRequestRegistry.get(requestKey)

  if (pendingRequest) {
    return pendingRequest
  }

  const request = loadLyricResponse(searchParams).finally(() => {
    lyricRequestRegistry.delete(requestKey)
  })
  lyricRequestRegistry.set(requestKey, request)

  return request
}

async function loadLyricResponse(searchParams = {}) {
  if (!searchParams.hash && !searchParams.keywords) {
    return createEmptyLyricResponse()
  }

  const lyricSearch = await getKugouRaw('/search/lyric', searchParams).catch(() => ({}))
  const candidate = getLyricCandidate(lyricSearch)

  const lyricId = candidate?.id ?? candidate?.lyricid ?? candidate?.lyric_id ?? candidate?.download_id
  const accessKey = candidate?.accesskey ?? candidate?.access_key ?? candidate?.accessKey

  if (!lyricId || !accessKey) {
    return createEmptyLyricResponse(lyricSearch)
  }

  const lyricResponse = await getKugouRaw('/lyric', {
    id: lyricId,
    accesskey: accessKey,
    fmt: 'krc',
    decode: true
  }).catch(() => ({}))
  const lyricData = lyricResponse.data ?? lyricResponse
  const lyricContent =
    lyricData.decodeContent ||
    lyricData.decode_content ||
    lyricData.krc ||
    lyricData.lrc ||
    lyricData.lyric ||
    decodeBase64Utf8(lyricData.content) ||
    ''

  return {
    ...lyricResponse,
    krc: {
      lyric: lyricContent
    },
    lrc: {
      lyric: lyricContent
    },
    tlyric: {
      lyric: ''
    }
  }
}

function createLyricSearchParams(params = {}, knownSong = {}) {
  const hash = String(params.hash ?? knownSong?.hash ?? '').trim()
  const keywords = String(params.keywords ?? params.keyword ?? knownSong?.songname ?? knownSong?.name ?? '').trim()
  const albumAudioId = params.album_audio_id ?? params.mixsongid ?? knownSong?.album_audio_id ?? knownSong?.mixsongid
  const duration = params.duration ?? knownSong?.duration
  const searchParams = {
    album_audio_id: albumAudioId,
    duration,
    man: params.man ?? 'no'
  }

  if (hash) {
    searchParams.hash = hash
  } else {
    searchParams.keywords = keywords
  }

  return searchParams
}

function createEmptyLyricResponse(response = {}) {
  const base = response && typeof response === 'object' && !Array.isArray(response) ? response : {}

  return {
    ...base,
    lrc: {
      lyric: ''
    },
    tlyric: {
      lyric: ''
    }
  }
}

function getLyricRequestKey(params = {}) {
  const hash = params.hash || ''
  const albumAudioId = params.album_audio_id || params.mixsongid || ''
  const id = hash || albumAudioId ? '' : params.id || ''
  const keywords = normalizeLyricKeyword(params.keywords || params.keyword || '')

  return [hash, albumAudioId, id, keywords, params.duration || '', params.man || 'no'].join('|')
}

function normalizeLyricKeyword(value = '') {
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase()
}

function getLyricCandidate(lyricSearch = {}) {
  return firstNonEmptyArray(
    lyricSearch.candidates,
    lyricSearch.data?.candidates,
    lyricSearch.data?.info,
    lyricSearch.data?.list,
    lyricSearch.data?.ugcandidates,
    lyricSearch.data?.ai_candidates,
    lyricSearch.info,
    lyricSearch.list,
    lyricSearch.ugcandidates,
    lyricSearch.ai_candidates
  )[0]
}

// Discovery and recommendations
export const getPersonalizedPlaylists = (params = {}) =>
  getKugou('/top/playlist', { category_id: 0, ...params }).then(toPlaylistListResponse)
export const getBanners = (params = {}) => getKugou('/pc/diantai', params).then(toBannerResponse)
export const getPersonalizedMvs = (params = {}) => getKugou('/brush', params).then(toMvListResponse)
export const getDailyRecommend = (params = {}) => getKugou('/everyday/recommend', params).then(toSongListResponse)
export const getPersonalizedNewSongs = (params = {}) => getDailyRecommend(params)
export const getPersonalFm = (params = {}) => getKugou('/personal/fm', params).then(toSongListResponse)
export const getPersonalFmByMode = (params = {}) => getKugou('/personal/fm', params).then(toSongListResponse)
export const sendFmTrash = (params = {}) => getKugou('/personal/fm', { ...params, action: 'garbage' })

// MV and video
export const subscribeMv = (params = {}) => getKugou('/youth/channel/sub', params)
export const getSubscribedMvs = (params = {}) => getKugou('/user/video/collect', params)
export const getMvComments = (params = {}) => getKugou('/comment/music', params).then(toCommentResponse)
export const likeResource = (params = {}) => getKugou('/youth/channel/sub', params)
export const getSimilarMvs = (params = {}) => getKugou('/ai/recommend', params).then(toSongListResponse)
export const getAllMvs = (params = {}) => getKugou('/brush', params).then(toMvListResponse)
export const getFirstMvs = (params = {}) => getKugou('/brush', params).then(toMvListResponse)
export const getExclusiveMvs = (params = {}) => getKugou('/brush', params).then(toMvListResponse)
export const getTopMvs = (params = {}) => getKugou('/brush', params).then(toMvListResponse)
export const getMvDetail = (params = {}) => getKugou('/video/detail', params)
export const getMvDetailInfo = (params = {}) => getKugou('/video/privilege', params)
export const getMvUrl = (params = {}) => getKugou('/video/url', params)
export const getFollowArtistNewMvs = (params = {}) => getKugou('/artist/follow/newsongs', params).then(toSongListResponse)
export const getUgcMv = (params = {}) => getKugou('/video/detail', params)

// Podcasts, radio, channels, and scenes
export const getPersonalizedDjPrograms = (params = {}) => getKugou('/longaudio/daily/recommend', params).then(toSongListResponse)
export const getDjBanner = (params = {}) => getKugou('/yueku/banner', params).then(toBannerResponse)
export const getDjPersonalizeRecommend = (params = {}) => getKugou('/longaudio/daily/recommend', params)
export const getDjHot = (params = {}) => getKugou('/longaudio/week/recommend', params)
export const getDjProgramToplist = (params = {}) => getKugou('/longaudio/rank/recommend', params)
export const getDjProgramHoursToplist = (params = {}) => getKugou('/longaudio/rank/recommend', params)
export const getDjToplist = (params = {}) => getKugou('/longaudio/rank/recommend', params)
export const getDjToplistPay = (params = {}) => getKugou('/longaudio/vip/recommend', params)
export const getDjToplistHours = (params = {}) => getKugou('/longaudio/rank/recommend', params)
export const getDjToplistNewcomer = (params = {}) => getKugou('/longaudio/daily/recommend', params)
export const getDjToplistPopular = (params = {}) => getKugou('/longaudio/week/recommend', params)
export const getDjRadioHot = (params = {}) => getKugou('/fm/recommend', params)
export const getDjRecommend = (params = {}) => getKugou('/fm/recommend', params)
export const getDjCatelist = (params = {}) => getKugou('/fm/class', params)
export const getDjRecommendType = (params = {}) => getKugou('/fm/recommend', params)
export const getRadioLibrary = (params = {}) => getKugou('/yueku/fm', params)
export const getRadioClasses = (params = {}) => getKugou('/fm/class', params)
export const getRadioRecommend = (params = {}) => getKugou('/fm/recommend', params)
export const getRadioImages = (params = {}) => getKugou('/fm/image', params)
export const getRadioSongs = (params = {}) => getKugou('/fm/songs', params)
export const updateDjSubscribe = (params = {}) => getKugou('/youth/channel/sub', params)
export const getDjSublist = (params = {}) => getKugou('/youth/channel/all', params)
export const getDjPaygift = (params = {}) => getKugou('/longaudio/vip/recommend', params)
export const getDjCategoryExcludehot = (params = {}) => getKugou('/fm/class', params)
export const getDjCategoryRecommend = (params = {}) => getKugou('/fm/recommend', params)
export const getDjTodayPreferred = (params = {}) => getKugou('/longaudio/daily/recommend', params)
export const getDjDetail = (params = {}) => getKugou('/longaudio/album/detail', { album_id: params.rid ?? params.id, ...params })
export const getDjPrograms = (params = {}) => getKugou('/longaudio/album/audios', { album_id: params.rid ?? params.id, ...params })
export const getDjProgramDetail = (params = {}) => getKugou('/longaudio/album/detail', { album_id: params.id, ...params })
export const getDjComments = (params = {}) => getKugou('/comment/album', params).then(toCommentResponse)
export const getRecentDj = (params = {}) => getKugou('/lastest/songs/listen', params).then(toSongListResponse)
export const searchVoiceLists = (params = {}) =>
  getKugou('/search', { ...params, type: 'album' }).then((response) => toSearchResponse(response, 10))
export const searchVoiceListPrograms = (params = {}) =>
  getKugou('/search', { ...params, type: 'song' }).then((response) => toSearchResponse(response, 1))
export const getVoiceListDetail = (params = {}) => getKugou('/longaudio/album/detail', { album_id: params.id, ...params })
export const getVoiceListPrograms = (params = {}) => getKugou('/longaudio/album/audios', { album_id: params.id, ...params })
export const getVoiceDetail = (params = {}) => getKugou('/krm/audio', { album_audio_id: params.id, ...params })
export const getVoiceLyric = (params = {}) => {
  const hash = params.hash ?? hashFromId(params.id)

  return toLyricResponse({
    ...params,
    ...(hash ? { hash } : {})
  })
}
export const getMyCreatedVoiceList = (params = {}) => getKugou('/youth/channel/all', params)
export const getBroadcastCategoryRegion = (params = {}) => getKugou('/fm/class', params)
export const getBroadcastCollectList = (params = {}) => getKugou('/youth/channel/all', params)
export const getBroadcastCurrentInfo = (params = {}) => getKugou('/youth/channel/detail', params)
export const getBroadcastChannelList = (params = {}) => getKugou('/fm/recommend', params)
export const updateBroadcastSubscribe = (params = {}) => getKugou('/youth/channel/sub', params)
export const getDifmStyleChannels = (params = {}) => getKugou('/scene/lists', params)
export const getDifmSubscribedChannels = (params = {}) => getKugou('/youth/channel/all', params)
export const subscribeDifmChannel = (params = {}) => getKugou('/youth/channel/sub', { ...params, t: 1 })
export const unsubscribeDifmChannel = (params = {}) => getKugou('/youth/channel/sub', { ...params, t: 0 })
export const getDifmPlayingTracks = (params = {}) => getKugou('/fm/songs', params).then(toSongListResponse)
export const getSatiTimeSceneResources = (params = {}) => getKugou('/scene/lists', params)
export const getSatiTags = (params = {}) => getKugou('/scene/module/info', params)
export const getSatiResources = (params = {}) => getKugou('/scene/audio/list', params)
export const getSatiMoreResources = (params = {}) => getKugou('/scene/module', params)
export const getSatiSubscribedResources = (params = {}) => getKugou('/youth/channel/all', params)
export const updateSatiSubscribe = (params = {}) => getKugou('/youth/channel/sub', params)
export const getSportRadio = (params = {}) => getKugou('/fm/recommend', params)

// User library
export const checkSongLike = (params = {}) => getKugou('/favorite/count', { mixsongids: params.ids, ...params })
export const updateSongLike = (params = {}) => getKugou('/playlist/tracks/add', params)
export const getUserCreatedPlaylists = (params = {}) => getKugou('/user/playlist', params).then(toPlaylistListResponse)
export const getUserCollectedPlaylists = (params = {}) => getKugou('/user/playlist', params).then(toPlaylistListResponse)
export const getSongDownloadList = (params = {}) => getKugou('/user/cloud', params).then(toSongListResponse)

// Playlists and charts
export const getPlaylistDetail = (params = {}) => {
  if (/^\d+$/.test(String(params.id ?? ''))) {
    return Promise.all([
      getKugou('/rank/info', { ...params, rankid: params.id }).catch(() => ({})),
      getKugou('/rank/list').catch(() => ({})),
      getKugou('/rank/audio', { ...params, rankid: params.id })
    ]).then(([infoResponse, listResponse, audioResponse]) => {
      const infoData = infoResponse.data ?? infoResponse
      const listRank = firstArray(listResponse.data?.info, listResponse.info, listResponse.data)
        .find((rank) => String(rank?.rankid ?? rank?.id ?? '') === String(params.id)) ?? {}

      return toRankTracksResponse(audioResponse, params.id, {
        data: {
          ...listRank,
          ...infoData
        }
      })
    })
  }

  return getKugou('/playlist/detail', params).then(toPlaylistDetailResponse)
}
export const getPlaylistTracks = (params = {}) => {
  if (params.listid || params.listId) {
    const listid = params.listid ?? params.listId

    return getKugou('/playlist/track/all/new', { ...params, listid }).then((response) =>
      toPlaylistTracksResponse(response, listid)
    )
  }

  if (/^\d+$/.test(String(params.id ?? ''))) {
    return getKugou('/rank/audio', { ...params, rankid: params.id }).then((response) =>
      toRankTracksResponse(response, params.id)
    )
  }

  return getKugou('/playlist/track/all', params).then((response) =>
    toPlaylistTracksResponse(response, params.id)
  )
}
export const getPlaylistHotCategories = (params = {}) => getKugou('/playlist/tags', params)
export const getPlaylistCategories = (params = {}) => getKugou('/playlist/tags', params)
export const getSimilarPlaylists = (params = {}) => getKugou('/playlist/similar', params).then(toPlaylistListResponse)
export const getTopPlaylists = (params = {}) =>
  getKugou('/top/playlist', { category_id: 0, ...params }).then(toPlaylistListResponse)
export const getHighQualityPlaylists = (params = {}) =>
  getKugou('/top/playlist', { category_id: 11292, ...params }).then(toPlaylistListResponse)
export const getToplist = (params = {}) => getKugou('/rank/list', params).then(toToplistResponse)

// Artists
export const getArtistList = (params = {}) => getKugou('/artist/lists', params).then(toArtistListResponse)
export const getArtistToplist = (params = {}) => getKugou('/artist/lists', params).then(toArtistListResponse)
export const getArtistDetail = (params = {}) => getKugou('/artist/detail', params).then(toArtistDetailResponse)
export const getArtistHotSongs = (params = {}) => getKugou('/artist/audios', params).then(toArtistSongsResponse)
export const getArtistTopSongs = (params = {}) =>
  getKugou('/artist/audios', { ...params, sort: 'hot' }).then(toArtistSongsResponse)
export const getArtistSongs = (params = {}) => getKugou('/artist/audios', params).then(toArtistSongsResponse)
export const getArtistAlbums = (params = {}) => getKugou('/artist/albums', params).then(toArtistAlbumsResponse)
export const getArtistMvs = (params = {}) => getKugou('/artist/videos', params)
export const getArtistVideos = (params = {}) => getKugou('/artist/videos', params).then(toArtistVideosResponse)
export const getArtistDesc = (params = {}) => getKugou('/artist/detail', params).then(toArtistDetailResponse)
export const getArtistDynamic = (params = {}) => getKugou('/artist/detail', params).then(toArtistDetailResponse)

// Albums
export const getAlbumNewest = (params = {}) => getKugou('/top/album', params).then(toAlbumListResponse)
export const getNewAlbums = (params = {}) => getKugou('/top/album', params).then(toAlbumListResponse)
export const getTopAlbums = (params = {}) => getKugou('/top/album', params).then(toAlbumListResponse)
export const getAlbumInfo = (params = {}) => getKugou('/album', params).then(toAlbumInfoResponse)
export const getAlbumDetail = (params = {}) => getKugou('/album/detail', params).then(toAlbumDetailResponse)
export const getAlbumSongs = (params = {}) => getKugou('/album/songs', params).then(toSongListResponse)
export const getAlbumDynamic = (params = {}) => getKugou('/album/detail', params).then(toAlbumDetailResponse)
export const getAlbumComments = (params = {}) => getKugou('/comment/album', params).then(toCommentResponse)
export const getPlaylistComments = (params = {}) => getKugou('/comment/playlist', params).then(toCommentResponse)
export const getCommentInfoList = (params = {}) => {
  const ids = String(params.ids ?? params.id ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  const resourceId = ids[0] ?? ''

  if (!resourceId) {
    return Promise.resolve({ data: [] })
  }

  return getKugou('/comment/count', {
    id: resourceId,
    hash: params.hash,
    special_id: params.special_id
  }).then((response) => {
    const data = response.data ?? response
    const count = data.count ?? data.comment_count ?? response.count ?? 0

    return {
      ...response,
      data: resourceId
        ? [{
          resourceId,
          commentCount: count,
          commentCountDesc: data.countDesc ?? ''
        }]
        : []
    }
  })
}

// Authentication
export const getLoginStatus = (params = {}) => getKugou('/user/detail', params).then(toLoginProfileResponse)
export const loginByCellphone = (params = {}) => {
  if (params.password && !params.captcha && !params.code) {
    return getKugou('/login', {
      username: params.phone ?? params.mobile,
      password: params.password,
      ...params
    }).then(toLoginProfileResponse)
  }

  return getKugou('/login/cellphone', params).then(toLoginProfileResponse)
}
export const loginByEmail = (params = {}) =>
  getKugou('/login', { username: params.email, ...params }).then(toLoginProfileResponse)
export const registerAnonymous = (params = {}) =>
  getKugou('/register/dev', params).then((response) => {
    const data = response.data ?? response
    const dfid = data.dfid ?? response.dfid ?? ''

    return {
      ...response,
      userId: '',
      cookie: dfid ? `dfid=${dfid}` : '',
      data: {
        ...data,
        userId: ''
      }
    }
  })
export const refreshLogin = (params = {}) => getKugou('/login/token', params).then(toLoginProfileResponse)
export const sendCaptcha = (params = {}) => getKugou('/captcha/sent', params)
export const verifyCaptcha = (params = {}) => getKugou('/login/cellphone', params)
export const getLoginQrKey = (params = {}) => getKugou('/login/qr/key', params).then(toQrKeyResponse)
export const getLoginQrCreate = (params = {}) => getKugou('/login/qr/create', params).then(toQrCreateResponse)
export const getLoginQrCheck = (params = {}) =>
  getKugou('/login/qr/check', params, { acceptCodes: [0, 1, 2, 4, 200] }).then(toQrCheckResponse)
export const getUserAccount = (params = {}) => getKugou('/user/detail', params).then(toLoginProfileResponse)
export const claimYouthDayVip = (params = {}) => getKugou('/youth/day/vip', params)
export const upgradeYouthDayVip = (params = {}) => getKugou('/youth/day/vip/upgrade', params)
export const getYouthVipStatus = (params = {}) => getKugou('/youth/union/vip', params)
export const logout = (params = {}) => getKugou('/login/token', params)

// Songs, comments, lyrics, and search
export const getSongComments = (params = {}) => getKugou('/comment/music', params).then(toCommentResponse)
export const getSongRedCount = (params = {}) => {
  const knownSong = getKnownSong(params.id)

  return getKugou('/comment/count', {
    ...params,
    hash: params.hash ?? knownSong?.hash
  }).then(toCommentCountResponse)
}
export const getSongUrl = (params = {}) =>
  getKugou('/song/url', params)
    .then(toSongUrlResponse)
    .catch(() => ({ data: [] }))
    .then((response) => {
      if (response.data?.[0]?.url) {
        return response
      }

      return getKugou('/song/url/new', params)
        .then(toSongUrlResponse)
        .catch(() => response)
    })
export const getLyric = (params = {}) => toLyricResponse(params)
export const getSearchDefault = (params = {}) => getKugou('/search/default', params, { noCookie: true })
export const getSearchHotDetail = (params = {}) => getKugou('/search/hot', params).then(toHotSearchResponse)
export const getSearchSuggestPc = (params = {}) => getKugou('/search/suggest', params).then(toSuggestResponse)
export const getSearchMultiMatch = (params = {}) =>
  getKugou('/search/complex', params)
    .then((response) => toSearchResponse(response, 1))
    .catch(() => emptySearchResponse(1))
export const getCloudSearch = (params = {}) => {
  const searchType = normalizeSearchType(params.type)
  const path = searchType === 'talent' ? '/search/complex' : '/search'

  return getKugou(path, params)
    .then((response) => toSearchResponse(response, params.type))
    .catch(() => emptySearchResponse(params.type))
}
