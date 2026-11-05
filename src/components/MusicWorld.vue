<template>
  <section class="music-world" :class="{'music-world--inspecting':selectedRecord,'music-world--seated':status.seated}" :inert="suspended" aria-label="声境 3D 音乐馆" @keydown="handleWorldKey">
    <canvas ref="canvas" :key="canvasKey" class="music-world__canvas" tabindex="0" aria-label="3D 音乐馆。WASD 行走，拖动环顾，方向键转向，E 选择视线中的展品，Home 返回中庭。" @pointerdown="exploring=true" />
    <WorldListeningRoom v-if="listeningPanel" :mode="listeningPanel" :display-name="account.isLoggedIn?account.displayName:''" @close="closeListeningRoom" />
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


    <div v-if="!ready || failed" class="world-loading" role="status">
      <AudioLines :size="42" :stroke-width="1" /><span>{{ failed ? '音乐馆暂时无法打开' : '正在打开声境' }}</span>
      <p>{{ failed ? '你可以重试，或返回 2D 继续听歌。' : '准备建筑、唱片和灯光' }}</p>
      <div v-if="!failed" class="world-loading__bar"><i :style="{width:`${Math.max(8,progress*100)}%`}" /></div>
      <button v-else type="button" @click="initialize">重新进入</button>
      <button v-if="failed" type="button" @click="returnTo2D">返回 2D</button>
    </div>

    <span v-if="exploring && !panel && !routeOpen" class="world-reticle" aria-hidden="true" />

    <section v-if="selectedRecord && !routeOpen" ref="recordPanel" class="world-record-inspector" aria-label="查看选中的唱片">
      <div class="world-record-inspector__copy"><span class="world-eyebrow">FROM YOUR RECORD SHELF</span><h2>{{ selectedRecord.name }}</h2><p>{{ selectedRecord.artist || '未知歌手' }}</p><small>{{ selectedRecord.album || '在控制终端，开始这一次聆听。' }}</small></div>
      <div class="world-record-inspector__actions"><button class="world-start-track" type="button" aria-label="播放并前往控制终端" title="播放并前往控制终端" :disabled="placingRecord" @click="placeSelected"><Loader2 v-if="placingRecord" class="world-spin" :size="22" /><Play v-else :size="22" fill="currentColor" /></button><button type="button" :aria-pressed="data.library.isTrackLiked(selectedRecord.id)" @click="data.library.toggleLikedTrack(selectedRecord)"><Heart :size="17" :fill="data.library.isTrackLiked(selectedRecord.id)?'currentColor':'none'" />{{ data.library.isTrackLiked(selectedRecord.id)?'已收藏':'收藏' }}</button><button type="button" :disabled="placingRecord" @click="dismissRecord"><ArrowLeft :size="16" />放回唱片</button></div>
      <small class="world-record-inspector__hint">封面与唱片来自你的曲库 <span>·</span> Esc 返回</small>
    </section>

    <WorldMap v-if="ready&&!suspended&&!panel&&!routeOpen&&!selectedRecord&&!commentOpen" :position="status" :archive-tracks="data.exhibits.value.archive" @open="openMap" @navigate="goToMapPoint" />

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
        <footer><span>{{ data.items.value.length }} {{ data.items.value[0]?.kind==='song'?'首音乐':'个展品' }}</span><button v-if="data.items.value.some(i=>i.kind==='song')" type="button" :disabled="player.state.isLoading" @click="playAll"><Play :size="13" fill="currentColor" />播放全部</button></footer>
      </section>
    </Transition>
    <div v-if="notice" class="world-notice" role="status">{{ notice }}</div>
  </section>
</template>

<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { ArrowLeft, ArrowUpRight, AudioLines, Disc3, Heart, Loader2, Play, Search, X } from 'lucide-vue-next'
import { usePlayerStore } from '../stores/player'
import { useListeningRoomStore } from '../stores/listeningRoom'
import { useAuthStore } from '../stores/auth'
import { useEnvironmentStore } from '../stores/environment'
import { getCachedTrackLyrics } from '../services/lyrics'
import { worldLyricIndex } from './music-world/lyricTypography.js'
import { useQueuePlayback } from '../composables/useQueuePlayback'
import { createWorldAudioSampler } from './music-world/createWorldAudioSampler.js'
import { getWorldScene } from './music-world/worldScenes.js'
import { createMusicWorld } from './music-world/createMusicWorld'
import WorldMap from './music-world/WorldMap.vue'
import WorldMusicLoading from './music-world/WorldMusicLoading.vue'
import { useWorldLibrary } from './music-world/useWorldLibrary'
import '../styles/music-world.css'
import WorldCommentReader from './music-world/WorldCommentReader.vue'
import { createScreenFeeds } from './music-world/screenFeeds.js'
import { loadWorldScreen } from './music-world/worldDataSources.js'
import { createSongComments } from './music-world/songComments.js'
import { getSongCommentsData } from '../services/netease'
import { readStorage, writeStorage } from '../utils/storage'
import { DANMAKU_OPACITY_KEY, normalizeDanmakuOpacity } from './music-world/danmakuSettings.js'

const player=usePlayerStore(),data=useWorldLibrary(),router=useRouter(),route=useRoute(),message=useMessage()
const environment=useEnvironmentStore()
const auth=useAuthStore()
const account=computed(()=>({isLoggedIn:auth.state.isLoggedIn,displayName:auth.displayName.value,avatarUrl:auth.avatarUrl.value}))
const WorldDanmaku=defineAsyncComponent(()=>import('./music-world/WorldDanmaku.vue'))
const WorldListeningRoom=defineAsyncComponent(()=>import('./music-world/WorldListeningRoom.vue'))
const listeningRoom=useListeningRoomStore(),listeningPanel=ref('')
const roomSummary=computed(()=>({id:listeningRoom.state.room?.id||'',isHost:listeningRoom.state.room?.hostId===listeningRoom.state.memberId,connected:listeningRoom.state.connected,count:listeningRoom.state.room?.members.length||0,capacity:listeningRoom.state.room?.capacity||10,status:listeningRoom.state.syncStatus}))
const props=defineProps({suspended:{type:Boolean,default:false}})
const canvas=ref(null),canvasKey=ref(0),ready=ref(false),failed=ref(false),progress=ref(0),exploring=ref(true),panel=ref(false),panelEl=ref(null),notice=ref('')
const sceneId=ref(getWorldScene(readStorage('lanyin.world.scene','rain')).id)
const stationId=ref('atrium'),routeOpen=computed(()=>route.name!=='space')
const status=reactive({x:0,z:12.8,yaw:0,live:false,seated:false,navigating:false,hint:'',sceneLoading:false,scenePending:'',lightingCue:'等待音乐',audioMode:'waiting'}),lyrics=ref([]),reducedMotion=ref(false)
const selectedRecord=ref(null),recordPanel=ref(null),placingRecord=ref(false),quality=ref(readStorage('lanyin.world.quality','balanced'))
const searchTypes=[{id:1,name:'歌曲'},{id:100,name:'歌手'},{id:1000,name:'歌单'}],discoveryTabs=[{id:'recommend',name:'为你推荐'},{id:'playlists',name:'歌单'},{id:'charts',name:'排行榜'},{id:'artists',name:'歌手'}]
const queue=computed(()=>data.items.value.filter(item=>item.kind==='song'))
const playback=useQueuePlayback({queue,player,message,emptyMessage:'先挑选一些音乐',errorMessage:'这首音乐暂时无法播放',queueSource:{type:'music-world',id:'pavilion',label:'声境音乐馆'}})
let world=null,sampler=null,abort=null,mediaQuery=null,noticeTimer=0,lyricsToken=0,disposed=false
const listening=computed(()=>({track:player.state.currentTrack,playing:player.state.isPlaying,currentTime:player.state.currentTime,duration:player.state.duration,loading:player.state.isLoading,volume:player.state.volume,queueLength:player.state.queue.length,queue:player.state.queue,queueVersion:player.state.queueVersion,playMode:player.state.playMode}))
const commentOpen=ref(false),commentsState=shallowRef({items:[],index:0,total:0,busy:false})
const danmakuEnabled=ref(readStorage('lanyin.world.danmaku','true')!=='false')
const danmakuOpacity=ref(normalizeDanmakuOpacity(readStorage(DANMAKU_OPACITY_KEY,'1')))
let opacitySaveTimer=0
const feeds=createScreenFeeds({load:loadWorldScreen,onChange:value=>world?.setFeeds(value),onPlay:playScreenTrack})
const comments=createSongComments({load:getSongCommentsData,onChange:value=>{commentsState.value=value;syncPlayback()}})
function toggleDanmaku(){danmakuEnabled.value=!danmakuEnabled.value;writeStorage('lanyin.world.danmaku',String(danmakuEnabled.value));if(danmakuEnabled.value&&commentsState.value.error)comments.retry()}
function saveDanmakuOpacity(){clearTimeout(opacitySaveTimer);opacitySaveTimer=0;writeStorage(DANMAKU_OPACITY_KEY,danmakuOpacity.value)}
function changeDanmakuOpacity(value){danmakuOpacity.value=normalizeDanmakuOpacity(value);clearTimeout(opacitySaveTimer);opacitySaveTimer=setTimeout(saveDanmakuOpacity,180)}
function returnTo2D(){environment.setMode('2d');if(route.name==='space')router.push(environment.state.returnPath||'/home')}
function openMap(){world?.clearMovement();world?.cancelTravel()}
function goToMapPoint(id){panel.value=false;exploring.value=true;world?.navigateToPoint(id);canvas.value?.focus({preventScroll:true})}
let lastVolume=player.state.volume||.8,lastQueueClick='',lastQueueTime=0
async function playQueuedTrack(payload){
  if(player.state.isLoading||payload.version!==player.state.queueVersion)return
  const track=player.state.queue[payload.index]
  if(!track||String(track.id)!==String(payload.id))return
  const key=String(track.id),now=performance.now()
  if(lastQueueClick===key&&now-lastQueueTime<400)return
  lastQueueClick=key;lastQueueTime=now
  try{const ok=String(player.state.currentTrack.id)===key?await player.togglePlay():await player.playTrack(track);if(!ok)toast('这首音乐暂时无法播放，请选择其他歌曲。')}catch{toast('音乐暂时无法播放，请稍后重试。')}
}
function seekListening(seconds){player.seekTo(seconds)}
async function playScreenTrack(track,tracks,title){
  if(player.state.isLoading)return
  try{
    player.setQueue(tracks,{type:'music-world',id:'discovery-screen',label:title})
    const ok=String(player.state.currentTrack.id)===String(track.id)?await player.togglePlay():await player.playTrack(track)
    if(!ok)toast('这首音乐暂时无法播放，请选择其他歌曲。')
  }catch{toast('音乐暂时无法播放，请稍后重试。')}
}
function openComments(index){
  if(Number.isInteger(index)&&index>=0)comments.select(index)
  else if(commentsState.value.error&&!commentsState.value.items.length)comments.retry()
  panel.value=false;commentOpen.value=true;exploring.value=true;world?.clearMovement();world?.cancelTravel()
}
function closeComments(){commentOpen.value=false;canvas.value?.focus({preventScroll:true})}
function openListeningRoom(mode){world?.clearMovement();world?.cancelTravel();panel.value=false;commentOpen.value=false;listeningPanel.value=mode||'create'}
async function closeListeningRoom(){listeningPanel.value='';await nextTick();canvas.value?.focus({preventScroll:true})}
function receiveStatus(value){Object.assign(status,value);status.audioMode=sampler?.getStatus()||'waiting';if(value.scene){sceneId.value=value.scene;writeStorage('lanyin.world.scene',value.scene)}if(value.sceneError)toast(value.sceneError);if(value.station)stationId.value=value.station;if(value.inspecting===false)selectedRecord.value=null}
function changeScene(id){world?.setScene(id)}
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
    const sameTrack=String(player.state.currentTrack.id)===String(item.id)
    const success=sameTrack?(player.state.isPlaying||await player.togglePlay()):await playback.playTrack(item)
    if(!success&&sameTrack)toast('音乐暂时无法播放，请稍后重试。')
    if(success&&!disposed&&selectedRecord.value?.id===item.id){world?.openTerminal();selectedRecord.value=null;canvas.value?.focus({preventScroll:true});toast(`已载入控制终端 · ${item.name}`)}
  }catch{toast('音乐暂时无法播放，请稍后重试。')}finally{placingRecord.value=false}
}
function toast(value){notice.value=value;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.value='',3500)}
function syncPlayback(){
  if(!props.suspended && !routeOpen.value && !listeningPanel.value && !failed.value && !document.hidden && player.state.isPlaying && !reducedMotion.value)sampler?.start();else sampler?.stop()
  const current=listening.value,index=worldLyricIndex(lyrics.value,current.currentTime)
  world?.setPlayback({...current,line:lyrics.value[index],previousLine:lyrics.value[index-1],nextLine:lyrics.value[index+1],lyrics:lyrics.value,commentsTotal:commentsState.value.total,danmakuEnabled:danmakuEnabled.value,danmakuOpacity:danmakuOpacity.value,reducedMotion:reducedMotion.value})
}
async function initialize(){
  const requestedScene=sceneId.value
  abort?.abort();world?.dispose();sampler?.dispose();world=null;sampler=null
  abort=new AbortController();const signal=abort.signal
  ready.value=false;failed.value=false;progress.value=0;canvasKey.value++;await nextTick()
  if(disposed||signal.aborted)return
  try{
    sampler=createWorldAudioSampler(player.getAudioElement())
    world=await createMusicWorld(canvas.value,{signal,sampleAudio:()=>sampler?.sample(),onProgress:value=>progress.value=value,onStatus:receiveStatus,onAction:handleAction})
    if(signal.aborted)return
    world.updateLibrary(data.exhibits.value);world.setFeeds(feeds.getState());world.setQuality(quality.value);world.setAccount(account.value);world.setListeningRoom(roomSummary.value);world.setActive(!props.suspended&&!routeOpen.value&&!listeningPanel.value);syncPlayback();await world.setScene(requestedScene);if(!signal.aborted){ready.value=true;if(!props.suspended&&!routeOpen.value&&!listeningPanel.value)canvas.value?.focus({preventScroll:true})}
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
  if(player.state.isLoading)return
  if(item.kind==='playlist'||item.kind==='artist'){panel.value=true;await data.openCollection(item);return}
  if(item.kind==='radio'){router.push(item.to||`/podcast/${item.id}`);return}
  if(item.kind==='video'){router.push(item.to||{path:'/mv',query:{mvId:item.id}});return}
  inspectRecord(item)
}
async function playAll(){if(await playback.playAll())toast('播放队列已同步 · 去听音厅坐坐吧')}
function retryContent(){data.retry()}
async function handleAction(action,payload){
  if(action==='section')openSection(payload)
  else if(action==='feed-scroll')feeds.scroll(payload.id,payload.delta)
  else if(action==='feed-top')feeds.scroll(payload.id,-Infinity)
  else if(action==='feed-page')feeds.scroll(payload.id,4.8)
  else if(action==='feed-select')feeds.select(payload.id,payload.item)
  else if(action==='feed-back')feeds.back(payload.id)
  else if(action==='feed-more')feeds.more(payload.id)
  else if(action==='feed-retry')feeds.retry(payload.id)
  else if(action==='feed-initial')feeds.setArtistInitial(payload.initial)
  else if(action==='comments')openComments()
  else if(action==='danmaku-toggle')toggleDanmaku()
  else if(action==='danmaku-opacity')changeDanmakuOpacity(payload)
  else if(action==='settings')router.push('/settings')
  else if(action==='account'){world?.clearMovement();world?.cancelTravel();auth.openLoginModal()}
  else if(action==='room-open')openListeningRoom(payload)
  else if(action==='environment'&&payload==='2d')returnTo2D()
  else if(action==='select')selectItem(payload)
  else if(action==='inspect')inspectRecord(payload,true)
  else if(action==='notice')toast(payload)
  else if(action==='station')['screen','terminal','discover'].includes(payload)?goTo(payload):openSection(payload==='archive'?'liked':'radio')
  else if(action==='listen')goTo('screen')
  else if(action==='toggle'){if(!player.state.isLoading)player.state.currentTrack.id?player.togglePlay():openSection('recommend')}
  else if(action==='previous'||action==='next'){if(player.state.isLoading)return;const track=player.getRelativeQueueTrack(action==='next'?1:-1);if(track)await player.playTrack(track)}
  else if(action==='queue-play')await playQueuedTrack(payload)
  else if(action==='play-mode')player.setPlayMode(payload)
  else if(action==='quality')changeQuality(payload)
  else if(action==='mute'){if(player.state.volume>0){lastVolume=player.state.volume;player.setVolume(0)}else player.setVolume(lastVolume||.8)}
  else if(action==='volume'){player.setVolume(payload);if(payload>0)lastVolume=payload}
  else if(action==='scene')changeScene(payload)
  else if(action==='progress')seekListening(payload*listening.value.duration)
  else if(action==='lyric')seekListening(payload)
  else if(action==='error'){failed.value=true;sampler?.stop()}
}
function visibility(){syncPlayback()}
function syncMotion(){reducedMotion.value=mediaQuery.matches;syncPlayback()}
watch(()=>[listening.value,danmakuEnabled.value,danmakuOpacity.value],syncPlayback)
watch(data.exhibits,value=>world?.updateLibrary(value))
watch(account,value=>world?.setAccount(value))
watch(roomSummary,value=>world?.setListeningRoom(value))
watch(()=>[routeOpen.value,props.suspended,listeningPanel.value],([covered,suspended,roomOpen])=>{world?.setActive(!covered&&!suspended&&!roomOpen);if(covered||suspended||roomOpen){world?.clearMovement();world?.dismissRecord();panel.value=false;commentOpen.value=false}syncPlayback()})
watch(()=>listening.value.track?.id,async()=>{
  const token=++lyricsToken;lyrics.value=[];comments.setTrack(listening.value.track)
  if(!listening.value.track?.id)return
  try{const result=await getCachedTrackLyrics(listening.value.track,{timeoutMs:6000});if(token===lyricsToken&&!disposed){lyrics.value=result;syncPlayback()}}catch{}
},{immediate:true})
onMounted(()=>{mediaQuery=matchMedia('(prefers-reduced-motion: reduce)');syncMotion();mediaQuery.addEventListener('change',syncMotion);document.addEventListener('visibilitychange',visibility);initialize();data.loadHome();feeds.loadAll()})
onBeforeUnmount(()=>{disposed=true;if(opacitySaveTimer)saveDanmakuOpacity();lyricsToken++;feeds.dispose();comments.dispose();abort?.abort();world?.dispose();sampler?.dispose();clearTimeout(noticeTimer);mediaQuery?.removeEventListener('change',syncMotion);document.removeEventListener('visibilitychange',visibility)})
</script>
