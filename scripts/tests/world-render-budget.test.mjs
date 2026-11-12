import assert from 'node:assert/strict'
import test from 'node:test'
import { createRenderScaleController, createWorldRenderBudget } from '../../src/components/music-world/worldRenderBudget.js'

test('sustained GPU overload reduces pixel density, never below the balanced pixel budget', () => {
  const control = createRenderScaleController(), minimum = Math.sqrt(1920 * 1080 / (2880 * 1464))
  control.reset(minimum)
  for (let i = 0; i < 39; i++) control.observe(30)
  assert.equal(control.getState().scale, 1, 'warm-up and first incomplete window must not resize')
  control.observe(30)
  assert.ok(control.getState().scale < 1)
  for (let i = 0; i < 160; i++) control.observe(30)
  assert.equal(control.getState().scale, minimum)
  assert.ok(Math.abs(2880 * 1464 * control.getState().scale ** 2 - 1920 * 1080) < 1e-8)
})

test('transient stalls and 48Hz scheduling do not cause a quality drop; recovery has hysteresis', () => {
  const control = createRenderScaleController()
  for (let i = 0; i < 200; i++) control.observe(i % 16 === 0 ? 100 : 8)
  assert.equal(control.getState().scale, 1)
  for (const value of [NaN, Infinity, 0, -1, 400]) control.observe(value)
  assert.equal(control.getState().scale, 1)
  for (let i = 0; i < 64; i++) control.observe(30)
  const low = control.getState().scale
  assert.ok(low < 1)
  for (let i = 0; i < 64; i++) control.observe(5)
  assert.equal(control.getState().scale, low)
  for (let i = 0; i < 4000; i++) control.observe(5)
  assert.equal(control.getState().scale, 1)
})

function setup(t, { timer = true } = {}) {
  let now = 0, active = null
  const listeners = new Map(), queries = new Set(), resizes = []
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name),
  } })
  t.mock.method(performance, 'now', () => now)
  const gl = {
    QUERY_RESULT_AVAILABLE: 1, QUERY_RESULT: 2, ready: true, disjoint: false,
    drawingBufferWidth: 2880, drawingBufferHeight: 1464,
    getExtension: () => timer ? { TIME_ELAPSED_EXT: 3, GPU_DISJOINT_EXT: 4 } : null,
    getParameter() { return this.disjoint },
    createQuery() { const q = {}; queries.add(q); return q },
    beginQuery(_, q) { assert.equal(active, null); active = q },
    endQuery() { assert.ok(active); active = null },
    deleteQuery(q) { assert.notEqual(q, active); assert.ok(queries.delete(q)) },
    getQueryParameter(q, property) { assert.ok(queries.has(q)); if (property === 1) return this.ready; assert.equal(this.ready, true); return 30e6 },
  }
  const renderer = { getContext: () => gl, setDrawingBufferSize(w, h, ratio) {
    assert.equal(active, null, 'never resize while a timer query is active')
    resizes.push({ w, h, ratio }); gl.drawingBufferWidth = Math.floor(w * ratio); gl.drawingBufferHeight = Math.floor(h * ratio)
  } }
  const budget = createWorldRenderBudget(renderer)
  budget.configure(2880, 1464, 1)
  const frame = (interval = 16, cpu = 3) => { now += interval; budget.begin(now); now += cpu; budget.end() }
  t.after(() => {
    budget.dispose()
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument); else delete globalThis.document
  })
  return { budget, gl, queries, listeners, resizes, frame }
}

test('GPU queries stay asynchronous/bounded and reset safely on visibility, disjoint and dispose', t => {
  const { budget, gl, queries, listeners, frame } = setup(t)
  budget.setEnabled(true); gl.ready = false
  for (let i = 0; i < 30; i++) frame()
  assert.equal(queries.size, 4)
  listeners.get('visibilitychange')(); assert.equal(queries.size, 0)
  frame(); frame(); assert.ok(queries.size)
  gl.disjoint = true; frame(); assert.equal(queries.size, 0)
  gl.disjoint = false; frame(); frame()
  budget.dispose(); assert.equal(queries.size, 0); assert.equal(listeners.size, 0)
})

test('production timing resizes the buffer, and disabling adaptive quality restores full resolution', t => {
  const { budget, queries, resizes, frame } = setup(t)
  budget.setEnabled(true)
  for (let i = 0; i < 240; i++) frame()
  assert.ok(resizes.length > 0)
  assert.ok(budget.getState().appliedScale < 1)
  budget.setEnabled(false); frame()
  assert.equal(budget.getState().appliedScale, 1)
  assert.equal(resizes.at(-1).ratio, 1)
  assert.equal(queries.size, 0)
})

test('resizing discards old GPU queries and preserves full density for small viewports', t => {
  const { budget, gl, queries, frame } = setup(t)
  budget.setEnabled(true)
  for (let i = 0; i < 160; i++) frame()
  assert.ok(budget.getState().appliedScale < 1)
  gl.ready = false
  for (let i = 0; i < 16; i++) frame()
  assert.ok(queries.size > 0)
  budget.configure(1000, 700, 1)
  assert.equal(queries.size, 0)
  gl.drawingBufferWidth = 1000; gl.drawingBufferHeight = 700
  gl.ready = true
  for (let i = 0; i < 160; i++) frame()
  assert.equal(budget.getState().minimumScale, 1)
  assert.equal(budget.getState().scale, 1)
})

test('timerless fallback preserves native 48Hz and ignores CPU stalls or background gaps', t => {
  const { budget, frame } = setup(t, { timer: false })
  budget.setEnabled(true)
  for (let i = 0; i < 80; i++) frame(1000 / 48 - 3, 3)
  assert.equal(budget.getState().scale, 1)
  for (let i = 0; i < 80; i++) frame(10, 40)
  assert.equal(budget.getState().scale, 1)
  frame(2000)
  for (let i = 0; i < 80; i++) frame(45, 3)
  assert.ok(budget.getState().scale < 1)
  for (let i = 0; i < 2400; i++) frame(1000 / 48 - 3, 3)
  assert.equal(budget.getState().scale, 1)
})
