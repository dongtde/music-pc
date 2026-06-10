export function canUseStorage(storageName = 'localStorage') {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return Boolean(window[storageName])
  } catch {
    return false
  }
}

export function readStorage(key, fallback = '', storageName = 'localStorage') {
  if (!canUseStorage(storageName)) {
    return fallback
  }

  try {
    return window[storageName].getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function writeStorage(key, value, storageName = 'localStorage') {
  if (!canUseStorage(storageName)) {
    return false
  }

  try {
    if (value === null || value === undefined || value === '') {
      window[storageName].removeItem(key)
    } else {
      window[storageName].setItem(key, String(value))
    }

    return true
  } catch {
    return false
  }
}

export function readJsonStorage(key, fallback = null, storageName = 'localStorage') {
  const raw = readStorage(key, '', storageName)

  if (!raw) {
    return fallback
  }

  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function writeJsonStorage(key, value, storageName = 'localStorage') {
  if (value === null || value === undefined) {
    return writeStorage(key, '', storageName)
  }

  try {
    return writeStorage(key, JSON.stringify(value), storageName)
  } catch {
    return false
  }
}

