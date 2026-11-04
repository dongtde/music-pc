<template>
  <button type="button" class="world-map" aria-label="打开音乐馆大地图" aria-haspopup="dialog" :aria-expanded="expanded" @click="open">
    <WorldMapFloor :position="position" compact />
    <span class="world-map__expand"><Maximize2 :size="12" aria-hidden="true" /></span>
  </button>

  <dialog ref="dialog" class="world-map-dialog" aria-labelledby="world-map-title" @keydown.stop @cancel.prevent="close" @close="onClose" @click.self="close">
    <div class="world-map-dialog__body">
      <header class="world-map-dialog__header">
        <div class="world-map-dialog__identity"><span class="world-map-dialog__emblem"><AudioLines :size="24" :stroke-width="1.4" /></span><div><h2 id="world-map-title">音乐馆地图</h2><p>声境 · 空间导览</p></div></div>
        <button type="button" class="world-map-dialog__close" aria-label="关闭大地图" autofocus @click="close"><X :size="19" /><kbd>Esc</kbd></button>
      </header>

      <div class="world-map-dialog__content">
        <div class="world-map-dialog__floor">
          <WorldMapFloor :position="position" :preview-id="previewId" :archive-tracks="archiveTracks" @navigate="navigate" @preview="previewId=$event" />
        </div>
        <aside class="world-map-directory" aria-label="音乐馆目的地">
          <header class="world-map-directory__header"><h3>目的地</h3><span>{{ destinations.length }} 个地点</span></header>
          <nav class="world-map-directory__tabs" aria-label="目的地分类"><button v-for="group in groups" :key="group.id" type="button" :class="{'is-active':groupId===group.id}" :aria-pressed="groupId===group.id" @click="groupId=group.id;previewId=''">{{ group.label }}<span>{{ group.count }}</span></button></nav>
          <div class="world-map-directory__list">
            <button v-for="place in visiblePlaces" :key="place.id" type="button" class="world-map-directory__place" :class="[`is-${place.kind}`,{'is-active':position.pointId===place.id,'is-preview':previewId===place.id}]" :aria-label="destinationTitle(place)" :aria-current="position.pointId===place.id?'location':undefined" @pointerenter="previewId=place.id" @pointerleave="previewId=''" @focus="previewId=place.id" @blur="previewId=''" @click="navigate(place.id)">
              <span class="world-map-directory__icon"><component :is="iconFor(place)" :size="18" :stroke-width="1.5" /></span>
              <span class="world-map-directory__copy"><strong>{{ place.label }}</strong><small>{{ detailFor(place) }}</small></span>
              <ArrowUpRight class="world-map-directory__arrow" :size="15" />
            </button>
          </div>
          <div class="world-map-directory__selected"><Navigation2 :size="19" :stroke-width="1.4" /><div><span>{{ position.navigating?'正在前往':selectedPlace?'已选地点':'当前位置' }}</span><strong>{{ selectedPlace?.label || '自由漫游' }}</strong></div><i :class="{'is-moving':position.navigating}" /></div>
        </aside>
      </div>

      <footer class="world-map-dialog__footer"><div><span><Navigation2 :size="12" />你的位置</span><span><i />已选地点</span></div><p>点击地点前往<ArrowUpRight :size="13" /></p></footer>
    </div>
  </dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ArrowUpRight, AudioLines, Disc3, ListMusic, Maximize2, MicVocal, MonitorPlay, Navigation2, SlidersHorizontal, Sofa, Sparkles, Trophy, X } from 'lucide-vue-next'
import { WORLD_MAP_DESTINATIONS } from './worldNavigation.js'
import WorldMapFloor from './WorldMapFloor.vue'

const props=defineProps({position:{type:Object,required:true},archiveTracks:{type:Array,default:()=>[]}})
const emit=defineEmits(['open','navigate'])
const destinations=WORLD_MAP_DESTINATIONS,dialog=ref(null),expanded=ref(false),previewId=ref(''),groupId=ref('space')
const groupFor=place=>place?.kind==='discovery'?'discovery':place?.kind==='record'?'records':'space'
const groups=[{id:'space',label:'空间'},{id:'discovery',label:'发现'},{id:'records',label:'唱片'}].map(group=>({...group,count:destinations.filter(place=>groupFor(place)===group.id).length}))
const visiblePlaces=computed(()=>destinations.filter(place=>groupFor(place)===groupId.value))
const selectedPlace=computed(()=>destinations.find(place=>place.id===props.position.pointId))
const iconFor=place=>place.kind==='seat'?Sofa:place.kind==='record'?Disc3:({screen:MonitorPlay,terminal:SlidersHorizontal,atrium:AudioLines,recommend:Sparkles,playlists:ListMusic,artists:MicVocal,charts:Trophy})[place.target||place.id]||Navigation2
function detailFor(place){
  if(place.kind==='record')return props.archiveTracks[place.target]?.name||'空展位'
  if(place.kind==='seat')return '落座聆听'
  return ({screen:'歌词与歌曲信息',terminal:'播放与空间设置',atrium:'返回音乐馆中央',recommend:'发现下一首音乐',playlists:'浏览精选歌单',artists:'按歌手寻找音乐',charts:'查看音乐排行榜'})[place.target||place.id]
}
function destinationTitle(place){const track=place.kind==='record'?props.archiveTracks[place.target]:null;return `${place.kind==='seat'?'落座':'前往'}${place.label}${track?.name?' · '+track.name:''}`}
function open(){if(!dialog.value||expanded.value)return;groupId.value=groupFor(selectedPlace.value);previewId.value='';emit('open');dialog.value.showModal();expanded.value=true}
function onClose(){expanded.value=false;previewId.value=''}
function close(){dialog.value?.close();onClose()}
function navigate(id){close();emit('navigate',id)}
</script>

<style scoped>
.world-map{position:absolute;top:20px;right:22px;z-index:4;box-sizing:border-box;width:128px;padding:9px;border:1px solid #8eaeb638;border-radius:18px;background:linear-gradient(145deg,#213744e8,#10252eee);color:#b6cdce;box-shadow:0 8px 30px #0003,inset 0 1px #d0e6e80a;transition:border-color .18s,transform .18s}
.world-map:hover{border-color:#a3e8df80;transform:translateY(-2px)}
.world-map .world-floor{aspect-ratio:444/550;height:auto}
.world-map__expand{position:absolute;right:10px;bottom:10px;display:grid;place-items:center;width:23px;height:23px;border:1px solid #adc9cd26;border-radius:7px;background:#112a35;color:#9cc8ce}
.world-map-dialog{--map-text:#e1eae7;--map-muted:#91a8b2;--map-ice:#a3e8df;--map-gold:#edc797;box-sizing:border-box;width:min(1020px,calc(100vw - 48px));height:min(748px,calc(100dvh - 48px));max-width:none;max-height:none;padding:0;border:1px solid #91aeb53b;border-radius:22px;background:#122630;color:var(--map-text);box-shadow:0 36px 120px #0008,inset 0 1px #d8eff01a;overflow:hidden;overscroll-behavior:contain}
.world-map-dialog[open]{animation:map-arrive .22s ease-out}
.world-map-dialog::backdrop{background:#041017b3;backdrop-filter:blur(7px)}
.world-map-dialog__body{height:100%;min-height:0;display:flex;flex-direction:column}
.world-map-dialog__header{display:flex;align-items:center;justify-content:space-between;flex-shrink:0;gap:16px;padding:23px 28px 21px;border-bottom:1px solid #9fb9c113}
.world-map-dialog__identity{display:flex;align-items:center;gap:14px;min-width:0}
.world-map-dialog__emblem{display:grid;place-items:center;width:42px;height:46px;border:1px solid #a3e8df25;border-radius:12px;background:#8ad5d00a;color:var(--map-ice)}
.world-map-dialog__header h2{margin:0;font-family:'Microsoft YaHei',sans-serif;font-size:21px;font-weight:500;letter-spacing:.08em;line-height:1.3}
.world-map-dialog__header p{margin:7px 0 0;color:var(--map-muted);font-size:10px;letter-spacing:.12em;line-height:1.3}
.world-map-dialog__close{display:flex;align-items:center;justify-content:center;flex-shrink:0;gap:8px;height:34px;padding:0 10px;border:1px solid #9fb9c126;border-radius:9px;background:#abc3ce05;color:var(--map-muted)}
.world-map-dialog__close kbd{font:10px Bahnschrift,'Segoe UI',sans-serif;opacity:.7}
.world-map-dialog__close:hover{background:#a3e8df10;color:var(--map-text)}
.world-map-dialog__content{flex:1;min-height:0;min-width:0;display:grid;grid-template-columns:minmax(0,1fr) 268px}
.world-map-dialog__floor{min-width:0;min-height:0;display:flex;align-items:center;justify-content:center;padding:13px 22px 5px;background:radial-gradient(ellipse at 50% 30%,#26414c55,transparent 70%),#0e222c;overflow:hidden}
.world-map-directory{min-width:0;min-height:0;display:flex;flex-direction:column;padding:22px 17px 17px;border-left:1px solid #9fb9c113;background:linear-gradient(165deg,#192e3880,#122630)}
.world-map-directory__header{display:flex;justify-content:space-between;align-items:center;padding:0 4px 16px;gap:10px}
.world-map-directory__header h3{margin:0;font-size:13px;font-weight:500;letter-spacing:.06em}
.world-map-directory__header>span{color:#77939f;font-size:10px}
.world-map-directory__tabs{display:flex;flex-shrink:0;gap:3px;padding:4px;border:1px solid #99b4c013;border-radius:9px;background:#071b245c;margin-bottom:14px}
.world-map-directory__tabs button{display:flex;flex:1;align-items:center;justify-content:center;gap:6px;min-width:0;padding:8px 3px;border:0;border-radius:6px;background:transparent;color:#8ea7b0;font-size:11px;line-height:1.2;transition:background .15s,color .15s}
.world-map-directory__tabs button span{font:10px Bahnschrift,sans-serif;opacity:.6}
.world-map-directory__tabs button.is-active{background:#304550;color:#ecf2eb;box-shadow:0 2px 6px #0002}
.world-map-directory__list{flex:1;min-height:0;display:flex;flex-direction:column;gap:5px;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#53758066 transparent;padding:2px}
.world-map-directory__place{box-sizing:border-box;display:flex;align-items:center;flex-shrink:0;gap:11px;min-width:0;width:100%;padding:10px 9px;border:1px solid transparent;border-radius:10px;background:transparent;text-align:left;color:var(--map-text);transition:background .15s,border-color .15s}
.world-map-directory__icon{display:grid;place-items:center;flex-shrink:0;width:30px;height:32px;border-radius:8px;background:#8ba6b20d;color:#a8c4d1}
.world-map-directory__place.is-record .world-map-directory__icon{color:#d7bc95;background:#d7bc950a}
.world-map-directory__place.is-discovery .world-map-directory__icon{color:#9ad2ca;background:#9ad2ca0a}
.world-map-directory__copy{flex:1;min-width:0}
.world-map-directory__copy strong,.world-map-directory__copy small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.world-map-directory__copy strong{font-size:12px;font-weight:400;line-height:1.5}
.world-map-directory__copy small{margin-top:3px;color:#7896a2;font-size:10px;line-height:1.3}
.world-map-directory__arrow{flex-shrink:0;color:#678590;opacity:.7;transition:transform .15s,color .15s}
.world-map-directory__place.is-preview,.world-map-directory__place:hover{background:#a3ced10a;border-color:#9fc8c521}
.world-map-directory__place.is-preview .world-map-directory__arrow,.world-map-directory__place:hover .world-map-directory__arrow{transform:translate(1px,-1px);color:var(--map-ice)}
.world-map-directory__place.is-active{border-color:#edc7973d;background:#edc79708}
.world-map-directory__place.is-active .world-map-directory__copy strong,.world-map-directory__place.is-active .world-map-directory__icon{color:var(--map-gold)}
.world-map-directory__selected{display:flex;align-items:center;flex-shrink:0;gap:11px;margin-top:15px;padding:15px 11px 1px;border-top:1px solid #9fb9c11c;color:var(--map-ice)}
.world-map-directory__selected>div{flex:1;min-width:0}
.world-map-directory__selected span,.world-map-directory__selected strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.world-map-directory__selected span{color:#7896a2;font-size:9px}
.world-map-directory__selected strong{color:#c2d7d6;font-size:12px;line-height:1.5;font-weight:400;margin-top:4px}
.world-map-directory__selected>i{width:5px;height:5px;border-radius:50%;background:var(--map-ice);opacity:.5}
.world-map-directory__selected>i.is-moving{background:var(--map-gold);opacity:1}
.world-map-dialog__footer{display:flex;align-items:center;justify-content:space-between;flex-shrink:0;gap:12px;padding:15px 28px;border-top:1px solid #9fb9c113;color:#7f9ba6;font-size:10px}
.world-map-dialog__footer>div{display:flex;gap:20px}
.world-map-dialog__footer span,.world-map-dialog__footer p{display:flex;align-items:center;gap:7px;margin:0;line-height:1.3}
.world-map-dialog__footer span svg{color:var(--map-ice)}
.world-map-dialog__footer i{width:5px;height:5px;border-radius:50%;background:var(--map-gold)}
.world-map-dialog button:focus-visible{outline:2px solid var(--map-ice);outline-offset:-2px}
@keyframes map-arrive{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:none}}
@media(max-width:800px){
  .world-map{top:14px;right:14px;width:108px;padding:7px;border-radius:14px}
  .world-map-dialog{width:calc(100vw - 28px);height:min(930px,calc(100dvh - 28px));border-radius:18px}
  .world-map-dialog__header{padding:17px 20px}
  .world-map-dialog__content{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) 205px}
  .world-map-dialog__floor{padding:8px 12px 0}
  .world-map-directory{padding:12px 16px;border-left:0;border-top:1px solid #9fb9c113;display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:32px minmax(0,1fr);gap:8px 16px}
  .world-map-directory__header{padding:0;justify-content:flex-start;gap:12px}
  .world-map-directory__tabs{margin:0;min-width:222px;align-self:center;padding:3px}
  .world-map-directory__tabs button{padding:6px 8px}
  .world-map-directory__list{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-content:start;gap:4px 10px}
  .world-map-directory__place{padding:7px;gap:8px}
  .world-map-directory__selected{display:none}
  .world-map-dialog__footer{padding:13px 20px}
}
@media(max-width:480px){
  .world-map-dialog{width:calc(100vw - 16px);height:calc(100dvh - 16px);border-radius:15px}
  .world-map-dialog__header{padding:15px 16px}
  .world-map-dialog__header h2{font-size:18px}.world-map-dialog__header p{font-size:9px}
  .world-map-dialog__emblem{width:34px;height:40px;border-radius:9px}.world-map-dialog__identity{gap:10px}
  .world-map-dialog__close kbd{display:none}.world-map-dialog__close{width:32px;padding:0}
  .world-map-dialog__floor{padding:3px 0}
  .world-map-dialog__content{grid-template-rows:minmax(0,1fr) 211px}
  .world-map-directory{padding:10px 12px;gap:8px}.world-map-directory__header>span{display:none}
  .world-map-directory__tabs{min-width:212px}.world-map-directory__header h3{font-size:12px}
  .world-map-directory__place{gap:5px}.world-map-directory__icon{width:25px;height:29px}
  .world-map-directory__copy strong{font-size:11px}.world-map-directory__copy small{font-size:9px}.world-map-directory__arrow{width:12px}
  .world-map-dialog__footer{padding:12px 16px;font-size:9px}.world-map-dialog__footer>div{gap:14px}.world-map-dialog__footer p{gap:3px}
}
@media(max-height:620px) and (min-width:801px){.world-map-dialog{height:calc(100dvh - 24px)}.world-map-dialog__header{padding:14px 24px}.world-map-directory{padding-top:14px}.world-map-dialog__footer{padding-block:11px}.world-map-directory__selected{margin-top:8px;padding-top:10px}}
@media(max-height:620px) and (max-width:800px){.world-map-dialog__content{grid-template-columns:minmax(0,1fr) 225px;grid-template-rows:minmax(0,1fr)}.world-map-directory{display:flex;gap:0;padding:12px;border-left:1px solid #9fb9c113;border-top:0}.world-map-directory__header{padding-bottom:10px}.world-map-directory__tabs{min-width:0;width:100%;margin-bottom:8px;box-sizing:border-box}.world-map-directory__list{display:flex}.world-map-dialog__header{padding:10px 16px}.world-map-dialog__footer{padding:10px 16px}}
@media(prefers-reduced-motion:reduce){.world-map,.world-map-directory__place,.world-map-directory__tabs button,.world-map-directory__arrow{transition:none}.world-map-dialog[open]{animation:none}}
</style>
