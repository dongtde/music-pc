import { reactive } from 'vue'
import { readStorage, writeStorage } from '../utils/storage.js'

const state = reactive({
  mode: readStorage('lanyin.environment', '2d') === '3d' ? '3d' : '2d',
  returnPath: readStorage('lanyin.environment.return', '/home'),
})

export function useEnvironmentStore() {
  function setMode(mode) {
    state.mode = mode === '3d' ? '3d' : '2d'
    writeStorage('lanyin.environment', state.mode)
  }
  function rememberPage(path) {
    if (!path?.startsWith('/') || path.startsWith('//') || path.startsWith('/space') || path.startsWith('/desktop-lyrics')) return
    state.returnPath = path
    writeStorage('lanyin.environment.return', path)
  }
  return { state, setMode, rememberPage }
}
