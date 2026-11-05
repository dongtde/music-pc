import { reactive } from 'vue'
import { usePlayerStore } from './player'
import { createListeningRoomClient } from '../services/listeningRoomClient'
import { readStorage } from '../utils/storage'

function defaultServer() {
  const configured = import.meta.env.VITE_LISTENING_SERVER_URL || readStorage('lanyin.listening.server', '')
  if (configured) return configured
  return typeof location !== 'undefined' && /^https?:$/.test(location.protocol) ? location.origin : 'http://localhost:3030'
}
const state = reactive({
  room: null, memberId: '', connected: false, connecting: false, serverUrl: defaultServer(), name: '',
  error: '', notice: '', localError: '', autoplayBlocked: false, syncStatus: 'idle', latency: null, driftMs: 0, lanUrls: [], publicUrl: '',
})
let client
export function useListeningRoomStore() {
  client ||= createListeningRoomClient({ player: usePlayerStore(), state })
  return { state, ...client }
}
