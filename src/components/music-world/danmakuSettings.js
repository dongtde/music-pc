export const DANMAKU_OPACITY_KEY = 'lanyin.world.danmaku-opacity'
export function normalizeDanmakuOpacity(value) {
  const opacity = value === '' || value == null ? 1 : Number(value)
  return Number.isFinite(opacity) ? Math.round(Math.max(0, Math.min(1, opacity)) * 100) / 100 : 1
}
