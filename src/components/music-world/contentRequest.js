export async function contentRequest(request, timeout = 12000) {
  let timer
  try {
    return await Promise.race([request, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Music content request timed out')), timeout)
    })])
  } finally { clearTimeout(timer) }
}
