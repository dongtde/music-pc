const { contextBridge, ipcRenderer } = require('electron');

const MAX_TASKBAR_COMMAND_QUEUE = 20;
const taskbarCommandQueue = [];
const taskbarCommandListeners = new Set();

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

function createTaskbarCommandSubscription(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }

  taskbarCommandListeners.add(listener);
  flushTaskbarCommandQueue(listener);

  return () => {
    taskbarCommandListeners.delete(listener);
  };
}

function flushTaskbarCommandQueue(listener) {
  if (!taskbarCommandQueue.length) {
    return;
  }

  const queuedCommands = taskbarCommandQueue.splice(0);

  queuedCommands.forEach((command) => {
    safelyNotifyTaskbarCommand(listener, command);
  });
}

function notifyTaskbarCommand(command) {
  if (!taskbarCommandListeners.size) {
    taskbarCommandQueue.push(command);

    if (taskbarCommandQueue.length > MAX_TASKBAR_COMMAND_QUEUE) {
      taskbarCommandQueue.shift();
    }

    return;
  }

  taskbarCommandListeners.forEach((listener) => {
    safelyNotifyTaskbarCommand(listener, command);
  });
}

function safelyNotifyTaskbarCommand(listener, command) {
  try {
    listener(command);
  } catch (error) {
    console.warn('Taskbar command listener failed:', error);
  }
}

ipcRenderer.on('taskbar-controls:command', (_event, payload) => {
  notifyTaskbarCommand(payload);
});

contextBridge.exposeInMainWorld('mappicDesktop', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  windowControls: {
    minimize: () => ipcRenderer.send('main-window:minimize'),
    toggleMaximize: () => ipcRenderer.send('main-window:toggle-maximize'),
    close: () => ipcRenderer.send('main-window:close'),
    getState: () => ipcRenderer.invoke('main-window:get-state'),
    onState: (listener) => createSubscription('main-window:state', listener),
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
    setLayout: (layout) =>
      ipcRenderer.send('desktop-lyrics:set-layout', layout),
    startDrag: () => ipcRenderer.send('desktop-lyrics:start-drag'),
    dragMove: () => ipcRenderer.send('desktop-lyrics:drag-move'),
    endDrag: () => ipcRenderer.send('desktop-lyrics:end-drag'),
    sendCommand: (command) =>
      ipcRenderer.send('desktop-lyrics:command', command),
    onState: (listener) =>
      createSubscription('desktop-lyrics:state', listener),
    onWindowState: (listener) =>
      createSubscription('desktop-lyrics:window-state', listener),
    onCommand: (listener) =>
      createSubscription('desktop-lyrics:command', listener),
  },
  taskbarControls: {
    available: process.platform === 'win32',
    publishState: (payload) =>
      ipcRenderer.send('taskbar-controls:state', payload),
    getState: () => ipcRenderer.invoke('taskbar-controls:get-state'),
    completeCommand: (payload) =>
      ipcRenderer.send('taskbar-controls:command-result', payload),
    onCommand: (listener) =>
      createTaskbarCommandSubscription(listener),
  },
});
