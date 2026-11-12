// Development-only measurements: bounded storage, no per-frame sorting or DOM writes.
export function createWorldFrameMetrics() {
  const intervals = new Float32Array(240), costs = new Float32Array(240)
  let count = 0, cursor = 0, previous = 0, started = 0, warmup = 90, recorded = false
  const percentile = (values, p) => values[Math.min(values.length - 1, Math.floor(values.length * p))] || 0
  return {
    begin(now) { recorded = false; started = performance.now(); if (previous && now - previous < 150) { if (warmup) warmup--; else { recorded = true; intervals[cursor] = now - previous; cursor = (cursor + 1) % 240; count = Math.min(240, count + 1) } } else warmup = 30; previous = now },
    end() { if (recorded) costs[(cursor + 239) % 240] = performance.now() - started },
    getState() {
      const frames = Array.from(intervals.subarray(0, count)).sort((a, b) => a - b)
      const cpu = Array.from(costs.subarray(0, count)).sort((a, b) => a - b)
      const median = percentile(frames, .5)
      return { samples: count, fps: median ? +(1000 / median).toFixed(1) : 0, frameP50: +median.toFixed(2), frameP95: +percentile(frames, .95).toFixed(2), cpuP95: +percentile(cpu, .95).toFixed(2) }
    },
  }
}
