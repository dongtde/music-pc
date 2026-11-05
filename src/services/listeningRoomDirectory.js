import { ROOM_DIRECTORY_PATH, normalizeRoomServer } from './listeningRoomProtocol.js'

// Discovery is a read-only HTTP request; it does not join a room or take over the player.
export async function fetchListeningRooms(serverUrl, { signal, timeoutMs = 8000, fetchRequest = globalThis.fetch } = {}) {
  const endpoint = normalizeRoomServer(serverUrl)
  const cancelled = () => new DOMException('房间查找已取消。', 'AbortError')
  if (signal?.aborted) throw cancelled()
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, timeoutMs)
  try {
    const response = await fetchRequest(`${endpoint}${ROOM_DIRECTORY_PATH}`, { signal: controller.signal, cache: 'no-store' })
    if (!response.ok) {
      if (response.status === 404) throw new Error('服务暂不支持房间列表，请更新后端，或使用房间码加入。')
      if (response.status === 403) throw new Error('服务未允许当前页面访问，请检查连接设置。')
      throw new Error('无法获取房间列表，请稍后刷新重试。')
    }
    let data
    try { data = await response.json() }
    catch { throw new Error('服务未返回有效的房间列表，请检查连接地址或更新后端。') }
    if (!Array.isArray(data?.rooms)) throw new Error('服务未返回有效的房间列表，请检查连接地址或更新后端。')
    if (controller.signal.aborted) throw cancelled()
    return { serverUrl: endpoint, rooms: data.rooms }
  } catch (error) {
    if (signal?.aborted) throw cancelled()
    if (controller.signal.aborted) throw new Error('查找房间超时，请检查连接地址和网络后重试。')
    if (error instanceof TypeError) throw new Error('无法获取房间列表，请检查连接地址，并确认一起听服务已启动。')
    throw error
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}
