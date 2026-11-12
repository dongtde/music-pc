export const WORLD_EYE_HEIGHT = 2
export const WORLD_SEAT_HEIGHT = 1.22
export const WORLD_PLAYER_RADIUS = .42
export const WORLD_BOUNDS = { minX: -14.7, maxX: 14.7, minZ: -19.1, maxZ: 19.9 }
export const WORLD_LOBBY_DISPLAY = { index: 3, x: -8.2, z: 7.1 }
export const WORLD_STATIONS = {
  atrium: { x: 0, z: 12.8, look: [0, 4, -12], label: '音乐中庭', sub: 'THE ATRIUM' },
  archive: { x: -5, z: 5.9, look: [-8.2, 2, 2.4], label: '唱片档案', sub: 'YOUR COLLECTION' },
  discover: { x: 2, z: 10.3, look: [8.2, 2, 3.2], label: '发现展厅', sub: 'DISCOVERY GALLERY' },
  terminal: { x: 0, z: 4.0, look: [0, 1.38, 1.5], label: '控制终端', sub: 'MUSIC CONTROL' },
  lobby: { x: -5.4, z: WORLD_LOBBY_DISPLAY.z, look: [WORLD_LOBBY_DISPLAY.x, 2, WORLD_LOBBY_DISPLAY.z], label: '一起听', sub: 'LISTEN TOGETHER' },
  screen: { x: 0, z: -10.5, look: [0, 3.6, -19.5], label: '主听音厅', sub: 'THE LISTENING ROOM' },
  lounge: { x: -8.2, z: 13.8, look: [-5, 1.3, 12], label: '声音沙龙', sub: 'RADIO LOUNGE' },
}

// Shared by the map, camera destinations and seat hit areas. Map markers follow
// the furniture; approach points stay on the walkable side of each object.
export const WORLD_DISCOVERY_SCREENS = ['推荐','歌单','歌手','排行榜'].map((label,index)=>{
  const id=['recommend','playlists','artists','charts'][index],z=-7+index*4.7
  return {id:`discover-${id}`,kind:'discovery',target:id,label,x:8.2,z,view:{x:4.5,z,look:[8.2,2,z]},mapLabel:{x:438,y:260+z*11.5}}
})
export const WORLD_RECORD_DISPLAYS = Array.from({length:4},(_,index)=>{
  const z=-7+index*4.7
  return {id:`archive-${index}`,kind:'record',target:index,label:`唱片 ${String(index>WORLD_LOBBY_DISPLAY.index?index:index+1).padStart(2,'0')}`,x:-8.2,z,view:{x:-4.5,z,look:[-8.2,2,z]},mapLabel:{x:42,y:260+z*11.5}}
}).filter(display=>display.target!==WORLD_LOBBY_DISPLAY.index)
export const WORLD_SEATS = [
  {id:'seat-front-left',label:'前排左沙发',x:-5,z:-10.8,model:'listening-chair--1--10.8',view:{x:-3.35,z:-10.8},mapLabel:{x:147,y:109}},
  {id:'seat-center',label:'中央沙发',x:0,z:-9,model:'listening-sofa',view:{x:0,z:-10.8},mapLabel:{x:240,y:190}},
  {id:'seat-front-right',label:'前排右沙发',x:5,z:-10.8,model:'listening-chair-1--10.8',view:{x:3.35,z:-10.8},mapLabel:{x:333,y:109}},
  {id:'seat-rear-left',label:'后排左沙发',x:-5,z:12,model:'listening-chair--1-12',view:{x:-3.35,z:12},mapLabel:{x:147,y:432}},
  {id:'seat-rear-right',label:'后排右沙发',x:5,z:12,model:'listening-chair-1-12',view:{x:3.35,z:12},mapLabel:{x:333,y:432}},
].map(seat=>({...seat,kind:'seat',view:{...seat.view,look:[0,3.55,-19.5]}}))
export const WORLD_MAP_DESTINATIONS = [
  {id:'screen',kind:'station',label:'音乐大屏',x:0,z:-19.5,view:WORLD_STATIONS.screen,mapLabel:{x:240,y:49}},
  ...WORLD_SEATS.slice(0,3),
  ...WORLD_DISCOVERY_SCREENS,
  ...WORLD_RECORD_DISPLAYS,
  {id:'lobby',kind:'station',label:'一起听',x:WORLD_LOBBY_DISPLAY.x,z:WORLD_LOBBY_DISPLAY.z,view:WORLD_STATIONS.lobby},
  {id:'terminal',kind:'station',label:'控制终端',x:0,z:1.5,view:WORLD_STATIONS.terminal,mapLabel:{x:240,y:311}},
  ...WORLD_SEATS.slice(3),
  {id:'atrium',kind:'station',label:'音乐中庭',x:0,z:12.8,view:WORLD_STATIONS.atrium,mapLabel:{x:240,y:480}},
]

// Feet use a circle against furniture footprints. The same sweep is used by
// manual movement and path smoothing, including the rounded furniture corners.
const SKIN = .002, EPSILON = 1e-8
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
export const WORLD_OBSTACLES = [
  { x: 0, z: 1.5, halfX: 2.25, halfZ: .92, height: 2.35 },
  { x: 0, z: -9, halfX: 1.67, halfZ: .95, height: 1.7 },
  ...[-1, 1].flatMap(side => [
    { x: side * 8.3, z: -16.9, halfX: .95, halfZ: 1.05, height: 4.8 },
    ...[-10.8, 12].map(z => ({ x: side * 5, z, halfX: 1.08, halfZ: 1.1, height: 1.7 })),
    ...[-4, 1, 6].map(z => ({ x: side * 11.9, z, halfX: 1.25, halfZ: 1.8, height: 3.35 })),
    ...[-7, -2.3, 2.4, 7.1].map(z => ({ x: side * 8.2, z, halfX: .7, halfZ: 1, height: 3.05 })),
  ]),
]

export function canWalkWorld(x, z, radius = WORLD_PLAYER_RADIUS) {
  if (!Number.isFinite(x) || !Number.isFinite(z) ||
    x < WORLD_BOUNDS.minX + radius || x > WORLD_BOUNDS.maxX - radius ||
    z < WORLD_BOUNDS.minZ + radius || z > WORLD_BOUNDS.maxZ - radius) return false
  return WORLD_OBSTACLES.every(obstacle => {
    const dx = Math.abs(x - obstacle.x) - obstacle.halfX
    const dz = Math.abs(z - obstacle.z) - obstacle.halfZ
    return (dx >= 0 || dz >= 0) && Math.max(0, dx) ** 2 + Math.max(0, dz) ** 2 >= radius ** 2 - EPSILON
  })
}

// Reconnects and interrupted seat transitions can start inside furniture.
export function resolveWorldPosition(position, radius = WORLD_PLAYER_RADIUS) {
  let x = Number.isFinite(position.x) ? position.x : WORLD_STATIONS.atrium.x
  let z = Number.isFinite(position.z) ? position.z : WORLD_STATIONS.atrium.z
  for (let pass = 0; pass < 12; pass++) {
    x = clamp(x, WORLD_BOUNDS.minX + radius + SKIN, WORLD_BOUNDS.maxX - radius - SKIN)
    z = clamp(z, WORLD_BOUNDS.minZ + radius + SKIN, WORLD_BOUNDS.maxZ - radius - SKIN)
    let resolved = true
    for (const obstacle of WORLD_OBSTACLES) {
      const nearestX = clamp(x, obstacle.x - obstacle.halfX, obstacle.x + obstacle.halfX)
      const nearestZ = clamp(z, obstacle.z - obstacle.halfZ, obstacle.z + obstacle.halfZ)
      const dx = x - nearestX, dz = z - nearestZ, distance = Math.hypot(dx, dz)
      if (distance >= radius) continue
      resolved = false
      if (distance > EPSILON) {
        const push = (radius + SKIN - distance) / distance
        x += dx * push; z += dz * push
      } else {
        const exits = [
          { distance: x - (obstacle.x - obstacle.halfX - radius), x: obstacle.x - obstacle.halfX - radius - SKIN, z },
          { distance: obstacle.x + obstacle.halfX + radius - x, x: obstacle.x + obstacle.halfX + radius + SKIN, z },
          { distance: z - (obstacle.z - obstacle.halfZ - radius), x, z: obstacle.z - obstacle.halfZ - radius - SKIN },
          { distance: obstacle.z + obstacle.halfZ + radius - z, x, z: obstacle.z + obstacle.halfZ + radius + SKIN },
        ]
        const exit = exits.reduce((best, next) => next.distance < best.distance ? next : best)
        x = exit.x; z = exit.z
      }
    }
    if (resolved) break
  }
  return { x, z }
}

function sweepWorld(position, dx, dz, radius) {
  let hit = null
  const consider = (time, nx, nz) => {
    if (time < -EPSILON || time > 1 + EPSILON || dx * nx + dz * nz >= -EPSILON) return
    time = clamp(time, 0, 1)
    if (!hit || time < hit.time) hit = { time, nx, nz }
  }
  if (dx < -EPSILON) consider((WORLD_BOUNDS.minX + radius - position.x) / dx, 1, 0)
  if (dx > EPSILON) consider((WORLD_BOUNDS.maxX - radius - position.x) / dx, -1, 0)
  if (dz < -EPSILON) consider((WORLD_BOUNDS.minZ + radius - position.z) / dz, 0, 1)
  if (dz > EPSILON) consider((WORLD_BOUNDS.maxZ - radius - position.z) / dz, 0, -1)
  const lengthSquared = dx * dx + dz * dz
  if (lengthSquared < EPSILON ** 2) return hit
  for (const obstacle of WORLD_OBSTACLES) {
    const minX = obstacle.x - obstacle.halfX, maxX = obstacle.x + obstacle.halfX
    const minZ = obstacle.z - obstacle.halfZ, maxZ = obstacle.z + obstacle.halfZ
    for (const sign of [-1, 1]) {
      if (Math.abs(dx) > EPSILON) {
        const time = ((sign < 0 ? minX : maxX) + sign * radius - position.x) / dx
        const z = position.z + dz * time
        if (z >= minZ && z <= maxZ) consider(time, sign, 0)
      }
      if (Math.abs(dz) > EPSILON) {
        const time = ((sign < 0 ? minZ : maxZ) + sign * radius - position.z) / dz
        const x = position.x + dx * time
        if (x >= minX && x <= maxX) consider(time, 0, sign)
      }
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const cx = sx < 0 ? minX : maxX, cz = sz < 0 ? minZ : maxZ
      const ox = position.x - cx, oz = position.z - cz
      const b = ox * dx + oz * dz, c = ox * ox + oz * oz - radius * radius
      const discriminant = b * b - lengthSquared * c
      if (discriminant < 0) continue
      const time = (-b - Math.sqrt(discriminant)) / lengthSquared
      const nx = position.x + dx * time - cx, nz = position.z + dz * time - cz
      if (nx * sx >= -EPSILON && nz * sz >= -EPSILON) consider(time, nx / radius, nz / radius)
    }
  }
  return hit
}

export function moveWorld(position, dx, dz, radius = WORLD_PLAYER_RADIUS) {
  const result = resolveWorldPosition(position, radius), contacts = []
  if (!Number.isFinite(dx) || !Number.isFinite(dz)) return { ...result, contacts }
  for (let iteration = 0; iteration < 6 && Math.hypot(dx, dz) > EPSILON; iteration++) {
    const hit = sweepWorld(result, dx, dz, radius)
    if (!hit) { result.x += dx; result.z += dz; break }
    const advance = Math.max(0, hit.time - SKIN / Math.hypot(dx, dz))
    result.x += dx * advance; result.z += dz * advance
    dx *= 1 - hit.time; dz *= 1 - hit.time
    const into = Math.min(0, dx * hit.nx + dz * hit.nz)
    dx -= into * hit.nx; dz -= into * hit.nz
    contacts.push({ x: hit.nx, z: hit.nz })
  }
  return { ...resolveWorldPosition(result, radius), contacts }
}

export function isWorldPathClear(start, destination, radius = WORLD_PLAYER_RADIUS) {
  if (!canWalkWorld(start.x, start.z, radius) || !canWalkWorld(destination.x, destination.z, radius)) return false
  const hit = sweepWorld(start, destination.x - start.x, destination.z - start.z, radius)
  return !hit || hit.time >= 1 - EPSILON
}

// Clip the camera boom against furniture height as well as room walls. A
// seated camera may start inside its chair, so that chair must allow an exit.
export function worldCameraLimit(origin, destination, radius = .18) {
  let limit = 1
  for (const [axis, min, max] of [['x', WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX], ['z', WORLD_BOUNDS.minZ, WORLD_BOUNDS.maxZ]]) {
    const delta = destination[axis] - origin[axis]
    if (delta > EPSILON) limit = Math.min(limit, (max - radius - origin[axis]) / delta)
    else if (delta < -EPSILON) limit = Math.min(limit, (min + radius - origin[axis]) / delta)
  }
  for (const obstacle of WORLD_OBSTACLES) {
    const ranges = { x: [obstacle.x - obstacle.halfX - radius, obstacle.x + obstacle.halfX + radius], y: [-radius, obstacle.height + radius], z: [obstacle.z - obstacle.halfZ - radius, obstacle.z + obstacle.halfZ + radius] }
    if (Object.entries(ranges).every(([axis, [min, max]]) => origin[axis] >= min && origin[axis] <= max)) continue
    let near = 0, far = limit
    for (const [axis, [min, max]] of Object.entries(ranges)) {
      const delta = destination[axis] - origin[axis]
      if (Math.abs(delta) < EPSILON) { if (origin[axis] < min || origin[axis] > max) { far = -1; break } }
      else {
        const a = (min - origin[axis]) / delta, b = (max - origin[axis]) / delta
        near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b))
      }
    }
    if (near <= far) limit = Math.min(limit, Math.max(0, near - .02))
  }
  return clamp(limit, 0, 1)
}

// A small floor grid routes around the same furniture used by manual walking.
export function planWorldPath(start, destination) {
  if (!canWalkWorld(start.x, start.z) || !canWalkWorld(destination.x, destination.z)) return []
  const clear = (a, b) => {
    const clearance=canWalkWorld(a.x,a.z,.5)&&canWalkWorld(b.x,b.z,.5)?.5:WORLD_PLAYER_RADIUS
    return isWorldPathClear(a,b,clearance)
  }
  if (clear(start,destination)) return [{x:destination.x,z:destination.z}]
  const step=.5, key=(x,z)=>`${x},${z}`, point=(x,z)=>({x:x*step,z:z*step})
  const nearest = p => {
    const candidates=[]
    for(let x=Math.round(p.x/step)-3;x<=Math.round(p.x/step)+3;x++)for(let z=Math.round(p.z/step)-3;z<=Math.round(p.z/step)+3;z++) {
      const at=point(x,z); if(canWalkWorld(at.x,at.z,.5)&&clear(p,at))candidates.push({x,z,d:Math.hypot(at.x-p.x,at.z-p.z)})
    }
    return candidates.sort((a,b)=>a.d-b.d)[0]
  }
  const first=nearest(start),goal=nearest(destination);if(!first||!goal)return []
  const heuristic=(x,z)=>Math.hypot(goal.x-x,goal.z-z)
  const open=[{...first,g:0,f:heuristic(first.x,first.z)}],costs=new Map([[key(first.x,first.z),0]]),parents=new Map(),closed=new Set()
  while(open.length){
    open.sort((a,b)=>b.f-a.f);const at=open.pop(),id=key(at.x,at.z)
    if(closed.has(id))continue
    if(at.x===goal.x&&at.z===goal.z){
      const path=[{x:destination.x,z:destination.z}];let cursor=id
      while(cursor){const [x,z]=cursor.split(',').map(Number);path.unshift(point(x,z));cursor=parents.get(cursor)}
      const result=[];let from=start
      for(let i=0;i<path.length;){let far=i;while(far+1<path.length&&clear(from,path[far+1]))far++;result.push(path[far]);from=path[far];i=far+1}
      return result
    }
    closed.add(id)
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const x=at.x+dx,z=at.z+dz,next=point(x,z),nextKey=key(x,z),g=at.g+Math.hypot(dx,dz)
      if(closed.has(nextKey)||!canWalkWorld(next.x,next.z,.5)||!clear(point(at.x,at.z),next)||g>=(costs.get(nextKey)??Infinity))continue
      costs.set(nextKey,g);parents.set(nextKey,id);open.push({x,z,g,f:g+heuristic(x,z)})
    }
  }
  return []
}
