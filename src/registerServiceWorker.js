export function registerServiceWorker() {
  if (import.meta.env.MODE === 'desktop' || !import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return
  }

  window.addEventListener('load', () => {
    const version = encodeURIComponent(__APP_BUILD_VERSION__)
    let refreshing = false

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) {
        return
      }

      refreshing = true
      window.location.reload()
    })

    navigator.serviceWorker
      .register(`/sw.js?v=${version}`, { updateViaCache: 'none' })
      .then(watchServiceWorkerUpdates)
      .catch((error) => {
        console.warn('Service worker registration failed:', error)
      })
  })
}

function watchServiceWorkerUpdates(registration) {
  if (registration.waiting) {
    notifyAppUpdateAvailable(registration)
  }

  registration.addEventListener('updatefound', () => {
    const worker = registration.installing

    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        notifyAppUpdateAvailable(registration)
      }
    })
  })
}

function notifyAppUpdateAvailable(registration) {
  window.dispatchEvent(new CustomEvent('lanyin:app-update-available', {
    detail: { registration }
  }))
}
