export function isAbortError(error) {
  return Boolean(
    error?.name === 'AbortError' ||
      error?.name === 'CanceledError' ||
      error?.code === 'ERR_CANCELED' ||
      error?.message === 'canceled'
  )
}
