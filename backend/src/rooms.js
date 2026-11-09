import { randomBytes, randomInt } from 'node:crypto'
import { networkInterfaces } from 'node:os'
import { Server } from 'socket.io'
import { AVATAR_IDS, initialPresence, movement, seatPosition, releasePosition } from './presence.js'
import { ROOM_SOCKET_PATH, ROOM_CAPACITY, ROOM_QUEUE_LIMIT, ROOM_MODES, roomTrack, roomQueue, trackKey, trackDuration, playbackPosition } from './protocol.js'

export function attachListeningRoomServer(httpServer, options = {}) {
  const now = options.now || Date.now
  const startDelay = options.startDelay ?? 700
  const prepareTimeout = options.prepareTimeout ?? 30000
  const reconnectGrace = options.reconnectGrace ?? 30000
  const capacity = options.capacity ?? ROOM_CAPACITY
  const rooms = new Map(), sessions = new Map()
  const io = new Server(httpServer, {
    path: ROOM_SOCKET_PATH, maxHttpBufferSize: 512 * 1024,
    cors: { origin: options.allowedOrigins || true, credentials: false },
    allowRequest: (request, done) => done(null, !options.allowedOrigins || !request.headers.origin || options.allowedOrigins.includes(request.headers.origin)),
    pingInterval: 5000, pingTimeout: 10000,
  })
  const fail = message => { throw new Error(message) }
  const nameOf = name => String(name || '音乐同伴').trim().slice(0, 24) || '音乐同伴'
  const timers = new Set()
  function later(callback, delay) {
    const timer = setTimeout(() => { timers.delete(timer); callback() }, delay)
    timer.unref?.(); timers.add(timer); return timer
  }
  function cancel(timer) { clearTimeout(timer); timers.delete(timer) }
  function presenceSnapshot(room) {
    return { roomId: room.id, version: room.presenceVersion || 0, players: [...room.members.values()].filter(member => member.connected && member.presence?.active).map(member => ({ id: member.id, name: member.name, ...member.presence })) }
  }
  function broadcastPresence(room) { room.presenceVersion = (room.presenceVersion || 0) + 1; io.to(room.id).emit('presence:state', presenceSnapshot(room)) }
  function snapshot(room) {
    return {
      id: room.id, hostId: room.hostId, capacity, revision: room.revision, queueVersion: room.queueVersion,
      members: [...room.members.values()].map(member => ({ id: member.id, name: member.name, connected: member.connected, ready: member.ready === room.playback.generation, buffering: member.buffering, error: member.error })),
      playback: { ...room.playback }, queue: room.queue, playMode: room.playMode, error: room.error, presence: presenceSnapshot(room),
    }
  }
  function broadcast(room) { room.revision++; io.to(room.id).emit('room:state', snapshot(room)) }
  function listRooms() {
    return [...rooms.values()].reverse().map(room => {
      const host = room.members.get(room.hostId), track = room.playback.track
      const unavailableReason = !host?.connected ? 'host-offline' : room.members.size >= capacity ? 'full' : ''
      return {
        id: room.id, hostName: host?.name || '音乐同伴', memberCount: room.members.size, capacity,
        track: track ? { name: track.name || '未命名歌曲', artist: track.artist || '' } : null,
        playing: Boolean(room.playback.playing), preparing: Boolean(room.playback.preparing),
        joinable: !unavailableReason, unavailableReason,
      }
    }).sort((left, right) => Number(right.joinable) - Number(left.joinable))
  }
  function setAnchor(room, position, playing, delay = 0) {
    const p = room.playback
    p.position = Math.max(0, p.duration ? Math.min(position, p.duration) : position)
    p.playing = playing; p.anchorTime = now() + delay
    cancel(room.endTimer)
    if (playing && p.duration > 0) {
      const generation = p.generation
      room.endTimer = later(() => {
        if (!rooms.has(room.id) || generation !== p.generation || !p.playing) return
        advance(room, 1, true); broadcast(room)
      }, Math.max(50, (p.duration - p.position) * 1000 + delay + 100))
    }
  }
  function stopPreparing(room) { cancel(room.prepareTimer); room.playback.preparing = false }
  function resumePlayback(room) {
    const p = room.playback, position = playbackPosition(p, now())
    if (!p.track) {
      if (room.queue.length) { prepare(room, room.queue[0]); return }
      fail('请先选择一首在线歌曲。')
    }
    if (p.preparing) room.desiredPlaying = true
    else if (room.error || [...room.members.values()].some(member => member.connected && member.ready !== p.generation)) prepare(room, p.track, position, true)
    else setAnchor(room, position >= p.duration ? 0 : position, true, startDelay)
  }
  function finishPreparation(room) {
    if (!room.playback.preparing) return
    const members = [...room.members.values()].filter(member => member.connected)
    if (!members.length || !room.members.get(room.hostId)?.connected || members.some(member => member.ready !== room.playback.generation || member.error)) return
    stopPreparing(room)
    setAnchor(room, room.playback.position, room.desiredPlaying, room.desiredPlaying ? startDelay : 0)
  }
  function prepare(room, track, position = 0, playing = true) {
    stopPreparing(room); cancel(room.endTimer); room.error = ''; room.desiredPlaying = playing
    room.playback = { track, generation: room.playback.generation + 1, position, duration: trackDuration(track), anchorTime: now(), playing: false, preparing: Boolean(track) }
    for (const member of room.members.values()) { member.ready = -1; member.buffering = false; member.error = ''; member.duration = 0 }
    if (!track) return
    room.prepareTimer = later(() => {
      stopPreparing(room); room.desiredPlaying = false
      room.error = '有成员未能准备好歌曲，请重试或换一首。'
      for (const member of room.members.values()) if (member.ready !== room.playback.generation) member.error ||= '加载超时，请重新加载'
      broadcast(room)
    }, prepareTimeout)
  }
  function advance(room, direction, ended = false) {
    const index = room.queue.findIndex(track => trackKey(track) === trackKey(room.playback.track))
    let next
    if (ended && room.playMode === 'single') next = room.playback.track
    else if (room.queue.length) {
      let target = index + direction
      if (room.playMode === 'shuffle' && room.queue.length > 1) {
        const choices = room.queue.filter((_, i) => i !== index)
        next = choices[randomInt(choices.length)]
      } else if (!(ended && room.playMode === 'order' && target >= room.queue.length)) {
        target = (target + room.queue.length) % room.queue.length
        next = room.queue[target]
      }
    }
    if (next) prepare(room, next)
    else { stopPreparing(room); setAnchor(room, playbackPosition(room.playback, now()), false) }
  }
  function closeRoom(room, reason) {
    stopPreparing(room); cancel(room.endTimer)
    io.to(room.id).emit('room:closed', { reason })
    for (const member of room.members.values()) {
      cancel(member.leaveTimer)
      const session = sessions.get(member.token)
      if (session) { session.roomId = ''; io.sockets.sockets.get(session.socketId)?.leave(room.id) }
    }
    rooms.delete(room.id)
  }
  function leave(session, explicit = true) {
    const room = rooms.get(session.roomId), member = room?.members.get(session.id)
    if (!room || !member) { session.roomId = ''; return }
    if (session.id === room.hostId) closeRoom(room, explicit ? '房主已结束一起听。' : '房主连接超时，房间已结束。')
    else {
      cancel(member.leaveTimer); room.members.delete(session.id); session.roomId = ''
      io.sockets.sockets.get(session.socketId)?.leave(room.id)
      broadcastPresence(room); finishPreparation(room); broadcast(room)
    }
  }
  function requireRoom(session) {
    const room = rooms.get(session.roomId)
    if (!room || !room.members.has(session.id)) fail('房间已失效，请重新创建或加入。')
    return room
  }
  function nextCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code
    do { code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('') } while (rooms.has(code))
    return code
  }
  function validateTrack(value) {
    const track = roomTrack(value)
    if (!track) fail('一起听暂时支持在线歌曲，请选择一首在线歌曲。')
    return track
  }
  function appendTracks(room, tracks) {
    const keys = new Set(room.queue.map(trackKey))
    const additions = roomQueue(tracks).filter(track => !keys.has(trackKey(track)))
    if (additions.length + room.queue.length > ROOM_QUEUE_LIMIT) fail(`播放队列最多 ${ROOM_QUEUE_LIMIT} 首，请先整理队列后再添加。`)
    if (additions.length) { room.queue = [...room.queue, ...additions]; room.queueVersion++ }
  }
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    let session = typeof token === 'string' ? sessions.get(token) : null
    if (!session) {
      if (sessions.size >= 4096) return next(new Error('连接人数较多，请稍后重试。'))
      session = { id: randomBytes(12).toString('hex'), token: randomBytes(32).toString('hex'), roomId: '', socketId: '', lastSeen: now() }
      sessions.set(session.token, session)
    }
    const previous = session.socketId
    session.socketId = socket.id; session.lastSeen = now(); socket.data.session = session
    if (previous && previous !== socket.id) io.sockets.sockets.get(previous)?.disconnect(true)
    next()
  })
  io.on('connection', socket => {
    const session = socket.data.session
    let windowStarted = now(), requests = 0, joins = [], motionWindow = now(), motionRequests = 0
    function handle(event, callback) {
      socket.on(event, (payload = {}, ack) => {
        if (typeof ack !== 'function') return
        try {
          if (session.socketId !== socket.id) fail('此连接已失效，请重新连接。')
          if (now() - windowStarted >= 1000) { windowStarted = now(); requests = 0 }
          if (++requests > 40) fail('操作太快，请稍后重试。')
          session.lastSeen = now()
          ack({ ok: true, ...callback(payload && typeof payload === 'object' ? payload : {}), serverTime: now() })
        } catch (error) { ack({ ok: false, error: error.message || '操作失败，请重试。', serverTime: now() }) }
      })
    }
    handle('session:hello', () => {
      const room = rooms.get(session.roomId), member = room?.members.get(session.id)
      if (member) {
        cancel(member.leaveTimer); member.connected = true; member.ready = -1; member.error = ''; member.presence.seq = 0; socket.join(room.id); broadcastPresence(room); broadcast(room)
      }
      const address = httpServer.address()
      const port = typeof address === 'object' && address ? address.port : 3030
      const lanUrls = Object.values(networkInterfaces()).flat().filter(item => item && !item.internal && item.family === 'IPv4').map(item => `http://${item.address}:${port}`)
      return { token: session.token, memberId: session.id, room: room ? snapshot(room) : null, lanUrls, publicUrl: options.publicUrl || '' }
    })
    handle('clock:ping', () => ({}))
    handle('room:create', payload => {
      if (session.roomId) fail('请先退出当前房间。')
      if (rooms.size >= 256) fail('房间较多，请稍后再创建。')
      const room = { id: nextCode(), hostId: session.id, revision: 0, queueVersion: 1, queue: [], playMode: 'list', error: '', members: new Map(), playback: { generation: 0 } }
      room.members.set(session.id, { id: session.id, token: session.token, name: nameOf(payload.name), connected: true, ready: -1, error: '', buffering: false, presence: initialPresence(0, payload.avatar) })
      rooms.set(room.id, room); session.roomId = room.id; socket.join(room.id)
      prepare(room, null, 0, false)
      broadcast(room); return { room: snapshot(room) }
    })
    handle('room:join', payload => {
      joins = joins.filter(time => now() - time < 60000)
      if (joins.length >= 10) fail('尝试次数较多，请一分钟后重试。')
      joins.push(now())
      if (session.roomId) fail('请先退出当前房间。')
      const room = rooms.get(String(payload.code || '').toUpperCase())
      if (!room) fail('没有找到这个房间，请检查房间码或让好友重新创建。')
      if (room.members.size >= capacity) fail(`房间已满，当前最多 ${capacity} 人。`)
      if (!room.members.get(room.hostId)?.connected) fail('房主正在重连，请稍后加入。')
      room.members.set(session.id, { id: session.id, token: session.token, name: nameOf(payload.name), connected: true, ready: -1, error: '', buffering: false, presence: initialPresence(room.members.size, payload.avatar) })
      session.roomId = room.id; socket.join(room.id); broadcast(room)
      return { room: snapshot(room) }
    })
    handle('room:snapshot', () => ({ room: snapshot(requireRoom(session)) }))
    handle('room:leave', () => { leave(session); return {} })
    handle('presence:profile', payload => {
      const room = requireRoom(session), member = room.members.get(session.id)
      if (payload.avatar !== undefined && !AVATAR_IDS.includes(payload.avatar)) fail('请选择有效的角色。')
      if (payload.avatar) member.presence.avatar = payload.avatar
      member.presence.active = payload.active === true
      if (!member.presence.active) member.presence = releasePosition(member.presence)
      broadcastPresence(room); return { presence: presenceSnapshot(room) }
    })
    handle('presence:seat', payload => {
      const room = requireRoom(session), member = room.members.get(session.id)
      if (!member.presence.active) fail('请先进入 3D 音乐馆。')
      if (payload.seatId) {
        const pose = seatPosition(payload.seatId)
        if (!pose) fail('这个座位不存在。')
        if ([...room.members.values()].some(peer => peer.id !== member.id && peer.connected && peer.presence?.active && peer.presence.seatId === payload.seatId)) fail('这张椅子已经有人坐了。')
        Object.assign(member.presence, pose)
      } else member.presence = releasePosition(member.presence)
      broadcastPresence(room); return { presence: presenceSnapshot(room) }
    })
    socket.on('presence:move', payload => {
      if (session.socketId !== socket.id) return
      const room = rooms.get(session.roomId), member = room?.members.get(session.id)
      if (!member?.connected || !member.presence?.active || member.presence.seatId) return
      if (now() - motionWindow >= 1000) { motionWindow = now(); motionRequests = 0 }
      if (++motionRequests > 25) return
      const next = movement(payload, member.presence)
      if (next) { member.presence = next; session.lastSeen = now(); room.presenceDirty = true }
    })
    handle('playback:ready', payload => {
      const room = requireRoom(session), p = room.playback, member = room.members.get(session.id)
      if (payload.generation !== p.generation) return { room: snapshot(room) }
      member.error = typeof payload.error === 'string' ? payload.error.slice(0, 180) : ''
      member.duration = Number.isFinite(payload.duration) ? payload.duration : 0
      if (!member.error && (member.duration <= 0 || member.duration > 86400)) member.error = '无法读取歌曲时长，请重新加载。'
      if (!member.error && session.id === room.hostId) {
        p.duration = member.duration
        for (const peer of room.members.values()) {
          if (peer.id !== room.hostId && peer.ready === p.generation && Math.abs(peer.duration - p.duration) > 2) {
            peer.error = '歌曲版本或试听时长不一致，请换一首。'; peer.ready = -1
          }
        }
      }
      if (!member.error && room.members.get(room.hostId)?.duration > 0 && Math.abs(member.duration - p.duration) > 2) member.error = '歌曲版本或试听时长不一致，请换一首。'
      member.ready = member.error ? -1 : p.generation
      const failedMember = [...room.members.values()].find(peer => peer.connected && peer.error)
      if (failedMember && p.preparing) {
        stopPreparing(room); room.desiredPlaying = false; room.error = `${failedMember.name}：${failedMember.error}`
      } else {
        finishPreparation(room)
      }
      broadcast(room); return { room: snapshot(room) }
    })
    handle('playback:buffering', payload => {
      const room = requireRoom(session)
      const member = room.members.get(session.id), buffering = Boolean(payload.buffering)
      if (payload.generation === room.playback.generation && member.buffering !== buffering) { member.buffering = buffering; broadcast(room) }
      return {}
    })
    handle('playback:command', payload => {
      const room = requireRoom(session)
      const commandId = String(payload.commandId || '').slice(0, 80)
      if (!commandId) fail('操作编号缺失，请重试。')
      const commandKey = `${session.id}:${commandId}`
      room.commands ||= new Set()
      if (room.commands.has(commandKey)) return { room: snapshot(room) }
      const p = room.playback, position = playbackPosition(p, now())
      if (!['queue', 'append', 'clear', 'mode', 'track'].includes(payload.type) && payload.generation !== p.generation) fail('歌曲已经变化，请重试。')
      if (['queue', 'clear'].includes(payload.type) && payload.queueVersion !== room.queueVersion) fail('播放队列已被其他操作更新，请查看最新队列后重试。')
      switch (payload.type) {
        case 'queue': room.queue = roomQueue(payload.tracks); room.queueVersion++; break
        case 'append': appendTracks(room, payload.tracks); break
        case 'clear': room.queue = []; room.queueVersion++; break
        case 'mode': if (!ROOM_MODES.includes(payload.mode)) fail('播放模式无效。'); room.playMode = payload.mode; break
        case 'track': {
          const track = validateTrack(payload.track)
          appendTracks(room, [track])
          if (payload.resume === true && trackKey(track) === trackKey(p.track)) {
            if (!p.playing) resumePlayback(room)
          } else prepare(room, track)
          break
        }
        case 'play':
          resumePlayback(room)
          break
        case 'pause': room.desiredPlaying = false; setAnchor(room, position, false); break
        case 'seek':
          if (!Number.isFinite(payload.position)) fail('播放位置无效。')
          setAnchor(room, payload.position, p.playing, p.playing ? startDelay : 0); break
        case 'retry': if (!p.track) fail('请先选择歌曲。'); prepare(room, p.track, position, true); break
        case 'next': advance(room, 1); break
        case 'previous': advance(room, -1); break
        case 'ended':
          if (!p.playing || !p.duration || position < p.duration - .5) return { room: snapshot(room) }
          advance(room, 1, true); break
        default: fail('不支持的房间操作。')
      }
      room.commands.add(commandKey)
      if (room.commands.size > 100) room.commands.delete(room.commands.values().next().value)
      broadcast(room); return { room: snapshot(room) }
    })
    socket.on('disconnect', () => {
      if (session.socketId !== socket.id) return
      session.socketId = ''; session.lastSeen = now()
      const room = rooms.get(session.roomId), member = room?.members.get(session.id)
      if (!member) return
      member.connected = false; member.buffering = false
      member.presence = { ...releasePosition(member.presence), active: false }
      broadcastPresence(room)
      if (session.id === room.hostId) {
        const position = playbackPosition(room.playback, now())
        stopPreparing(room); setAnchor(room, position, false); room.desiredPlaying = false
        room.error = '房主正在重连，播放已暂停。'
      }
      member.leaveTimer = later(() => leave(session, false), reconnectGrace)
      finishPreparation(room); broadcast(room)
    })
  })
  const cleanup = setInterval(() => {
    for (const [token, session] of sessions) if (!session.socketId && !session.roomId && now() - session.lastSeen > 3600000) sessions.delete(token)
  }, 60000)
  cleanup.unref?.()
  // At most 20 compact room broadcasts/second; song queues never enter these packets.
  const presenceTimer = setInterval(() => {
    for (const room of rooms.values()) if (room.presenceDirty) { room.presenceDirty = false; broadcastPresence(room) }
  }, 50)
  presenceTimer.unref?.()
  return {
    io,
    listRooms,
    close() {
      clearInterval(cleanup); clearInterval(presenceTimer); for (const timer of timers) clearTimeout(timer); timers.clear()
      rooms.clear(); sessions.clear()
      return new Promise(resolve => io.close(resolve))
    },
  }
}
