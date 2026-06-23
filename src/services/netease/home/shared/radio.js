import { getRadioImages } from '../../../../api/modules/netease'
import { isVipSong } from '../../../../utils/songAccess'
import {
  UNKNOWN_ARTIST,
  UNKNOWN_SONG,
  asArray,
  cleanRadioTitle,
  coverType,
  formatPlayCount,
  formatRadioDuration,
  getArtistIds,
  getArtistNames,
  getKugouTrackMeta,
  normalizeKugouMediaUrl,
  parseCountText,
  splitKugouSongName,
  uniqueValues
} from './common'

export function getRadioRecommendPayload(response = {}) {
  return asArray(response.data ?? response.radios ?? response.list ?? response.items)
}

export async function getRadioImageMap(radios = []) {
  const ids = uniqueValues(radios.map((radio) => radio.id)).slice(0, 80)

  if (!ids.length) {
    return new Map()
  }

  const response = await getRadioImages({ fmid: ids.join(',') }).catch(() => ({}))
  const items = asArray(response.data ?? response.list ?? response.items)

  return new Map(items.map((item) => [
    String(item.fmid ?? item.fmId ?? item.id),
    {
      coverUrl: normalizeKugouMediaUrl(item.imgUrl480 || item.imgUrl100 || item.imgurl || item.picUrl, 520),
      fmtype: item.fmtype
    }
  ]))
}

export function hydrateRadioImage(radio = {}, imageMap = new Map()) {
  const image = imageMap.get(String(radio.id))

  if (!image) {
    return radio
  }

  return {
    ...radio,
    fmtype: radio.fmtype ?? image.fmtype,
    coverUrl: radio.coverUrl || image.coverUrl
  }
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
    creator: '酷狗电台',
    creatorAvatarUrl: coverUrl,
    category: category || '电台',
    primaryCategory: category || '电台',
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
    tag: category || '电台',
    subed: false,
    type: coverType(index || Number(id) || 0),
    to: id ? `/podcast/${id}` : '',
    previewTracks,
    raw: source
  }
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
    album: radio.title || radio.name || album.name || '酷狗电台',
    albumId: album.id ?? song.album_id ?? '',
    rank: String(index + 1).padStart(2, '0'),
    type: coverType(index || Number(id) || 0),
    time: formatRadioDuration(duration),
    duration: formatRadioDuration(duration),
    coverUrl,
    thumbnailUrl: normalizeKugouMediaUrl(coverUrl, 96),
    source: radio.title ? `电台 · ${radio.title}` : '酷狗电台',
    category: radio.category || '',
    vip: isVipSong(song),
    hasVideo: Boolean(song.mv || song.mvhash),
    mvId: song.mv || song.mvhash || '',
    radioId: radio.id || radio.fmid || '',
    radioTitle: radio.title || radio.name || ''
  }
}

export function getRadioDescription(title = '', category = '') {
  const prefix = category ? `${category}里的` : ''

  return `${prefix}${title}，按酷狗电台实时歌单连续播放。`
}

export function getRadioPreviewSongs(source = {}) {
  const candidates = [
    source.rcmdlist,
    source.songlist,
    source.songs,
    source.song_info ? [source.song_info] : null
  ]

  return candidates.find((item) => Array.isArray(item)) ?? []
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
