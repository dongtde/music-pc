import assert from 'node:assert/strict'
import { getPlayerSwipeAction, getPlayerSwipeAxis, getMiniPlayerSwipeDirection, getPlayerPageIndex, getPlayerPageTarget, getPlayerPageDragOffset, MOBILE_PLAYER_PAGES } from '../src/utils/mobilePlayerSwipe.js'

assert.deepEqual(MOBILE_PLAYER_PAGES.map(page => page.id), ['danmaku', 'cover', 'lyrics'])
assert.equal(getPlayerPageIndex('cover'), 1)
assert.equal(getPlayerPageIndex('unknown'), 1)
assert.equal(getPlayerPageTarget('cover', 1), 'lyrics')
assert.equal(getPlayerPageTarget('cover', -1), 'danmaku')
assert.equal(getPlayerPageTarget('danmaku', 1), 'cover')
assert.equal(getPlayerPageTarget('lyrics', -1), 'cover')
assert.equal(getPlayerPageTarget('danmaku', -1), 'danmaku')
assert.equal(getPlayerPageTarget('lyrics', 1), 'lyrics')
const ready = { canChangeTrack: true, trackLoading: false }
for (const { id: page } of MOBILE_PLAYER_PAGES) {
  assert.equal(getPlayerSwipeAxis(-100, 5, { ...ready, page }), 'horizontal')
  assert.equal(getPlayerSwipeAxis(100, -5, { ...ready, page }), 'horizontal')
  const expected = page === 'cover' ? 'vertical' : 'scroll'
  assert.equal(getPlayerSwipeAxis(5, -120, { ...ready, page }), expected)
  assert.equal(getPlayerSwipeAxis(-5, 120, { ...ready, page }), expected)
}
assert.equal(getPlayerSwipeAxis(4, 8, { ...ready, page: 'cover' }), null)
assert.equal(getPlayerSwipeAxis(20, 22, { ...ready, page: 'cover' }), null)
assert.equal(getPlayerSwipeAxis(0, -120, { page: 'cover', canChangeTrack: false }), 'scroll')
assert.equal(getPlayerSwipeAxis(0, -120, { ...ready, page: 'cover', trackLoading: true }), 'scroll')
assert.equal(getPlayerSwipeAxis(-100, 0, { ...ready, page: 'cover', trackLoading: true }), 'horizontal')

for (const [width, height] of [[320, 568], [390, 844], [430, 932], [667, 375]]) {
  assert.equal(getPlayerPageDragOffset('cover', -100, width), -100)
  assert.equal(getPlayerPageDragOffset('cover', 100, width), 100)
  assert.equal(getPlayerPageDragOffset('danmaku', 100, width), 25)
  assert.equal(getPlayerPageDragOffset('lyrics', -100, width), -25)
  assert.equal(getPlayerPageDragOffset('cover', width * 2, width), width)
  assert.equal(getPlayerPageDragOffset('danmaku', width * 2, width), width * .25)
  assert.equal(getPlayerSwipeAction({ axis: 'vertical', dy: -140, width, height }), 'next-song')
  assert.equal(getPlayerSwipeAction({ axis: 'vertical', dy: 140, width, height }), 'previous-song')
  assert.equal(getPlayerSwipeAction({ axis: 'vertical', dy: -25, width, height }), null)
  assert.equal(getPlayerSwipeAction({ axis: 'horizontal', dx: -100, width, height }), 'next-page')
  assert.equal(getPlayerSwipeAction({ axis: 'horizontal', dx: 100, width, height }), 'previous-page')
  assert.equal(getPlayerSwipeAction({ axis: 'horizontal', dx: 20, width, height }), null)
  assert.equal(getPlayerSwipeAction({ axis: 'scroll', dy: -200, width, height }), null)
  for (const direction of [-1, 1]) {
    assert.equal(getMiniPlayerSwipeDirection({ dx: direction * width * .69, dy: 0, width }), 0)
    assert.equal(getMiniPlayerSwipeDirection({ dx: direction * width * .7, dy: 0, width }), 0)
    assert.equal(getMiniPlayerSwipeDirection({ dx: direction * width * .700001, dy: 0, width }), -direction)
    assert.equal(getMiniPlayerSwipeDirection({ dx: direction * width * .71, dy: 5, width }), -direction)
  }
  assert.equal(getMiniPlayerSwipeDirection({ dx: -20, dy: 0, width }), 0)
  assert.equal(getMiniPlayerSwipeDirection({ dx: 0, dy: -100, width }), 0)
  assert.equal(getMiniPlayerSwipeDirection({ dx: 70, dy: 80, width }), 0)
  assert.equal(getMiniPlayerSwipeDirection({ dx: -70, dy: 80, width }), 0)
}
for (const width of [0, -100, NaN, Infinity]) {
  assert.equal(getMiniPlayerSwipeDirection({ dx: -100, width }), 0)
}
console.log('Mobile player checks passed: full-player gestures and mini-player commits only above 70% progress.')
