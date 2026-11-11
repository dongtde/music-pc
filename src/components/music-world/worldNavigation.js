export const WORLD_EYE_HEIGHT = 2
export const WORLD_SEAT_HEIGHT = 1.22
export const WORLD_STATIONS = {
  atrium: { x: 0, z: 12.8, look: [0, 4, -12], label: '音乐中庭', sub: 'THE ATRIUM' },
  archive: { x: -5, z: 5.9, look: [-8.2, 2, 2.4], label: '唱片档案', sub: 'YOUR COLLECTION' },
  discover: { x: 2, z: 10.3, look: [8.2, 2, 3.2], label: '发现展厅', sub: 'DISCOVERY GALLERY' },
  terminal: { x: 0, z: 4.0, look: [0, 1.38, 1.5], label: '控制终端', sub: 'MUSIC CONTROL' },
  lobby: { x: -5.4, z: 2.4, look: [-8.2, 2, 2.4], label: '一起听', sub: 'LISTEN TOGETHER' },
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
  return {id:`archive-${index}`,kind:'record',target:index,label:`唱片 ${String(index>2?index:index+1).padStart(2,'0')}`,x:-8.2,z,view:{x:-4.5,z,look:[-8.2,2,z]},mapLabel:{x:42,y:260+z*11.5}}
}).filter(display=>display.target!==2)
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
  {id:'lobby',kind:'station',label:'一起听',x:-8.2,z:2.4,view:WORLD_STATIONS.lobby},
  {id:'terminal',kind:'station',label:'控制终端',x:0,z:1.5,view:WORLD_STATIONS.terminal,mapLabel:{x:240,y:311}},
  ...WORLD_SEATS.slice(3),
  {id:'atrium',kind:'station',label:'音乐中庭',x:0,z:12.8,view:WORLD_STATIONS.atrium,mapLabel:{x:240,y:480}},
]

// A small floor grid routes around the same furniture used by manual walking.
export function planWorldPath(start, destination) {
  if (!canWalkWorld(start.x, start.z) || !canWalkWorld(destination.x, destination.z)) return []
  const clear = (a, b) => {
    const clearance=canWalkWorld(a.x,a.z,.5)&&canWalkWorld(b.x,b.z,.5)?.5:.32
    for(const obstacle of WORLD_OBSTACLES){
      let near=0,far=1,intersects=true
      for(const [axis,half] of [['x','halfX'],['z','halfZ']]){
        const delta=b[axis]-a[axis],min=obstacle[axis]-obstacle[half]-clearance,max=obstacle[axis]+obstacle[half]+clearance
        if(Math.abs(delta)<1e-8){if(a[axis]<min||a[axis]>max){intersects=false;break}}
        else {const t1=(min-a[axis])/delta,t2=(max-a[axis])/delta;near=Math.max(near,Math.min(t1,t2));far=Math.min(far,Math.max(t1,t2));if(near>far){intersects=false;break}}
      }
      if(intersects)return false
    }
    return true
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
export const WORLD_OBSTACLES = [
  { x: 0, z: 1.5, halfX: 2.5, halfZ: 1.4 },
  { x: 0, z: -9, halfX: 1.7, halfZ: 1.1 },
  ...[-1, 1].flatMap((side) => [
    { x: side * 8.3, z: -16.9, halfX: .9, halfZ: 1 },
    ...[-10.8, 12].map(z => ({ x: side * 5, z, halfX: 1, halfZ: 1 })),
    ...[-4, 1, 6].map(z => ({ x: side * 11.9, z, halfX: 1.35, halfZ: 1.9 })),
    ...[-7, -2.3, 2.4, 7.1].map(z => ({ x: side * 8.2, z, halfX: .85, halfZ: 1.1 })),
  ]),
]
export function canWalkWorld(x, z, clearance=.32) {
  return Math.abs(x) < 14.3 && z > -18.7 && z < 19.5 && WORLD_OBSTACLES.every(o =>
    Math.abs(x - o.x) > o.halfX + clearance || Math.abs(z - o.z) > o.halfZ + clearance)
}
export function moveWorld(position, dx, dz) {
  const count = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .1))
  let { x, z } = position
  for (let i = 0; i < count; i++) {
    if (canWalkWorld(x + dx / count, z)) x += dx / count
    if (canWalkWorld(x, z + dz / count)) z += dz / count
  }
  return { x, z }
}
