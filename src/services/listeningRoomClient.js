import { io } from 'socket.io-client'
import { ROOM_SOCKET_PATH, normalizeRoomServer, parseRoomInvitation, playbackPosition, roomQueue, roomTrack } from './listeningRoomProtocol.js'

const SESSION_KEY = 'lanyin.listening.session'
const monotonicNow = () => performance.timeOrigin + performance.now()
const commandId = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
const availableSessionStorage = () => { try { return globalThis.sessionStorage } catch { return null } }

export function createListeningRoomClient({ player, state, storage = availableSessionStorage(), createSocket = io, now = monotonicNow }) {
  let socket, driver, preparation, startTimer, pollTimer, clockTimer, seekTimer
  let preparedGeneration = -1, loadingGeneration = -1, failedGeneration = -1, queueVersion = -1
  let offset = 0, lifecycle = 0, commandChain = Promise.resolve(), playPending = false, playAttempt = 0, restored = false
  let pendingSnapshot = null, pendingSeek = null, audioListeners = [], lastBuffering = false
  let presenceSequence = 0, lastPresenceSent = -Infinity
  function acceptPresence(value) {
    if (!value || value.roomId !== state.room?.id || !Array.isArray(value.players)) return
    if (state.presence?.roomId === value.roomId && state.presence.version > value.version) return
    state.presence = value
  }
  async function setPresenceActive(active, avatar = state.avatar || 'mint') {
    state.presenceActive = Boolean(active); state.avatar = avatar
    if (!state.connected || !state.room) return true
    const epoch = lifecycle, roomId = state.room.id
    try {
      const reply = await request('presence:profile', { active: state.presenceActive, avatar })
      if (epoch === lifecycle && roomId === state.room?.id) acceptPresence(reply.presence)
      return true
    } catch { return false }
  }
  function movePresence(pose, force = false) {
    if (!state.connected || !state.room || !state.presenceActive || !socket?.connected || (!force && now() - lastPresenceSent < 50)) return
    lastPresenceSent = now()
    // Volatile packets are never replayed after reconnecting or accumulated offline.
    socket.volatile.emit('presence:move', { x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw, motion: pose.motion, seq: ++presenceSequence })
  }
  async function takeSeat(seatId = '') {
    if (!state.room) return true
    if (!state.connected) { state.presenceError = '连接恢复后才能使用房间座位。'; return false }
    const epoch = lifecycle, roomId = state.room.id
    try {
      const reply = await request('presence:seat', { seatId })
      if (epoch !== lifecycle || roomId !== state.room?.id) return false
      acceptPresence(reply.presence); state.presenceError = ''; return true
    } catch (error) { state.presenceError = error.message; return false }
  }
  const readSession = () => { try { return JSON.parse(storage?.getItem(SESSION_KEY) || 'null') } catch { return null } }
  function saveSession(token) {
    try { storage?.setItem(SESSION_KEY, JSON.stringify({ token: token || socket?.auth.token, serverUrl: state.serverUrl, roomId: state.room?.id || '', name: state.name })) } catch { /* Storage may be unavailable in private sessions. */ }
  }
  function request(event, payload = {}, target = socket) {
    if (!target?.connected) return Promise.reject(new Error('连接已断开，正在尝试重新连接。'))
    return new Promise((resolve, reject) => {
      target.timeout(8000).emit(event, payload, (error, result) => {
        if (error) reject(new Error('服务器响应超时，请检查连接后重试。'))
        else if (!result?.ok) reject(new Error(result?.error || '操作失败，请重试。'))
        else resolve(result)
      })
    })
  }
  async function calibrate(target = socket) {
    let best
    for (let index = 0; index < 4; index++) {
      const sent = now(), result = await request('clock:ping', {}, target), received = now()
      const sample = { latency: received - sent, offset: result.serverTime - (sent + received) / 2 }
      if (!best || sample.latency < best.latency) best = sample
    }
    if (target !== socket) return
    offset = best.offset; state.latency = Math.round(best.latency)
  }
  function clearPlaybackWork() {
    playAttempt++; playPending = false
    preparation?.abort(); preparation = null
    clearTimeout(startTimer); clearTimeout(seekTimer)
    if (pendingSeek) { pendingSeek.resolve(false); pendingSeek = null }
    preparedGeneration = loadingGeneration = failedGeneration = -1
    driver?.pause(); driver?.setWaiting(false)
  }
  function detach(reason = '') {
    lifecycle++; clearPlaybackWork()
    for (const [event, callback] of audioListeners) driver?.audio.removeEventListener(event, callback)
    audioListeners = []; driver?.release(); driver = null
    state.room = null; state.presence = null; state.presenceError = ''; state.createdRoomId = ''; state.localError = ''; state.autoplayBlocked = false; state.syncStatus = 'idle'
    state.notice = reason; queueVersion = -1; pendingSnapshot = null; saveSession()
  }
  function bindDriver() {
    if (driver) return
    driver = player.attachRoomController({ command, ended() { if (state.room?.hostId === state.memberId) void command('ended') } })
    const buffering = value => {
      if (!state.connected || !state.room || preparedGeneration !== state.room.playback.generation) return
      if (lastBuffering === value) return
      lastBuffering = value
      void request('playback:buffering', { generation: preparedGeneration, buffering: value }).catch(() => {})
      if (!value) reconcile()
    }
    const onError = () => {
      if (!state.room || loadingGeneration >= 0) return
      state.localError = '歌曲加载失败，请重新加载或换一首。'; failedGeneration = state.room.playback.generation
      driver.pause(); state.syncStatus = 'error'
      void request('playback:ready', { generation: failedGeneration, error: state.localError }).catch(() => {})
    }
    audioListeners = [['waiting', () => buffering(true)], ['playing', () => buffering(false)], ['canplay', () => buffering(false)], ['error', onError]]
    for (const [event, callback] of audioListeners) driver.audio.addEventListener(event, callback)
  }
  async function prepareCurrent() {
    const p = state.room?.playback
    if (!p?.track || !state.connected || p.generation === loadingGeneration || p.generation === failedGeneration) return
    preparation?.abort(); preparation = new AbortController()
    const signal = preparation.signal, generation = p.generation, epoch = lifecycle
    loadingGeneration = generation; preparedGeneration = -1; state.localError = ''; state.autoplayBlocked = false; state.syncStatus = 'loading'
    lastBuffering = false
    try {
      const result = await driver.prepare(p.track, signal)
      if (signal.aborted || epoch !== lifecycle || state.room?.playback.generation !== generation) return
      preparedGeneration = generation; loadingGeneration = -1
      const reply = await request('playback:ready', { generation, duration: result.duration })
      if (epoch !== lifecycle || signal.aborted) return
      if (!reply.room.members.find(member => member.id === state.memberId)?.error) state.localError = ''
      accept(reply.room); reconcile(true)
    } catch (error) {
      if (error.name === 'AbortError' || signal.aborted || epoch !== lifecycle) return
      loadingGeneration = -1; failedGeneration = generation; state.localError = error.message; state.syncStatus = 'error'
      driver?.setWaiting(false)
      void request('playback:ready', { generation, error: error.message }).catch(() => {})
    }
  }
  function reportPlayError(error, epoch, generation) {
    if (epoch !== lifecycle || generation !== state.room?.playback.generation) return
    if (error.name === 'AbortError' || !state.room.playback.playing) return
    state.autoplayBlocked = error.name === 'NotAllowedError' || /自动播放|user gesture|not allowed/i.test(error.message)
    state.localError = state.autoplayBlocked ? '点击“启用声音”，跟上房间播放。' : '播放失败，请重新加载歌曲。'
    state.syncStatus = 'error'
  }
  function reconcile(hard = false) {
    clearTimeout(startTimer)
    const p = state.room?.playback
    if (!driver || !p || !state.connected) return
    if (!p.track) { driver.pause(); driver.clearTrack?.(); driver.setWaiting(false); state.syncStatus = 'waiting'; return }
    if (state.localError || state.autoplayBlocked) { driver.setWaiting(false); return }
    if (preparedGeneration !== p.generation) { void prepareCurrent(); return }
    driver.setWaiting(p.preparing)
    if (p.preparing) { driver.pause(); state.syncStatus = 'waiting'; return }
    const serverNow = now() + offset, target = playbackPosition(p, serverNow), delta = target - driver.currentTime()
    state.driftMs = Math.round(delta * 1000)
    if (p.playing && p.anchorTime > serverNow) {
      driver.pause(); if (Math.abs(driver.currentTime() - p.position) > .05) driver.seek(p.position); state.syncStatus = 'scheduled'
      startTimer = setTimeout(() => reconcile(true), Math.ceil(p.anchorTime - serverNow))
      return
    }
    if (!p.playing) {
      driver.pause(); if (Math.abs(delta) > .06) driver.seek(target)
      state.syncStatus = 'paused'; return
    }
    if (hard || driver.audio.paused || Math.abs(delta) > .5) { driver.seek(target); driver.setRate(1) }
    else driver.setRate(Math.abs(delta) > .1 ? 1 + Math.max(-.025, Math.min(.025, delta * .08)) : 1)
    state.syncStatus = 'playing'
    if (driver.audio.paused && !playPending) {
      const epoch = lifecycle, attempt = ++playAttempt, generation = p.generation
      playPending = true
      void driver.play().catch(error => reportPlayError(error, epoch, generation)).finally(() => { if (attempt === playAttempt) playPending = false })
    }
  }
  function accept(room) {
    if (!room || (state.room && (state.room.id !== room.id || state.room.revision > room.revision))) return
    if (!room.members.some(member => member.id === state.memberId)) return
    const previous = state.room?.playback
    const hard = !previous || ['generation', 'anchorTime', 'position', 'playing'].some(key => previous[key] !== room.playback[key])
    state.room = room; acceptPresence(room.presence); state.error = ''; bindDriver()
    if (queueVersion !== room.queueVersion || player.state.playMode !== room.playMode) { driver.setQueue(room.queue, room.playMode); queueVersion = room.queueVersion }
    const self = room.members.find(member => member.id === state.memberId)
    if (self.error && !state.localError && loadingGeneration !== room.playback.generation) { state.localError = self.error; failedGeneration = room.playback.generation; driver.pause(); state.syncStatus = 'error' }
    if (previous?.generation !== room.playback.generation) { state.localError = ''; state.autoplayBlocked = false; failedGeneration = -1; playAttempt++; playPending = false }
    saveSession(); reconcile(hard)
  }
  function beginPolling() {
    clearInterval(pollTimer); clearInterval(clockTimer)
    pollTimer = setInterval(() => {
      if (!state.room || !state.connected) return
      const epoch = lifecycle, id = state.room.id
      void request('room:snapshot').then(result => { if (epoch === lifecycle && state.room?.id === id) accept(result.room) }).catch(error => {
        if (epoch === lifecycle && /房间已失效/.test(error.message)) detach(error.message)
      })
    }, 2000)
    clockTimer = setInterval(() => { if (state.connected) void calibrate().then(() => reconcile()).catch(() => {}) }, 30000)
  }
  let resyncing = false
  async function onVisible() {
    if (globalThis.document?.hidden || !state.room || !state.connected || resyncing) return
    const epoch = lifecycle
    resyncing = true
    try {
      await calibrate()
      const result = await request('room:snapshot')
      if (epoch === lifecycle && state.room) accept(result.room)
    } catch { /* Regular reconnection and polling remain active. */ }
    finally { resyncing = false }
  }
  globalThis.document?.addEventListener('visibilitychange', onVisible)
  async function connect(serverUrl) {
    const endpoint = normalizeRoomServer(serverUrl)
    if (socket?.connected && state.connected && state.serverUrl === endpoint) return
    if (state.room && state.serverUrl !== endpoint) throw new Error('请先退出当前房间，再更换连接地址。')
    const saved = readSession()
    if (socket) { const previous = socket; socket = null; lifecycle++; clearPlaybackWork(); previous.disconnect() }
    clearInterval(pollTimer); clearInterval(clockTimer)
    state.serverUrl = endpoint; state.connecting = true; state.connected = false; state.error = ''
    const target = createSocket(endpoint, { path: ROOM_SOCKET_PATH, transports: ['websocket'], autoConnect: false, reconnection: true, reconnectionDelay: 800, reconnectionDelayMax: 4000, timeout: 7000, auth: { token: saved?.serverUrl === endpoint ? saved.token : undefined } })
    socket = target
    await new Promise((resolve, reject) => {
      let settled = false
      const timeout = setTimeout(() => failed(new Error('无法连接一起听服务，请检查连接地址和网络。')), 12000)
      function failed(error) {
        if (target !== socket) return
        state.connecting = false; state.error = error.message
        if (!settled) { settled = true; clearTimeout(timeout); reject(error) }
        if (!state.room) { target.disconnect(); clearInterval(pollTimer); clearInterval(clockTimer) }
      }
      target.on('connect', async () => {
        try {
          const hello = await request('session:hello', {}, target)
          if (target !== socket) return
          target.auth.token = hello.token; state.memberId = hello.memberId; state.lanUrls = hello.lanUrls || []; state.publicUrl = hello.publicUrl || ''
          await calibrate(target)
          if (target !== socket) return
          state.connected = true; state.connecting = false; state.error = ''
          saveSession(hello.token)
          if (hello.room) {
            const next = pendingSnapshot?.id === hello.room.id && pendingSnapshot.revision > hello.room.revision ? pendingSnapshot : hello.room
            pendingSnapshot = null; accept(next)
          } else if (state.room || saved?.roomId) detach('原房间已结束，可以重新创建或加入。')
          presenceSequence = 0; lastPresenceSent = -Infinity
          if (state.room) await setPresenceActive(state.presenceActive, state.avatar)
          beginPolling()
          if (!settled) { settled = true; clearTimeout(timeout); resolve() }
        } catch (error) { failed(error) }
      })
      target.on('connect_error', () => failed(new Error('无法连接一起听服务，请检查连接地址，并确认服务已启动。')))
      target.on('room:state', room => {
        if (target !== socket) return
        if (state.connected && state.room?.id === room.id) accept(room)
        else pendingSnapshot = room
      })
      target.on('room:closed', result => { if (target === socket) detach(result.reason || '房间已结束。') })
      target.on('presence:state', value => { if (target === socket && state.connected) acceptPresence(value) })
      target.on('disconnect', () => {
        if (target !== socket) return
        lifecycle++; state.connected = false; state.presence = null; clearPlaybackWork()
        if (state.room) state.syncStatus = 'reconnecting'
      })
      target.connect()
    })
  }
  async function enter(kind, { serverUrl, name, invitation } = {}) {
    state.error = ''; state.notice = ''; state.name = String(name || '音乐同伴').trim().slice(0, 24)
    try {
      const parsed = kind === 'join' ? parseRoomInvitation(invitation, serverUrl) : { serverUrl: normalizeRoomServer(serverUrl) }
      await connect(parsed.serverUrl)
      if (state.room) return true
      const payload = kind === 'join' ? { code: parsed.code, name: state.name } : { name: state.name }
      payload.avatar = state.avatar || 'mint'
      const epoch = lifecycle
      const result = await request(`room:${kind}`, payload)
      if (epoch !== lifecycle) return false
      state.createdRoomId = kind === 'create' ? result.room.id : ''
      accept(pendingSnapshot?.id === result.room.id && pendingSnapshot.revision > result.room.revision ? pendingSnapshot : result.room)
      pendingSnapshot = null
      await setPresenceActive(state.presenceActive, state.avatar)
      return true
    } catch (error) { state.error = error.message; return false }
  }
  function deny(message) { state.error = message; driver?.setError(message); return false }
  function command(type, payload = {}) {
    if (!state.room || !state.connected) return Promise.resolve(deny('连接已断开，恢复后才能控制播放。'))
    if (type === 'quality') return Promise.resolve(deny('一起听期间保持当前音质，退出房间后可以切换。'))
    if (type === 'track' && !roomTrack(payload.track)) return Promise.resolve(deny('一起听暂时支持在线歌曲，请选择一首在线歌曲。'))
    if (type === 'append' && !roomQueue(payload.tracks).length) return Promise.resolve(deny('一起听暂时支持在线歌曲，请选择一首在线歌曲。'))
    if (type === 'seek') {
      if (pendingSeek) pendingSeek.resolve(false)
      clearTimeout(seekTimer)
      return new Promise(resolve => {
        pendingSeek = { resolve, generation: state.room.playback.generation }
        seekTimer = setTimeout(() => {
          const pending = pendingSeek; pendingSeek = null
          if (state.room?.playback.generation !== pending.generation) { pending.resolve(false); return }
          void enqueue(type, payload).then(pending.resolve)
        }, 90)
      })
    }
    return enqueue(type, payload)
  }
  function enqueue(type, payload) {
    const epoch = lifecycle, generation = state.room?.playback.generation, expectedQueueVersion = state.room?.queueVersion
    const next = type === 'toggle' ? (state.room.playback.playing ? 'pause' : 'play') : type === 'restart' ? 'seek' : type
    const task = commandChain.then(async () => {
      if (epoch !== lifecycle || !state.room || !state.connected) return false
      state.error = ''; driver?.setError('')
      const data = { ...payload, type: next, generation, queueVersion: expectedQueueVersion, commandId: commandId() }
      if (type === 'restart') data.position = 0
      if (payload.track) data.track = roomTrack(payload.track)
      if (payload.tracks) data.tracks = roomQueue(payload.tracks)
      try {
        const result = await request('playback:command', data)
        if (epoch !== lifecycle) return false
        accept(result.room)
        return true
      } catch (error) { if (epoch === lifecycle) deny(error.message); return false }
    })
    commandChain = task.then(() => undefined, () => undefined)
    return task
  }
  async function retryLocal() {
    if (!state.room) return
    state.localError = ''; state.autoplayBlocked = false; failedGeneration = -1
    preparedGeneration = -1; await prepareCurrent()
  }
  async function enableAudio() {
    if (!driver || !state.room) return
    const epoch = lifecycle, generation = state.room.playback.generation
    try { await driver.play(); state.autoplayBlocked = false; state.localError = ''; reconcile(true) }
    catch (error) { reportPlayError(error, epoch, generation) }
  }
  async function leave() {
    if (!state.room) return
    if (!state.connected) {
      detach('已退出一起听，离线连接会自动释放。')
      const previous = socket; socket = null; previous?.disconnect()
      clearInterval(pollTimer); clearInterval(clockTimer)
      try { storage?.removeItem(SESSION_KEY) } catch { /* Local exit also works without storage. */ }
      return
    }
    try { await request('room:leave'); if (state.room) detach('已退出一起听。') }
    catch (error) { state.error = error.message }
  }
  async function restore() {
    if (restored) return
    restored = true
    const saved = readSession()
    if (!saved?.roomId || !saved.serverUrl) return
    state.name = saved.name || '音乐同伴'
    try { await connect(saved.serverUrl) } catch { /* The panel exposes a retry action. */ }
  }
  function invitation() {
    if (!state.room) return ''
    let endpoint = state.publicUrl || state.serverUrl
    if (!state.publicUrl && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(endpoint).hostname) && state.lanUrls.length) endpoint = state.lanUrls[0]
    return `澜音 · 一起听\n房间码：${state.room.id}\n连接地址：${endpoint}`
  }
  function dispose() {
    detach(); clearInterval(pollTimer); clearInterval(clockTimer)
    globalThis.document?.removeEventListener('visibilitychange', onVisible)
    const previous = socket; socket = null; previous?.disconnect()
  }
  return { create: options => enter('create', options), join: options => enter('join', options), leave, restore, connect, command, retryLocal, enableAudio, invitation, dispose, setPresenceActive, movePresence, takeSeat }
}
