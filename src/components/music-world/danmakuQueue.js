export function createDanmakuQueue() {
  let track = '', items = [], seen = new Set(), cursor = 0, version = 0, signature = ''
  return {
    setSource(trackId, comments = []) {
      if (track !== trackId) { track = trackId; seen.clear(); cursor = 0; signature = ''; version++ }
      const unique = new Map()
      for (const item of comments) {
        const content = String(item?.content || '').replace(/\s+/g, ' ').trim()
        if (!content) continue
        const key = String(item.id ?? `${item.user?.name}:${content}`)
        unique.set(key, { ...item, key, content, hot: Boolean(item.hot || unique.get(key)?.hot || item.likedCount >= 500) })
      }
      items = [...unique.values()]
      const next = items.map(item => item.key).join('|')
      if (next !== signature) { signature = next; version++ }
      seen = new Set([...seen].filter(key => unique.has(key)))
      cursor %= items.length || 1
    },
    take(activeKeys = []) {
      const active = new Set(activeKeys)
      let index = items.findIndex(item => !seen.has(item.key) && !active.has(item.key))
      if (index < 0) {
        for (let i = 0; i < items.length; i++) {
          const candidate = (cursor + i) % items.length
          if (!active.has(items[candidate].key)) { index = candidate; break }
        }
      }
      if (index < 0) return null
      const item = items[index]; seen.add(item.key); cursor = (index + 1) % items.length
      return item
    },
    getState: () => ({ count: items.length, unread: items.length - seen.size, version }),
  }
}
