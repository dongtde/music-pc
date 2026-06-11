export const API_CONFIG = {
  baseURL: '/api',
  timeout: 12000
}

export const STORAGE_KEYS = {
  neteaseCookie: 'mappic:netease-cookie',
  libraryData: 'mappic:library:data',
  playerSnapshot: 'mappic:player:last-track',
  themePreferences: 'mappic-theme-preferences',
  searchHistory: 'mappic.searchHistory',
  fullPlayerVisualizerMode: 'mappic:full-player:visualizer-mode'
}

export const CACHE_TTL = {
  comments: 60 * 1000,
  discovery: 2 * 60 * 1000,
  lyrics: 10 * 60 * 1000,
  podcast: 2 * 60 * 1000,
  playlistDetail: 3 * 60 * 1000,
  searchBoot: 10 * 60 * 1000
}

export const DEFAULT_COUNTRY_CODE = '86'
export const DEFAULT_COMMENT_LIMIT = 30
export const SKELETON_MIN_MS = 360
export const COVER_TYPES = ['sunset', 'neon', 'lofi', 'stage', 'piano']
