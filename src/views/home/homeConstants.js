export const DEFAULT_COVER_TINT_RGB = '255, 63, 115'

export const COVER_TINT_FALLBACKS = Object.freeze({
  sunset: '236, 127, 56',
  neon: '240, 25, 141',
  lofi: '139, 186, 213',
  stage: '183, 218, 233',
  piano: '246, 212, 142'
})

export const EMPTY_SLIDE_STYLE = Object.freeze({
  '--soda-cover-image': 'none',
  '--soda-cover-tint-rgb': DEFAULT_COVER_TINT_RGB
})

export const HOME_SECTIONS = [
  { label: '音乐', value: 'music' },
  { label: '视频', value: 'video' }
]

export const MOOD_SIGNALS = {
  daily: ['猜你喜欢', '今日日推', '继续探索'],
  hot: ['正在流行', '高热播放', '旋律上头'],
  new: ['新鲜发行', '新歌速递', '本周新声'],
  chill: ['低压氛围', '通勤友好', '耳机时间']
}

export const FEED_DRAG_THRESHOLD = 6
export const LYRICS_DRAG_SCROLL_SPEED = 2.2
export const LYRICS_WHEEL_SCROLL_SPEED = 1.2
export const LYRICS_LOAD_TIMEOUT_MS = 12000
export const RECOMMENDATION_LIMIT = 36
export const MV_RECOMMENDATION_LIMIT = 36
export const HOME_DANMAKU_COMMENT_LIMIT = 80
export const HOME_DANMAKU_MAX_ITEMS = 48
export const HOME_DANMAKU_PREFETCH_THRESHOLD = 12
export const SLIDE_HYDRATE_RADIUS = 2
