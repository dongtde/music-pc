import { computed, reactive } from 'vue'
import { STORAGE_KEYS } from '../config/app'
import { readJsonStorage, writeJsonStorage } from '../utils/storage'

const LIBRARY_DATA_VERSION = 2

const fallbackTracks = [
  {
    id: 25706282,
    name: '夜空中最亮的星',
    artist: '逃跑计划',
    album: '世界',
    time: '4:12',
    type: 'stage',
    source: '默认歌单',
    hasVideo: true,
    mvId: 382555
  },
  {
    id: 347230,
    name: '海阔天空',
    artist: 'Beyond',
    album: '海阔天空',
    time: '5:26',
    type: 'sunset',
    source: '默认歌单',
    hasVideo: true,
    mvId: 376199
  },
  {
    id: 28815250,
    name: '平凡之路',
    artist: '朴树',
    album: '猎户星座',
    time: '5:02',
    type: 'lofi',
    source: '默认歌单',
    hasVideo: true,
    mvId: 34755243
  },
  {
    id: 2092595510,
    name: '平凡之路',
    artist: '陌尘',
    album: '平凡之路',
    time: '5:00',
    type: 'piano',
    source: '默认歌单'
  },
  {
    id: 2155924104,
    name: '夜空中最亮的星',
    artist: '你的名字 / 张月',
    album: '夜星',
    time: '4:20',
    type: 'neon',
    source: '默认歌单'
  },
  {
    id: 419827620,
    name: '没那么简单',
    artist: '黄小琥',
    album: '靓声天后',
    time: '5:08',
    type: 'piano',
    source: '默认歌单'
  },
  {
    id: 5255454,
    name: '你是我的眼',
    artist: '萧煌奇',
    album: 'K情歌2',
    time: '5:16',
    type: 'stage',
    source: '默认歌单',
    hasVideo: true,
    mvId: 385364
  },
  {
    id: 5230792,
    name: '怨苍天变了心',
    artist: '群星',
    album: '传世情歌.女声试音天碟Ⅱ',
    time: '4:14',
    type: 'lofi',
    source: '默认歌单'
  },
  {
    id: 865632948,
    name: '若把你',
    artist: 'Kirsty刘瑾睿',
    album: '若把你',
    time: '3:09',
    type: 'sunset',
    source: '默认歌单'
  }
].map(normalizeTrack)

const defaultCreatedPlaylists = [
  {
    id: 'emo',
    title: '深夜emo专用',
    description: '适合夜里慢慢听的情绪歌单',
    trackIds: fallbackTracks.slice(0, 5).map((track) => track.id),
    createdAt: 1717200000000,
    updatedAt: 1717200000000
  },
  {
    id: 'coding',
    title: 'Coding Focus',
    description: '敲代码时保持节奏和专注',
    trackIds: fallbackTracks.slice(2, 8).map((track) => track.id),
    createdAt: 1717286400000,
    updatedAt: 1717286400000
  }
]

const defaultCollectedPlaylists = [
  {
    id: 'hot-2024',
    title: '2024年度热歌',
    description: '年度循环最多的流行单曲',
    trackIds: fallbackTracks.slice(0, 7).map((track) => track.id),
    collectedAt: 1717372800000,
    updatedAt: 1717372800000
  },
  {
    id: 'cpop',
    title: '华语流行金曲',
    description: '熟悉旋律和华语经典',
    trackIds: fallbackTracks.slice(1, 9).map((track) => track.id),
    collectedAt: 1717459200000,
    updatedAt: 1717459200000
  }
]

const state = reactive(createInitialState())

export function useLibraryStore() {
  const allTracks = computed(() => {
    const byId = new Map()

    fallbackTracks.forEach((track) => byId.set(String(track.id), track))
    state.localTracks.forEach((track, index) => {
      byId.set(String(track.id), normalizeTrack(track, index))
    })
    state.recentTracks.forEach((track, index) => {
      byId.set(String(track.id), normalizeTrack(track, index))
    })
    state.likedTracks.forEach((track, index) => {
      byId.set(String(track.id), normalizeTrack(track, index))
    })

    return Array.from(byId.values())
  })

  const likedCount = computed(() => state.likedTracks.length)

  function getPlaylist(id) {
    const playlistId = String(id ?? '')
    const playlist = [...state.createdPlaylists, ...state.collectedPlaylists].find(
      (item) => String(item.id) === playlistId
    )

    if (!playlist) {
      return null
    }

    return {
      ...playlist,
      tracks: getTracksByIds(playlist.trackIds)
    }
  }

  function getTracksByIds(ids = []) {
    const trackMap = new Map(allTracks.value.map((track) => [String(track.id), track]))

    return ids
      .map((id) => trackMap.get(String(id)))
      .filter(Boolean)
      .map((track, index) => normalizeTrack(track, index))
  }

  function addRecentTrack(track) {
    if (!isPlayableTrack(track)) {
      return
    }

    const normalizedTrack = {
      ...normalizeTrack(track),
      playedAt: Date.now()
    }

    state.recentTracks = [
      normalizedTrack,
      ...state.recentTracks.filter((item) => String(item.id) !== String(track.id))
    ].slice(0, 80)

    persist()
  }

  function isTrackLiked(trackOrId) {
    const id = getTrackId(trackOrId)

    return Boolean(id && state.likedTracks.some((track) => String(track.id) === id))
  }

  function toggleLikedTrack(track) {
    if (!isPlayableTrack(track)) {
      return false
    }

    const id = String(track.id)

    if (isTrackLiked(id)) {
      state.likedTracks = state.likedTracks.filter((item) => String(item.id) !== id)
      persist()
      return false
    }

    state.likedTracks = [
      {
        ...normalizeTrack(track),
        likedAt: Date.now()
      },
      ...state.likedTracks
    ]
    persist()
    return true
  }

  function addLocalFiles(files = []) {
    const nextTracks = Array.from(files)
      .filter((file) => file?.type?.startsWith?.('audio/'))
      .map((file, index) => createLocalTrack(file, state.localTracks.length + index))

    return addLocalTracks(nextTracks)
  }

  function addLocalTracks(tracks = []) {
    const nextTracks = tracks
      .filter(isPlayableTrack)
      .map((track, index) => normalizeTrack(track, state.localTracks.length + index))

    if (!nextTracks.length) {
      return []
    }

    const existingIds = new Set(state.localTracks.map((track) => String(track.id)))
    const uniqueTracks = nextTracks.filter((track) => !existingIds.has(String(track.id)))

    if (!uniqueTracks.length) {
      return []
    }

    state.localTracks = [...uniqueTracks, ...state.localTracks]
    persist()

    return uniqueTracks
  }

  function createPlaylist(title, { description = '', trackIds = [] } = {}) {
    const normalizedTitle = String(title ?? '').trim()

    if (!normalizedTitle) {
      return null
    }

    const now = Date.now()
    const playlist = {
      id: createPlaylistId(normalizedTitle),
      title: normalizedTitle,
      description,
      trackIds,
      createdAt: now,
      updatedAt: now
    }

    state.createdPlaylists = [playlist, ...state.createdPlaylists]
    persist()

    return playlist
  }

  function addTrackToPlaylist(playlistId, track) {
    if (!isPlayableTrack(track)) {
      return false
    }

    const playlist = state.createdPlaylists.find((item) => String(item.id) === String(playlistId))

    if (!playlist || playlist.trackIds.some((id) => String(id) === String(track.id))) {
      return false
    }

    playlist.trackIds = [String(track.id), ...playlist.trackIds]
    playlist.updatedAt = Date.now()
    persist()
    return true
  }

  function mergeRemotePlaylists({ createdPlaylists = [], collectedPlaylists = [] } = {}) {
    if (Array.isArray(createdPlaylists)) {
      state.createdPlaylists = mergePlaylists(state.createdPlaylists, createdPlaylists)
    }

    if (Array.isArray(collectedPlaylists)) {
      state.collectedPlaylists = mergePlaylists(state.collectedPlaylists, collectedPlaylists)
    }

    persist()
  }

  function seedLikedIfEmpty() {
    if (state.likedTracks.length) {
      return
    }

    state.likedTracks = fallbackTracks.slice(0, 6).map((track, index) => ({
      ...track,
      likedAt: Date.now() - index * 60000
    }))
    persist()
  }

  return {
    state,
    allTracks,
    likedCount,
    getPlaylist,
    getTracksByIds,
    addRecentTrack,
    isTrackLiked,
    toggleLikedTrack,
    addLocalFiles,
    addLocalTracks,
    createPlaylist,
    addTrackToPlaylist,
    mergeRemotePlaylists,
    seedLikedIfEmpty
  }
}

function createInitialState() {
  const stored = readJsonStorage(STORAGE_KEYS.libraryData, null)
  const canReuseStoredDefaults = Number(stored?.version) >= LIBRARY_DATA_VERSION

  return {
    localTracks: Array.isArray(stored?.localTracks)
      ? stored.localTracks.map(normalizeTrack)
      : [],
    recentTracks: Array.isArray(stored?.recentTracks)
      ? stored.recentTracks.map(normalizeTrack)
      : [],
    likedTracks: canReuseStoredDefaults && Array.isArray(stored?.likedTracks)
      ? stored.likedTracks.map(normalizeTrack)
      : fallbackTracks.slice(0, 6),
    createdPlaylists: canReuseStoredDefaults && Array.isArray(stored?.createdPlaylists)
      ? stored.createdPlaylists.map(normalizePlaylist)
      : defaultCreatedPlaylists,
    collectedPlaylists: canReuseStoredDefaults && Array.isArray(stored?.collectedPlaylists)
      ? stored.collectedPlaylists.map(normalizePlaylist)
      : defaultCollectedPlaylists
  }
}

function persist() {
  writeJsonStorage(STORAGE_KEYS.libraryData, {
    version: LIBRARY_DATA_VERSION,
    localTracks: state.localTracks.map(serializeTrack),
    recentTracks: state.recentTracks.map(serializeTrack),
    likedTracks: state.likedTracks.map(serializeTrack),
    createdPlaylists: state.createdPlaylists,
    collectedPlaylists: state.collectedPlaylists
  })
}

function createLocalTrack(file, index = 0) {
  const name = file.name?.replace(/\.[^.]+$/, '') || '本地音乐'
  const objectUrl = URL.createObjectURL(file)

  return normalizeTrack(
    {
      id: `local-${file.name}-${file.size}-${file.lastModified}`,
      name,
      artist: '本地文件',
      album: '本地与下载',
      source: '本地音乐',
      type: 'lofi',
      duration: '0:00',
      time: '0:00',
      localUrl: objectUrl,
      fileName: file.name,
      fileSize: file.size,
      addedAt: Date.now()
    },
    index
  )
}

function normalizeTrack(track = {}, index = 0) {
  const rank = track.rank || String(index + 1).padStart(2, '0')

  return {
    id: track.id ?? `track-${rank}`,
    name: track.name || track.title || '未命名歌曲',
    artist: track.artist || '未知歌手',
    album: track.album || track.source || '未知专辑',
    rank,
    type: track.type || 'sunset',
    time: track.time || track.duration || '0:00',
    duration: track.duration || track.time || '0:00',
    coverUrl: track.coverUrl || '',
    thumbnailUrl: track.thumbnailUrl || track.coverUrl || '',
    localUrl: track.localUrl || '',
    source: track.source || '',
    vip: Boolean(track.vip),
    hasVideo: Boolean(track.hasVideo),
    mvId: track.mvId || '',
    artistId: track.artistId || '',
    albumId: track.albumId || '',
    playedAt: track.playedAt || 0,
    likedAt: track.likedAt || 0,
    addedAt: track.addedAt || 0,
    fileName: track.fileName || '',
    fileSize: track.fileSize || 0
  }
}

function normalizePlaylist(playlist = {}) {
  return {
    id: playlist.id || createPlaylistId(playlist.title),
    title: playlist.title || '新建歌单',
    description: playlist.description || '',
    trackIds: Array.isArray(playlist.trackIds)
      ? playlist.trackIds.map((id) => String(id))
      : [],
    remote: Boolean(playlist.remote),
    coverUrl: playlist.coverUrl || '',
    trackCount: playlist.trackCount ?? 0,
    createdAt: playlist.createdAt || playlist.collectedAt || Date.now(),
    collectedAt: playlist.collectedAt || 0,
    updatedAt: playlist.updatedAt || playlist.createdAt || Date.now()
  }
}

function mergePlaylists(currentPlaylists, incomingPlaylists) {
  const byId = new Map(currentPlaylists.map((playlist) => [String(playlist.id), normalizePlaylist(playlist)]))

  incomingPlaylists.forEach((playlist) => {
    const normalizedPlaylist = normalizePlaylist(playlist)

    if (normalizedPlaylist.id) {
      byId.set(String(normalizedPlaylist.id), normalizedPlaylist)
    }
  })

  return Array.from(byId.values()).sort((left, right) => {
    const rightTime = Number(right.updatedAt || right.createdAt || right.collectedAt) || 0
    const leftTime = Number(left.updatedAt || left.createdAt || left.collectedAt) || 0

    return rightTime - leftTime
  })
}

function serializeTrack(track) {
  const { localUrl, ...serializableTrack } = track

  return {
    ...serializableTrack,
    localUrl: ''
  }
}

function isPlayableTrack(track) {
  return Boolean(track?.id && track?.name)
}

function getTrackId(trackOrId) {
  return String(
    typeof trackOrId === 'object'
      ? trackOrId?.id ?? ''
      : trackOrId ?? ''
  )
}

function createPlaylistId(title = 'playlist') {
  const slug = String(title)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${slug || 'playlist'}-${Date.now().toString(36)}`
}
