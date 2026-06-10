const cacheStore = new Map()

export function getCachedData(key, ttlMs, loader) {
  const now = Date.now()
  const cached = cacheStore.get(key)

  if (cached && cached.expiresAt > now) {
    return cached.promise.then(cloneCachedData)
  }

  const promise = Promise.resolve()
    .then(loader)
    .catch((error) => {
      cacheStore.delete(key)
      throw error
    })

  cacheStore.set(key, {
    expiresAt: now + ttlMs,
    promise
  })

  return promise.then(cloneCachedData)
}

export function cacheKey(scope, payload = '') {
  return `${scope}:${stableStringify(payload)}`
}

export function clearServiceCache() {
  cacheStore.clear()
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`
  }

  return JSON.stringify(value)
}

function cloneCachedData(value) {
  if (!value || typeof value !== 'object') {
    return value
  }

  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value)
    } catch {
      // API payloads are plain data; JSON clone is enough as a fallback.
    }
  }

  return JSON.parse(JSON.stringify(value))
}

