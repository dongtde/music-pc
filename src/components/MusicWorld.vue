<template>
  <section class="music-world" :class="{'music-world--inspecting':selectedRecord,'music-world--seated':status.seated}" :inert="suspended" aria-label="声境 3D 音乐馆" @keydown="handleWorldKey">
    <canvas ref="canvas" :key="canvasKey" class="music-world__canvas" :inert="!ready || failed" :aria-hidden="!ready || failed" tabindex="0" aria-label="3D 音乐馆。WASD 行走，空格跳跃，V 切换视角，拖动环顾，E 互动，Home 返回中庭。" @pointerdown="exploring=true" />
    <output v-if="status.performance" style="position:absolute;bottom:24px;right:24px;z-index:4;padding:8px 12px;border-radius:8px;background:#10232ddd;color:#bad4d1;font:11px monospace;pointer-events:none" aria-label="渲染性能" :data-metrics="JSON.stringify(status.performance)">{{ status.performance.fps }} FPS · P95 {{ status.performance.frameP95 }} ms · CPU {{ status.performance.cpuP95 }} ms · {{ status.performance.quality }} · {{ status.performance.width }} × {{ status.performance.height }}</output>
    <div v-if="ready&&!suspended&&!routeOpen&&!panel&&!commentOpen&&!selectedRecord&&!listeningPanel" class="world-avatar-controls" @keydown.stop>
      <span class="world-avatar-controls__model"><UserRound :size="18" /><span>Fantasy Queen</span></span>
      <button type="button" :title="status.viewMode==='first'?'第三人称 · V':'第一人称 · V'" aria-label="切换人物视角" @click="toggleView"><ScanEye :size="18" /><span>{{ status.viewMode==='first'?'第三人称':'第一人称' }}</span></button>
      <button type="button" :title="status.seated?'起身':'跳跃 · 空格'" :aria-label="status.seated?'起身':'跳跃'" @click="jumpAvatar"><ArrowUp :size="18" /></button>
      <span v-if="listeningRoom.state.room" class="world-avatar-controls__online">{{ listeningRoom.state.connected ? (listeningRoom.state.presence?.players.length||0)+' 人在场' : '重连中' }}</span>
    </div>
    <WorldListeningRoom v-if="listeningPanel && ready && !suspended && !routeOpen" :mode="listeningPanel" :lobby="lobby" :placement="listeningPlacement" @close="closeListeningRoom" />
    <WorldDanmaku
      v-if="ready && commentsState.items.length"
      class="world-danmaku"
      :enabled="danmakuEnabled && !suspended && !routeOpen && !panel && !commentOpen && !selectedRecord && stationId!=='discover'"
      :paused="!listening.playing || listening.loading"
      :opacity="danmakuOpacity"
      :song-key="listening.track?.id || ''"
      :comments="commentsState.items"
      :has-more="commentsState.more && !commentsState.error"
      :loading="commentsState.busy"
      @need-more="comments.more"
    />

    <WorldCommentReader v-if="commentOpen&&!routeOpen" :state="commentsState" :track="listening.track" @close="closeComments" @step="comments.step" @retry="comments.retry" @more="comments.more" />


    <WorldEntrance :scene="entranceScene" :ready="sceneReady" :failed="failed" :progress="progress" :reduced-motion="reducedMotion" :paused="suspended || routeOpen" @opened="finishEntrance" @retry="initialize" @exit="returnTo2D" />

    <span v-if="ready && exploring && !panel && !routeOpen && !listeningPanel" class="world-reticle" aria-hidden="true" />

    <section v-if="selectedRecord && !routeOpen" ref="recordPanel" class="world-record-inspector" aria-label="查看选中的唱片">
      <div class="world-record-inspector__copy"><span class="world-eyebrow">FROM YOUR RECORD SHELF</span><h2>{{ selectedRecord.name }}</h2><p>{{ selectedRecord.artist || '未知歌手' }}</p><small>{{ selectedRecord.album || '在控制终端，开始这一次聆听。' }}</small></div>
      <div class="world-record-inspector__actions"><button class="world-start-track" type="button" aria-label="加入播放列表并前往控制终端" title="加入播放列表并前往控制终端" :disabled="placingRecord" @click="placeSelected"><Loader2 v-if="placingRecord" class="world-spin" :size="22" /><Play v-else :size="22" fill="currentColor" /></button><button type="button" :aria-pressed="data.library.isTrackLiked(selectedRecord.id)" @click="data.library.toggleLikedTrack(selectedRecord)"><Heart :size="17" :fill="data.library.isTrackLiked(selectedRecord.id)?'currentColor':'none'" />{{ data.library.isTrackLiked(selectedRecord.id)?'已收藏':'收藏' }}</button><button type="button" :disabled="placingRecord" @click="dismissRecord"><ArrowLeft :size="16" />放回唱片</button></div>
      <small class="world-record-inspector__hint">封面与唱片来自你的曲库 <span>·</span> Esc 返回</small>
    </section>

    <WorldMap v-if="ready&&!suspended&&!panel&&!routeOpen&&!selectedRecord&&!commentOpen&&!listeningPanel" :position="status" :archive-tracks="data.exhibits.value.archive" @open="openMap" @navigate="goToMapPoint" />
    <WorldClimate v-if="sceneId==='sky-lounge'&&ready&&!suspended&&!panel&&!routeOpen&&!selectedRecord&&!commentOpen&&!listeningPanel" ref="climatePanel" :model-value="climate" :current-hour="status.climateHour" @update:model-value="changeClimate" @open="openMap" />

    <Transition name="world-panel">
      <section v-if="panel && !routeOpen" ref="panelEl" class="world-panel" aria-label="音乐馆曲库" @keydown.esc.stop="closePanel">
        <header class="world-panel__head"><h2>{{ data.title.value }}</h2><button type="button" aria-label="关闭曲库，返回空间" @click="closePanel"><X :size="20" /></button></header>
        <form v-if="data.section.value==='search'" class="world-search" @submit.prevent="data.submitSearch()"><Search :size="18" /><input v-model="data.search.value" autofocus aria-label="搜索歌曲、歌手或歌单" placeholder="歌曲、歌手，或一张歌单" /><button type="submit" :disabled="data.busy.value">搜索</button></form>
        <nav v-if="data.section.value==='search'" class="world-tabs" aria-label="搜索类型"><button v-for="tab in searchTypes" :key="tab.id" type="button" :aria-pressed="data.searchType.value===tab.id" @click="data.searchType.value=tab.id;data.submitSearch()">{{ tab.name }}</button></nav>
        <nav v-else-if="!data.detail.value && ['recommend','playlists','charts','artists'].includes(data.section.value)" class="world-tabs" aria-label="发现分类"><button v-for="tab in discoveryTabs" :key="tab.id" type="button" :aria-pressed="data.section.value===tab.id" @click="data.loadSection(tab.id)">{{ tab.name }}</button></nav>
        <nav v-else-if="!data.detail.value && ['liked','recent'].includes(data.section.value)" class="world-tabs"><button type="button" :aria-pressed="data.section.value==='liked'" @click="data.loadSection('liked')">我喜欢</button><button type="button" :aria-pressed="data.section.value==='recent'" @click="data.loadSection('recent')">最近播放</button></nav>
        <div v-if="data.detail.value" class="world-list-actions"><button type="button" @click="data.loadSection(data.section.value)"><ArrowLeft :size="14" />返回列表</button></div>
        <div class="world-panel__body">
          <div v-if="data.error.value" class="world-empty" role="status"><p>{{ data.error.value }}</p><button type="button" @click="retryContent">重试</button></div>
          <WorldMusicLoading v-else-if="data.busy.value && !data.items.value.length" :paused="suspended || routeOpen" />
          <div v-else-if="!data.items.value.length" class="world-empty"><Disc3 :size="42" :stroke-width="1" /><h3>{{ data.section.value==='search' ? '从一个名字开始。' : '这里，留给你的音乐。' }}</h3><p>{{ data.section.value==='liked' ? '点亮歌曲旁的爱心，收藏会同步到唱片档案。' : data.section.value==='search' ? '输入歌名或歌手，找到下一张唱片。' : '播放过的音乐会在这里留下记录。' }}</p><button v-if="data.section.value!=='search'" type="button" @click="openSection('recommend')">去发现音乐</button></div>
          <div v-else class="world-records">
            <article v-for="(item,index) in data.items.value" :key="`${item.kind}-${item.id}-${index}`" class="world-record" :class="{'is-current':String(item.id)===String(player.state.currentTrack.id) && item.kind==='song'}">
              <button type="button" class="world-record__cover" :aria-label="`${item.kind==='song'?'拿起唱片':'打开'} ${item.name||item.title}`" @click="selectItem(item)"><img v-if="item.coverUrl" :src="item.coverUrl" alt="" loading="lazy" @error="$event.target.style.visibility='hidden'" /><Disc3 v-else :size="40" :stroke-width="1" /><span><ArrowUpRight :size="20" /></span></button>
              <button type="button" class="world-record__title" @click="selectItem(item)"><strong>{{ item.name||item.title }}</strong><small v-if="item.artist||item.description||item.desc||item.label">{{ item.artist||item.description||item.desc||item.label }}</small></button>
              <button v-if="item.kind==='song'" type="button" class="world-record__like" :aria-label="data.library.isTrackLiked(item.id)?`取消收藏 ${item.name}`:`收藏 ${item.name}`" :aria-pressed="data.library.isTrackLiked(item.id)" @click="data.library.toggleLikedTrack(item)"><Heart :size="16" :fill="data.library.isTrackLiked(item.id)?'currentColor':'none'" /></button>
            </article>
          </div>
          <button v-if="data.section.value==='search' && data.more.value && !data.detail.value" class="world-more" type="button" :disabled="data.busy.value" @click="data.submitSearch(true)">{{ data.busy.value?'加载中…':'更多结果' }}</button>
        </div>
        <footer><span>{{ data.items.value.length }} {{ data.items.value[0]?.kind==='song'?'首音乐':'个展品' }}</span><button v-if="queue.length" type="button" @click="enqueueTracks(queue,data.title.value)"><Play :size="13" fill="currentColor" />全部加入</button></footer>
      </section>
    </Transition>
    <div v-if="notice" class="world-notice" role="status">{{ notice }}</div>
  </section>
</template>

<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ArrowUpRight, ArrowUp, Disc3, Heart, Loader2, Play, Search, X, UserRound, ScanEye } from 'lucide-vue-next'
import { usePlayerStore } from '../stores/player'
import { useListeningRoomStore } from '../stores/listeningRoom'
import { useAuthStore } from '../stores/auth'
import { useEnvironmentStore } from '../stores/environment'
import { getCachedTrackLyrics } from '../services/lyrics'
import { worldLyricIndex } from './music-world/lyricTypography.js'
import { createWorldAudioSampler } from './music-world/createWorldAudioSampler.js'
import { getWorldScene } from './music-world/worldScenes.js'
import { createMusicWorld } from './music-world/createMusicWorld'
import WorldMap from './music-world/WorldMap.vue'
import WorldClimate from './music-world/WorldClimate.vue'
import { LOUNGE_CLIMATE_KEY, normalizeLoungeClimate } from './music-world/loungeClimate.js'
import WorldMusicLoading from './music-world/WorldMusicLoading.vue'
import WorldEntrance from './music-world/WorldEntrance.vue'
import { useWorldLibrary } from './music-world/useWorldLibrary'
import '../styles/music-world.css'
import WorldCommentReader from './music-world/WorldCommentReader.vue'
import { createScreenFeeds } from './music-world/screenFeeds.js'
import { createScreenListFeedback } from './music-world/createScreenList.js'
import { loadWorldScreen } from './music-world/worldDataSources.js'
import { createSongComments } from './music-world/songComments.js'
import { getSongCommentsData } from '../services/netease'
import { readStorage, writeStorage, readJsonStorage, writeJsonStorage } from '../utils/storage'
import { DANMAKU_OPACITY_KEY, normalizeDanmakuOpacity } from './music-world/danmakuSettings.js'
import { useListeningLobby } from './music-world/useListeningLobby.js'
import { WORLD_LOBBY_DISPLAY } from './music-world/worldNavigation.js'

const player=usePlayerStore(),data=useWorldLibrary(),router=useRouter(),route=useRoute()
const environment=useEnvironmentStore()
const auth=useAuthStore()
const account=computed(()=>({isLoggedIn:auth.state.isLoggedIn,displayName:auth.displayName.value,avatarUrl:auth.avatarUrl.value}))
const WorldDanmaku=defineAsyncComponent(()=>import('./music-world/WorldDanmaku.vue'))
const WorldListeningRoom=defineAsyncComponent(()=>import('./music-world/WorldListeningRoom.vue'))
const listeningRoom=useListeningRoomStore(),listeningPanel=ref(''),listeningPlacement=shallowRef(null)
const roomSummary=computed(()=>({id:listeningRoom.state.room?.id||'',isHost:listeningRoom.state.room?.hostId===listeningRoom.state.memberId,connected:listeningRoom.state.connected,count:listeningRoom.state.room?.members.length||0,capacity:listeningRoom.state.room?.capacity||10,status:listeningRoom.state.syncStatus}))
const props=defineProps({suspended:{type:Boolean,default:false}})
const canvas=ref(null),canvasKey=ref(0),ready=ref(false),sceneReady=ref(false),failed=ref(false),progress=ref(0),exploring=ref(true),panel=ref(false),panelEl=ref(null),notice=ref('')
const sceneId=ref(getWorldScene(readStorage('lanyin.world.scene','rain')).id)
// Keep the destination on the doors while the world prepares its initial rain shell.
const entranceScene=ref(sceneId.value)
const climate=ref(normalizeLoungeClimate(readJsonStorage(LOUNGE_CLIMATE_KEY))),climatePanel=ref(null)
let climateClock=0
function changeClimate(value){climate.value=normalizeLoungeClimate(value);world?.setClimate(climate.value);writeJsonStorage(LOUNGE_CLIMATE_KEY,climate.value)}
const stationId=ref('atrium'),routeOpen=computed(()=>route.name!=='space')
const status=reactive({x:0,z:12.8,yaw:0,live:false,seated:false,navigating:false,hint:'',sceneLoading:false,scenePending:'',lightingCue:'等待音乐',audioMode:'waiting'}),lyrics=ref([]),reducedMotion=ref(false)
const selectedRecord=ref(null),recordPanel=ref(null),placingRecord=ref(false),quality=ref(readStorage('lanyin.world.quality','balanced'))
const lobby=useListeningLobby(listeningRoom,{
  active:computed(()=>ready.value&&!props.suspended&&!routeOpen.value&&!failed.value&&(Boolean(listeningPanel.value)||status.pointId==='lobby'||Math.hypot(status.x-WORLD_LOBBY_DISPLAY.x,status.z-WORLD_LOBBY_DISPLAY.z)<6)),
  displayName:computed(()=>account.value.isLoggedIn?account.value.displayName:''),
})
const searchTypes=[{id:1,name:'歌曲'},{id:100,name:'歌手'},{id:1000,name:'歌单'}],discoveryTabs=[{id:'recommend',name:'为你推荐'},{id:'playlists',name:'歌单'},{id:'charts',name:'排行榜'},{id:'artists',name:'歌手'}]
const queue=computed(()=>data.items.value.filter(item=>item.kind==='song'))
let world=null,sampler=null,abort=null,mediaQuery=null,noticeTimer=0,lyricsToken=0,disposed=false
const pendingListKeys=shallowRef([]),listFeedback=createScreenListFeedback(keys=>{pendingListKeys.value=keys})
const listening=computed(()=>({track:player.state.currentTrack,playing:player.state.isPlaying,currentTime:player.state.currentTime,duration:player.state.duration,loading:player.state.isLoading,loadingTrack:player.state.loadingTrack,pendingKeys:pendingListKeys.value,volume:player.state.volume,queueLength:player.state.queue.length,queue:player.state.queue,queueVersion:player.state.queueVersion,playMode:player.state.playMode}))
const commentOpen=ref(false),commentsState=shallowRef({items:[],index:0,total:0,busy:false})
const danmakuEnabled=ref(readStorage('lanyin.world.danmaku','true')!=='false')
const lightsEnabled=ref(readStorage('lanyin.world.lights','true')!=='false')
const danmakuOpacity=ref(normalizeDanmakuOpacity(readStorage(DANMAKU_OPACITY_KEY,'1')))
let opacitySaveTimer=0
const feeds=createScreenFeeds({load:loadWorldScreen,onChange:value=>world?.setFeeds(value),onAdd:enqueueTracks})
const comments=createSongComments({load:getSongCommentsData,onChange:value=>{commentsState.value=value;syncPlayback()}})
function toggleDanmaku(){danmakuEnabled.value=!danmakuEnabled.value;writeStorage('lanyin.world.danmaku',String(danmakuEnabled.value));if(danmakuEnabled.value&&commentsState.value.error)comments.retry()}
function toggleLights(){lightsEnabled.value=!lightsEnabled.value;writeStorage('lanyin.world.lights',String(lightsEnabled.value))}
function saveDanmakuOpacity(){clearTimeout(opacitySaveTimer);opacitySaveTimer=0;writeStorage(DANMAKU_OPACITY_KEY,danmakuOpacity.value)}
function changeDanmakuOpacity(value){danmakuOpacity.value=normalizeDanmakuOpacity(value);clearTimeout(opacitySaveTimer);opacitySaveTimer=setTimeout(saveDanmakuOpacity,180)}
function returnTo2D(){environment.setMode('2d');if(route.name==='space')router.push(environment.state.returnPath||'/home')}
function openMap(){world?.clearMovement();world?.cancelTravel()}
function toggleView(){world?.setViewMode(status.viewMode==='first'?'third':'first');canvas.value?.focus({preventScroll:true})}
function jumpAvatar(){world?.jump();canvas.value?.focus({preventScroll:true})}
function syncPresence(){
  const state=listeningRoom.state
  const preserved=world?.setPresence(state.presence,{memberId:state.memberId,roomId:state.room?.id||'',connected:state.connected,preservePosition:Boolean(state.enteredRoomId)&&state.enteredRoomId===state.room?.id})
  if(preserved)state.enteredRoomId=''
}
async function takeSeat(id){const ok=await listeningRoom.takeSeat(id);if(!ok&&id)toast(listeningRoom.state.presenceError||'暂时无法落座。');return ok}
function goToMapPoint(id){panel.value=false;exploring.value=true;world?.navigateToPoint(id);canvas.value?.focus({preventScroll:true})}
let lastVolume=player.state.volume||.8
async function playSelectedTrack(track){
  if(String(player.state.currentTrack.id)!==String(track.id))return player.playTrack(track)
  return player.state.isPlaying?true:player.togglePlay()
}
async function playQueuedTrack(payload){
  if(player.state.isLoading||payload.version!==player.state.queueVersion)return
  const track=player.state.queue[payload.index]
  if(!track||String(track.id)!==String(payload.id))return
  const done=listFeedback.begin(track)
  try{const ok=await playSelectedTrack(track);if(!ok)toast('这首音乐暂时无法播放，请选择其他歌曲。')}catch{toast('音乐暂时无法播放，请稍后重试。')}finally{done()}
}
function seekListening(seconds){player.seekTo(seconds)}
async function enqueueTracks(tracks,title='声境音乐馆'){
  const done=listFeedback.begin(tracks)
  try{
    const result=await player.appendToQueue(tracks,{type:'music-world',id:'pavilion',label:title})
    if(result===false){toast(player.state.error?.userMessage||'未能加入播放列表，请稍后重试。');return false}
    toast('已加入播放列表');return true
  }catch{toast('未能加入播放列表，请稍后重试。');return false}finally{done()}
}
function openComments(index){
  if(Number.isInteger(index)&&index>=0)comments.select(index)
  else if(commentsState.value.error&&!commentsState.value.items.length)comments.retry()
  panel.value=false;commentOpen.value=true;exploring.value=true;world?.clearMovement();world?.cancelTravel()
}
function closeComments(){commentOpen.value=false;canvas.value?.focus({preventScroll:true})}
function openListeningInput(mode){if(!['code','settings','search','copy'].includes(mode))return;panel.value=false;commentOpen.value=false;world?.setListeningInputOpen(true);listeningPanel.value=mode}
async function closeListeningRoom(){listeningPanel.value='';world?.setListeningInputOpen(false);await nextTick();canvas.value?.focus({preventScroll:true})}
function receiveStatus(value){Object.assign(status,value);status.audioMode=sampler?.getStatus()||'waiting';if(value.scene)sceneId.value=value.scene;if(value.sceneError)toast(value.sceneError);if(value.station)stationId.value=value.station;if(value.inspecting===false)selectedRecord.value=null}
async function changeScene(id){
  const destination=getWorldScene(id).id
  if(!world||!ready.value||failed.value||destination===sceneId.value)return
  const currentWorld=world,previousScene=sceneId.value
  entranceScene.value=destination;ready.value=false;sceneReady.value=false;progress.value=0
  panel.value=false;commentOpen.value=false;listeningPanel.value='';listeningPlacement.value=null
  world.clearMovement();world.cancelTravel();world.dismissRecord();world.setListeningInputOpen(false)
  selectedRecord.value=null
  await nextTick()
  // Paint closed doors before even a cached scene can replace the visible world.
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))
  if(disposed||world!==currentWorld||failed.value)return
  try{
    const applied=await currentWorld.setScene(destination,value=>{if(!disposed&&world===currentWorld)progress.value=value})
    if(disposed||world!==currentWorld||failed.value)return
    if(applied)writeStorage('lanyin.world.scene',destination)
    else entranceScene.value=previousScene
    sceneReady.value=true
  }catch(error){
    if(disposed||world!==currentWorld||failed.value)return
    entranceScene.value=previousScene;sceneReady.value=true
    toast('场景暂时无法加载，已保留当前空间。')
  }
}
function changeQuality(value){quality.value=['smooth','balanced','high'].includes(value)?value:'balanced';world?.setQuality(quality.value);writeStorage('lanyin.world.quality',quality.value)}
function handleWorldKey(event){if(event.code!=='Escape')return;if(selectedRecord.value&&!placingRecord.value){event.preventDefault();dismissRecord()}else if(status.seated){event.preventDefault();world?.stand()}}
function dismissRecord(){if(placingRecord.value)return;world?.dismissRecord();selectedRecord.value=null;canvas.value?.focus({preventScroll:true})}
async function inspectRecord(item,alreadyVisible=false){
  if(!ready.value||placingRecord.value)return
  panel.value=false;exploring.value=true;selectedRecord.value=item
  if(!alreadyVisible)world?.inspectRecord(item)
  selectedRecord.value=item
  await nextTick();recordPanel.value?.querySelector('button')?.focus({preventScroll:true})
}
async function placeSelected(){
  const item=selectedRecord.value;if(!item||placingRecord.value)return
  placingRecord.value=true
  try{
    const success=await enqueueTracks(item)
    if(success&&!disposed&&selectedRecord.value?.id===item.id){world?.openTerminal();selectedRecord.value=null;canvas.value?.focus({preventScroll:true})}
  }finally{placingRecord.value=false}
}
function toast(value){notice.value=value;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.value='',3500)}
function syncPlayback(){
  if(!props.suspended && !routeOpen.value && !failed.value && !document.hidden && player.state.isPlaying && !reducedMotion.value)sampler?.start();else sampler?.stop()
  const current=listening.value,index=worldLyricIndex(lyrics.value,current.currentTime)
  world?.setPlayback({...current,line:lyrics.value[index],previousLine:lyrics.value[index-1],nextLine:lyrics.value[index+1],lyrics:lyrics.value,commentsTotal:commentsState.value.total,danmakuEnabled:danmakuEnabled.value,danmakuOpacity:danmakuOpacity.value,lightsEnabled:lightsEnabled.value,reducedMotion:reducedMotion.value})
}
async function finishEntrance(){
  if(disposed || failed.value || !sceneReady.value)return
  ready.value=true
  await nextTick()
  if(!disposed && ready.value && !failed.value && !props.suspended && !routeOpen.value && !listeningPanel.value)canvas.value?.focus({preventScroll:true})
}
async function initialize(){
  const requestedScene=entranceScene.value,baseProgress=requestedScene==='rain'?1:.55
  abort?.abort();world?.dispose();sampler?.dispose();world=null;sampler=null
  abort=new AbortController();const signal=abort.signal
  ready.value=false;sceneReady.value=false;failed.value=false;progress.value=0;canvasKey.value++;await nextTick()
  listeningPanel.value='';listeningPlacement.value=null
  if(disposed||signal.aborted)return
  try{
    sampler=createWorldAudioSampler(player.getAudioElement())
    world=await createMusicWorld(canvas.value,{signal,quality:quality.value,sampleAudio:()=>sampler?.sample(),onProgress:value=>{if(!signal.aborted)progress.value=value*baseProgress},onStatus:receiveStatus,onAction:handleAction,onListeningScreen:value=>listeningPlacement.value=value,onPresence:listeningRoom.movePresence,onSeat:takeSeat})
    if(signal.aborted)return
    world.setClimate(climate.value)
    syncPresence();await listeningRoom.setPresenceActive(!props.suspended&&!routeOpen.value)
    world.updateLibrary(data.exhibits.value);world.setFeeds(feeds.getState());world.setQuality(quality.value);world.setAccount(account.value);world.setListeningRoom(roomSummary.value);world.setListeningLobby(lobby.snapshot);world.setActive(!props.suspended&&!routeOpen.value);syncPlayback()
    const applied=await world.setScene(requestedScene,value=>{if(!signal.aborted)progress.value=baseProgress+value*(1-baseProgress)})
    if(disposed||signal.aborted||failed.value)return
    if(!applied){failed.value=true;sampler?.stop();return}
    writeStorage('lanyin.world.scene',requestedScene);sceneReady.value=true
  }catch(error){if(error.name!=='AbortError'&&!signal.aborted){failed.value=true;sampler?.stop();console.warn('Music pavilion failed:',error)}}
}
async function goTo(id){
  if(routeOpen.value)await router.push('/space')
  panel.value=false;exploring.value=true;stationId.value=id;world?.navigate(id);canvas.value?.focus({preventScroll:true})
}
async function openSection(id){
  if(id==='recommend'){await goTo('discover');return}
  if(routeOpen.value)await router.push('/space')
  const destination=['liked','recent'].includes(id)?'archive':id==='radio'?'lounge':id==='video'?'screen':'discover'
  stationId.value=destination;world?.navigate(destination,{immediate:true});world?.clearMovement();panel.value=true;exploring.value=true
  data.loadSection(id);await nextTick();panelEl.value?.querySelector(id==='search'?'input':'button')?.focus()
}
function closePanel(){panel.value=false;canvas.value?.focus({preventScroll:true})}
async function selectItem(item){
  if(item.kind==='playlist'||item.kind==='artist'){panel.value=true;await data.openCollection(item);return}
  if(item.kind==='radio'){router.push(item.to||`/podcast/${item.id}`);return}
  if(item.kind==='video'){router.push(item.to||{path:'/mv',query:{mvId:item.id}});return}
  inspectRecord(item)
}
function retryContent(){data.retry()}
async function handleAction(action,payload){
  if(action==='section')openSection(payload)
  else if(action==='feed-scroll')feeds.scroll(payload.id,payload.delta)
  else if(action==='feed-select')feeds.select(payload.id,payload.item)
  else if(action==='feed-back')feeds.back(payload.id)
  else if(action==='feed-retry')feeds.retry(payload.id)
  else if(action==='feed-initial')feeds.setArtistInitial(payload.initial)
  else if(action==='comments')openComments()
  else if(action==='danmaku-toggle')toggleDanmaku()
  else if(action==='lights-toggle')toggleLights()
  else if(action==='danmaku-opacity')changeDanmakuOpacity(payload)
  else if(action==='settings')router.push('/settings')
  else if(action==='climate')climatePanel.value?.open()
  else if(action==='account'){world?.clearMovement();world?.cancelTravel();auth.openLoginModal()}
  else if(action==='room-open')goTo('lobby')
  else if(action==='lobby-input')openListeningInput(payload)
  else if(action==='lobby-input-close')closeListeningRoom()
  else if(action==='lobby-create')await lobby.create()
  else if(action==='lobby-join')await lobby.join(payload)
  else if(action==='lobby-copy'){await lobby.copy();if(lobby.copyFallback)openListeningInput('copy')}
  else if(action==='lobby-leave')await lobby.leave()
  else if(action==='lobby-audio')await lobby.enableAudio()
  else if(action==='lobby-retry-local')await lobby.retryLocal()
  else if(action==='lobby-retry')await lobby.retry()
  else if(action==='lobby-refresh')lobby.refresh()
  else if(action==='lobby-filter')lobby.filter=payload
  else if(action==='environment'&&payload==='2d')returnTo2D()
  else if(action==='select')selectItem(payload)
  else if(action==='inspect')inspectRecord(payload,true)
  else if(action==='notice')toast(payload)
  else if(action==='station')['screen','terminal','discover','lobby'].includes(payload)?goTo(payload):openSection(payload==='archive'?'liked':'radio')
  else if(action==='listen')goTo('screen')
  else if(action==='toggle'){if(!player.state.isLoading)(player.state.currentTrack.id||player.state.queue.length)?player.togglePlay():openSection('recommend')}
  else if(action==='previous'||action==='next'){if(player.state.isLoading)return;const track=player.getRelativeQueueTrack(action==='next'?1:-1);if(track)await player.playTrack(track)}
  else if(action==='queue-play')await playQueuedTrack(payload)
  else if(action==='play-mode')player.setPlayMode(payload)
  else if(action==='quality')changeQuality(payload)
  else if(action==='mute'){if(player.state.volume>0){lastVolume=player.state.volume;player.setVolume(0)}else player.setVolume(lastVolume||.8)}
  else if(action==='volume'){player.setVolume(payload);if(payload>0)lastVolume=payload}
  else if(action==='scene')changeScene(payload)
  else if(action==='progress')seekListening(payload*listening.value.duration)
  else if(action==='lyric')seekListening(payload)
  else if(action==='error'){ready.value=false;failed.value=true;world?.clearMovement();sampler?.stop()}
}
function visibility(){syncPlayback();if(!document.hidden&&sceneId.value==='sky-lounge')world?.setClimate(climate.value)}
function syncMotion(){reducedMotion.value=mediaQuery.matches;syncPlayback()}
watch(()=>[listening.value,danmakuEnabled.value,danmakuOpacity.value,lightsEnabled.value],syncPlayback)
watch(data.exhibits,value=>world?.updateLibrary(value))
watch(account,value=>world?.setAccount(value))
watch(roomSummary,value=>world?.setListeningRoom(value))
watch(()=>JSON.stringify(lobby.snapshot),()=>world?.setListeningLobby(lobby.snapshot))
watch(()=>[listeningRoom.state.presence,listeningRoom.state.connected,listeningRoom.state.room?.id],syncPresence)
watch(()=>[routeOpen.value,props.suspended],([covered,suspended])=>{void listeningRoom.setPresenceActive(!covered&&!suspended)})
watch(()=>[routeOpen.value,props.suspended,listeningPanel.value],([covered,suspended,roomOpen])=>{world?.setActive(!covered&&!suspended);world?.setListeningInputOpen(!covered&&!suspended&&Boolean(roomOpen));if(covered||suspended){listeningPanel.value='';listeningPlacement.value=null}if(covered||suspended||roomOpen){world?.clearMovement();world?.dismissRecord();panel.value=false;commentOpen.value=false}syncPlayback()})
watch(()=>listening.value.track?.id,async()=>{
  const token=++lyricsToken;lyrics.value=[];comments.setTrack(listening.value.track)
  if(!listening.value.track?.id)return
  try{const result=await getCachedTrackLyrics(listening.value.track,{timeoutMs:6000});if(token===lyricsToken&&!disposed){lyrics.value=result;syncPlayback()}}catch{}
},{immediate:true})
onMounted(()=>{mediaQuery=matchMedia('(prefers-reduced-motion: reduce)');syncMotion();mediaQuery.addEventListener('change',syncMotion);document.addEventListener('visibilitychange',visibility);climateClock=setInterval(()=>{if(sceneId.value==='sky-lounge'&&climate.value.mode!=='manual'&&!props.suspended&&!routeOpen.value&&!document.hidden)world?.setClimate(climate.value)},15000);initialize();data.loadHome();feeds.loadAll()})
onBeforeUnmount(()=>{disposed=true;clearInterval(climateClock);void listeningRoom.setPresenceActive(false);listFeedback.dispose();if(opacitySaveTimer)saveDanmakuOpacity();lyricsToken++;feeds.dispose();comments.dispose();abort?.abort();world?.dispose();sampler?.dispose();clearTimeout(noticeTimer);mediaQuery?.removeEventListener('change',syncMotion);document.removeEventListener('visibilitychange',visibility)})
</script>
