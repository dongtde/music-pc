<template>
  <div class="listening-screen-overlay" :style="screenStyle" @pointerdown.stop @pointerup.stop @click.self="close" @wheel.stop @keydown.stop="onKey">
  <section ref="dialog" class="listening-input" role="dialog" aria-modal="true" aria-labelledby="listening-input-title" tabindex="-1">
    <form novalidate @submit.prevent="submit" @input="validationError=''">
      <header class="listening-input__header">
        <h2 id="listening-input-title">{{ title }}</h2>
        <button type="button" class="listening-input__icon listening-input__close" title="关闭" aria-label="关闭" @click="close"><X :size="18" /></button>
      </header>
      <div class="listening-input__body">
        <template v-if="mode==='settings'">
          <div class="listening-input__field">
            <label for="listening-name">你的昵称</label>
            <div class="listening-input__control"><UserRound :size="17" :stroke-width="1.6" aria-hidden="true" /><input id="listening-name" v-model="draftName" maxlength="24" autocomplete="nickname" placeholder="输入昵称" :disabled="blocked||Boolean(lobby.room)" required /></div>
          </div>
          <div class="listening-input__field">
            <label for="listening-server">一起听服务地址</label>
            <div class="listening-input__control"><Link2 :size="17" :stroke-width="1.6" aria-hidden="true" /><input id="listening-server" v-model="draftServer" type="url" spellcheck="false" placeholder="留空使用默认地址" :disabled="blocked||Boolean(lobby.room)" /></div>
          </div>
          <p v-if="lobby.room" class="listening-input__note">退出房间后可更换昵称和地址</p>
        </template>
        <div v-else-if="mode==='code'" class="listening-input__field">
          <label for="listening-invitation" class="listening-input__label--hidden">房间码或邀请信息</label>
          <div class="listening-input__control"><KeyRound :size="17" :stroke-width="1.6" aria-hidden="true" /><input id="listening-invitation" v-model="lobby.invitation" placeholder="输入房间码或粘贴邀请" :disabled="blocked" required /></div>
        </div>
        <div v-else-if="mode==='search'" class="listening-input__field">
          <label for="listening-query" class="listening-input__label--hidden">搜索房间、昵称或歌曲</label>
          <div class="listening-input__control"><Search :size="17" :stroke-width="1.6" aria-hidden="true" /><input id="listening-query" v-model="draftQuery" type="search" placeholder="房间 / 昵称 / 歌曲" /></div>
        </div>
        <div v-else class="listening-input__field">
          <label for="listening-copy">复制这段邀请，发给好友</label>
          <div class="listening-input__control listening-input__control--multiline"><textarea id="listening-copy" :value="lobby.copyFallback" readonly rows="4" @focus="$event.target.select()" /></div>
        </div>
        <p v-if="validationError||(mode==='code'&&lobby.state.error)" class="listening-input__error" role="alert">{{ validationError||lobby.state.error }}</p>
      </div>
      <footer v-if="mode!=='copy'" class="listening-input__footer"><button type="submit" class="listening-input__confirm" :disabled="blocked||(mode==='settings'&&Boolean(lobby.room))" :aria-busy="blocked"><Loader2 v-if="blocked" :size="16" class="listening-input__spin" aria-hidden="true" /><span>{{ blocked&&mode==='code' ? '正在加入…' : submitLabel }}</span></button></footer>
    </form>
  </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { KeyRound, Link2, Loader2, Search, UserRound, X } from 'lucide-vue-next'
import { writeStorage } from '../../utils/storage'
import { SCREEN_INPUT_SIZE } from './createScreenProjection.js'
import '../../styles/listening-room.css'
const props=defineProps({lobby:{type:Object,required:true},mode:{type:String,required:true},placement:{type:Object,default:null}})
const emit=defineEmits(['close'])
const lobby=props.lobby,dialog=ref(null),draftName=ref(lobby.name),draftServer=ref(lobby.serverUrl),draftQuery=ref(lobby.query)
const validationError=ref('')
const screenStyle=computed(()=>({width:`${SCREEN_INPUT_SIZE}px`,height:`${SCREEN_INPUT_SIZE}px`,transform:props.placement?.transform,visibility:props.placement?'visible':'hidden'}))
const blocked=computed(()=>lobby.busy||lobby.state.connecting)
const title=computed(()=>({code:'加入房间',settings:'昵称与连接设置',search:'搜索房间',copy:'邀请好友'}[props.mode]))
const submitLabel=computed(()=>({code:'加入房间',settings:'保存设置',search:'搜索房间'}[props.mode]))
function close(){emit('close')}
function onKey(event){
  if(event.isComposing)return
  if(event.key==='Escape'){event.preventDefault();close();return}
  if(event.key!=='Tab')return
  const fields=Array.from(dialog.value.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled)'))
  const first=fields[0],last=fields.at(-1)
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus({preventScroll:true})}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus({preventScroll:true})}
}
async function submit(){
  if(blocked.value)return
  validationError.value=''
  const invalid=dialog.value.querySelector('input:invalid')
  if(invalid){validationError.value=invalid.validationMessage;invalid.focus({preventScroll:true});return}
  if(props.mode==='code'){if(await lobby.joinInvitation())close();return}
  if(props.mode==='settings'){
    if(lobby.room)return
    const name=draftName.value.trim()
    if(!name){validationError.value='先填写一个昵称吧';dialog.value.querySelector('#listening-name')?.focus({preventScroll:true});return}
    lobby.name=name;lobby.serverUrl=draftServer.value.trim()
    writeStorage('lanyin.listening.name',name);writeStorage('lanyin.listening.server',lobby.serverUrl)
  }else if(props.mode==='search')lobby.query=draftQuery.value
  close()
}
async function focusInput(){await nextTick();if(props.placement)(dialog.value?.querySelector('input:not(:disabled),textarea')||dialog.value)?.focus({preventScroll:true})}
onMounted(focusInput)
watch(()=>Boolean(props.placement),visible=>{if(visible)focusInput()})
</script>
