export function createLruCache(maxSize = 100) {
  const limit = normalizeLimit(maxSize)
  const store = new Map()

  const cache = {
    get size() {
      return store.size
    },

    has(key) {
      return store.has(key)
    },

    get(key) {
      if (!store.has(key)) {
        return undefined
      }

      const value = store.get(key)
      store.delete(key)
      store.set(key, value)
      return value
    },

    set(key, value) {
      if (store.has(key)) {
        store.delete(key)
      }

      store.set(key, value)
      trimOldestEntries()
      return cache
    },

    delete(key) {
      return store.delete(key)
    },

    clear() {
      store.clear()
    }
  }

  function trimOldestEntries() {
    while (store.size > limit) {
      const oldestKey = store.keys().next().value
      store.delete(oldestKey)
    }
  }

  return cache
}

function normalizeLimit(maxSize) {
  const limit = Number(maxSize)

  if (!Number.isFinite(limit) || limit < 1) {
    return 1
  }

  return Math.floor(limit)
}
