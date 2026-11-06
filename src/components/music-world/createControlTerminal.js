import * as THREE from 'three'
import { canvasSurface } from './worldSurfaces.js'
import { createScreenImages, cropImage, formatTime, ink, rounded, text } from './screenDrawing.js'
import { drawPlayerIcon, drawTransportButton } from '../playerTransportDrawing.js'
import { WORLD_SCENES } from './worldScenes.js'
import { normalizeDanmakuOpacity } from './danmakuSettings.js'
import { createScreenList } from './createScreenList.js'

export const TERMINAL_SLIDERS = ['progress','volume','danmaku-opacity']
export const TERMINAL_QUEUE = {x:28,y:143,width:392,height:480,rowHeight:72}
export const TERMINAL_ACCOUNT = {x:1304,y:10,width:272,height:57}
export const TERMINAL_LISTENING = {create:{x:540,y:17,width:178,height:43},join:{x:732,y:17,width:178,height:43}}
export const TERMINAL_MODES = [{value:'shuffle',label:'随机播放'},{value:'order',label:'顺序播放'},{value:'single',label:'单曲循环'},{value:'list',label:'列表循环'}]
const WIDTH=1600,HEIGHT=650,QUALITIES=[{id:'smooth',label:'流畅'},{id:'balanced',label:'均衡'},{id:'high',label:'精细'}]
const EMPTY_QUEUE=[]
export function createControlTerminal(pavilion, hitTargets, invalidate) {
  const surface=canvasSurface(WIDTH,HEIGHT),ctx=surface.context
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(4.14,1.68),new THREE.MeshBasicMaterial({map:surface.texture,toneMapped:false}))
  mesh.name='world-control-terminal-screen';mesh.userData={action:'terminal',hint:'控制终端 · 点歌、滚动列表或调节播放'}
  pavilion.getObjectByName('terminal-screen').add(mesh);hitTargets.push(mesh)
  let dirty=true,signature='',zones=[],sceneId='rain',sceneLoading=false,quality='balanced',lastDraw=0
  let playback={},queue=[],queueVersion,queueReference,currentId='',scroll=0,menu=''
  let account={isLoggedIn:false,displayName:'点击登录',avatarUrl:''}
  let room={id:'',isHost:false,connected:false,count:0,capacity:10,status:''}
  const images=createScreenImages(()=>{dirty=true;invalidate()},32)
  const zone=(x,y,w,h,action,payload,label)=>zones.push({x,y,w,h,action,payload,label})
  const changed=()=>{dirty=true;invalidate()}
  const queueList=createScreenList(ctx,{images,invalidate:changed})
  const maxScroll=()=>Math.max(0,queue.length-TERMINAL_QUEUE.height/TERMINAL_QUEUE.rowHeight)
  const centered=(label,x,y,size,color=ink.light,width=560,weight=400)=>{ctx.save();ctx.textAlign='center';text(ctx,label,x,y,size,color,width,weight);ctx.restore()}
  function scrollQueue(delta){const next=THREE.MathUtils.clamp(scroll+delta,0,maxScroll());if(next!==scroll){scroll=next;queueList.reset();changed()}}
  function revealCurrent(){
    const index=queue.findIndex(track=>String(track.id)===currentId)
    if(index>=0)scroll=THREE.MathUtils.clamp(index-3,0,maxScroll())
    queueList.reset()
    changed()
  }
  function button(x,y,w,h,label,action,payload,{selected=false,size=20}={}){
    rounded(ctx,x,y,w,h,7,selected?'#25464e':'#132f3c')
    centered(label,x+w/2,y+h/2+size*.35,size,selected?ink.ice:ink.light,w-20)
    zone(x,y,w,h,action,payload,label)
  }
  function icon(icon,x,y,action,payload,label,size=28){
    drawPlayerIcon(ctx,icon,x,y,size,ink.light)
    zone(x-24,y-24,48,48,action,payload,label)
  }
  function slider(x,y,w,value,action,color=ink.ice){
    rounded(ctx,x,y,w,5,3,'#7296a345');rounded(ctx,x,y,Math.max(2,w*value),5,3,color)
    rounded(ctx,x+w*value-6,y-4,13,13,7,ink.light);zone(x,y-20,w,45,action,undefined,action==='volume'?'调节音量':action==='progress'?'调节进度':'调节弹幕不透明度')
  }
  function drawQueue(state,now,audioLevels){
    text(ctx,'播放列表',36,116,25,ink.light)
    text(ctx,queue.length+' 首',352,116,18,ink.muted,70)
    const area=TERMINAL_QUEUE
    queueList.draw({items:queue,area,scroll,playback:state,songsOnly:true,now,audioLevels})
    if(!queue.length){
      text(ctx,'播放列表还是空的',57,292,23,ink.light)
      text(ctx,'去发现屏挑选一首音乐',57,329,18,ink.muted)
      button(57,365,245,46,'前往发现屏 ↗','station','discover')
    }
    if(maxScroll()>0){
      const thumb=Math.max(16,area.height*(area.height/area.rowHeight)/queue.length)
      rounded(ctx,426,area.y,3,area.height,2,'#6e9ba523')
      rounded(ctx,426,area.y+(area.height-thumb)*scroll/maxScroll(),3,thumb,2,'#8eb9bb8c')
    }
  }
  function drawPlayer(state,now){
    const track=state.track||{},art=images.get(track.coverUrl)
    centered(state.loading?'正在载入':state.playing?'正在播放':'当前歌曲',790,115,18,ink.muted)
    rounded(ctx,679,132,222,222,6,'#adc9c71c')
    if(art)cropImage(ctx,art,685,138,210,3)
    else{
      rounded(ctx,685,138,210,210,3,'#15343f')
      for(let r=27;r<94;r+=8){ctx.beginPath();ctx.arc(790,243,r,0,Math.PI*2);ctx.strokeStyle='#87b5bd31';ctx.stroke()}
      rounded(ctx,775,228,30,30,15,ink.copper)
    }
    centered(track.id?track.name:'选一首歌，开始聆听',790,395,34,ink.light,574,500)
    centered(track.id?track.artist||'未知歌手':'在左侧播放列表中选择歌曲',790,430,20,ink.muted)
    const progress=state.duration>0?THREE.MathUtils.clamp(state.currentTime/state.duration,0,1):0
    slider(500,469,580,progress,'progress')
    if(!state.duration||state.loading)zones.pop()
    text(ctx,formatTime(state.currentTime),500,509,18,ink.muted)
    ctx.save();ctx.textAlign='right';text(ctx,formatTime(state.duration),1080,509,18,ink.muted);ctx.restore()
    const mode=TERMINAL_MODES.find(mode=>mode.value===state.playMode)||TERMINAL_MODES[3]
    icon(mode.value,535,565,'terminal-menu','mode',mode.label)
    for(const control of [{x:665,action:'previous',size:58},{x:790,action:'toggle',size:82},{x:915,action:'next',size:58}]){
      ctx.save();if(state.loading&&control.action!=='toggle')ctx.globalAlpha=.35
      drawTransportButton(ctx,control.action,control.x,565,control.size,state,{now});ctx.restore()
      if(!state.loading)zone(control.x-43,522,86,86,control.action,null,control.action==='toggle'?(state.playing?'暂停':'播放'):control.action==='next'?'下一首':'上一首')
    }
    icon(state.volume?'volume':'muted',1045,565,'terminal-menu','volume','音量')
  }
  function drawSettings(state){
    text(ctx,'空间设置',1154,116,25,ink.light)
    text(ctx,sceneLoading?'正在切换场景…':'音乐场景',1154,156,18,ink.muted)
    WORLD_SCENES.forEach((place,index)=>{
      const y=175+index*52,selected=sceneId===place.id
      button(1154,y,410,44,place.name,'scene',place.id,{selected,size:21})
    })
    text(ctx,'画质',1154,360,18,ink.muted)
    QUALITIES.forEach((option,index)=>button(1154+index*140,378,130,40,option.label,'quality',option.id,{selected:quality===option.id,size:19}))
    text(ctx,'弹幕',1154,467,21,ink.light)
    const enabled=state.danmakuEnabled!==false
    rounded(ctx,1490,439,72,32,16,enabled?'#38786f':'#354b56')
    rounded(ctx,enabled?1533:1496,444,22,22,11,enabled?ink.ice:ink.muted)
    zone(1475,431,89,50,'danmaku-toggle',null,enabled?'关闭弹幕':'开启弹幕')
    text(ctx,'不透明度',1154,516,17,ink.muted)
    const opacity=normalizeDanmakuOpacity(state.danmakuOpacity)
    slider(1250,508,247,opacity,'danmaku-opacity')
    text(ctx,Math.round(opacity*100)+'%',1510,517,17,ink.light)
    button(1154,575,195,46,'设置 ↗','settings',null,{size:20})
    button(1365,575,199,46,'返回 2D ↗','environment','2d',{size:20})
  }
  function drawMenu(state){
    if(menu==='mode'){
      rounded(ctx,484,295,276,229,10,'#213e4b');zone(484,295,276,229,'noop')
      text(ctx,'播放顺序',503,325,17,ink.muted)
      TERMINAL_MODES.forEach((mode,index)=>{
        const y=339+index*43,selected=state.playMode===mode.value
        if(selected)rounded(ctx,494,y,256,39,5,'#31545a')
        drawPlayerIcon(ctx,mode.value,518,y+20,23,selected?ink.ice:ink.light)
        text(ctx,mode.label,545,y+27,20,selected?ink.ice:ink.light)
        if(selected)text(ctx,'✓',719,y+27,20,ink.ice)
        zone(494,y,256,39,'play-mode',mode.value,mode.label)
      })
    }else if(menu==='volume'){
      const volume=THREE.MathUtils.clamp(Number(state.volume)||0,0,1)
      rounded(ctx,848,391,248,124,10,'#213e4b');zone(848,391,248,124,'noop')
      text(ctx,'音量',869,426,20,ink.light);text(ctx,Math.round(volume*100)+'%',1022,426,18,ink.muted)
      icon(volume?'volume':'muted',879,473,'mute',null,volume?'静音':'恢复音量',23)
      slider(921,470,148,volume,'volume',ink.copper)
    }
  }
  function drawAccount(){
    const avatar=account.isLoggedIn?images.get(account.avatarUrl):null
    rounded(ctx,1514,15,48,48,24,'#29444f')
    if(avatar)cropImage(ctx,avatar,1516,17,44,22)
    else if(account.isLoggedIn)centered(Array.from(account.displayName)[0]||'听',1538,47,22,ink.ice,38)
    else drawPlayerIcon(ctx,'user',1538,39,27,ink.muted)
    ctx.save();ctx.textAlign='right';text(ctx,account.displayName,1498,46,18,account.isLoggedIn?ink.light:ink.muted,185);ctx.restore()
    const area=TERMINAL_ACCOUNT
    zone(area.x,area.y,area.width,area.height,'account',null,account.isLoggedIn?'查看账号信息':'登录账号')
  }
  function drawListening(){
    if(room.id){
      const label=room.connected?`一起听 · ${room.id} · ${room.count}/${room.capacity}`:'一起听 · 正在重新连接'
      button(510,17,480,43,label,'room-open','details',{selected:true,size:19})
      text(ctx,room.isHost?'你是房主':'共同控制',1008,46,17,ink.muted,130)
    }else{
      for(const [mode,label] of [['create','创建房间'],['join','加入房间']]){
        const area=TERMINAL_LISTENING[mode]
        button(area.x,area.y,area.width,area.height,label,'room-open',mode,{size:19})
      }
      text(ctx,'多人一起听',933,46,17,ink.muted,140)
    }
  }
  function draw(state,now=performance.now(),audioLevels=null){
    playback=state;queue=Array.isArray(state.queue)?state.queue:EMPTY_QUEUE
    const nextId=String(state.track?.id||'')
    if(queueReference!==queue||queueVersion!==state.queueVersion){queueReference=queue;queueVersion=state.queueVersion;currentId=nextId;scroll=0;revealCurrent()}
    else if(currentId!==nextId){currentId=nextId;revealCurrent()}
    scroll=THREE.MathUtils.clamp(scroll,0,maxScroll())
    const track=state.track||{},motion=!state.reducedMotion&&(state.loading||queueList.getState().animating)
    const next=[track.id,track.name,track.artist,track.coverUrl,state.playing,state.loading,state.loadingTrack?.id,(state.pendingKeys||[]).join(','),state.reducedMotion,Math.floor(state.currentTime*4),state.duration,state.volume,state.playMode,state.queueVersion,queue.length,state.danmakuEnabled,state.danmakuOpacity,sceneId,sceneLoading,quality,menu,scroll,motion?Math.floor(now/50):0].join('|')
    if(!dirty&&(signature===next||now-lastDraw<40))return motion
    dirty=false;lastDraw=now;signature=next;zones=[]
    ctx.fillStyle='#0b202b';ctx.fillRect(0,0,WIDTH,HEIGHT)
    ctx.fillStyle='#102b36';ctx.fillRect(458,80,663,570)
    text(ctx,'澜音  /  控制终端',36,49,23,ink.light)
    drawAccount();drawListening()
    ctx.fillStyle='#9abcc82b';ctx.fillRect(28,76,1536,1);ctx.fillRect(456,96,1,530);ctx.fillRect(1120,96,1,530)
    drawQueue(state,now,audioLevels);drawPlayer(state,now);drawSettings(state);drawMenu(state)
    surface.refresh();return !state.reducedMotion&&(state.loading||queueList.getState().animating)
  }
  function rawHit(uv,action){
    if(!uv)return null
    const x=uv.x*WIDTH,y=(1-uv.y)*HEIGHT
    if(action)return zones.find(zone=>zone.action===action)
    const control=zones.findLast(zone=>{
      const padding=TERMINAL_SLIDERS.includes(zone.action)?8:0
      return x>=zone.x-padding&&x<=zone.x+zone.w+padding&&y>=zone.y&&y<=zone.y+zone.h
    })
    if(control)return control
    const row=queueList.hitTest({x,y})
    return row?{action:'queue-play',payload:{index:row.index,id:row.item.id,version:queueVersion},label:'播放 '+(row.item.name||'这首歌'),disabled:row.disabled}:null
  }
  function hitTest(uv,action){
    draw(playback)
    const target=rawHit(uv,action);if(!target||target.disabled)return null
    if(room.id&&!room.connected&&['toggle','previous','next','queue-play','play-mode','progress'].includes(target.action))return {action:'room-open',payload:'details'}
    return {action:target.action,payload:TERMINAL_SLIDERS.includes(target.action)?THREE.MathUtils.clamp((uv.x*WIDTH-target.x)/target.w,0,1):target.payload}
  }
  function closeMenus(){if(menu){menu='';changed()}}
  function select(uv,options){
    const hit=hitTest(uv)
    if(hit?.action==='queue-play'){
      const row=queueList.select({x:uv.x*WIDTH,y:(1-uv.y)*HEIGHT},options)
      if(!row)return null
      closeMenus();return hit
    }
    queueList.cancelClick()
    if(hit?.action==='terminal-menu'){menu=menu===hit.payload?'':hit.payload;changed();return null}
    if(hit?.action==='noop')return null
    if(hit?.action!=='volume'&&hit?.action!=='mute')closeMenus()
    return hit
  }
  function containsQueue(uv){
    const x=uv.x*WIDTH,y=(1-uv.y)*HEIGHT,area=TERMINAL_QUEUE
    return queue.length>0&&x>=area.x&&x<=area.x+area.width&&y>=area.y&&y<=area.y+area.height
  }
  return {mesh,draw,hitTest,select,closeMenus,containsQueue,scrollQueue,
    setHover(uv){draw(playback);return queueList.setHover(uv?{x:uv.x*WIDTH,y:(1-uv.y)*HEIGHT}:null)},
    cancelClick:()=>queueList.cancelClick(),
    hint:uv=>rawHit(uv)?.label||'控制终端',
    setScene(id,loading=false){sceneId=id;sceneLoading=loading;changed()},
    setQuality(value){quality=QUALITIES.some(option=>option.id===value)?value:'balanced';changed()},
    setRoom(value){if(JSON.stringify(value)!==JSON.stringify(room)){room={...value};changed()}},
    setAccount(value={}){
      const loggedIn=Boolean(value.isLoggedIn),next={isLoggedIn:loggedIn,displayName:loggedIn?String(value.displayName||'我的账号'):'点击登录',avatarUrl:loggedIn?String(value.avatarUrl||''):''}
      if(next.isLoggedIn===account.isLoggedIn&&next.displayName===account.displayName&&next.avatarUrl===account.avatarUrl)return
      account=next;changed()
    },
    getState:()=>({scene:sceneId,loading:sceneLoading,quality,menu,scroll,account:{...account},room:{...room},queueLength:queue.length,...queueList.getState(),danmakuEnabled:playback.danmakuEnabled!==false,danmakuOpacity:normalizeDanmakuOpacity(playback.danmakuOpacity),controls:zones.map(z=>z.action)}),
    dispose(){images.dispose();surface.texture.dispose()},
  }
}

