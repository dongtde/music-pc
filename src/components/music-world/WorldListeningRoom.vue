<template>
  <dialog ref="dialog" class="listening-dialog" aria-labelledby="listening-title" @cancel.prevent="emit('close')" @click="backdropClick" @keydown.stop>
    <div class="listening-dialog__body">
      <header class="listening-dialog__header">
        <div class="listening-dialog__identity">
          <span class="listening-dialog__record" aria-hidden="true"><Headphones :size="23" :stroke-width="1.6" /></span>
          <div>
            <span class="listening-dialog__eyebrow">澜音 · 音乐房间</span>
            <h2 id="listening-title">此刻，一起听。</h2>
          </div>
        </div>
        <button type="button" class="listening-dialog__close" aria-label="关闭一起听面板" @click="emit('close')"><X :size="20" /></button>
      </header>

      <template v-if="room">
        <div class="listening-invite">
          <div class="listening-invite__code"><span>房间码</span><strong>{{ room.id }}</strong></div>
          <button type="button" class="listening-button listening-button--soft" aria-live="polite" @click="copyInvitation"><Check v-if="copied" :size="17" /><Copy v-else :size="17" />{{ copied ? '已复制' : '复制邀请' }}</button>
        </div>
        <div class="listening-current" :class="{'is-playing':state.syncStatus==='playing'}">
          <img v-if="room.playback.track?.coverUrl" :src="room.playback.track.coverUrl" alt="" />
          <span v-else class="listening-current__disc"><Disc3 :size="29" :stroke-width="1.4" /></span>
          <div class="listening-current__track">
            <strong :title="room.playback.track?.name">{{ room.playback.track?.name || '还没有歌曲' }}</strong>
            <span v-if="room.playback.track?.artist || !room.playback.track" :title="room.playback.track?.artist">{{ room.playback.track?.artist || '在终端点歌，一起听' }}</span>
          </div>
          <span v-if="room.playback.track" class="listening-current__state" role="status"><AudioLines v-if="state.syncStatus==='playing'" :size="17" aria-hidden="true" />{{ playbackLabel }}</span>
        </div>
        <div class="listening-members-heading">
          <span>房间成员</span>
          <span class="listening-members-heading__count" aria-live="polite"><UsersRound :size="15" aria-hidden="true" /><template v-if="onlineCount < room.members.length">{{ onlineCount }} 在线 · </template>{{ room.members.length }} / {{ capacity }}</span>
        </div>
        <div class="listening-members" role="group" aria-label="房间成员" tabindex="0">
          <div v-for="member in room.members" :key="member.id" class="listening-member">
            <span class="listening-avatar" :class="{'listening-avatar--host':member.id===room.hostId}">
              {{ Array.from(member.name)[0] }}
              <span class="listening-member__status" :class="{'is-pending':!member.connected || member.error || member.buffering || (room.playback.track && !member.ready)}" role="img" :aria-label="memberStatus(member)" :title="memberStatus(member)" />
            </span>
            <div class="listening-member__body">
              <div class="listening-member__name">
                <strong :title="member.name">{{ member.name }}</strong>
                <span v-if="member.id===state.memberId" class="listening-member__self">你</span>
                <span v-if="member.id===room.hostId" class="listening-member__host" title="房主"><Crown :size="15" role="img" aria-label="房主" /></span>
              </div>
              <span v-if="!member.connected || member.error || member.buffering || (room.playback.track && !member.ready)" class="listening-member__issue">{{ memberStatus(member) }}</span>
            </div>
          </div>
          <button v-if="room.members.length===1 && room.members.length<capacity" type="button" class="listening-member listening-member--empty" @click="copyInvitation">
            <span class="listening-avatar"><Plus :size="20" /></span><strong>{{ copied ? '邀请已复制' : '邀请好友' }}</strong>
          </button>
        </div>
      </template>

      <form v-else class="listening-form" @submit.prevent="submit">
        <div class="listening-tabs" role="group" aria-label="房间操作">
          <button type="button" :aria-pressed="tab==='create'" :disabled="busy" @click="tab='create'"><Plus :size="17" aria-hidden="true" />创建房间</button>
          <button type="button" :aria-pressed="tab==='join'" :disabled="busy" @click="tab='join'"><UsersRound :size="17" aria-hidden="true" />加入房间</button>
        </div>
        <div class="listening-field">
          <label for="listening-name">你的昵称</label>
          <div class="listening-name-field">
            <UserRound :size="18" aria-hidden="true" />
            <input id="listening-name" v-model="name" name="nickname" maxlength="24" autocomplete="nickname" placeholder="输入昵称" :disabled="busy" required />
          </div>
        </div>
        <template v-if="tab==='join'">
          <section class="listening-directory" aria-labelledby="listening-directory-title">
            <div class="listening-directory__header">
              <h3 id="listening-directory-title">已创建的房间</h3>
              <button type="button" class="listening-directory__refresh" aria-label="刷新房间列表" title="刷新房间列表" :disabled="directoryLoading || busy" @click="refreshDirectory"><RefreshCw :size="17" :class="{'listening-spin':directoryLoading}" /></button>
            </div>
            <div v-if="directoryLoading && !availableRooms.length" class="listening-directory__status" role="status"><Loader2 :size="24" class="listening-spin" aria-hidden="true" /><p>正在查找房间…</p></div>
            <div v-else-if="directoryError" class="listening-directory__status listening-directory__status--error" role="alert"><WifiOff :size="24" aria-hidden="true" /><p>{{ directoryError }}</p></div>
            <ul v-else-if="availableRooms.length" class="listening-directory__list" aria-label="已创建的房间列表" tabindex="0">
              <li v-for="listed in availableRooms" :key="listed.id">
                <button type="button" class="listening-room-option" :class="{'is-playing':listed.playing}" :data-room-id="listed.id" :aria-label="'加入 ' + listed.hostName + ' 的房间 ' + listed.id" :disabled="busy || !listed.joinable" @click="joinListedRoom(listed)">
                  <span class="listening-room-option__icon"><AudioLines v-if="listed.playing" :size="21" aria-hidden="true" /><Headphones v-else :size="21" aria-hidden="true" /></span>
                  <span class="listening-room-option__body">
                    <strong :title="listed.hostName + ' 的房间'">{{ listed.hostName }} 的房间</strong>
                    <span :title="directoryTrackLabel(listed)">{{ listed.track?.name || '等待选歌' }}<template v-if="listed.track?.artist"> · {{ listed.track.artist }}</template></span>
                  </span>
                  <span class="listening-room-option__aside">
                    <span class="listening-room-option__count"><UsersRound :size="13" aria-hidden="true" />{{ listed.memberCount }} / {{ listed.capacity }}</span>
                    <span class="listening-room-option__action">{{ listed.joinable ? '加入' : listed.unavailableReason === 'full' ? '已满' : '重连中' }}<ArrowUpRight v-if="listed.joinable" :size="16" aria-hidden="true" /></span>
                  </span>
                </button>
              </li>
            </ul>
            <div v-else class="listening-directory__status" role="status"><Headphones :size="27" :stroke-width="1.4" aria-hidden="true" /><p>暂时没有房间</p><button type="button" class="listening-directory__create" @click="tab='create'">创建一个，邀请好友<ArrowUpRight :size="15" aria-hidden="true" /></button></div>
          </section>
          <div class="listening-field listening-manual">
            <label for="listening-invitation">房间码或邀请信息</label>
            <div class="listening-manual__row">
              <textarea id="listening-invitation" v-model="invitation" name="invitation" rows="1" autocomplete="off" spellcheck="false" placeholder="粘贴邀请或房间码" :disabled="busy" required />
              <button class="listening-button listening-button--primary" type="submit" :disabled="busy || state.connecting"><Loader2 v-if="busy || state.connecting" :size="17" class="listening-spin" aria-hidden="true" />{{ busy || state.connecting ? '连接中…' : '加入房间' }}<ArrowUpRight v-if="!busy && !state.connecting" :size="17" aria-hidden="true" /></button>
            </div>
          </div>
        </template>
        <button v-else class="listening-button listening-button--primary listening-create-button" type="submit" :disabled="busy || state.connecting"><Loader2 v-if="busy || state.connecting" :size="18" class="listening-spin" aria-hidden="true" /><Headphones v-else :size="18" aria-hidden="true" /><span>{{ busy || state.connecting ? '正在连接…' : '创建房间' }}</span><ArrowUpRight v-if="!busy && !state.connecting" :size="18" aria-hidden="true" /></button>
        <details class="listening-connection" :open="connectionOpen">
          <summary :title="serverLabel"><span><Settings2 :size="16" aria-hidden="true" />连接设置</span><ChevronDown :size="16" aria-hidden="true" /></summary>
          <div class="listening-field">
            <label for="listening-server">连接地址</label>
            <input id="listening-server" v-model="serverUrl" type="url" placeholder="http://192.168.1.10:3030" autocomplete="off" spellcheck="false" :disabled="busy" />
            <p>和好友连接同一地址，或直接粘贴完整邀请。</p>
          </div>
        </details>
      </form>

      <div v-if="state.error || state.localError || room?.error" class="listening-error" role="alert"><WifiOff :size="17" /><p>{{ state.error || state.localError || room?.error }}</p></div>
      <p v-if="state.notice && !room" class="listening-notice" role="status">{{ state.notice }}</p>
      <div v-if="copyFallback" class="listening-copy-fallback"><label for="listening-copy">请复制以下邀请信息</label><textarea id="listening-copy" :value="copyFallback" rows="3" readonly @focus="$event.target.select()" /></div>
      <footer v-if="room" class="listening-dialog__footer">
        <span class="listening-connection-state" :title="state.connected && state.latency!==null ? '延迟 ' + state.latency + ' ms' : undefined"><i :class="{'is-connected':state.connected}" />{{ state.connected ? '已连接' : '正在重连' }}</span>
        <div class="listening-dialog__actions">
          <button v-if="state.autoplayBlocked" type="button" class="listening-button listening-button--soft" @click="store.enableAudio()">启用声音</button>
          <button v-else-if="state.localError && state.connected" type="button" class="listening-button listening-button--soft" @click="store.retryLocal()">重新加载</button>
          <button v-if="room.error && state.connected" type="button" class="listening-button listening-button--soft" @click="store.command('retry')">重新同步</button>
          <button type="button" class="listening-button listening-button--leave" :disabled="busy" @click="leave">{{ isHost ? '结束一起听' : '退出房间' }}</button>
        </div>
      </footer>
    </div>
  </dialog>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowUpRight, AudioLines, Check, ChevronDown, Copy, Crown, Disc3, Headphones, Loader2, Plus, RefreshCw, Settings2, UserRound, UsersRound, WifiOff, X } from 'lucide-vue-next'
import { useListeningRoomStore } from '../../stores/listeningRoom'
import { writeStorage } from '../../utils/storage'
import { fetchListeningRooms } from '../../services/listeningRoomDirectory.js'
import '../../styles/listening-room.css'

const props = defineProps({ mode: { type: String, default: 'create' }, displayName: { type: String, default: '' } })
const emit = defineEmits(['close'])
const store = useListeningRoomStore(), state = store.state
const dialog = ref(null), tab = ref(props.mode === 'join' ? 'join' : 'create'), busy = ref(false)
const name = ref(state.name || props.displayName || '音乐同伴'), invitation = ref(''), serverUrl = ref(state.serverUrl)
const copied = ref(false), copyFallback = ref(''), connectionOpen = ref(false)
const availableRooms = ref([]), directoryServer = ref(''), directoryError = ref(''), directoryLoading = ref(false)
const room = computed(() => state.room), isHost = computed(() => room.value?.hostId === state.memberId)
const capacity = computed(() => room.value?.capacity || 10)
const onlineCount = computed(() => room.value?.members.filter(member => member.connected).length || 0)
const serverLabel = computed(() => { try { return new URL(serverUrl.value).host } catch { return '填写连接地址' } })
const playbackLabel = computed(() => ({ idle:'等待选歌', waiting:'等待准备', loading:'加载歌曲', scheduled:'即将同步', playing:'同步播放中', paused:'已暂停', reconnecting:'正在重连', error:'需要重试' }[state.syncStatus] || '等待同步'))
let copiedTimer, directoryTimer, directoryController, directoryVersion = 0, mounted = false
const canDiscover = () => mounted && tab.value === 'join' && !room.value && !busy.value && !document.hidden
function stopDirectory() {
  directoryVersion++; clearTimeout(directoryTimer); directoryTimer = null
  directoryController?.abort(); directoryController = null; directoryLoading.value = false
}
function startDirectory(delay = 0, reset = false) {
  stopDirectory()
  if (reset) { availableRooms.value = []; directoryServer.value = ''; directoryError.value = '' }
  if (!canDiscover()) return
  if (delay) directoryTimer = setTimeout(refreshDirectory, delay)
  else void refreshDirectory()
}
async function refreshDirectory() {
  stopDirectory()
  if (!canDiscover()) return
  const version = directoryVersion, controller = new AbortController()
  directoryController = controller; directoryLoading.value = true; directoryError.value = ''
  try {
    const result = await fetchListeningRooms(serverUrl.value, { signal: controller.signal })
    if (version !== directoryVersion || !canDiscover()) return
    availableRooms.value = result.rooms; directoryServer.value = result.serverUrl
  } catch (error) {
    if (version !== directoryVersion || controller.signal.aborted) return
    availableRooms.value = []; directoryServer.value = ''; directoryError.value = error.message
  } finally {
    if (version === directoryVersion) {
      directoryLoading.value = false; directoryController = null
      if (canDiscover()) directoryTimer = setTimeout(refreshDirectory, 5000)
    }
  }
}
function directoryTrackLabel(listed) {
  if (!listed.track) return '等待选歌'
  const status = listed.preparing ? '准备中' : listed.playing ? '正在播放' : '已暂停'
  return `${status} · ${listed.track.name}${listed.track.artist ? ` · ${listed.track.artist}` : ''}`
}
async function joinListedRoom(listed) {
  if (busy.value || room.value || !listed.joinable || !directoryServer.value) return
  if (dialog.value.querySelector('#listening-name')?.reportValidity() === false) return
  const endpoint = directoryServer.value
  invitation.value = listed.id
  await enterRoom('join', { serverUrl: endpoint, invitation: listed.id })
}
function onVisibilityChange() { startDirectory() }
watch([tab, serverUrl, () => room.value?.id, busy], (values, previous) => {
  const addressChanged = values[1] !== previous[1]
  startDirectory(addressChanged ? 500 : 0, addressChanged || values[0] !== previous[0])
}, { flush: 'sync' })
function memberStatus(member) {
  if (!member.connected) return '重连中'
  if (member.error) return '加载失败'
  if (!room.value.playback.track) return '已加入'
  if (member.buffering) return '缓冲中'
  return member.ready ? '已准备' : '准备中'
}
async function submit() {
  await enterRoom(tab.value, { serverUrl: serverUrl.value, invitation: invitation.value })
}
async function enterRoom(mode, options) {
  busy.value = true; copyFallback.value = ''
  try {
    const ok = await store[mode]({ ...options, name: name.value })
    if (ok) { serverUrl.value = state.serverUrl; writeStorage('lanyin.listening.server', state.serverUrl) }
    else if (/连接|地址/.test(state.error)) connectionOpen.value = true
  } finally { busy.value = false }
}
async function copyInvitation() {
  const value = store.invitation()
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value)
    else {
      const input = document.createElement('textarea'); input.value = value; input.style.position = 'fixed'; input.style.opacity = '0'
      dialog.value.appendChild(input); input.select(); const success = document.execCommand('copy'); input.remove()
      if (!success) throw new Error('clipboard unavailable')
    }
    copied.value = true; clearTimeout(copiedTimer); copiedTimer = setTimeout(() => copied.value = false, 2500)
  } catch { copyFallback.value = value; await nextTick(); dialog.value.querySelector('#listening-copy')?.focus() }
}
async function leave() { busy.value = true; try { await store.leave() } finally { busy.value = false } }
function backdropClick(event) {
  if (event.target !== dialog.value) return
  const rect = dialog.value.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) emit('close')
}
onMounted(() => {
  mounted = true; dialog.value.showModal(); startDirectory()
  document.addEventListener('visibilitychange', onVisibilityChange)
  nextTick(() => dialog.value.querySelector(room.value ? '.listening-dialog__close' : '#listening-name')?.focus())
})
onBeforeUnmount(() => {
  mounted = false; stopDirectory(); clearTimeout(copiedTimer)
  document.removeEventListener('visibilitychange', onVisibilityChange); dialog.value?.close()
})
</script>
