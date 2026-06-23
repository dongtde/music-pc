import { normalizeAudioQualities } from '../../../../utils/audioQuality'
import { normalizeSongAccess } from '../../../../utils/songAccess'
import { rememberSong } from './client'

export function firstArray(...values) {
  return values.find((value) => Array.isArray(value)) ?? []
}

export function firstObject(...values) {
  return values.find((value) => value && typeof value === 'object' && !Array.isArray(value)) ?? {}
}

export function firstNonEmptyArray(...values) {
  return values.find((value) => Array.isArray(value) && value.length) ?? []
}

export function toMilliseconds(value) {
  const number = Number(value)

  if (!Number.isFinite(number) || number <= 0) {
    return 0
  }

  return number > 10000 ? number : number * 1000
}

export function normalizeKugouImage(url, size = 480) {
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

export function splitFilename(value = '') {
  const [artist, ...nameParts] = cleanKugouText(value).split(' - ')

  if (!nameParts.length) {
    return { artist: '', name: cleanKugouText(value) }
  }

  return {
    artist: artist.trim(),
    name: nameParts.join(' - ').trim()
  }
}

export function mergeSongFields(song = {}) {
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

export function fillMissingSongFields(target, source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return
  }

  Object.entries(source).forEach(([key, value]) => {
    if (isPresentValue(value) && !isPresentValue(target[key])) {
      target[key] = value
    }
  })
}

export function isPresentValue(value) {
  return value !== undefined && value !== null && value !== ''
}

export function pickField(source = {}, keys = []) {
  for (const key of keys) {
    const value = source?.[key]

    if (isPresentValue(value)) {
      return value
    }
  }

  return undefined
}

export function pickDurationField(...values) {
  for (const value of values) {
    const number = Number(value)

    if (Number.isFinite(number) && number > 0) {
      return value
    }
  }

  return 0
}

export function cleanKugouText(value = '') {
  return String(value ?? '')
    .replace(/<\/?em>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim()
}

export function normalizeArtistName(song = {}) {
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

export function normalizeSongName(song = {}) {
  const source = mergeSongFields(song)
  const title = source.filename || source.audio_name || source.songname || source.name || source.remark || source.title
  const file = splitFilename(title)
  const plainName = source.name && !splitFilename(source.name).artist ? source.name : ''

  return plainName || file.name || source.audio_name || source.songname || source.name || source.remark || source.title || '未知歌曲'
}

export function normalizeSong(song = {}, index = 0) {
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
  const duration = toMilliseconds(pickDurationField(
    source.timelength,
    source.timelen,
    source.time_length,
    source.timelength_320,
    source['320time'],
    source.duration,
    source.duration_ms,
    source.durationMs,
    source.duration_128,
    source.duration_320,
    source.duration_high,
    source.filetime,
    source.FileTime,
    source.TimeLength,
    source.FileDuration,
    source.audio_info?.time_length,
    source.audio_info?.timelength_320,
    source.audio_info?.duration_128,
    source.audio_info?.duration_320,
    source.audio_info?.duration_high,
    source.deprecated?.duration,
    source.video_timelength
  ))
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
  const qualities = normalizeAudioQualities(source)
  const access = normalizeSongAccess(source)
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
    qualities,
    duration,
    dt: duration,
    mv: mvId,
    fee: access.fee,
    vip: access.vip,
    accessType: access.accessType,
    accessBadges: access.badges,
    songAccess: access,
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

export function normalizePlaylist(playlist = {}, index = 0) {
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

export function normalizeTimestamp(value) {
  const number = Number(value)

  if (!Number.isFinite(number) || number <= 0) {
    return value
  }

  return number < 10000000000 ? number * 1000 : number
}

export function normalizeRank(rank = {}, index = 0) {
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

export function normalizeArtist(artist = {}, index = 0) {
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

export function normalizeAlbum(album = {}, index = 0) {
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

export function normalizeComment(comment = {}) {
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

export function extractSongItems(source = {}) {
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
