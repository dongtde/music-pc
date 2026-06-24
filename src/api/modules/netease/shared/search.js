import { normalizeAudioQualities } from '../../../../utils/audioQuality'
import { normalizeSongAccess } from '../../../../utils/songAccess'
import { normalizeSearchType, rememberSong } from './client'
import {
  cleanKugouText,
  firstArray,
  firstObject,
  normalizeAlbum,
  normalizeArtist,
  normalizeKugouImage,
  normalizePlaylist,
  pickField,
  splitFilename,
  toMilliseconds
} from './base'

export function toHotSearchResponse(response = {}) {
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

export function getHotSearchItems(item) {
  const nestedItems = firstArray(item?.keywords, item?.list, item?.items)

  if (nestedItems.length) {
    return nestedItems
  }

  return item && typeof item === 'object' && !Array.isArray(item) ? [item] : []
}

export function toSuggestResponse(response = {}) {
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

export function toSearchResponse(response = {}, type = 1) {
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
      hasMore: getExplicitMore(data, response)
    },
    type
  }
}

function getExplicitMore(...sources) {
  for (const source of sources) {
    if (!source || typeof source !== 'object') {
      continue
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
  }

  return undefined
}

export function emptySearchResponse(type = 1) {
  return toSearchResponse({ data: { lists: [] } }, type)
}

export function isSearchGroup(item) {
  return item && typeof item === 'object' && !Array.isArray(item) && typeof item.type === 'string' && Array.isArray(item.lists)
}

export function getSearchResultTotal(data = {}, group = {}, items = [], isActiveType = false) {
  if (group?.total !== undefined) {
    return group.total
  }

  if (isActiveType) {
    return data.total ?? data.count ?? data.page_total ?? data.extra?.page_total ?? items.length
  }

  return items.length
}

export function normalizeSearchSong(song = {}, index = 0) {
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
  const access = normalizeSongAccess(song)
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
    qualities: normalizeAudioQualities(song),
    fee: access.fee,
    vip: access.vip,
    accessType: access.accessType,
    accessBadges: access.badges,
    songAccess: access,
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

export function normalizeSearchArtist(artist = {}, index = 0) {
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

export function normalizeSearchUser(user = {}, index = 0) {
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

export function normalizeSearchMv(mv = {}, index = 0) {
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
    const id = pickField(mv, ['id', 'ID', 'video_id', 'VideoID', 'VideoId', 'mvid', 'MVID', 'mv_id', 'MvID', 'hash', 'Hash', 'video_hash'])
    const hash =
      pickField(mv, [
        'hash',
        'Hash',
        'video_hash',
        'VideoHash',
        'MvHash',
        'MVHash',
        'mvhash',
        'mkv_sd_hash',
        'fhd_hash',
        'fhd_hash_265',
        'qhd_hash',
        'qhd_hash_265',
        'hd_hash',
        'hd_hash_265',
        'sd_hash',
        'sd_hash_265',
        'ld_hash',
        'ld_hash_265'
      ]) ||
      (/^\d+$/.test(String(id ?? '')) ? '' : id)

    return {
      ...mv,
      id,
      hash,
      videoId: pickField(mv, ['video_id', 'VideoID', 'VideoId', 'id', 'ID', 'mvid', 'MVID', 'mv_id', 'MvID']),
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
