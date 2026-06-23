const SW_VERSION = new URL(self.location.href).searchParams.get('v') || 'dev'
const APP_CACHE = `lanyin-music-app-${SW_VERSION}`
const RUNTIME_CACHE = `lanyin-music-runtime-${SW_VERSION}`
const CACHE_NAMES = [APP_CACHE, RUNTIME_CACHE]
const MAX_RUNTIME_CACHE_ENTRIES = 120

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/pwa/icon.svg',
  '/pwa/icon-192.png',
  '/pwa/icon-512.png',
  '/pwa/apple-touch-icon.png'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !CACHE_NAMES.includes(key)).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)

  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request))
    return
  }

  if (shouldCacheRuntimeAsset(request)) {
    event.respondWith(cacheFirst(request))
  }
})

async function handleNavigation(request) {
  try {
    const response = await fetch(request)

    if (response.ok) {
      const cache = await caches.open(APP_CACHE)
      cache.put('/index.html', response.clone())
    }

    return response
  } catch (error) {
    return (await caches.match('/index.html')) || Response.error()
  }
}

function shouldCacheRuntimeAsset(request) {
  return ['font', 'image', 'manifest', 'script', 'style'].includes(request.destination)
}

async function cacheFirst(request) {
  const cached = await caches.match(request)

  if (cached) {
    return cached
  }

  const response = await fetch(request)

  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(RUNTIME_CACHE)
    await cache.put(request, response.clone())
    await trimRuntimeCache(cache)
  }

  return response
}

async function trimRuntimeCache(cache) {
  const keys = await cache.keys()

  if (keys.length <= MAX_RUNTIME_CACHE_ENTRIES) {
    return
  }

  await Promise.all(
    keys
      .slice(0, keys.length - MAX_RUNTIME_CACHE_ENTRIES)
      .map((request) => cache.delete(request))
  )
}
