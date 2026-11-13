import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { createListeningScreen } from './createListeningScreen.js'
import { createConcertLights } from '../music-room/createConcertLights'
import { createStageRhythm } from './createStageRhythm.js'
import { WORLD_STATIONS, WORLD_DISCOVERY_SCREENS, WORLD_RECORD_DISPLAYS, WORLD_LOBBY_DISPLAY, WORLD_SEATS, WORLD_MAP_DESTINATIONS, WORLD_EYE_HEIGHT, WORLD_SEAT_HEIGHT, resolveWorldPosition, worldCameraLimit } from './worldNavigation'
import { createWorldMovement } from './worldMovement.js'
import { createWorldTravel, stepWorldTravel, worldViewToward, smoothWorldView, angleDelta } from './worldTravel.js'
import { createCoverSurface, makeSign, materialTexture } from './worldTextures'
import { createRecordExperience } from './createRecordExperience'
import { createWorldLightShow } from './createWorldLightShow'
import { createWorldScenes } from './createWorldScenes.js'
import { createDiscoveryScreen } from './createDiscoveryScreen.js'
import { FEED_IDS, FEED_LAYOUT } from './screenFeeds.js'
import { createControlTerminal, TERMINAL_SLIDERS, TERMINAL_QUEUE } from './createControlTerminal.js'
import { createWorldAvatars } from './createWorldAvatars.js'
import { optimizeWorldMaterials } from './optimizeWorldMaterials.js'
import { createWorldLightGrid } from './worldLightGrid.js'
import { createWorldRenderBudget } from './worldRenderBudget.js'
import { createWorldFrameMetrics } from './worldFrameMetrics.js'
import { createSpeakerMotion } from './createSpeakerMotion.js'
import { createListeningLobbyScreen } from './createListeningLobbyScreen.js'
import { createScreenProjection } from './createScreenProjection.js'
import { getSeatSlot, availableSeatSlots, seatOccupants } from '../../../backend/src/seatLayout.js'
import { createSeatMotion, sampleSeatMotion } from './worldSeatMotion.js'

const KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'ShiftLeft', 'ShiftRight'])
export async function createMusicWorld(canvas, { onStatus, onAction, onProgress, onListeningScreen, sampleAudio, onPresence, onSeat, signal, quality: initialQuality = 'balanced' } = {}) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#142330'); scene.fog = new THREE.FogExp2('#152737', .012)
  const lightGrid = createWorldLightGrid(scene)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true
  const renderBudget = createWorldRenderBudget(renderer)
  const frameMetrics = import.meta.env.DEV && new URLSearchParams(location.search).has('renderStats') ? createWorldFrameMetrics() : null
  let lastMetrics = 0
  const camera = new THREE.PerspectiveCamera(65, 1, .1, 600); camera.rotation.order = 'YXZ'
  const viewCamera = camera.clone(); viewCamera.rotation.order = 'YXZ'; scene.add(viewCamera)
  const keys = new Set(), covers = [], hitTargets = [], textures = new Set(), practicals=[]
  const movement = createWorldMovement()
  const rhythm = createStageRhythm(), raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2()
  const visibleSurfaces = new THREE.Frustum(), viewProjection = new THREE.Matrix4()
  const screenCorner = new THREE.Vector3()
  let lastScreenResolution = -Infinity
  function updateScreenResolution(surface, mesh) {
    if (!surface.setResolution) return
    const { width, height } = mesh.geometry.parameters
    let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity, near = false
    for (const x of [-.5, .5]) for (const y of [-.5, .5]) {
      screenCorner.set(x * width, y * height, 0).applyMatrix4(mesh.matrixWorld).project(viewCamera)
      near ||= screenCorner.z < -1
      left = Math.min(left, screenCorner.x); right = Math.max(right, screenCorner.x)
      bottom = Math.min(bottom, screenCorner.y); top = Math.max(top, screenCorner.y)
    }
    // Match the projected drawing-buffer width with a little room for movement.
    const pixels = Math.max((right - left) * canvas.width, (top - bottom) * canvas.height * width / height) * .5
    surface.setResolution(near ? 2048 : Math.max(0, pixels) * 1.2)
  }
  let frame = 0, last = 0, settle = 0, disposed = false, initialized = false, active = true, walking = false, reducedMotion = false
  let yaw = 0, pitch = .09, drag = null, previousTrack = '', previousScreen = '', lastStatus = 0, frameCount = 0
  let hoveredSurface = null
  let listeningInputOpen = false, listeningTransform = ''
  const projectListeningScreen = createScreenProjection()
  function syncListeningScreen() {
    if (!listeningInputOpen || !lobbyScreen) return
    const rect = canvas.getBoundingClientRect(), parent = canvas.parentElement.getBoundingClientRect()
    const placement = projectListeningScreen(lobbyScreen.mesh, viewCamera, { width: rect.width, height: rect.height, left: rect.left - parent.left, top: rect.top - parent.top })
    if ((placement?.transform || '') !== listeningTransform) { listeningTransform = placement?.transform || ''; onListeningScreen?.(placement) }
  }
  function setListeningInputOpen(value) {
    listeningInputOpen = Boolean(value)
    if (listeningInputOpen) { clearMovement(); cancelTravel(); clearScreenHover(); syncListeningScreen() }
    else { listeningTransform = ''; onListeningScreen?.(null) }
    invalidate()
  }
  let previousLyrics=null,previousCover=''
  let playback = { track: {}, currentTime: 0, duration: 0, playing: false }, library = {}, lighting = { power: 0, live: false }
  let observer, screen, screenMesh, environment, concert, pavilion, records, lightShow, environments, terminal, speakers, lobbyScreen
  let tour=null, pendingTravel=null, seated=false, seatId='', pointId='', seatMove=null, returnPose=null, quality=['smooth','balanced','high'].includes(initialQuality)?initialQuality:'balanced'
  let viewMode='third',bodyYaw=Math.PI,jumpHeight=0,jumpVelocity=0,seatEpoch=0,seatPending=false,membership='',roomConnected=false,lastPresence=0,lastPose=''
  let movementSpeed=0, movementActive=false, cameraBoom=1, cameraSettling=false
  let seatIndex=null, presencePlayers=[], selfId='', releasingSeat=false
  const avatars=createWorldAvatars(invalidate);scene.add(avatars.group)
  const offset=new THREE.Vector3(),targetPosition=new THREE.Vector3()
  const ambient = new THREE.HemisphereLight('#d4e3ef', '#39352d', 1.9); scene.add(ambient)
  const sun = new THREE.DirectionalLight('#b1cbe2', 2.8); sun.position.set(-6, 11, 9)
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.normalBias = .06
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 25, bottom: -25, near: .5, far: 65 })
  scene.add(sun)

  function invalidate() {
    settle = performance.now() + 400
    if (!frame && initialized && !disposed && active && !document.hidden) frame = requestAnimationFrame(render)
  }
  function clearMovement() { keys.clear(); drag = null; walking=false;movementSpeed=0;movementActive=false;movement.reset() }
  function stop() { cancelAnimationFrame(frame); frame = 0; last = 0; clearMovement(); clearScreenHover();jumpHeight=jumpVelocity=0;if(!seated&&!seatMove)camera.position.y=WORLD_EYE_HEIGHT;if(initialized&&!seatMove)onPresence?.(avatarPose(),true) }
  function updateScreenHover(hit) {
    const next = hit?.object.userData.action === 'terminal' ? terminal : hit?.object.userData.action === 'lobby' ? lobbyScreen : hit?.object.userData.action === 'feed' ? covers.find(entry => entry.surface.mesh === hit.object)?.surface : null
    if (hoveredSurface !== next) { hoveredSurface?.setHover(null); hoveredSurface?.cancelClick() }
    hoveredSurface = next
    hoveredSurface?.setHover(hit.uv)
  }
  function clearScreenHover(event) {
    hoveredSurface?.setHover(null)
    if (event?.pointerType !== 'touch') hoveredSurface?.cancelClick()
    hoveredSurface = null
    canvas.style.cursor = 'grab'; canvas.title = ''
  }
  function angles(look) {
    return worldViewToward(camera.position,look)
  }
  function lookToward(look,amount=1) {
    const target=angles(look)
    yaw+=Math.atan2(Math.sin(target.yaw-yaw),Math.cos(target.yaw-yaw))*amount
    pitch+=(target.pitch-pitch)*amount
  }
  function cancelTravel(){tour=null;pendingTravel=null;seatEpoch++;onStatus?.({navigating:false})}
  function selectDestination(id,details={}){pointId=id;onStatus?.({pointId:id,...details})}
  function seatAvailability() {
    const players=presencePlayers.filter(player=>player.id!==selfId)
    if(seated)players.push({id:selfId,seatId,seatIndex,active:true})
    return Object.fromEntries(WORLD_SEATS.map(seat=>{
      const occupants=seatOccupants(seat.id,players)
      return [seat.id,{capacity:seat.capacity,occupied:occupants.length,slots:seat.offsets.map((_,index)=>occupants.find(player=>(player.seatIndex??0)===index)||null)}]
    }))
  }
  function publishSeats(){onStatus?.({seats:seatAvailability()});invalidate()}
  function seatHint(id,index) {
    const seat=WORLD_SEATS.find(item=>item.id===id),state=seatAvailability()[id]
    if(!seat)return ''
    const occupant=index===undefined?null:state.slots[index]
    return `${seat.label} · ${state.occupied}/${state.capacity} 人 · ${occupant?occupant.id===selfId?'你已入座':`${occupant.name||'同伴'}已入座`:state.occupied>=state.capacity?'已坐满':'坐下听歌'}`
  }
  async function releaseSeat() {
    const room=membership
    releasingSeat=true
    try {
      const accepted=await (onSeat?.('')??true)
      if(!accepted&&!disposed&&room&&membership===room&&roomConnected){
        const self=presencePlayers.find(player=>player.id===selfId)
        const slot=self&&getSeatSlot(self.seatId,self.seatIndex??0)
        if(slot){clearMovement();cancelTravel();restoreSeat(slot);publishSeats()}
      }
      return accepted
    }
    finally { releasingSeat=false;invalidate() }
  }
  function restoreSeat(slot){
    seated=true;seatId=slot.seatId;seatIndex=slot.seatIndex;seatMove=null
    returnPose={position:new THREE.Vector3(slot.approach.x,WORLD_EYE_HEIGHT,slot.approach.z)}
    camera.position.set(slot.camera.x,slot.camera.y,slot.camera.z);bodyYaw=slot.pose.yaw
    selectDestination(seatId,{seated:true,seatId,seatIndex})
  }
  function finishSeatMove(){
    if(!seatMove)return
    camera.position.copy(seatMove.to);bodyYaw=seatMove.avatar.to.yaw
    if(seatMove.look)lookToward(seatMove.look)
    seatMove=null
  }
  function stand(immediate=false,release=true) {
    seatEpoch++
    if(!seated){
      if(immediate&&seatMove)finishSeatMove()
      return
    }
    const from=avatarPose(),pose=returnPose;seated=false;seatId='';seatIndex=null;seatMove=null
    if(release)void releaseSeat()
    if(pose){
      const safe=resolveWorldPosition(pose.position);pose.position.x=safe.x;pose.position.z=safe.z
      const to={x:safe.x,y:0,z:safe.z,yaw:from.yaw,motion:'idle',seatId:'',seatIndex:null}
      seatMove={from:camera.position.clone(),to:pose.position.clone(),elapsed:0,look:null,avatar:createSeatMotion(from,to)}
      if(immediate||reducedMotion)finishSeatMove()
    }
    selectDestination('',{seated:false,seatId:'',seatIndex:null});publishSeats()
  }
  function travelTo(station,onArrival,immediate=false) {
    jumpHeight=jumpVelocity=0
    clearMovement();clearScreenHover();cancelTravel()
    if(immediate||reducedMotion)stand(true)
    else if(seated||seatMove){
      if(seated)stand()
      pendingTravel={station,onArrival};onStatus?.({navigating:true});invalidate();return
    }
    beginTravel(station,onArrival,immediate)
  }
  function beginTravel(station,onArrival,immediate=false){
    const safe=resolveWorldPosition(station);station={...station,...safe}
    if(immediate||reducedMotion){camera.position.set(station.x,WORLD_EYE_HEIGHT,station.z);lookToward(station.look);bodyYaw=yaw+Math.PI;onArrival?.();onStatus?.({navigating:false})}
    else {
      const route=createWorldTravel(camera.position,station)
      if(route){tour={...route,onArrival};onStatus?.({navigating:true})}
      else {onStatus?.({navigating:false});onAction?.('notice','暂时无法自动到达，可以使用 WASD 自由行走。')}
    }
    camera.rotation.set(pitch,yaw,0);camera.updateMatrixWorld(true);invalidate()
  }
  function navigate(id,{immediate=false}={}) {
    let station = WORLD_STATIONS[id]; if (!station) return
    terminal?.closeMenus()
    if (id === 'terminal' && camera.aspect < 1.35) {
      const distance = Math.min(16.5,Math.max(station.z-station.look[2],4.7/(2*Math.tan(THREE.MathUtils.degToRad(65/2))*camera.aspect*.9)))
      station = { ...station, z: station.look[2] + distance }
    }
    records?.dismiss();travelTo(station,null,immediate)
    selectDestination(id,{ station: id, location: station.label, focusedScreen: '' })
  }
  function focusScreen(id, { immediate = false } = {}) {
    const screen = WORLD_DISCOVERY_SCREENS.find(item=>item.target===id); if (!screen) return
    terminal?.closeMenus()
    records?.dismiss()
    travelTo(screen.view, null, immediate)
    selectDestination(screen.id,{ station: 'discover', focusedScreen: id, location: screen.label })
  }
  function focusRecord(index, { immediate = false } = {}) {
    const display=WORLD_RECORD_DISPLAYS.find(item=>item.target===index);if(!display)return
    terminal?.closeMenus();records?.dismiss();travelTo(display.view,null,immediate)
    selectDestination(display.id,{station:'archive',focusedScreen:'',location:display.label})
  }
  function sit(id='seat-center',{immediate=false,seatIndex:requestedIndex}={}) {
    if(seatPending||releasingSeat)return
    if(typeof id==='number')id=id<0?'seat-front-left':id>0?'seat-front-right':'seat-center'
    const seat=WORLD_SEATS.find(item=>item.id===id);if(!seat)return
    if(seated&&seatId===id&&(requestedIndex===undefined||requestedIndex===seatIndex))return
    const free=availableSeatSlots(id,presencePlayers,selfId)
    if(!free.length){onAction?.('notice',`${seat.label}已坐满（${seat.capacity}/${seat.capacity} 人）。`);return}
    if(requestedIndex!==undefined&&!free.includes(requestedIndex)){onAction?.('notice','这个座位已经有人坐了。');return}
    const index=requestedIndex??free.reduce((best,next)=>{
      const a=getSeatSlot(id,best).approach,b=getSeatSlot(id,next).approach
      return Math.hypot(b.x-camera.position.x,b.z-camera.position.z)<Math.hypot(a.x-camera.position.x,a.z-camera.position.z)?next:best
    })
    const slot=getSeatSlot(id,index)
    terminal?.closeMenus();records?.dismiss()
    const look=seat.view.look
    let visit
    travelTo({...slot.approach,look:[slot.camera.x,1.22,slot.camera.z]},async()=>{
      // Immediate/reduced-motion travel also finishes before travelTo returns.
      await Promise.resolve()
      if(visit!==seatEpoch||disposed)return
      if(!availableSeatSlots(id,presencePlayers,selfId).includes(index)){onAction?.('notice','这个座位刚刚有人坐下，请选择其他空位。');selectDestination('');return}
      seatPending=true
      const room=membership
      let accepted
      try { accepted=await (onSeat?.(seat.id,index)??{seatId:id,seatIndex:index}) }
      catch { onAction?.('notice','暂时无法落座，请重试。') }
      finally { seatPending=false }
      if(!accepted||disposed||!active||visit!==seatEpoch){
        if(room===membership&&(accepted||presencePlayers.some(player=>player.id===selfId&&player.seatId===id)))void releaseSeat()
        if(visit===seatEpoch)selectDestination('')
        return
      }
      const assigned=getSeatSlot(id,accepted.seatIndex??index)
      if(!assigned)return
      const from=avatarPose()
      returnPose={position:camera.position.clone().setY(WORLD_EYE_HEIGHT)}
      seated=true;seatId=seat.id;seatIndex=assigned.seatIndex
      seatMove={from:camera.position.clone(),to:new THREE.Vector3(assigned.camera.x,WORLD_SEAT_HEIGHT,assigned.camera.z),elapsed:0,look,avatar:createSeatMotion(from,assigned.pose)}
      if(immediate||reducedMotion)finishSeatMove()
      selectDestination(seat.id,{seated:true,seatId,seatIndex,station:seat.z>0?'lounge':'screen',focusedScreen:'',location:seat.label});publishSeats()
    },immediate)
    visit=seatEpoch
    selectDestination(seat.id,{station:seat.z>0?'lounge':'screen',focusedScreen:'',location:seat.label})
  }
  function navigateToPoint(id,options) {
    const point=WORLD_MAP_DESTINATIONS.find(item=>item.id===id);if(!point)return
    if(point.kind==='seat')sit(point.id,options)
    else if(point.kind==='discovery')focusScreen(point.target,options)
    else if(point.kind==='record')focusRecord(point.target,options)
    else navigate(point.id,options)
  }
  function setKey(code, pressed) {
    if(!pressed){keys.delete(code);return}
    if (listeningInputOpen || disposed || !active) return
    if(!KEYS.has(code)||records?.getState().inspecting)return
    if(!keys.has(code)){
      clearScreenHover()
      if(!code.startsWith('Shift')){
        cancelTravel()
        if(code.startsWith('Key')){if(seated)stand();if(pointId)selectDestination('')}
        if(seatMove)seatMove.look=null
      }
      keys.add(code);invalidate()
    }
  }
  function keydown(event) {
    if (listeningInputOpen) { event.stopPropagation(); if (event.code === 'Escape') { event.preventDefault(); onAction?.('lobby-input-close') } return }
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (KEYS.has(event.code)) { event.preventDefault(); setKey(event.code, true) }
    if (event.code === 'Home') { event.preventDefault(); navigate('atrium') }
    if (event.code === 'Space') { event.preventDefault(); if(!event.repeat)jump() }
    if (event.code === 'KeyV' && !event.repeat) { event.preventDefault();setViewMode(viewMode==='third'?'first':'third') }
    if (event.code === 'KeyE' && !event.repeat) { event.preventDefault(); interactAtCenter() }
    if (event.code === 'PageDown' || event.code === 'PageUp') {
      raycaster.setFromCamera(new THREE.Vector2(0,0),viewCamera)
      const object = firstHit()?.object, delta = event.code === 'PageDown' ? 1 : -1
      if (object?.userData.action === 'feed') { event.preventDefault(); onAction?.('feed-scroll', { id: object.userData.payload, delta: delta * 4 }) }
      if (object?.userData.action === 'lobby') { event.preventDefault(); lobbyScreen.scroll(delta * 3) }
    }
    if (event.code === 'Escape') {clearMovement();cancelTravel();terminal?.closeMenus();records?.dismiss();stand()}
  }
  function keyup(event) { keys.delete(event.code) }
  function pointerdown(event) {
    if (listeningInputOpen) { event.preventDefault(); onAction?.('lobby-input-close'); return }
    if (event.button !== 0 || records?.getState().inspecting) return
    cancelTravel()
    canvas.focus({ preventScroll: true }); canvas.setPointerCapture(event.pointerId)
    setPointer(event); raycaster.setFromCamera(pointer,viewCamera)
    const hit=firstHit(),action=hit?.object.userData.action
    updateScreenHover(hit)
    const queueDrag=action==='terminal'&&terminal.containsQueue(hit.uv)
    if(action!=='terminal')terminal.closeMenus()
    if(action==='terminal'){
      const control=terminal.hitTest(hit.uv)
      if(control&&TERMINAL_SLIDERS.includes(control.action)){
        drag={id:event.pointerId,x:event.clientX,y:event.clientY,distance:10,action:'terminal-slider',control:control.action,mesh:hit.object}
        onAction?.(control.action,control.payload);invalidate();return
      }
    }
    let units = 1 / 80
    if (action === 'feed' || queueDrag) {
      const halfHeight = hit.object.geometry.parameters.height / 2
      const top = hit.object.localToWorld(new THREE.Vector3(0,halfHeight,0)).project(viewCamera), bottom = hit.object.localToWorld(new THREE.Vector3(0,-halfHeight,0)).project(viewCamera)
      units = (queueDrag?650:FEED_LAYOUT.size) / Math.max(30, Math.abs(top.y-bottom.y)*canvas.clientHeight/2) / (queueDrag?TERMINAL_QUEUE.rowHeight:FEED_LAYOUT.rowHeight)
    }
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, distance: 0, action:queueDrag?'terminal-queue':action, feed: hit?.object.userData.payload, units, accumulated: 0 }; invalidate()
  }
  function pointermove(event) {
    if (listeningInputOpen) return
    if (!drag) {
      setPointer(event); raycaster.setFromCamera(pointer,viewCamera)
      const hit=firstHit(),action=hit?.object.userData.action
      updateScreenHover(hit)
      canvas.style.cursor = ['feed','terminal','lobby','sit'].includes(action) ? 'pointer' : 'grab'
      canvas.title=action==='terminal'?terminal.hint(hit.uv):action==='lobby'?lobbyScreen.hint(hit.uv):action==='sit'?seatHint(hit.object.userData.seatId,hit.object.userData.seatIndex):''
      return
    }
    if (drag.id !== event.pointerId) return
    const x = event.clientX - drag.x, y = event.clientY - drag.y
    drag.distance += Math.abs(x) + Math.abs(y)
    if(drag.action==='terminal-slider'){
      setPointer(event);raycaster.setFromCamera(pointer,viewCamera)
      const hit=raycaster.intersectObject(drag.mesh,false)[0],control=hit&&terminal.hitTest(hit.uv,drag.control)
      if(control)onAction?.(control.action,control.payload)
    }
    else if (drag.action === 'feed' || drag.action === 'terminal-queue') {
      drag.accumulated += y
      if (drag.distance >= 6) {
        clearScreenHover()
        if (drag.action === 'feed') onAction?.('feed-scroll', { id: drag.feed, delta: -drag.accumulated * drag.units })
        else terminal.scrollQueue(-drag.accumulated * drag.units)
        drag.accumulated = 0
      }
    }
    else if (drag.action === 'terminal' || drag.action === 'lobby') { /* Keep touch displays in view while swiping. */ }
    else { if(seatMove)seatMove.look=null; yaw -= x * .003; pitch = THREE.MathUtils.clamp(pitch - y * .0025, -.9, 1.12) }
    drag.x = event.clientX; drag.y = event.clientY; invalidate()
  }
  function wheel(event) {
    if (listeningInputOpen) { event.preventDefault(); return }
    hoveredSurface?.cancelClick()
    setPointer(event); raycaster.setFromCamera(pointer,viewCamera)
    const hit=firstHit(),target=hit?.object
    if (target?.userData.action === 'feed') {
      event.preventDefault(); cancelTravel()
      onAction?.('feed-scroll', { id: target.userData.payload, delta: event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 600 : 1) / 140 })
    } else if(target?.userData.action==='lobby') {
      event.preventDefault();cancelTravel();lobbyScreen.scroll(event.deltaY)
    } else if(target?.userData.action==='terminal'&&terminal.containsQueue(hit.uv)) {
      event.preventDefault();cancelTravel();terminal.scrollQueue(event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?600:1)/100)
    }
  }
  function pointerup(event) {
    if (!drag || drag.id !== event.pointerId) return
    const click = drag.distance < 6 && event.type !== 'pointercancel'; drag = null
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    if (!click) { clearScreenHover(); return }
    setPointer(event)
    selectObject()
  }
  function setPointer(event){const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1)}
  function firstHit(){return raycaster.intersectObjects(hitTargets,false).find(hit=>{for(let object=hit.object;object;object=object.parent)if(!object.visible)return false;return true})}
  function interactAtCenter() { pointer.set(0,0); selectObject({keyboard:true}) }
  function selectObject(options) {
    if(records?.getState().inspecting)return
    raycaster.setFromCamera(pointer, viewCamera)
    const hit = firstHit()
    if (!hit) return
    clearMovement();cancelTravel()
    if (hit.object.name === 'world-music-screen') {
      const action = screen.hitTest(hit.uv)
      if (action) onAction?.(action.action, action.payload)
      else onAction?.('listen')
    } else if(hit.object.userData.action==='terminal'){
      const action=terminal.select(hit.uv,options)
      if(action)onAction?.(action.action,action.payload)
    } else if(hit.object.userData.action==='lobby'){
      const action=lobbyScreen.select(hit.uv)
      if(action)onAction?.(action.action,action.payload)
    } else if(hit.object.userData.action==='feed'){
      const action = covers.find(c => c.surface.mesh === hit.object)?.surface.select(hit.uv,options)
      if (action?.action === 'feed-focus') focusScreen(action.payload.id)
      else if (action) onAction?.(action.action, action.payload)
    } else if (hit.object.userData.item) {records.inspect(hit.object.userData.item,hit.object);onAction?.('inspect',hit.object.userData.item)}
    else if(hit.object.userData.action==='sit')sit(hit.object.userData.seatId,{seatIndex:hit.object.userData.seatIndex})
    else if(hit.object.userData.action)onAction?.(hit.object.userData.action,hit.object.userData.payload)
    else if (hit.object.userData.station) onAction?.('station', hit.object.userData.station)
  }
  function visibility() { if (document.hidden) stop(); else invalidate() }
  function contextLost(event) { event.preventDefault(); stop(); active = false; onAction?.('error') }

  function resizeRenderer() {
    const { width, height } = canvas.getBoundingClientRect()
    if (!width || !height) return
    // A DPR cap alone turns a 1080p window into a 4.7-million-pixel render.
    // Bound total pixels as well, keeping HiDPI detail in smaller windows.
    const pixels = quality === 'smooth' ? 1280 * 720 : quality === 'high' ? 3840 * 2160 : 1920 * 1080
    const ratio = Math.min(window.devicePixelRatio || 1, quality === 'smooth' ? 1 : quality === 'high' ? 2 : 1.5, Math.sqrt(pixels / (width * height)))
    const scale = renderBudget.configure(width, height, ratio)
    renderer.setDrawingBufferSize(width, height, ratio * scale)
    camera.aspect = width / height; camera.updateProjectionMatrix()
    lastScreenResolution = -Infinity
    records?.resize(); invalidate()
  }

  function setQuality(value) {
    quality=['smooth','balanced','high'].includes(value)?value:'balanced'
    // A manual high preset restores its full resolution immediately.
    if (quality === 'high') renderBudget.setEnabled(false)
    terminal.setQuality(quality)
    environments?.setQuality(quality)
    concert.setQuality(quality)
    const size=quality==='smooth'?1024:2048
    if(sun.shadow.mapSize.x!==size){sun.shadow.mapSize.set(size,size);sun.shadow.map?.dispose();sun.shadow.map=null}
    renderer.shadowMap.needsUpdate=true
    resizeRenderer()
  }

  function setViewMode(value){viewMode=value==='first'?'first':'third';onStatus?.({viewMode});invalidate()}
  function jump(){
    if(disposed||!active||records?.getState().inspecting)return
    if(seated){cancelTravel();stand();return}
    if(seatPending){cancelTravel();return}
    if(jumpVelocity||jumpHeight||seatMove)return
    clearScreenHover();cancelTravel();jumpVelocity=4.5;invalidate()
  }
  function avatarPose(){
    if(seatMove)return sampleSeatMotion(seatMove.avatar,seatMove.elapsed)
    if(seated)return {...getSeatSlot(seatId,seatIndex).pose,sitBlend:1}
    return {x:camera.position.x,z:camera.position.z,y:jumpHeight,yaw:bodyYaw,motion:jumpHeight>0?'jump':walking?(movementSpeed>4.5?'run':'walk'):'idle',speed:movementSpeed,seatId:'',transition:Boolean(seatMove)}
  }
  function updateView(delta){
    cameraSettling=false
    // Map destinations must not override the view mode chosen by the user.
    const firstPerson=viewMode==='first'||Boolean(records?.getState().inspecting)
    viewCamera.fov=camera.fov;viewCamera.aspect=camera.aspect;viewCamera.updateProjectionMatrix()
    if(firstPerson){viewCamera.position.copy(camera.position);viewCamera.rotation.copy(camera.rotation)}
    else {
      const sitting=avatarPose().sitBlend??0
      offset.set(Math.sin(yaw)*3.3+Math.cos(yaw)*1.5*sitting,1.10+1.10*sitting,Math.cos(yaw)*3.3-Math.sin(yaw)*1.5*sitting)
      targetPosition.copy(camera.position).add(offset)
      const limit=worldCameraLimit(camera.position,targetPosition)
      // Retract immediately before clipping; ease back out after clearing it.
      cameraBoom=limit<cameraBoom?limit:THREE.MathUtils.lerp(cameraBoom,limit,1-Math.exp(-delta*8))
      cameraSettling=Math.abs(cameraBoom-limit)>.001
      viewCamera.position.copy(camera.position).addScaledVector(offset,cameraBoom)
      targetPosition.set(camera.position.x-Math.sin(yaw)*2,camera.position.y+Math.tan(pitch)*4-.45,camera.position.z-Math.cos(yaw)*2)
      viewCamera.lookAt(targetPosition)
    }
    viewCamera.updateMatrixWorld(true);return firstPerson
  }

  function updateMotion(delta){
    const previousX=camera.position.x,previousZ=camera.position.z
    const traveling=Boolean(tour)
    let arrivalTurn=false
    const forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS')), right = Number(keys.has('KeyD')) - Number(keys.has('KeyA'))
    if (!seated && !tour && !pendingTravel && !seatMove && !seatPending && !records?.getState().inspecting) {
      const next = movement.update(camera.position,{forward,right,yaw,running:keys.has('ShiftLeft')||keys.has('ShiftRight')},delta)
      camera.position.x = next.x; camera.position.z = next.z
      movementActive=next.active
    }else{movement.reset();movementActive=false}
    if(tour){
      const next=stepWorldTravel(tour,{yaw,pitch},delta)
      camera.position.set(next.x,next.y,next.z);yaw=next.yaw;pitch=next.pitch
      arrivalTurn=tour.distance===tour.total
      if(next.arrived&&Math.abs(angleDelta(yaw+Math.PI,bodyYaw))<.002){bodyYaw=yaw+Math.PI;const done=tour.onArrival;tour=null;onStatus?.({navigating:false});done?.()}
    }
    if(seatMove){
      seatMove.elapsed+=delta
      const pose=sampleSeatMotion(seatMove.avatar,seatMove.elapsed)
      camera.position.lerpVectors(seatMove.from,seatMove.to,pose.move)
      camera.position.y=THREE.MathUtils.lerp(seatMove.from.y,seatMove.to.y,pose.posture)
      bodyYaw=pose.yaw
      let aligned=true
      if(seatMove.look){
        const target=angles(seatMove.look),view=smoothWorldView({yaw,pitch},target,delta)
        yaw=view.yaw;pitch=view.pitch;aligned=Math.abs(angleDelta(target.yaw,yaw))<.002&&Math.abs(target.pitch-pitch)<.002
      }
      if(pose.done&&aligned){
        seatMove=null
        if(pendingTravel){const next=pendingTravel;pendingTravel=null;beginTravel(next.station,next.onArrival)}
      }
    }
    else if(!seated){
      if(jumpVelocity||jumpHeight){jumpHeight=Math.max(0,jumpHeight+jumpVelocity*delta-6*delta*delta);jumpVelocity-=12*delta;if(!jumpHeight)jumpVelocity=0}
      camera.position.y=WORLD_EYE_HEIGHT+jumpHeight
    }
    const dx=camera.position.x-previousX,dz=camera.position.z-previousZ
    movementSpeed=delta?Math.hypot(dx,dz)/delta:0
    walking=!seated&&!seatMove&&movementSpeed>.03
    // Finish the arrival turn with the camera instead of retaining the last path heading.
    if(!seatMove&&(walking||traveling))bodyYaw+=angleDelta(walking&&!arrivalTurn?Math.atan2(dx,dz):yaw+Math.PI,bodyYaw)*(reducedMotion?1:1-Math.exp(-delta*16))
    yaw += (Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight'))) * delta
    pitch = THREE.MathUtils.clamp(pitch + (Number(keys.has('ArrowUp')) - Number(keys.has('ArrowDown'))) * delta * .7, -.9, 1.12)
    camera.rotation.set(pitch, yaw, 0)
    const fov=seated?55:65
    if(Math.abs(camera.fov-fov)>.03){camera.fov=reducedMotion?fov:THREE.MathUtils.lerp(camera.fov,fov,1-Math.exp(-delta*6));camera.updateProjectionMatrix()}
    return fov
  }
  function render(now) {
    frame = 0; if (disposed || !active || document.hidden) return
    frameMetrics?.begin(now)
    // High is a fixed fidelity choice; only performance presets adapt to load.
    renderBudget.setEnabled(quality !== 'high' && environments.getConfig().id === 'sky-lounge')
    if (renderBudget.begin(now)) lastScreenResolution = -Infinity
    environments.setWeatherBudget(renderBudget.getState().appliedScale)
    const delta = Math.min((now - (last || now - 16)) / 1000, .1); last = now
    const fov=updateMotion(delta)
    const firstPerson=updateView(delta),pose=avatarPose()
    const avatarMotion=avatars.update(pose,delta,{firstPerson,reducedMotion})
    const signature=[pose.x.toFixed(3),pose.y.toFixed(3),pose.z.toFixed(3),pose.yaw.toFixed(3),pose.motion].join(':')
    if(!seatMove&&!seatPending&&!releasingSeat&&now-lastPresence>=50&&(signature!==lastPose||now-lastPresence>1000)){lastPresence=now;lastPose=signature;onPresence?.(pose)}
    const audioLevels = playback.playing && !reducedMotion ? sampleAudio?.() : null
    lighting = rhythm.update({ playing: playback.playing, reducedMotion, levels: audioLevels }, delta)
    const speakerMotion = speakers.update(lighting, delta, { reducedMotion, lightsEnabled: playback.lightsEnabled !== false })
    const lightSettling=lightShow.update(lighting, environments.getConfig(), reducedMotion,delta,seated,quality)
    const weatherMotion=environments.update(delta,lighting,reducedMotion,playback)
    const recordMotion=records.update(delta,lighting,reducedMotion)
    viewCamera.updateMatrixWorld()
    visibleSurfaces.setFromProjectionMatrix(viewProjection.multiplyMatrices(viewCamera.projectionMatrix,viewCamera.matrixWorldInverse))
    if (now - lastScreenResolution > 250) {
      lastScreenResolution = now
      updateScreenResolution(screen, screenMesh); updateScreenResolution(terminal, terminal.mesh)
      covers.forEach(({ surface }) => updateScreenResolution(surface, surface.mesh))
    }
    let feedMotion = false
    covers.forEach(({ surface }) => {
      if (visibleSurfaces.intersectsObject(surface.mesh)) feedMotion = Boolean(surface.draw?.(now,audioLevels)) || feedMotion
    })
    const screenMotion = visibleSurfaces.intersectsObject(screenMesh) ? screen.draw(playback, now) : false
    const terminalMotion = visibleSurfaces.intersectsObject(terminal.mesh) ? terminal.draw(playback, now,audioLevels) : false
    lightGrid.invalidate()
    try { renderer.render(scene, viewCamera) } catch { renderBudget.abort();active=false;stop();onAction?.('error');return }
    renderBudget.end()
    frameMetrics?.end()
    if(frameMetrics&&now-lastMetrics>1000){lastMetrics=now;onStatus?.({performance:{...frameMetrics.getState(),...renderBudget.getState(),quality,width:renderer.domElement.width,height:renderer.domElement.height,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles}})}
    syncListeningScreen()
    frameCount++
    if (now - lastStatus > 200) {
      lastStatus = now
      raycaster.setFromCamera(new THREE.Vector2(0,0),viewCamera)
      const target=firstHit()?.object
      const hint=target?.userData.action==='sit'?seatHint(target.userData.seatId,target.userData.seatIndex):target?.userData.hint|| (target?.userData.item?`拿起唱片 · ${target.userData.item.name}`:target?.name==='world-music-screen'?'操作音乐大屏':target?.userData.station?'前往'+WORLD_STATIONS[target.userData.station]?.label:'')
      onStatus?.({ x: camera.position.x, z: camera.position.z, yaw, live: lighting.live, walking, jumping:jumpHeight>0,viewMode,frameCount,hint,lightingCue:lightShow.getState().cue,tempo:lighting.tempo,climateHour:environments.getClimate().currentHour })
    }
    if (!frame && (tour || pendingTravel || seatMove || movementActive || cameraSettling || avatarMotion || jumpHeight || jumpVelocity || recordMotion || weatherMotion || speakerMotion || lightSettling || screenMotion || terminalMotion || feedMotion || keys.size || drag || Math.abs(camera.fov-fov)>.03 || (playback.playing && !reducedMotion) || lighting.settling || now < settle)) frame = requestAnimationFrame(render)
  }
  function updateLibrary(data) {
    library = data
    covers.forEach(({ surface, side, index }) => {
      if(side!=='archive')return
      const item = library.archive?.[index>WORLD_LOBBY_DISPLAY.index?index-1:index]
      surface.update(item, index); surface.mesh.userData.item = item || null
    }); invalidate()
  }
  function dispose() {
    if (disposed) return
    renderBudget.dispose()
    lightGrid.dispose()
    disposed = true; stop(); observer?.disconnect(); onListeningScreen?.(null)
    canvas.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', clearMovement)
    canvas.removeEventListener('blur', clearMovement); document.removeEventListener('visibilitychange', visibility)
    canvas.removeEventListener('pointerdown', pointerdown); canvas.removeEventListener('pointermove', pointermove)
    canvas.removeEventListener('pointerup', pointerup); canvas.removeEventListener('pointercancel', pointerup)
    canvas.removeEventListener('pointerleave', clearScreenHover); canvas.removeEventListener('blur', clearScreenHover); window.removeEventListener('blur', clearScreenHover)
    canvas.removeEventListener('wheel', wheel)
    canvas.removeEventListener('webglcontextlost', contextLost)
    avatars.dispose();environments?.dispose();records?.dispose();covers.forEach(c => c.surface.dispose()); screen?.dispose();terminal?.dispose()
    disposeTree(scene); textures.forEach(t => t.dispose()); environment?.dispose()
    renderer.dispose(); if (!renderer.getContext().isContextLost()) renderer.forceContextLoss()
  }
  signal?.addEventListener('abort', dispose, { once: true })
  try {
    const generator = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment()
    try { environment = generator.fromScene(room, .03) } finally { generator.dispose(); room.dispose() }
    scene.environment = environment.texture; scene.environmentIntensity = .38
    const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/resonance-pavilion.glb`, event => onProgress?.(event.total ? event.loaded/event.total*.65 : 0))
    if (disposed || signal?.aborted) { disposeTree(gltf.scene); throw new DOMException('World closed', 'AbortError') }
    pavilion = gltf.scene; scene.add(pavilion)
    await avatars.load(renderer, event => onProgress?.(.65+(event.total ? event.loaded/event.total*.35 : 0)))
    if (disposed || signal?.aborted) throw new DOMException('World closed', 'AbortError')
    pavilion.traverse(object => {
      if (!object.isMesh) return
      object.castShadow = !object.material.transparent; object.receiveShadow = true
      const name = object.material.name
      const kind = name === 'walnut' || name === 'speaker-smoked-walnut' ? 'wood' : name === 'basalt' ? 'stone' : name === 'woven-fabric' ? 'fabric' : name === 'brushed-aluminium' || name === 'speaker-titanium' ? 'metal' : ''
      if (kind && !object.material.bumpMap) { const texture = materialTexture(kind); textures.add(texture); object.material.bumpMap = texture; object.material.bumpScale = ({metal:.002,wood:.008,fabric:.012,stone:.018})[kind]; object.material.roughnessMap = texture }
    })
    speakers = createSpeakerMotion(pavilion)
    screen = createListeningScreen(invalidate)
    screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(12.85,5.28), new THREE.MeshBasicMaterial({map:screen.texture,toneMapped:false}))
    for (const layer of screen.layers) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(12.85*layer.width/2048,5.28*layer.height/840),new THREE.MeshBasicMaterial({map:layer.texture,toneMapped:false,transparent:true,depthWrite:false}))
      mesh.position.set(12.85*((layer.x+layer.width/2)/2048-.5),5.28*(.5-(layer.y+layer.height/2)/840),.003)
      screenMesh.add(mesh)
    }
    screenMesh.name = 'world-music-screen'; pavilion.getObjectByName('music-screen').add(screenMesh); hitTargets.push(screenMesh)
    terminal=createControlTerminal(pavilion,hitTargets,invalidate)
    for (const side of ['archive','discover']) for (let index = 0; index < 4; index++) {
      const isLobby=side==='archive'&&index===WORLD_LOBBY_DISPLAY.index
      const surface = isLobby?(lobbyScreen=createListeningLobbyScreen(invalidate)):side==='discover'?createDiscoveryScreen(index,invalidate):createCoverSurface(invalidate)
      pavilion.getObjectByName(`cover-${side}-${index}`).add(surface.mesh)
      covers.push({surface,side:isLobby?'lobby':side,index}); hitTargets.push(surface.mesh)
    }
    for (const [text,sub,pos,rotation,station] of [
      ['唱片档案','YOUR MUSIC, COLLECTED.',[-11.9,4.5,1],Math.PI/2,'archive'],
      ['发现展厅','THE NEXT GREAT LISTEN.',[11.9,4.5,1],-Math.PI/2,'discover'],
      ['声 境','LANYIN / RESONANCE PAVILION',[0,7.45,-20.15],0,'screen'],
      ['声音沙龙','SLOW DOWN. TUNE IN.',[-7,3.8,15],Math.PI/3,'lounge'],
      ['控制终端','MUSIC CONTROL',[0,.46,2.43],0,'terminal'],
    ]) {
      const sign = makeSign(text,sub,station==='terminal'?1.7:station==='screen'?4.5:5)
      sign.position.fromArray(pos); sign.rotation.y=rotation; sign.userData.station=station; scene.add(sign); hitTargets.push(sign)
    }
    for(const seat of WORLD_SEATS){
      seat.offsets.forEach((offset,index)=>{
        const hit=new THREE.Mesh(new THREE.BoxGeometry(seat.capacity>1?1.46:1.75,1.65,1.75),new THREE.MeshBasicMaterial({visible:false}))
        hit.position.set(seat.x+offset,.85,seat.z);hit.rotation.y=seat.yaw-Math.PI
        hit.userData={action:'sit',seatId:seat.id,seatIndex:index};hit.name=`${seat.id}-${index}`;scene.add(hit);hitTargets.push(hit)
      })
      const sign=makeSign('落座听音','TAKE A SEAT',1.3);sign.position.set(seat.x,1.1,seat.z+1.04);sign.userData={action:'sit',seatId:seat.id,hint:`${seat.label} · 坐下听歌`};scene.add(sign);hitTargets.push(sign)
    }
    for (const [x,z] of [[-10,-5],[10,-5],[-10,7],[10,7],[0,-17]]) {
      const light = new THREE.PointLight('#ffdeb2',38,15,2); light.position.set(x,5.5,z); scene.add(light);practicals.push(light)
    }
    concert = createConcertLights(scene)
    lightShow=createWorldLightShow(scene,concert)
    records=createRecordExperience({camera:viewCamera,invalidate,onChange:onStatus})
    environments=createWorldScenes({scene,pavilion,renderer,camera:viewCamera,ambient,sun,practicals,concert,lightGrid,onInvalidate:invalidate,onChange:value=>{terminal.setScene(value.scene||environments?.getConfig().id||'rain',Boolean(value.sceneLoading));onStatus?.(value);invalidate()}})
    observer = new ResizeObserver(resizeRenderer); observer.observe(canvas)
    canvas.addEventListener('keydown',keydown); window.addEventListener('keyup',keyup); window.addEventListener('blur',clearMovement)
    canvas.addEventListener('blur',clearMovement); document.addEventListener('visibilitychange',visibility)
    canvas.addEventListener('pointerdown',pointerdown); canvas.addEventListener('pointermove',pointermove)
    canvas.addEventListener('pointerup',pointerup); canvas.addEventListener('pointercancel',pointerup); canvas.addEventListener('webglcontextlost',contextLost)
    canvas.addEventListener('pointerleave',clearScreenHover); canvas.addEventListener('blur',clearScreenHover); window.addEventListener('blur',clearScreenHover)
    canvas.addEventListener('wheel',wheel,{passive:false})
    scene.updateMatrixWorld(true)
    optimizeWorldMaterials(scene, lightGrid)
    setQuality(quality)
    // Compile with the final, fixed light count before the page becomes interactive,
    // including the beam materials that are invisible while playback is paused.
    await renderer.compileAsync(scene,viewCamera)
    if (disposed || signal?.aborted) throw new DOMException('World closed', 'AbortError')
    onProgress?.(1)
    initialized=true;navigate('atrium',{immediate:true}); updateLibrary(library)
  } catch(error) { dispose(); throw error }
  return {
    navigate, navigateToPoint, focusScreen, sit, stand, cancelTravel, setKey, clearMovement, dispose, updateLibrary, jump, setViewMode,
    setPresence(value,{memberId,roomId='',connected=false,preservePosition=false}={}){
      avatars.setPeers(value,memberId,connected)
      selfId=memberId;presencePlayers=connected&&value?.roomId===roomId?(value?.players||[]):[]
      const self=value?.players?.find(item=>item.id===memberId)
      let preserved=false
      if((membership!==roomId||(!roomConnected&&connected))&&self){
        if(membership!==roomId&&preservePosition){
          // Joining or creating keeps the local pose and publishes it to the new room.
          clearMovement();cancelTravel()
          preserved=true
          onPresence?.(avatarPose(),true)
          if(seated){
            const requested=seatId,index=seatIndex,epoch=seatEpoch
            seatPending=true
            Promise.resolve(onSeat?.(requested,index)??true).then(accepted=>{
              if(disposed||epoch!==seatEpoch){if(accepted&&membership===roomId)void releaseSeat();return}
              if(!accepted)stand(true,false)
            }).catch(()=>stand(true,false)).finally(()=>{seatPending=false;publishSeats()})
          }
        }else{
          clearMovement();cancelTravel();stand(true,false);jumpHeight=jumpVelocity=0
          const safe=resolveWorldPosition(self)
          camera.position.set(safe.x,WORLD_EYE_HEIGHT,safe.z);bodyYaw=self.yaw;selectDestination('')
          const slot=self.seatId&&getSeatSlot(self.seatId,self.seatIndex??0)
          if(slot)restoreSeat(slot)
        }
      }
      if((!connected||!roomId)&&seated&&membership)stand(true,false)
      if(seated&&connected&&roomId===membership&&!seatPending&&!releasingSeat&&(!self||self.seatId!==seatId||(self.seatIndex??0)!==seatIndex))stand(true,false)
      if(self||!roomId)membership=roomId
      roomConnected=connected&&Boolean(self);publishSeats()
      return preserved
    },
    setAccount(value){terminal.setAccount(value)},
    setListeningRoom(value){terminal.setRoom(value)},
    setListeningLobby(value){lobbyScreen.setState(value)},
    setListeningInputOpen,
    setFeeds(value) { covers.filter(c => c.side === 'discover').forEach(c => c.surface.setState(value[FEED_IDS[c.index]])); invalidate() },
    inspectRecord(item){clearMovement();cancelTravel();stand(true);records.inspect(item)},
    dismissRecord(){records.dismiss()},
    openTerminal(){records.dismiss();navigate('terminal')},
    setQuality,
    setActive(value) { active=Boolean(value); if(active)invalidate();else {cancelTravel();stop()} },
    async setScene(id,onProgress){const applied=await environments.select(id,onProgress);if(applied)invalidate();return applied},
    setClimate(value){environments.setClimate(value)},
    setPlayback(value) {
      if(previousTrack!==value.track?.id || Math.abs((value.currentTime||0)-(playback.currentTime||0))>2) { rhythm.reset();lightShow?.reset(); previousTrack=value.track?.id }
      const stopMotion=Boolean(value.reducedMotion)&&!reducedMotion
      playback=value;reducedMotion=Boolean(value.reducedMotion)
      lightShow.setEnabled(value.lightsEnabled!==false)
      if(stopMotion){
        if(seatMove)finishSeatMove()
        if(pendingTravel){const next=pendingTravel;pendingTravel=null;beginTravel(next.station,next.onArrival,true)}
        if(tour){const target=tour.destination,done=tour.onArrival;tour=null;camera.position.set(target.x,WORLD_EYE_HEIGHT,target.z);lookToward(target.look);bodyYaw=yaw+Math.PI;onStatus?.({navigating:false});done?.()}
        camera.rotation.set(pitch,yaw,0);camera.updateMatrixWorld(true)
      }
      const contentChanged=previousLyrics!==value.lyrics
      previousLyrics=value.lyrics
      const coverChanged=previousCover!==value.track?.coverUrl
      previousCover=value.track?.coverUrl
      covers.forEach(c => c.surface.setPlayback?.(value))
      const signature=[value.track?.id,value.track?.name,value.playing,value.loading,value.loadingTrack?.id,(value.pendingKeys||[]).join(','),value.volume,value.queueVersion,value.playMode,value.queueLength,value.line?.text,value.currentTime,value.commentsTotal,value.danmakuEnabled,value.danmakuOpacity,value.lightsEnabled,reducedMotion].join('|')
      if(signature!==previousScreen||contentChanged||coverChanged){previousScreen=signature;invalidate()}
    },
    getState() { return { x:camera.position.x,y:camera.position.y,z:camera.position.z,yaw,pitch,pointId,seatId,seatIndex,seats:seatAvailability(),frameCount,avatar:avatarPose(),avatars:avatars.getState(),viewMode,lighting:{...lighting},lightShow:lightShow?.getState(),environment:environments?.getState(),covers:covers.length,seated,seatTransition:Boolean(seatMove),navigating:Boolean(tour||pendingTravel),quality,record:records?.getState(),screen:screen?.getState(),terminal:terminal?.getState(),feeds:covers.filter(c=>c.side==='discover').map(c=>c.surface.getState()) } },
  }
}

function disposeTree(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set()
  root.traverse(o => { if(o.geometry)geometries.add(o.geometry);if(o.isInstancedMesh)o.dispose();o.shadow?.dispose();
    for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){materials.add(m);Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v)})}
  })
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose())
}
