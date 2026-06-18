export const API_CONFIG = {
  // baseURL: 'https://ku-gou-music-api-i2hh.vercel.app/',
  baseURL: '/api',
  neteaseBaseURL: '/netease-api',
  timeout: 120000,
};

export const STORAGE_KEYS = {
  neteaseCookie: 'mappic:netease-cookie',
  kugouAuth: 'mappic:kugou-auth',
  neteaseSession: 'mappic:netease-session',
  dailyVipClaim: 'mappic:daily-vip-claim',
  libraryData: 'mappic:library:data',
  playerSnapshot: 'mappic:player:last-track',
  playbackQuality: 'mappic:player:quality',
  themePreferences: 'mappic-theme-preferences',
  searchHistory: 'mappic.searchHistory',
  fullPlayerVisualizerMode: 'mappic:full-player:visualizer-mode',
};

export const CACHE_TTL = {
  comments: 60 * 1000,
  discovery: 2 * 60 * 1000,
  lyrics: 10 * 60 * 1000,
  podcast: 2 * 60 * 1000,
  playlistDetail: 3 * 60 * 1000,
  searchBoot: 10 * 60 * 1000,
};

export const DEFAULT_COUNTRY_CODE = '86';
export const DEFAULT_COMMENT_LIMIT = 30;
export const SKELETON_MIN_MS = 360;
export const COVER_TYPES = ['sunset', 'neon', 'lofi', 'stage', 'piano'];
