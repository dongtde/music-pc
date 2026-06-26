export const API_CONFIG = {
  baseURL: readEnv('VITE_KUGOU_API_BASE', '/api'),
  neteaseBaseURL: readEnv('VITE_NETEASE_API_BASE', '/netease-api'),
  timeout: readNumberEnv('VITE_API_TIMEOUT', 120000),
};

function readEnv(key, fallback) {
  const value = import.meta.env[key];
  return value === undefined || value === '' ? fallback : value;
}

function readNumberEnv(key, fallback) {
  const value = Number(readEnv(key, fallback));
  return Number.isFinite(value) ? value : fallback;
}

export const STORAGE_KEYS = {
  neteaseCookie: 'mappic:netease-cookie',
  kugouAuth: 'mappic:kugou-auth',
  neteaseSession: 'mappic:netease-session',
  dailyVipClaim: 'mappic:daily-vip-claim',
  dailyVipAutoStatusCheck: 'mappic:daily-vip-auto-status-check',
  libraryData: 'mappic:library:data',
  playerSnapshot: 'mappic:player:last-track',
  playerPlayMode: 'mappic:player:play-mode',
  playbackQuality: 'mappic:player:quality',
  playerVolume: 'mappic:player:volume',
  themePreferences: 'mappic-theme-preferences',
  searchHistory: 'mappic.searchHistory',
  fullPlayerVisualizerMode: 'mappic:full-player:visualizer-mode',
};

export const SETTINGS_DEFAULTS = {
  theme: {
    mode: 'dark',
    transition: 'fade',
    queueTransition: 'slide-left',
    primaryColor: '#ff3f73',
    reducedMotion: false,
  },
};

export const THEME_MODE_OPTIONS = [
  { value: 'dark' },
  { value: 'light' },
];

export const THEME_COLOR_PRESETS = [
  { label: '玫瑰粉', value: '#ff3f73' },
  { label: '电音紫', value: '#8a5cff' },
  { label: '湖水青', value: '#1dbf9f' },
  { label: '海岸蓝', value: '#3f8cff' },
  { label: '日落橙', value: '#ff8a3d' },
  { label: '荧光绿', value: '#52c96f' },
];

export const THEME_TRANSITION_EFFECTS = [
  {
    label: '柔和淡入',
    value: 'fade',
    desc: '用透明度变化完成切换',
  },
  {
    label: '横向幕布',
    value: 'wipe',
    desc: '从左到右扫过页面，适合干净利落的切换',
  },
  {
    label: '圆形扩散',
    value: 'circle',
    desc: '从右上角向外扩散，强调开关触发点',
  },
  {
    label: '滑动翻页',
    value: 'slide',
    desc: '像切换唱片页一样横向滑过',
  },
  {
    label: '模糊光晕',
    value: 'blur',
    desc: '用短暂模糊和光晕弱化颜色跳变',
  },
];

export const QUEUE_TRANSITION_EFFECTS = [
  {
    label: '右侧滑入',
    value: 'slide-left',
    desc: '播放列表从右侧进入',
  },
  {
    label: '柔和淡入',
    value: 'fade',
    desc: '用透明度显示播放列表',
  },
  {
    label: '轻微上浮',
    value: 'rise',
    desc: '从底部轻轻浮出',
  },
  {
    label: '缩放展开',
    value: 'scale',
    desc: '从右下角展开面板',
  },
];

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
