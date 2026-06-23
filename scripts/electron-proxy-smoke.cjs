const assert = require('node:assert/strict');
const {
  hostMatchesAllowList,
  parseHostAllowList,
  sanitizeMediaProxyHeaders,
  validateMediaTargetUrl,
} = require('../electron/protocolProxy.cjs');

const allowedHosts = parseHostAllowList('music.126.net,.kugou.com');

assert.deepEqual(allowedHosts, ['music.126.net', '.kugou.com']);
assert.equal(hostMatchesAllowList('music.126.net', allowedHosts), true);
assert.equal(hostMatchesAllowList('webfs.kugou.com', allowedHosts), true);
assert.equal(hostMatchesAllowList('example.com', allowedHosts), false);

assert.equal(
  validateMediaTargetUrl('https://music.126.net/song.mp3').ok,
  true,
);
assert.equal(
  validateMediaTargetUrl('ftp://music.126.net/song.mp3').status,
  400,
);
assert.equal(
  validateMediaTargetUrl('http://127.0.0.1/song.mp3').status,
  403,
);
assert.equal(
  validateMediaTargetUrl('https://example.com/song.mp3', {
    allowedHosts,
  }).status,
  403,
);
assert.equal(
  validateMediaTargetUrl('https://webfs.kugou.com/song.mp3', {
    allowedHosts,
  }).ok,
  true,
);

const sanitizedHeaders = sanitizeMediaProxyHeaders(
  new Headers({
    authorization: 'Bearer secret',
    cookie: 'sid=secret',
    range: 'bytes=0-1023',
    referer: 'https://app.example',
  }),
);

assert.equal(sanitizedHeaders.has('authorization'), false);
assert.equal(sanitizedHeaders.has('cookie'), false);
assert.equal(sanitizedHeaders.has('referer'), false);
assert.equal(sanitizedHeaders.get('range'), 'bytes=0-1023');

console.log('Electron proxy smoke passed');
