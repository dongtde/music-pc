import { getPlaylistTracks, getToplist } from '../../api/modules/netease'
import { coverType, formatPlayCount, getKugouTrackMeta } from './shared'

export async function getChartsDiscoveryData() {
  const toplistResponse = await getToplist({ withsong: 1 })
  const toplists = (toplistResponse.list ?? []).map(mapToplist)
  const featured = toplists.slice(0, 6)
  const boards = await hydrateChartPreviewTracks(featured)

  return {
    boards,
    officialCharts: featured,
    globalCharts: toplists.slice(6),
    chartSections: groupToplists(toplists.slice(6))
  }
}

async function hydrateChartPreviewTracks(charts) {
  const previewResponses = await Promise.all(
    charts.map((chart) => {
      if (Array.isArray(chart.tracks) && chart.tracks.length >= 3) {
        return Promise.resolve(null)
      }

      return getPlaylistTracks({ id: chart.id, limit: 3, offset: 0 }).catch(() => null)
    })
  )

  return charts.map((chart, index) => {
    const previewSongs = previewResponses[index]?.songs ?? []
    const tracks = previewSongs.length
      ? previewSongs.slice(0, 3).map(mapChartTrack)
      : (chart.tracks ?? []).slice(0, 3)

    return {
      ...chart,
      tracks
    }
  })
}

function groupToplists(charts) {
  const sectionMap = new Map()

  charts.forEach((chart) => {
    const title = getToplistSectionTitle(chart.title)

    if (!sectionMap.has(title)) {
      sectionMap.set(title, [])
    }

    sectionMap.get(title).push(chart)
  })

  return [...sectionMap.entries()].map(([title, items]) => ({ title, items }))
}

function getToplistSectionTitle(name = '') {
  if (/合伙人/.test(name)) {
    return '音乐合伙人榜'
  }

  if (/黑胶|VIP/.test(name)) {
    return '会员榜'
  }

  if (/韩语|UK|美国|Billboard|Beatport|日本|Oricon|欧美|法国|日语|俄语|越南|俄罗斯|泰语/.test(name)) {
    return '地区/语种榜'
  }

  if (/说唱|古典|电音|ACG|动画|游戏|VOCALOID|摇滚|国风|民谣|DJ|R&B/.test(name)) {
    return '曲风榜'
  }

  if (/KTV|听歌识曲|网络热歌|LOOK|直播|车友|蛋仔|AI|乐夏|喜力|特斯拉|理想|比亚迪|蔚来|极氪|昊铂|埃安|吉利/.test(name)) {
    return '场景/活动榜'
  }

  return '特色榜'
}

function mapToplist(item, index) {
  return {
    id: item.id,
    title: item.name,
    desc: item.description || item.updateFrequency || '',
    label: item.updateFrequency || '云音乐榜单',
    coverUrl: item.coverImgUrl,
    listeners: formatPlayCount(item.playCount),
    trackCount: item.trackCount ?? item.tracks?.length ?? 0,
    type: coverType(index),
    tracks: (item.tracks ?? []).slice(0, 3).map(mapChartTrack)
  }
}

function mapChartTrack(song, index) {
  const artists = song.ar ?? song.artists ?? []
  const titleSource = [song.name, song.first, song.songname]
    .find((value) => String(value || '').includes(' - ')) ||
    song.name ||
    song.first ||
    song.songname
  const parsedTitle = splitChartTrackTitle(titleSource)
  const explicitArtist =
    artists.map((artist) => artist.name).filter(Boolean).join(' / ') ||
    song.second ||
    song.author ||
    ''
  const artist = explicitArtist && explicitArtist !== '未知歌手'
    ? explicitArtist
    : parsedTitle.artist || explicitArtist || '未知歌手'

  return {
    id: song.id ?? song.album_audio_id ?? song.mixsongid ?? song.hash ?? '',
    ...getKugouTrackMeta(song),
    rank: String(index + 1).padStart(2, '0'),
    name: parsedTitle.name || song.first || song.name || song.songname || '未知歌曲',
    artist,
    change: index === 0 ? 'HOT' : index < 3 ? 'UP' : ''
  }
}

function splitChartTrackTitle(value = '') {
  const text = String(value || '').trim()
  const [artist, ...nameParts] = text.split(' - ')

  if (!artist || !nameParts.length) {
    return {
      artist: '',
      name: text
    }
  }

  return {
    artist: artist.trim(),
    name: nameParts.join(' - ').trim()
  }
}
