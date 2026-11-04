export function danmakuLayout(width, height) {
  const lanes = Math.max(1, Math.min(8, Math.floor(height / 34)))
  return { lanes, speed: Math.max(85, Math.min(150, width / 10)), gap: 48, interval: 240, maxActive: lanes * 6 }
}

export function createDanmakuSchedule({ lanes, speed, gap, interval, maxActive }) {
  const readyAt = Array(lanes).fill(0)
  let cursor = 0, nextEmission = 0
  return {
    next(now, activeCount) {
      if (activeCount >= maxActive) return null
      const availableAt = Math.max(now, nextEmission, Math.min(...readyAt))
      for (let offset = 0; offset < lanes; offset++) {
        const lane = (cursor + offset) % lanes
        if (readyAt[lane] <= availableAt) return { lane, delay: availableAt - now }
      }
      return null
    },
    commit(lane, width, now) {
      // All comments use the same speed: a cleared entrance stays clear for the whole crossing.
      readyAt[lane] = now + (width + gap) / speed * 1000
      nextEmission = now + interval
      cursor = (lane + 1) % lanes
    },
  }
}
