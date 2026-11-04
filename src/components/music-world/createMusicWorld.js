import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { createListeningScreen } from './createListeningScreen.js'
import { createConcertLights } from '../music-room/createConcertLights'
import { createStageRhythm } from './createStageRhythm.js'
import { WORLD_STATIONS, WORLD_DISCOVERY_SCREENS, WORLD_RECORD_DISPLAYS, WORLD_SEATS, WORLD_MAP_DESTINATIONS, WORLD_EYE_HEIGHT, WORLD_SEAT_HEIGHT, moveWorld } from './worldNavigation'
import { createWorldTravel, stepWorldTravel, worldViewToward, smoothWorldView, angleDelta } from './worldTravel.js'
import { createCoverSurface, makeSign, materialTexture } from './worldTextures'
import { createRecordExperience } from './createRecordExperience'
import { createWorldLightShow } from './createWorldLightShow'
import { createWorldScenes } from './createWorldScenes.js'
import { createDiscoveryScreen } from './createDiscoveryScreen.js'
import { FEED_IDS, FEED_LAYOUT } from './screenFeeds.js'
import { createControlTerminal, TERMINAL_SLIDERS, TERMINAL_QUEUE } from './createControlTerminal.js'

const KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'ShiftLeft', 'ShiftRight'])
export async function createMusicWorld(canvas, { onStatus, onAction, onProgress, sampleAudio, signal } = {}) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#142330'); scene.fog = new THREE.FogExp2('#152737', .012)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true
  const camera = new THREE.PerspectiveCamera(65, 1, .1, 180); camera.rotation.order = 'YXZ'
  scene.add(camera)
  const keys = new Set(), covers = [], hitTargets = [], textures = new Set(), practicals=[]
  const rhythm = createStageRhythm(), raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2()
  const visibleSurfaces = new THREE.Frustum(), viewProjection = new THREE.Matrix4()
  let frame = 0, last = 0, settle = 0, disposed = false, active = true, walking = false, reducedMotion = false
  let yaw = 0, pitch = .09, drag = null, previousTrack = '', previousScreen = '', lastStatus = 0, frameCount = 0
  let previousLyrics=null
  let playback = { track: {}, currentTime: 0, duration: 0, playing: false }, library = {}, lighting = { power: 0, live: false }
  let observer, screen, screenMesh, environment, concert, pavilion, records, lightShow, environments, terminal
  let tour=null, pendingTravel=null, seated=false, seatId='', pointId='', seatMove=null, returnPose=null, quality='balanced'
  const ambient = new THREE.HemisphereLight('#d4e3ef', '#39352d', 1.9); scene.add(ambient)
  const sun = new THREE.DirectionalLight('#b1cbe2', 2.8); sun.position.set(-6, 11, 9)
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.normalBias = .06
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 25, bottom: -25, near: .5, far: 65 })
  scene.add(sun)

  function invalidate() {
    settle = performance.now() + 400
    if (!frame && !disposed && active && !document.hidden) frame = requestAnimationFrame(render)
  }
  function clearMovement() { keys.clear(); drag = null }
  function stop() { cancelAnimationFrame(frame); frame = 0; last = 0; clearMovement() }
  function angles(look) {
    return worldViewToward(camera.position,look)
  }
  function lookToward(look,amount=1) {
    const target=angles(look)
    yaw+=Math.atan2(Math.sin(target.yaw-yaw),Math.cos(target.yaw-yaw))*amount
    pitch+=(target.pitch-pitch)*amount
  }
  function cancelTravel(){tour=null;pendingTravel=null;onStatus?.({navigating:false})}
  function selectDestination(id,details={}){pointId=id;onStatus?.({pointId:id,...details})}
  function stand(immediate=false) {
    if(!seated){
      if(immediate&&seatMove){camera.position.copy(seatMove.to);seatMove=null}
      return
    }
    const pose=returnPose;seated=false;seatId='';seatMove=null
    if(pose){
      if(immediate||reducedMotion)camera.position.copy(pose.position)
      else seatMove={from:camera.position.clone(),to:pose.position.clone(),elapsed:0,look:null}
    }
    selectDestination('',{seated:false,seatId:''});invalidate()
  }
  function travelTo(station,onArrival,immediate=false) {
    clearMovement();cancelTravel()
    if(immediate||reducedMotion)stand(true)
    else if(seated||seatMove){
      if(seated)stand()
      pendingTravel={station,onArrival};onStatus?.({navigating:true});invalidate();return
    }
    beginTravel(station,onArrival,immediate)
  }
  function beginTravel(station,onArrival,immediate=false){
    if(immediate||reducedMotion){camera.position.set(station.x,WORLD_EYE_HEIGHT,station.z);lookToward(station.look);onArrival?.();onStatus?.({navigating:false})}
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
    const display=WORLD_RECORD_DISPLAYS[index];if(!display)return
    terminal?.closeMenus();records?.dismiss();travelTo(display.view,null,immediate)
    selectDestination(display.id,{station:'archive',focusedScreen:'',location:display.label})
  }
  function sit(id='seat-center',{immediate=false}={}) {
    if(typeof id==='number')id=id<0?'seat-front-left':id>0?'seat-front-right':'seat-center'
    const seat=WORLD_SEATS.find(item=>item.id===id);if(!seat)return
    terminal?.closeMenus();records?.dismiss()
    const look=seat.view.look
    travelTo(seat.view,()=>{
      returnPose={position:camera.position.clone().setY(WORLD_EYE_HEIGHT)}
      seated=true;seatId=seat.id;seatMove={from:camera.position.clone(),to:new THREE.Vector3(seat.x,WORLD_SEAT_HEIGHT,seat.z),elapsed:0,look}
      if(immediate||reducedMotion){camera.position.copy(seatMove.to);lookToward(look);seatMove=null}
      selectDestination(seat.id,{seated:true,seatId,station:seat.z>0?'lounge':'screen',focusedScreen:'',location:seat.label});invalidate()
    },immediate)
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
    if(!KEYS.has(code)||records?.getState().inspecting)return
    if(pressed){
      if(!code.startsWith('Shift')){
        cancelTravel()
        if(code.startsWith('Key')){if(seated)stand();if(pointId)selectDestination('')}
        if(seatMove)seatMove.look=null
      }
      keys.add(code);walking=true;invalidate()
    }else keys.delete(code)
  }
  function keydown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (KEYS.has(event.code)) { event.preventDefault(); setKey(event.code, true) }
    if (event.code === 'Home') { event.preventDefault(); navigate('atrium') }
    if (event.code === 'KeyE' && !event.repeat) { event.preventDefault(); interactAtCenter() }
    if (event.code === 'PageDown' || event.code === 'PageUp') {
      raycaster.setFromCamera(new THREE.Vector2(0,0),camera)
      const object = firstHit()?.object, delta = event.code === 'PageDown' ? 1 : -1
      if (object?.userData.action === 'feed') { event.preventDefault(); onAction?.('feed-scroll', { id: object.userData.payload, delta: delta * 4 }) }
    }
    if (event.code === 'Escape') {clearMovement();cancelTravel();terminal?.closeMenus();records?.dismiss();stand()}
  }
  function keyup(event) { keys.delete(event.code) }
  function pointerdown(event) {
    if (event.button !== 0 || records?.getState().inspecting) return
    cancelTravel()
    canvas.focus({ preventScroll: true }); canvas.setPointerCapture(event.pointerId)
    setPointer(event); raycaster.setFromCamera(pointer,camera)
    const hit=firstHit(),action=hit?.object.userData.action
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
      const top = hit.object.localToWorld(new THREE.Vector3(0,halfHeight,0)).project(camera), bottom = hit.object.localToWorld(new THREE.Vector3(0,-halfHeight,0)).project(camera)
      units = (queueDrag?650:FEED_LAYOUT.size) / Math.max(30, Math.abs(top.y-bottom.y)*canvas.clientHeight/2) / (queueDrag?TERMINAL_QUEUE.rowHeight:FEED_LAYOUT.rowHeight)
    }
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, distance: 0, action:queueDrag?'terminal-queue':action, feed: hit?.object.userData.payload, units, accumulated: 0 }; invalidate()
  }
  function pointermove(event) {
    if (!drag) {
      setPointer(event); raycaster.setFromCamera(pointer,camera)
      const hit=firstHit(),action=hit?.object.userData.action
      canvas.style.cursor = ['feed','terminal'].includes(action) ? 'pointer' : 'grab'
      canvas.title=action==='terminal'?terminal.hint(hit.uv):''
      return
    }
    if (drag.id !== event.pointerId) return
    const x = event.clientX - drag.x, y = event.clientY - drag.y
    if(drag.action==='terminal-slider'){
      setPointer(event);raycaster.setFromCamera(pointer,camera)
      const hit=raycaster.intersectObject(drag.mesh,false)[0],control=hit&&terminal.hitTest(hit.uv,drag.control)
      if(control)onAction?.(control.action,control.payload)
    }
    else if (drag.action === 'feed') onAction?.('feed-scroll', { id: drag.feed, delta: -y * drag.units })
    else if (drag.action === 'terminal-queue') terminal.scrollQueue(-y*drag.units)
    else if (drag.action === 'terminal') { /* A swipe across the terminal keeps the display in view. */ }
    else { if(seatMove)seatMove.look=null; yaw -= x * .003; pitch = THREE.MathUtils.clamp(pitch - y * .0025, -.9, 1.12) }
    drag.x = event.clientX; drag.y = event.clientY; drag.distance += Math.abs(x) + Math.abs(y); invalidate()
  }
  function wheel(event) {
    setPointer(event); raycaster.setFromCamera(pointer,camera)
    const hit=firstHit(),target=hit?.object
    if (target?.userData.action === 'feed') {
      event.preventDefault(); cancelTravel()
      onAction?.('feed-scroll', { id: target.userData.payload, delta: event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 600 : 1) / 140 })
    } else if(target?.userData.action==='terminal'&&terminal.containsQueue(hit.uv)) {
      event.preventDefault();cancelTravel();terminal.scrollQueue(event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?600:1)/100)
    }
  }
  function pointerup(event) {
    if (!drag || drag.id !== event.pointerId) return
    const click = drag.distance < 6 && event.type !== 'pointercancel'; drag = null
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    if (!click) return
    setPointer(event)
    selectObject()
  }
  function setPointer(event){const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1)}
  function firstHit(){return raycaster.intersectObjects(hitTargets,false).find(hit=>{for(let object=hit.object;object;object=object.parent)if(!object.visible)return false;return true})}
  function interactAtCenter() { pointer.set(0,0); selectObject() }
  function selectObject() {
    if(records?.getState().inspecting)return
    raycaster.setFromCamera(pointer, camera)
    const hit = firstHit()
    if (!hit) return
    clearMovement();cancelTravel()
    if (hit.object.name === 'world-music-screen') {
      const action = screen.hitTest(hit.uv)
      if (action) onAction?.(action.action, action.payload)
      else onAction?.('listen')
    } else if(hit.object.userData.action==='terminal'){
      const action=terminal.select(hit.uv)
      if(action)onAction?.(action.action,action.payload)
    } else if(hit.object.userData.action==='feed'){
      const action = covers.find(c => c.surface.mesh === hit.object)?.surface.hitTest(hit.uv)
      if (action?.action === 'feed-focus') focusScreen(action.payload.id)
      else if (action) onAction?.(action.action, action.payload)
    } else if (hit.object.userData.item) {records.inspect(hit.object.userData.item,hit.object);onAction?.('inspect',hit.object.userData.item)}
    else if(hit.object.userData.action==='sit')sit(hit.object.userData.seatId)
    else if(hit.object.userData.action)onAction?.(hit.object.userData.action,hit.object.userData.payload)
    else if (hit.object.userData.station) onAction?.('station', hit.object.userData.station)
  }
  function visibility() { if (document.hidden) stop(); else invalidate() }
  function contextLost(event) { event.preventDefault(); stop(); active = false; onAction?.('error') }

  function updateMotion(delta){
    const forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS')), right = Number(keys.has('KeyD')) - Number(keys.has('KeyA'))
    walking=Boolean(forward||right)
    if ((forward || right) && !tour && !pendingTravel && !seatMove && !records?.getState().inspecting) {
      const speed = delta * (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 7 : 3.8) / Math.hypot(forward,right)
      const next = moveWorld(camera.position, (-Math.sin(yaw)*forward + Math.cos(yaw)*right)*speed, (-Math.cos(yaw)*forward - Math.sin(yaw)*right)*speed)
      camera.position.x = next.x; camera.position.z = next.z
    }
    if(tour){
      const next=stepWorldTravel(tour,{yaw,pitch},delta)
      camera.position.set(next.x,next.y,next.z);yaw=next.yaw;pitch=next.pitch
      if(next.arrived){const done=tour.onArrival;tour=null;onStatus?.({navigating:false});done?.()}
    }
    if(seatMove){
      seatMove.elapsed=Math.min(1,seatMove.elapsed+delta/.85);const t=seatMove.elapsed*seatMove.elapsed*(3-2*seatMove.elapsed)
      camera.position.lerpVectors(seatMove.from,seatMove.to,t)
      let aligned=true
      if(seatMove.look){
        const target=angles(seatMove.look),view=smoothWorldView({yaw,pitch},target,delta)
        yaw=view.yaw;pitch=view.pitch;aligned=Math.abs(angleDelta(target.yaw,yaw))<.002&&Math.abs(target.pitch-pitch)<.002
      }
      if(t===1&&aligned){
        seatMove=null
        if(pendingTravel){const next=pendingTravel;pendingTravel=null;beginTravel(next.station,next.onArrival)}
      }
    }
    else if(!seated)camera.position.y=WORLD_EYE_HEIGHT
    yaw += (Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight'))) * delta
    pitch = THREE.MathUtils.clamp(pitch + (Number(keys.has('ArrowUp')) - Number(keys.has('ArrowDown'))) * delta * .7, -.9, 1.12)
    camera.rotation.set(pitch, yaw, 0)
    const fov=seated?55:65
    if(Math.abs(camera.fov-fov)>.03){camera.fov=reducedMotion?fov:THREE.MathUtils.lerp(camera.fov,fov,1-Math.exp(-delta*6));camera.updateProjectionMatrix()}
    return fov
  }
  function render(now) {
    frame = 0; if (disposed || !active || document.hidden) return
    const delta = Math.min((now - (last || now - 16)) / 1000, .1); last = now
    const fov=updateMotion(delta)
    lighting = rhythm.update({ playing: playback.playing, reducedMotion, levels: playback.playing && !reducedMotion ? sampleAudio?.() : null }, delta)
    const lightSettling=lightShow.update(lighting, environments.getConfig(), reducedMotion,delta,seated,quality)
    const weatherMotion=environments.update(delta,lighting,reducedMotion)
    const recordMotion=records.update(delta,lighting,reducedMotion)
    camera.updateMatrixWorld()
    visibleSurfaces.setFromProjectionMatrix(viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse))
    let feedMotion = false
    covers.forEach(({ surface }) => {
      if (visibleSurfaces.intersectsObject(surface.mesh)) feedMotion = Boolean(surface.draw?.(now)) || feedMotion
    })
    const screenMotion = visibleSurfaces.intersectsObject(screenMesh) ? screen.draw(playback, now) : false
    const terminalMotion = visibleSurfaces.intersectsObject(terminal.mesh) ? terminal.draw(playback, now) : false
    try { renderer.render(scene, camera) } catch { active=false;stop();onAction?.('error');return }
    frameCount++
    if (now - lastStatus > 200) {
      lastStatus = now
      raycaster.setFromCamera(new THREE.Vector2(0,0),camera)
      const target=firstHit()?.object
      const hint=target?.userData.hint|| (target?.userData.item?`拿起唱片 · ${target.userData.item.name}`:target?.userData.action==='sit'?'坐下听歌':target?.name==='world-music-screen'?'操作音乐大屏':target?.userData.station?'前往'+WORLD_STATIONS[target.userData.station]?.label:'')
      onStatus?.({ x: camera.position.x, z: camera.position.z, yaw, live: lighting.live, walking, frameCount,hint,lightingCue:lightShow.getState().cue,tempo:lighting.tempo })
    }
    if (!frame && (tour || pendingTravel || seatMove || recordMotion || weatherMotion || lightSettling || screenMotion || terminalMotion || feedMotion || keys.size || drag || Math.abs(camera.fov-fov)>.03 || (playback.playing && !reducedMotion) || lighting.settling || now < settle)) frame = requestAnimationFrame(render)
  }
  function updateLibrary(data) {
    library = data
    covers.forEach(({ surface, side, index }) => {
      if(side==='discover')return
      const item = (side === 'archive' ? library.archive : library.discover)?.[index]
      surface.update(item, index); surface.mesh.userData.item = item || null
    }); invalidate()
  }
  function dispose() {
    if (disposed) return
    disposed = true; stop(); observer?.disconnect()
    canvas.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', clearMovement)
    canvas.removeEventListener('blur', clearMovement); document.removeEventListener('visibilitychange', visibility)
    canvas.removeEventListener('pointerdown', pointerdown); canvas.removeEventListener('pointermove', pointermove)
    canvas.removeEventListener('pointerup', pointerup); canvas.removeEventListener('pointercancel', pointerup)
    canvas.removeEventListener('wheel', wheel)
    canvas.removeEventListener('webglcontextlost', contextLost)
    environments?.dispose();records?.dispose();covers.forEach(c => c.surface.dispose()); screen?.dispose();terminal?.dispose()
    disposeTree(scene); textures.forEach(t => t.dispose()); environment?.dispose()
    renderer.dispose(); if (!renderer.getContext().isContextLost()) renderer.forceContextLoss()
  }
  signal?.addEventListener('abort', dispose, { once: true })
  try {
    const generator = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment()
    try { environment = generator.fromScene(room, .03) } finally { generator.dispose(); room.dispose() }
    scene.environment = environment.texture; scene.environmentIntensity = .38
    const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/resonance-pavilion.glb`, event => onProgress?.(event.total ? event.loaded/event.total : 0))
    if (disposed || signal?.aborted) { disposeTree(gltf.scene); throw new DOMException('World closed', 'AbortError') }
    pavilion = gltf.scene; scene.add(pavilion)
    pavilion.traverse(object => {
      if (!object.isMesh) return
      object.castShadow = !object.material.transparent; object.receiveShadow = true
      const name = object.material.name
      const kind = name === 'walnut' ? 'wood' : name === 'basalt' ? 'stone' : name === 'woven-fabric' ? 'fabric' : name === 'brushed-aluminium' ? 'metal' : ''
      if (kind && !object.material.bumpMap) { const texture = materialTexture(kind); textures.add(texture); object.material.bumpMap = texture; object.material.bumpScale = ({metal:.002,wood:.008,fabric:.012,stone:.018})[kind]; object.material.roughnessMap = texture }
    })
    screen = createListeningScreen(invalidate)
    screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(12.85,5.28), new THREE.MeshBasicMaterial({map:screen.texture,toneMapped:false}))
    screenMesh.name = 'world-music-screen'; pavilion.getObjectByName('music-screen').add(screenMesh); hitTargets.push(screenMesh)
    terminal=createControlTerminal(pavilion,hitTargets,invalidate)
    for (const side of ['archive','discover']) for (let index = 0; index < 4; index++) {
      const surface = side==='discover'?createDiscoveryScreen(index,invalidate):createCoverSurface(invalidate)
      pavilion.getObjectByName(`cover-${side}-${index}`).add(surface.mesh)
      covers.push({surface,side,index}); hitTargets.push(surface.mesh)
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
      const hit=new THREE.Mesh(new THREE.BoxGeometry(seat.id==='seat-center'?3.3:1.75,1.65,1.75),new THREE.MeshBasicMaterial({visible:false}))
      hit.position.set(seat.x,.85,seat.z);hit.userData={action:'sit',seatId:seat.id,hint:`${seat.label} · 坐下听歌`};hit.name=seat.id;scene.add(hit);hitTargets.push(hit)
      const sign=makeSign('落座听音','TAKE A SEAT',1.3);sign.position.set(seat.x,1.1,seat.z+1.04);sign.userData={action:'sit',seatId:seat.id,hint:`${seat.label} · 坐下听歌`};scene.add(sign);hitTargets.push(sign)
    }
    for (const [x,z] of [[-10,-5],[10,-5],[-10,7],[10,7],[0,-17]]) {
      const light = new THREE.PointLight('#ffdeb2',38,15,2); light.position.set(x,5.5,z); scene.add(light);practicals.push(light)
    }
    concert = createConcertLights(scene)
    lightShow=createWorldLightShow(scene,concert)
    records=createRecordExperience({camera,invalidate,onChange:onStatus})
    environments=createWorldScenes({scene,pavilion,renderer,ambient,sun,practicals,onChange:value=>{terminal.setScene(value.scene||environments?.getConfig().id||'rain',Boolean(value.sceneLoading));onStatus?.(value);invalidate()}})
    observer = new ResizeObserver(() => {
      const {width,height} = canvas.getBoundingClientRect(); if (!width || !height) return
      renderer.setSize(width,height,false); camera.aspect=width/height; camera.updateProjectionMatrix();records?.resize(); invalidate()
    }); observer.observe(canvas)
    canvas.addEventListener('keydown',keydown); window.addEventListener('keyup',keyup); window.addEventListener('blur',clearMovement)
    canvas.addEventListener('blur',clearMovement); document.addEventListener('visibilitychange',visibility)
    canvas.addEventListener('pointerdown',pointerdown); canvas.addEventListener('pointermove',pointermove)
    canvas.addEventListener('pointerup',pointerup); canvas.addEventListener('pointercancel',pointerup); canvas.addEventListener('webglcontextlost',contextLost)
    canvas.addEventListener('wheel',wheel,{passive:false})
    scene.updateMatrixWorld(true)
    navigate('atrium',{immediate:true}); updateLibrary(library)
  } catch(error) { dispose(); throw error }
  return {
    navigate, navigateToPoint, focusScreen, sit, stand, cancelTravel, setKey, clearMovement, dispose, updateLibrary,
    setAccount(value){terminal.setAccount(value)},
    setFeeds(value) { covers.filter(c => c.side === 'discover').forEach(c => c.surface.setState(value[FEED_IDS[c.index]])); invalidate() },
    inspectRecord(item){clearMovement();cancelTravel();stand(true);records.inspect(item)},
    dismissRecord(){records.dismiss()},
    openTerminal(){records.dismiss();navigate('terminal')},
    setQuality(value){
      quality=['smooth','balanced','high'].includes(value)?value:'balanced'
      terminal.setQuality(quality)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,quality==='smooth'?1:quality==='high'?2:1.5))
      const size=quality==='smooth'?1024:2048
      sun.shadow.mapSize.set(size,size);sun.shadow.map?.dispose();sun.shadow.map=null;renderer.shadowMap.needsUpdate=true
      const {width,height}=canvas.getBoundingClientRect();renderer.setSize(width,height,false);invalidate()
    },
    setActive(value) { active=Boolean(value); if(active)invalidate();else stop() },
    async setScene(id){const applied=await environments.select(id);if(applied)invalidate();return applied},
    setPlayback(value) {
      if(previousTrack!==value.track?.id || Math.abs((value.currentTime||0)-(playback.currentTime||0))>2) { rhythm.reset();lightShow?.reset(); previousTrack=value.track?.id }
      const stopMotion=Boolean(value.reducedMotion)&&!reducedMotion
      playback=value;reducedMotion=Boolean(value.reducedMotion)
      if(stopMotion){
        if(seatMove){camera.position.copy(seatMove.to);if(seatMove.look)lookToward(seatMove.look);seatMove=null}
        if(pendingTravel){const next=pendingTravel;pendingTravel=null;beginTravel(next.station,next.onArrival,true)}
        if(tour){const target=tour.destination,done=tour.onArrival;tour=null;camera.position.set(target.x,WORLD_EYE_HEIGHT,target.z);lookToward(target.look);onStatus?.({navigating:false});done?.()}
        camera.rotation.set(pitch,yaw,0);camera.updateMatrixWorld(true)
      }
      const contentChanged=previousLyrics!==value.lyrics
      previousLyrics=value.lyrics
      covers.forEach(c => c.surface.setPlayback?.(value))
      const signature=[value.track?.id,value.track?.name,value.track?.coverUrl,value.playing,value.loading,value.volume,value.queueVersion,value.playMode,value.queueLength,value.line?.text,value.currentTime,value.commentsTotal,value.danmakuEnabled,value.danmakuOpacity,reducedMotion].join('|')
      if(signature!==previousScreen||contentChanged){previousScreen=signature;invalidate()}
    },
    getState() { return { x:camera.position.x,y:camera.position.y,z:camera.position.z,yaw,pitch,pointId,seatId,frameCount,lighting:{...lighting},lightShow:lightShow?.getState(),environment:environments?.getState(),covers:covers.length,seated,seatTransition:Boolean(seatMove),navigating:Boolean(tour||pendingTravel),quality,record:records?.getState(),screen:screen?.getState(),terminal:terminal?.getState(),feeds:covers.filter(c=>c.side==='discover').map(c=>c.surface.getState()) } },
  }
}

function disposeTree(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set()
  root.traverse(o => { if(o.geometry)geometries.add(o.geometry);o.shadow?.dispose();
    for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){materials.add(m);Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v)})}
  })
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose())
}
