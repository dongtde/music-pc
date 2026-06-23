import { isVipSong } from '../../../utils/songAccess'
import {
  RADIO_CATEGORY,
  RADIO_CREATOR,
  UNKNOWN_ALBUM,
  UNKNOWN_ARTIST,
  UNKNOWN_SONG,
  cleanRadioTitle,
  coverType,
  formatPlainDate,
  formatRadioDuration,
  formatDuration,
  formatPlayCount,
  getArtistIds,
  getArtistNames,
  getKugouTrackMeta,
  getRadioDescription,
  getRadioPreviewSongs,
  getSatiCategoryName,
  normalizeKugouMediaUrl,
  parseCountText,
  resizeNeteaseImage,
  splitKugouSongName
} from './shared'

export function mapVoiceListSearchResult(resource, index) {
  return mapRadioCard(
    {
      ...(resource?.baseInfo ?? {}),
      resourceId: resource?.resourceId,
      uiElement: resource?.uiElement,
      extInfo: resource?.extInfo
    },
    index
  )
}

export function mapRadioCard(raw = {}, index = 0) {
  const source = raw.baseInfo ?? raw.radio ?? raw.djRadio ?? raw
  const id = source.fmid ?? source.fm_id ?? source.fmId ?? source.id ?? source.radioId ?? source.rid ?? raw.resourceId
  const title = cleanRadioTitle(
    source.fmname ?? source.fm_name ?? source.name ?? source.title ?? raw.uiElement?.mainTitle?.title ?? '未命名电台'
  )
  const fmtype = Number(source.fmtype ?? source.fm_type ?? raw.fmtype ?? 2) || 2
  const category = source.classname ?? source.categoryName ?? source.category ?? source.sectionTitle ?? raw.categoryName ?? ''
  const description =
    source.description ||
    source.rcm_text ||
    source.rcmdText ||
    source.rcmdtext ||
    source.sectionDescription ||
    source.desc ||
    ''
  const heat = Number(source.heat ?? source.playCount ?? parseCountText(source.playCountLabel) ?? 0) || 0
  const previewTracks = getRadioPreviewSongs(source)
    .map((song, songIndex) => mapRadioSongTrack(song, songIndex, {
      id,
      title,
      fmtype,
      coverUrl: normalizeKugouMediaUrl(source.imgUrl480 || source.imgurl || source.imgUrl100 || source.picUrl, 520),
      category
    }))
    .filter((track) => track.id)
  const coverUrl = normalizeKugouMediaUrl(
    source.imgUrl480 ||
      source.imgurl ||
      source.imgUrl100 ||
      source.picUrl ||
      source.coverUrl ||
      source.cover ||
      raw.uiElement?.image?.imageUrl,
    520
  )
  const bannerUrl = normalizeKugouMediaUrl(source.banner || source.bannerUrl || source.imageUrl, 900)

  return {
    id,
    fmid: id,
    fmtype,
    title,
    name: title,
    description: description || getRadioDescription(title, category),
    creator: RADIO_CREATOR,
    creatorAvatarUrl: coverUrl,
    category: category || RADIO_CATEGORY,
    primaryCategory: category || RADIO_CATEGORY,
    subCategory: source.parentName || '',
    coverUrl,
    bannerUrl,
    programCount: Number(source.rcmdsongsize ?? source.size ?? previewTracks.length) || previewTracks.length,
    subCount: 0,
    playCount: heat,
    heat,
    playCountLabel: heat ? `${formatPlayCount(heat)} 热度` : 'FM',
    subCountLabel: '',
    programCountLabel: '',
    lastProgramName: previewTracks[0]?.name || '',
    score: source.isnew === '1' || source.isnew === 1 ? '新' : '',
    tag: category || RADIO_CATEGORY,
    subed: false,
    type: coverType(index || Number(id) || 0),
    to: id ? `/podcast/${id}` : '',
    previewTracks,
    raw: source
  }
}

export function mapRadioDetail(raw = {}, total = 0) {
  const card = mapRadioCard(raw, Number(raw.id) || 0)

  return {
    ...card,
    description: card.description || getRadioDescription(card.title, card.category),
    programCount: total,
    programCountLabel: total ? `${total}+ 首歌曲` : '',
    commentCount: 0,
    shareCount: 0,
    likedCount: 0,
    lastUpdated: formatPlainDate(raw.raw?.addtime ?? raw.addtime),
    comments: []
  }
}

export function mapPodcastProgramTrack(program = {}, index = 0) {
  return mapRadioSongTrack(program.mainSong ?? program.song ?? program.track ?? program, index, program.radio ?? program.djRadio ?? {})
}

export function mapRadioSongTrack(song = {}, index = 0, radio = {}) {
  const file = splitKugouSongName(song.name || song.filename || song.songname || song.audio_name || UNKNOWN_SONG)
  const album = song.al ?? song.album ?? {}
  const artists = song.ar ?? song.artists ?? []
  const artistName = getArtistNames(artists) || song.artist || song.singername || file.artist || UNKNOWN_ARTIST
  const id = song.id ?? song.album_audio_id ?? song.mixsongid ?? song.audio_id ?? song.hash ?? `radio-song-${radio.id}-${index}`
  const duration = song.dt ?? song.duration ?? song.time ?? song['320time'] ?? song.timelength ?? 0
  const coverUrl = normalizeKugouMediaUrl(
    album.picUrl ||
      album.coverUrl ||
      song.picUrl ||
      song.coverUrl ||
      song.imgurl ||
      song.trans_param?.union_cover ||
      radio.coverUrl,
    360
  )

  return {
    id,
    ...getKugouTrackMeta(song),
    name: file.name || song.name || UNKNOWN_SONG,
    artistId: artists[0]?.id ?? song.author_id ?? '',
    artistIds: getArtistIds(artists),
    artist: artistName,
    album: radio.title || radio.name || album.name || RADIO_CREATOR,
    albumId: album.id ?? song.album_id ?? '',
    rank: String(index + 1).padStart(2, '0'),
    type: coverType(index || Number(id) || 0),
    time: formatRadioDuration(duration),
    duration: formatRadioDuration(duration),
    coverUrl,
    thumbnailUrl: normalizeKugouMediaUrl(coverUrl, 96),
    source: radio.title ? `电台 · ${radio.title}` : RADIO_CREATOR,
    category: radio.category || '',
    vip: isVipSong(song),
    hasVideo: Boolean(song.mv || song.mvhash),
    mvId: song.mv || song.mvhash || '',
    radioId: radio.id || radio.fmid || '',
    radioTitle: radio.title || radio.name || ''
  }
}

export function mapSatiResourceTrack(item = {}, index = 0) {
  const id = item.trackId ?? item.djProgramId ?? item.id

  return {
    id,
    programId: item.djProgramId ?? '',
    name: item.name || '助眠声音',
    artist: '助眠解压',
    album: getSatiCategoryName(item.category),
    rank: String(index + 1).padStart(2, '0'),
    type: coverType(index || Number(id) || 0),
    time: '--:--',
    duration: '--:--',
    coverUrl: resizeNeteaseImage(item.pic, 240),
    source: '助眠解压',
    satiId: item.id,
    category: item.category
  }
}

export function mapDifmTrack(item = {}, index = 0) {
  const song = item.song ?? item.track ?? item
  const id = song.id ?? item.trackId ?? item.id

  return {
    id,
    name: song.name ?? item.name ?? 'DIFM 声音',
    artist: getArtistNames(song.ar ?? song.artists ?? []) || song.artist || item.artistName || item.artist || 'DIFM',
    album: item.channelName || item.styleName || 'DIFM 电台',
    rank: String(index + 1).padStart(2, '0'),
    type: coverType(index || Number(id) || 0),
    time: formatRadioDuration(song.dt ?? song.duration ?? item.duration),
    duration: formatRadioDuration(song.dt ?? song.duration ?? item.duration),
    coverUrl: resizeNeteaseImage(song.al?.picUrl ?? song.album?.picUrl ?? item.cover ?? item.coverUrl ?? item.picUrl, 360),
    source: 'DIFM'
  }
}

export function mapBroadcastChannel(item = {}, index = 0) {
  const id = item.id ?? item.channelId ?? item.radioId

  return {
    id,
    title: item.name ?? item.channelName ?? '广播电台',
    name: item.name ?? item.channelName ?? '广播电台',
    description: item.desc ?? item.description ?? item.programName ?? '',
    coverUrl: resizeNeteaseImage(item.picUrl ?? item.coverUrl ?? item.logoUrl, 360),
    category: item.categoryName ?? item.category ?? '',
    region: item.regionName ?? item.region ?? '',
    subed: Boolean(item.subed ?? item.collected),
    type: coverType(index || Number(id) || 0)
  }
}

export function mapPlaylistTrack(song = {}, index = 0) {
  const album = song.al ?? song.album ?? {}
  const artists = song.ar ?? song.artists ?? []
  const artistIds = getArtistIds(artists)
  const trackId = song.id ?? song.album_audio_id ?? song.mixsongid ?? song.hash ?? `track-${index + 1}`

  return {
    id: trackId,
    ...getKugouTrackMeta(song),
    name: song.name,
    artistId: artistIds[0] ?? '',
    artistIds,
    artist: artists.map((artist) => artist.name).filter(Boolean).join(' / ') || UNKNOWN_ARTIST,
    album: album.name || UNKNOWN_ALBUM,
    rank: String(index + 1).padStart(2, '0'),
    albumId: album.id ?? '',
    type: coverType(index),
    time: formatDuration(song.dt ?? song.duration),
    coverUrl: album.picUrl || album.blurPicUrl,
    thumbnailUrl: resizeNeteaseImage(album.picUrl, 96),
    to: `/playlist/song-${trackId}`,
    vip: isVipSong(song),
    hasVideo: Boolean(song.mv),
    mvId: song.mv || ''
  }
}

export function uniqueRadioCards(items = []) {
  const seenIds = new Set()

  return items
    .map((item, index) => (item?.id && item?.title ? item : mapRadioCard(item, index)))
    .filter((item) => {
      const id = String(item?.id ?? '')

      if (!id || seenIds.has(id)) {
        return false
      }

      seenIds.add(id)
      return true
    })
}
