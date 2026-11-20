import * as THREE from 'three'
import { canvasSurface } from './worldSurfaces.js'
import { createScreenImages, cropImage, font, formatTime, ink, rounded, text } from './screenDrawing.js'
import { drawPlayerIcon, drawTransportButton } from '../playerTransportDrawing.js'
import { WORLD_SCENES } from './worldScenes.js'
import { normalizeDanmakuOpacity } from './danmakuSettings.js'
import { createScreenList } from './createScreenList.js'
import { worldControls as controls } from './worldControlTheme.js'
import { DEFAULT_LOUNGE_CLIMATE, LOUNGE_WEATHERS, formatLoungeTime } from './loungeClimate.js'

export const TERMINAL_SLIDERS = ['progress','volume','danmaku-opacity','climate-hour']
export const TERMINAL_QUEUE = {x:28,y:143,width:392,height:480,rowHeight:72}
export const TERMINAL_ACCOUNT = {x:1304,y:10,width:272,height:57}
export const TERMINAL_MODES = [{value:'shuffle',label:'随机播放'},{value:'order',label:'顺序播放'},{value:'single',label:'单曲循环'},{value:'list',label:'列表循环'}]
const WIDTH=1600,HEIGHT=650,QUALITIES=[{id:'smooth',label:'流畅'},{id:'balanced',label:'均衡'},{id:'high',label:'精细'}]
const EMPTY_QUEUE=[]
const TYPE=Object.freeze({heading:22,body:20,meta:18})
export function createControlTerminal(pavilion, hitTargets, invalidate) {
  const surface=canvasSurface(WIDTH,HEIGHT,{dynamic:true,onReady:invalidate}),ctx=surface.context
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(4.14,1.68),new THREE.MeshBasicMaterial({map:surface.texture,toneMapped:false}))
  mesh.name='world-control-terminal-screen';mesh.userData={action:'terminal',hint:'控制终端 · 点歌、滚动列表或调节播放'}
  pavilion.getObjectByName('terminal-screen').add(mesh);hitTargets.push(mesh)
  let dirty=true,signature='',zones=[],sceneId='rain',sceneLoading=false,quality='balanced',lastDraw=0,previousCover=''
  let playback={},queue=[],queueVersion,queueReference,currentId='',scroll=0,menu=''
  let account={isLoggedIn:false,displayName:'点击登录',avatarUrl:''}
  let room={id:'',isHost:false,connected:false,count:0,capacity:10,status:''}
  let viewMode='third',climate={...DEFAULT_LOUNGE_CLIMATE},climateSignature=''
  let previousClockKey='',previousClock='',transitionClock='',clockAnimationUntil=0
  const images=createScreenImages(()=>{dirty=true;invalidate()},32)
  let clockTimer=0
  const zone=(x,y,w,h,action,payload,label,axis='x')=>zones.push({x,y,w,h,action,payload,label,axis})
  const changed=()=>{dirty=true;invalidate()}
  const queueList=createScreenList(ctx,{images,invalidate:changed})
  const maxScroll=()=>Math.max(0,queue.length-TERMINAL_QUEUE.height/TERMINAL_QUEUE.rowHeight)
  const centered=(label,x,y,size,color=ink.light,width=560,weight=400)=>{ctx.save();ctx.textAlign='center';text(ctx,label,x,y,size,color,width,weight);ctx.restore()}
  function drawWeatherIcon(weather,x,y,size=28,tint){
    const color=tint||(weather==='clear'?'#f4cb83':controls.accent),scale=size/32
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=2.3;ctx.lineCap='round';ctx.lineJoin='round'
    if(weather==='clear'){
      ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill()
      for(let i=0;i<8;i++){const angle=i*Math.PI/4;ctx.beginPath();ctx.moveTo(Math.cos(angle)*10,Math.sin(angle)*10);ctx.lineTo(Math.cos(angle)*14,Math.sin(angle)*14);ctx.stroke()}
    }else{
      ctx.beginPath();ctx.arc(-5,-1,6,Math.PI*.95,Math.PI*1.95);ctx.arc(2,-5,8,Math.PI,Math.PI*1.9);ctx.arc(8,-1,5,Math.PI*1.35,Math.PI*2.15);ctx.lineTo(11,5);ctx.quadraticCurveTo(0,9,-11,5);ctx.closePath();ctx.fill()
      if(weather==='rain'){for(const dx of [-6,2,9]){ctx.beginPath();ctx.moveTo(dx,9);ctx.lineTo(dx-2,13);ctx.stroke()}}
      if(weather==='fog'){ctx.beginPath();ctx.moveTo(-12,10);ctx.lineTo(12,10);ctx.moveTo(-9,14);ctx.lineTo(9,14);ctx.stroke()}
    }
    ctx.restore()
  }
  function drawClockCharacter(value,x,y,alpha=1,offset=0){
    ctx.save();ctx.globalAlpha=alpha;ctx.font=font(TYPE.meta)
    ctx.fillStyle=ink.light;ctx.textBaseline='middle';ctx.fillText(value,x,y+offset);ctx.restore()
  }
  function drawTopClock(now,state){
    const date=new Date(),pad=value=>String(value).padStart(2,'0')
    const clockKey=`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`
    const clock=`${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    if(clockKey!==previousClockKey){
      transitionClock=previousClock
      clockAnimationUntil=previousClock&&!state.reducedMotion?now+320:0
      previousClockKey=clockKey;previousClock=clock
    }
    let x=756
    ctx.save();ctx.beginPath();ctx.rect(748,25,104,28);ctx.clip()
    for(let index=0;index<clock.length;index++){
      const value=clock[index]
      if(value===':'){drawClockCharacter(value,x,39,.6);x+=8;continue}
      const old=transitionClock[index]||''
      const animating=!state.reducedMotion&&now<clockAnimationUntil&&old&&old!==value
      if(animating){
        const progress=1-Math.pow((clockAnimationUntil-now)/320,3)
        drawClockCharacter(old,x,39,1-progress,-progress*24)
        drawClockCharacter(value,x,39,progress,(1-progress)*24)
      }else drawClockCharacter(value,x,39)
      x+=12
    }
    ctx.restore()
    // Schedule only after a visible draw; an offscreen or suspended terminal
    // gets at most one final wake-up instead of a permanent render interval.
    if(!clockTimer)clockTimer=setTimeout(()=>{clockTimer=0;if(!document.hidden)changed()},1000-Date.now()%1000)
    return !state.reducedMotion&&now<clockAnimationUntil
  }

  function scrollQueue(delta){const next=THREE.MathUtils.clamp(scroll+delta,0,maxScroll());if(next!==scroll){scroll=next;queueList.reset();changed()}}
  function revealCurrent(){
    const index=queue.findIndex(track=>String(track.id)===currentId)
    if(index>=0)scroll=THREE.MathUtils.clamp(index-3,0,maxScroll())
    queueList.reset()
    changed()
  }
  function button(x,y,w,h,label,action,payload,{selected=false,size=TYPE.body}={}){
    rounded(ctx,x,y,w,h,7,selected?controls.selected:controls.surface)
    centered(label,x+w/2,y+h/2+size*.35,size,controls.accent,w-20)
    zone(x,y,w,h,action,payload,label)
  }
  function settingsChoice(y,label,value,id,weather){
    text(ctx,label,1154,y+27,TYPE.body,ink.muted)
    if(weather)drawWeatherIcon(weather,1516,y+21,23)
    else{ctx.save();ctx.textAlign='right';text(ctx,value,1530,y+27,TYPE.body,menu===id?controls.accent:ink.light,280);ctx.restore()}
    ctx.save();ctx.strokeStyle=controls.muted;ctx.lineWidth=1.5;ctx.lineCap='round';ctx.lineJoin='round'
    ctx.beginPath();ctx.moveTo(1544,y+18);ctx.lineTo(1549,y+23);ctx.lineTo(1554,y+18);ctx.stroke();ctx.restore()
    zone(1154,y,410,42,'terminal-menu',id,`${label} · ${value}`)
  }
  function weatherButton(x,y,weather,selected){
    if(selected)rounded(ctx,x,y,94,56,8,controls.selectedTint)
    drawWeatherIcon(weather.id,x+47,y+19,23)
    centered(weather.label,x+47,y+47,TYPE.meta,selected?controls.accent:ink.muted,86)
    zone(x,y,94,56,'climate-change',{weather:weather.id},weather.label)
  }
  function icon(icon,x,y,action,payload,label,size=28){
    drawPlayerIcon(ctx,icon,x,y,size,controls.accent)
    zone(x-24,y-24,48,48,action,payload,label)
  }
  function slider(x,y,w,value,action,color=controls.accent){
    rounded(ctx,x,y,w,5,3,'#7296a345');rounded(ctx,x,y,Math.max(2,w*value),5,3,color)
    rounded(ctx,x+w*value-6,y-4,13,13,7,controls.accent);zone(x,y-20,w,45,action,undefined,action==='volume'?'调节音量':action==='progress'?'调节进度':action==='climate-hour'?'调节场景时间':'调节弹幕不透明度')
  }
  function settingToggle(x,y,w,label,enabled,action){
    text(ctx,label,x,y+21,TYPE.body,ink.light)
    rounded(ctx,x+w-48,y,46,26,13,enabled?controls.accent:controls.disabled)
    rounded(ctx,enabled?x+w-24:x+w-44,y+4,18,18,9,enabled?controls.onAccent:controls.muted)
    zone(x,y-8,w,42,action,null,(enabled?'关闭':'开启')+label)
  }
  function drawQueue(state,now,audioLevels){
    text(ctx,'播放列表',36,116,TYPE.heading,ink.light,280,500)
    text(ctx,queue.length+' 首',352,116,TYPE.meta,ink.muted,70)
    const area=TERMINAL_QUEUE
    queueList.draw({items:queue,area,scroll,playback:state,songsOnly:true,fontSizes:{title:TYPE.body,metadata:TYPE.meta,time:TYPE.meta},now,audioLevels,trailingAction:row=>{
      const {button,hitArea,item,index,hovered}=row
      rounded(ctx,button.x,button.y,button.w,button.h,7,hovered?controls.selected:controls.surface)
      drawPlayerIcon(ctx,'trash',button.x+button.w/2,button.y+button.h/2,22,controls.accent)
      if(hitArea.h)zone(hitArea.x,hitArea.y,hitArea.w,hitArea.h,'queue-remove',{index,id:item.id,version:queueVersion},'从播放列表移除 '+(item.name||'这首歌'))
    }})
    if(!queue.length){
      text(ctx,'播放列表还是空的',57,292,TYPE.heading,ink.light)
      text(ctx,'去发现屏挑选一首音乐',57,329,TYPE.meta,ink.muted)
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
    centered(state.loading?'正在载入':state.playing?'正在播放':'当前歌曲',790,115,TYPE.heading,ink.light,560,500)
    rounded(ctx,679,132,222,222,6,'#adc9c71c')
    if(art)cropImage(ctx,art,685,138,210,3)
    else{
      rounded(ctx,685,138,210,210,3,'#15343f')
      for(let r=27;r<94;r+=8){ctx.beginPath();ctx.arc(790,243,r,0,Math.PI*2);ctx.strokeStyle='#87b5bd31';ctx.stroke()}
      rounded(ctx,775,228,30,30,15,ink.copper)
    }
    centered(track.id?track.name:'选一首歌，开始聆听',790,395,TYPE.heading,ink.light,574,500)
    centered(track.id?track.artist||'未知歌手':'在左侧播放列表中选择歌曲',790,430,TYPE.meta,ink.muted)
    const progress=state.duration>0?THREE.MathUtils.clamp(state.currentTime/state.duration,0,1):0
    slider(500,469,580,progress,'progress')
    if(!state.duration||state.loading)zones.pop()
    text(ctx,formatTime(state.currentTime),500,509,TYPE.meta,ink.muted)
    ctx.save();ctx.textAlign='right';text(ctx,formatTime(state.duration),1080,509,TYPE.meta,ink.muted);ctx.restore()
    const mode=TERMINAL_MODES.find(mode=>mode.value===state.playMode)||TERMINAL_MODES[3]
    icon(mode.value,535,565,'terminal-menu','mode',mode.label)
    for(const control of [{x:665,action:'previous',size:58},{x:790,action:'toggle',size:82},{x:915,action:'next',size:58}]){
      ctx.save();if(state.loading&&control.action!=='toggle')ctx.globalAlpha=.35
      drawTransportButton(ctx,control.action,control.x,565,control.size,state,{now,accent:controls.accent,color:controls.accent,onAccent:controls.onAccent});ctx.restore()
      if(!state.loading)zone(control.x-43,522,86,86,control.action,null,control.action==='toggle'?(state.playing?'暂停':'播放'):control.action==='next'?'下一首':'上一首')
    }
    icon(state.volume?'volume':'muted',1045,565,'terminal-menu','volume','音量')
  }
  function drawSettings(state){
    text(ctx,'空间设置',1154,116,TYPE.heading,ink.light,410,500)
    const scene=WORLD_SCENES.find(place=>place.id===sceneId)||WORLD_SCENES[0]
    const preset=QUALITIES.find(option=>option.id===quality)||QUALITIES[1]
    settingsChoice(156,'场景',sceneLoading?'切换中…':scene.name,'scene')
    settingsChoice(214,'画质',preset.label,'quality')
    settingsChoice(272,'视角',viewMode==='first'?'第一人称':'第三人称','view')
    ctx.fillStyle='#9abcc821';ctx.fillRect(1154,332,410,1)
    settingToggle(1154,352,410,'灯光',state.lightsEnabled!==false,'lights-toggle')
    settingToggle(1154,410,410,'弹幕',state.danmakuEnabled!==false,'danmaku-toggle')
    const danmakuEnabled=state.danmakuEnabled!==false
    if(danmakuEnabled){
      const opacity=normalizeDanmakuOpacity(state.danmakuOpacity)
      text(ctx,'弹幕透明度',1154,485,TYPE.meta,ink.muted)
      slider(1260,478,232,opacity,'danmaku-opacity')
      ctx.save();ctx.textAlign='right';text(ctx,Math.round(opacity*100)+'%',1564,485,TYPE.meta,ink.muted);ctx.restore()
    }
    if(sceneId==='sky-lounge')drawTimeSettings(danmakuEnabled)
  }
  function drawTimeSettings(danmakuEnabled){
    const y=danmakuEnabled?534:478,hour=climate.mode==='manual'?climate.hour:climate.currentHour??climate.hour
    const mode=climate.mode==='local'?'本地 · ':climate.mode==='cycle'?'流转 · ':''
    const weather=LOUNGE_WEATHERS.find(option=>option.id===climate.weather)||LOUNGE_WEATHERS[0]
    ctx.fillStyle='#9abcc821';ctx.fillRect(1154,y-18,410,1)
    settingsChoice(y,'时间',mode+formatLoungeTime(hour),'climate')
    settingsChoice(y+54,'天气',weather.label,'weather',weather.id)
  }
  function settingsPopup(y,height){
    ctx.save();ctx.shadowColor='#00000040';ctx.shadowBlur=16;ctx.shadowOffsetY=5
    rounded(ctx,1144,y,430,height,12,'#17333e');ctx.restore()
    zone(1144,y,430,height,'noop')
  }
  function choiceMenu(y,options,current,action){
    settingsPopup(y,options.length*42+16)
    options.forEach((option,index)=>{
      const top=y+8+index*42,selected=option.id===current
      if(selected)rounded(ctx,1152,top,414,38,7,controls.selectedTint)
      text(ctx,option.label,1168,top+25,TYPE.body,selected?controls.accent:ink.light,350)
      if(selected)rounded(ctx,1546,top+17,5,5,3,controls.accent)
      zone(1152,top,414,38,action,option.id,option.label)
    })
  }
  function drawMenu(state){
    if(menu==='scene')choiceMenu(204,WORLD_SCENES.map(place=>({id:place.id,label:place.name})),sceneId,'scene')
    else if(menu==='quality')choiceMenu(262,QUALITIES,quality,'quality')
    else if(menu==='view')choiceMenu(320,[{id:'first',label:'第一人称'},{id:'third',label:'第三人称'}],viewMode,'view-mode')
    else if(menu==='climate'&&sceneId==='sky-lounge'){
      const top=(state.danmakuEnabled!==false?534:478)-162
      const hour=climate.mode==='manual'?climate.hour:climate.currentHour??climate.hour
      settingsPopup(top,150)
      const modes=[{id:'manual',label:'手动'},{id:'local',label:'本地'},{id:'cycle',label:'循环'}]
      modes.forEach((mode,index)=>button(1158+index*136,top+14,126,32,mode.label,'climate-change',{mode:mode.id,hour},{selected:climate.mode===mode.id,size:TYPE.body}))
      slider(1170,top+82,378,THREE.MathUtils.clamp(hour/23.75,0,1),'climate-hour')
      text(ctx,'00:00',1170,top+123,TYPE.meta,ink.muted)
      centered(formatLoungeTime(hour),1359,top+124,TYPE.body,controls.accent,100)
      ctx.save();ctx.textAlign='right';text(ctx,'23:45',1548,top+123,TYPE.meta,ink.muted);ctx.restore()
    }else if(menu==='weather'&&sceneId==='sky-lounge'){
      const top=(state.danmakuEnabled!==false?534:478)+54-80
      settingsPopup(top,68)
      LOUNGE_WEATHERS.forEach((weather,index)=>weatherButton(1158+index*102,top+6,weather,climate.weather===weather.id))
    }else if(menu==='mode'){
      rounded(ctx,484,275,190,249,14,'#213e4b');zone(484,275,190,249,'noop')
      text(ctx,'播放顺序',502,309,TYPE.heading,ink.muted)
      TERMINAL_MODES.forEach((mode,index)=>{
        const y=325+index*47,selected=state.playMode===mode.value
        if(selected)rounded(ctx,494,y,170,43,9,controls.selected)
        drawPlayerIcon(ctx,mode.value,516,y+21.5,21,selected?controls.accent:ink.muted)
        text(ctx,mode.label,540,y+28,TYPE.body,selected?controls.accent:ink.light,112,selected?500:400)
        zone(494,y,170,43,'play-mode',mode.value,mode.label)
      })
    }else if(menu==='volume'){
      const volume=THREE.MathUtils.clamp(Number(state.volume)||0,0,1)
      rounded(ctx,990,230,110,300,12,'#213e4b');zone(990,230,110,300,'noop')
      centered('音量',1045,261,TYPE.body,ink.light,90)
      centered(Math.round(volume*100)+'%',1045,293,TYPE.meta,controls.accent,90)
      const top=316,height=154,thumbY=top+height*(1-volume)
      rounded(ctx,1042,top,6,height,3,'#7296a345')
      if(volume>0)rounded(ctx,1042,thumbY,6,height*volume,3,controls.accent)
      rounded(ctx,1038,thumbY-7,14,14,7,controls.accent)
      zone(1025,top,40,height,'volume',undefined,'调节音量','y')
      icon(volume?'volume':'muted',1045,502,'mute',null,volume?'静音':'恢复音量',23)
    }
  }
  function drawAccount(){
    const avatar=account.isLoggedIn?images.get(account.avatarUrl):null
    rounded(ctx,1514,15,48,48,24,controls.surface)
    if(avatar)cropImage(ctx,avatar,1516,17,44,22)
    else if(account.isLoggedIn)centered(Array.from(account.displayName)[0]||'听',1538,47,TYPE.body,controls.accent,38)
    else drawPlayerIcon(ctx,'user',1538,39,27,controls.accent)
    ctx.save();ctx.textAlign='right';text(ctx,account.displayName,1498,46,TYPE.body,controls.accent,185);ctx.restore()
    const area=TERMINAL_ACCOUNT
    zone(area.x,area.y,area.width,area.height,'account',null,account.isLoggedIn?'查看账号信息':'登录账号')
  }
  function draw(state,now=performance.now(),audioLevels=null){
    playback=state;queue=Array.isArray(state.queue)?state.queue:EMPTY_QUEUE
    const nextId=String(state.track?.id||'')
    if(queueReference!==queue||queueVersion!==state.queueVersion){
      const reveal=queueVersion===undefined||currentId!==nextId
      queueReference=queue;queueVersion=state.queueVersion;currentId=nextId
      queueList.reset();if(reveal)revealCurrent();changed()
    }
    else if(currentId!==nextId){currentId=nextId;revealCurrent()}
    scroll=THREE.MathUtils.clamp(scroll,0,maxScroll())
    const track=state.track||{},motion=!state.reducedMotion&&(state.loading||queueList.getState().animating)
    if(track.coverUrl!==previousCover){previousCover=track.coverUrl;dirty=true}
    const clockAnimating=!state.reducedMotion&&now<clockAnimationUntil
    const next=[track.id,track.name,track.artist,state.playing,state.loading,state.loadingTrack?.id,(state.pendingKeys||[]).join(','),state.reducedMotion,Math.floor(state.currentTime*4),state.duration,state.volume,state.playMode,state.queueVersion,queue.length,state.danmakuEnabled,state.danmakuOpacity,state.lightsEnabled,sceneId,sceneLoading,quality,menu,scroll,viewMode,climateSignature,Math.floor(Date.now()/1000),clockAnimating?Math.floor(now/32):0,motion?Math.floor(now/50):0].join('|')
    if(!dirty&&(signature===next||now-lastDraw<40))return motion||clockAnimating
    dirty=false;lastDraw=now;signature=next;zones=[]
    ctx.fillStyle='#0b202b';ctx.fillRect(0,0,WIDTH,HEIGHT)
    ctx.fillStyle='#102b36';ctx.fillRect(458,80,663,570)
    text(ctx,'澜音  /  控制终端',36,49,TYPE.heading,ink.light,400,500)
    drawAccount()
    const clockMotion=drawTopClock(now,state)
    ctx.fillStyle='#9abcc82b';ctx.fillRect(28,76,1536,1);ctx.fillRect(456,96,1,530);ctx.fillRect(1120,96,1,530)
    drawQueue(state,now,audioLevels);drawPlayer(state,now);drawSettings(state);drawMenu(state)
    surface.refresh();return !state.reducedMotion&&(state.loading||queueList.getState().animating||clockMotion)
  }
  function rawHit(uv,action){
    if(!uv)return null
    const x=uv.x*WIDTH,y=(1-uv.y)*HEIGHT
    if(action)return zones.find(zone=>zone.action===action)
    const control=zones.findLast(zone=>{
      const padding=TERMINAL_SLIDERS.includes(zone.action)?8:0
      const verticalPadding=zone.axis==='y'?padding:0
      return x>=zone.x-padding&&x<=zone.x+zone.w+padding&&y>=zone.y-verticalPadding&&y<=zone.y+zone.h+verticalPadding
    })
    if(control)return control
    const row=queueList.hitTest({x,y})
    return row?{action:'queue-play',payload:{index:row.index,id:row.item.id,version:queueVersion},label:'播放 '+(row.item.name||'这首歌'),disabled:row.disabled}:null
  }
  function hitTest(uv,action){
    draw(playback)
    const target=rawHit(uv,action);if(!target||target.disabled)return null
    if(room.id&&!room.connected&&['toggle','previous','next','queue-play','queue-remove','play-mode','progress'].includes(target.action))return {action:'room-open',payload:'details'}
    const value=target.axis==='y'?1-((1-uv.y)*HEIGHT-target.y)/target.h:(uv.x*WIDTH-target.x)/target.w
    return {action:target.action,payload:TERMINAL_SLIDERS.includes(target.action)?THREE.MathUtils.clamp(value,0,1):target.payload}
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
    if(!['volume','mute','climate-hour'].includes(hit?.action)&&!(hit?.action==='climate-change'&&hit.payload?.mode))closeMenus()
    return hit
  }
  function containsQueue(uv){
    const x=uv.x*WIDTH,y=(1-uv.y)*HEIGHT,area=TERMINAL_QUEUE
    return queue.length>0&&x>=area.x&&x<=area.x+area.width&&y>=area.y&&y<=area.y+area.height
  }
  return {mesh,draw,hitTest,select,closeMenus,containsQueue,scrollQueue,
    setResolution(width){if(surface.setScale(width/WIDTH))dirty=true},
    setHover(uv){draw(playback);return queueList.setHover(uv?{x:uv.x*WIDTH,y:(1-uv.y)*HEIGHT}:null)},
    cancelClick:()=>queueList.cancelClick(),
    hint:uv=>rawHit(uv)?.label||'控制终端',
    setScene(id,loading=false){sceneId=id;sceneLoading=loading;if(id!=='sky-lounge'&&['climate','weather'].includes(menu))menu='';changed()},
    setQuality(value){quality=QUALITIES.some(option=>option.id===value)?value:'balanced';changed()},
    setViewMode(value){if(viewMode!==value){viewMode=value==='first'?'first':'third';changed()}},
    setClimate(value){
      const next=[value.weather,value.mode,value.hour,Math.floor((value.currentHour??value.hour)*60)].join('|')
      if(next!==climateSignature){climate={...value};climateSignature=next;changed()}
    },
    refreshClock(){changed()},
    setRoom(value){if(JSON.stringify(value)!==JSON.stringify(room)){room={...value};changed()}},
    setAccount(value={}){
      const loggedIn=Boolean(value.isLoggedIn),next={isLoggedIn:loggedIn,displayName:loggedIn?String(value.displayName||'我的账号'):'点击登录',avatarUrl:loggedIn?String(value.avatarUrl||''):''}
      if(next.isLoggedIn===account.isLoggedIn&&next.displayName===account.displayName&&next.avatarUrl===account.avatarUrl)return
      account=next;changed()
    },
    getState:()=>({scene:sceneId,loading:sceneLoading,quality,menu,viewMode,climate:{...climate},scroll,account:{...account},room:{...room},queueLength:queue.length,...queueList.getState(),lightsEnabled:playback.lightsEnabled!==false,danmakuEnabled:playback.danmakuEnabled!==false,danmakuOpacity:normalizeDanmakuOpacity(playback.danmakuOpacity),controls:zones.map(z=>z.action)}),
    dispose(){clearTimeout(clockTimer);images.dispose();surface.texture.dispose()},
  }
}

