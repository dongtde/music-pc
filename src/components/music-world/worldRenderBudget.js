// High quality keeps all effects. Only the main drawing-buffer pixel density
// adapts; DOM UI, panorama/material textures and the 512px reflection stay intact.
export function createRenderScaleController({ targetMs = 12, minimumScale = .5 } = {}) {
  const samples = []
  let scale = 1, minimum = minimumScale, fastWindows = 0, warmup = 24, lastCost = null
  return {
    reset(min = minimum) { minimum = Math.min(1, Math.max(.5, min)); scale = 1; samples.length = 0; fastWindows = 0; warmup = 24; lastCost = null },
    observe(milliseconds) {
      if (!Number.isFinite(milliseconds) || milliseconds <= 0 || milliseconds > 250) return scale
      if (warmup > 0) { warmup--; return scale } // Shader compilation/uploads are transient.
      samples.push(milliseconds)
      if (samples.length < 16) return scale
      samples.sort((a, b) => a - b)
      lastCost = samples[12] // Include periodic reflection work, not a single worst frame.
      samples.length = 0
      if (lastCost > targetMs * 1.12) {
        const desired = scale * Math.sqrt(targetMs / lastCost)
        scale = Math.max(minimum, Math.floor(Math.max(scale - .15, desired) * 32) / 32)
        fastWindows = 0
      } else if (lastCost < targetMs * .7) {
        if (++fastWindows >= 8) { scale = Math.min(1, scale + 1 / 32); fastWindows = 0 }
      } else fastWindows = 0
      return scale
    },
    getState: () => ({ scale, minimumScale: minimum, targetGpuMs: targetMs, measuredGpuMs: lastCost }),
  }
}

export function createWorldRenderBudget(renderer) {
  const gl = renderer.getContext(), timer = gl.getExtension('EXT_disjoint_timer_query_webgl2')
  const controller = createRenderScaleController(), pending = []
  let enabled = false, disposed = false, query = null, sampleFrame = 0, generation = 0
  let width = 1, height = 1, ratio = 1, appliedScale = 1, lastFrame = null, started = 0, frameInterval = 0
  function clearQueries() {
    if (query) { gl.endQuery(timer.TIME_ELAPSED_EXT); gl.deleteQuery(query); query = null }
    pending.forEach(entry => gl.deleteQuery(entry.query)); pending.length = 0
  }
  function reset() {
    clearQueries(); generation++; lastFrame = null
    // May go down to the balanced preset's pixel budget, never below it.
    controller.reset(Math.sqrt(Math.min(width * height * ratio * ratio, 1920 * 1080) / (width * height * ratio * ratio)))
  }
  function visibility() { clearQueries(); lastFrame = null }
  document.addEventListener('visibilitychange', visibility)
  return {
    configure(w, h, baseRatio) {
      if (w !== width || h !== height || baseRatio !== ratio) {
        width = w; height = h; ratio = baseRatio; reset()
      }
      appliedScale = enabled ? controller.getState().scale : 1
      return appliedScale
    },
    setEnabled(value) { if (enabled !== value) { enabled = value; reset() } },
    // Called before the main render, never during a recursive reflection render.
    begin(now) {
      if (disposed) return false
      const disjoint = timer && gl.getParameter(timer.GPU_DISJOINT_EXT)
      if (disjoint) { clearQueries(); generation++ }
      while (pending.length && gl.getQueryParameter(pending[0].query, gl.QUERY_RESULT_AVAILABLE)) {
        const entry = pending.shift()
        if (enabled && entry.generation === generation) controller.observe(gl.getQueryParameter(entry.query, gl.QUERY_RESULT) / 1e6)
        gl.deleteQuery(entry.query)
      }
      const scale = enabled ? controller.getState().scale : 1
      const resized = scale !== appliedScale
      if (resized) {
        renderer.setDrawingBufferSize(width, height, ratio * scale); appliedScale = scale
        // Queries submitted before the resize describe a different pixel budget.
        clearQueries(); generation++
      }
      frameInterval = lastFrame === null ? 0 : now - lastFrame; lastFrame = now; started = performance.now()
      if (enabled && timer && !disjoint && ++sampleFrame % 2 === 0 && pending.length < 4) {
        query = gl.createQuery(); if (query) gl.beginQuery(timer.TIME_ELAPSED_EXT, query)
      }
      return resized
    },
    end() {
      if (query) { gl.endQuery(timer.TIME_ELAPSED_EXT); pending.push({ query, generation }); query = null }
      // Fallback only for sustained slow frames; native 48/50Hz pacing must not
      // be mistaken for GPU overload. Ignore idle/background gaps and CPU stalls.
      if (enabled && !timer && frameInterval > 0 && frameInterval < 100 && performance.now() - started < frameInterval * .5 && (frameInterval > 30 || controller.getState().scale < 1)) {
        controller.observe(frameInterval < 25 ? 6 : frameInterval * .75)
      }
    },
    abort() { clearQueries(); lastFrame = null },
    getState: () => ({ enabled, ...controller.getState(), appliedScale, timing: timer ? 'gpu' : 'frame-fallback' }),
    dispose() { if (disposed) return; clearQueries(); disposed = true; document.removeEventListener('visibilitychange', visibility) },
  }
}
