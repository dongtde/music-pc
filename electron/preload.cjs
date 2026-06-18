const { contextBridge, ipcRenderer } = require('electron');

function createSubscription(channel, listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }

  const wrappedListener = (_event, payload) => listener(payload);
  ipcRenderer.on(channel, wrappedListener);

  return () => {
    ipcRenderer.removeListener(channel, wrappedListener);
  };
}

contextBridge.exposeInMainWorld('mappicDesktop', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  desktopLyrics: {
    show: () => ipcRenderer.invoke('desktop-lyrics:show'),
    hide: () => ipcRenderer.invoke('desktop-lyrics:hide'),
    toggle: () => ipcRenderer.invoke('desktop-lyrics:toggle'),
    getWindowState: () =>
      ipcRenderer.invoke('desktop-lyrics:get-window-state'),
    ready: () => ipcRenderer.send('desktop-lyrics:ready'),
    publishState: (payload) =>
      ipcRenderer.send('desktop-lyrics:state', payload),
    setLocked: (locked) =>
      ipcRenderer.send('desktop-lyrics:set-locked', Boolean(locked)),
    sendCommand: (command) =>
      ipcRenderer.send('desktop-lyrics:command', command),
    onState: (listener) =>
      createSubscription('desktop-lyrics:state', listener),
    onWindowState: (listener) =>
      createSubscription('desktop-lyrics:window-state', listener),
    onCommand: (listener) =>
      createSubscription('desktop-lyrics:command', listener),
  },
});
