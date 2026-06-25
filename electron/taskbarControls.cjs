const { nativeImage } = require('electron');
const { sendToWindow } = require('./windowUtils.cjs');

const isWindows = process.platform === 'win32';

const BUTTON_SIZE = 16;
const ICON_COLOR = [255, 255, 255, 255];
const APP_TITLE = '\u6f9c\u97f3';
const ENABLED_BUTTON_FLAGS = ['enabled'];
const COMMAND_RESULT_TIMEOUT_MS = 1500;
const ACTIVATION_GUARD_DELAYS_MS = [0, 50, 150, 350];

function createTaskbarControlsManager({ ipcMain, getMainWindow }) {
  let registered = false;
  let commandSequence = 0;
  let lastFocusedAt = 0;
  let lastBackgroundSnapshot = null;
  const pendingCommands = new Map();
  let currentState = {
    available: isWindows,
    isPlaying: false,
    isLoading: false,
    title: '',
    artist: '',
    hasTrack: false,
    canPrevious: false,
    canNext: false,
    thumbnailClip: null,
  };

  const icons = createIcons();

  function registerIpc() {
    if (registered) {
      return;
    }

    registered = true;

    ipcMain.on('taskbar-controls:state', (event, payload) => {
      if (!isTrustedSender(event)) {
        return;
      }

      updateState(payload);
    });

    ipcMain.handle('taskbar-controls:get-state', (event) => {
      if (!isTrustedSender(event)) {
        return createPublicState();
      }

      return createPublicState();
    });

    ipcMain.on('taskbar-controls:command-result', (event, payload) => {
      if (!isTrustedSender(event)) {
        return;
      }

      completeCommand(payload);
    });
  }

  function updateState(payload = {}) {
    currentState = normalizeState(payload, currentState);
    updateWindowControls(getMainWindow());
  }

  function attachToWindow(window) {
    updateWindowControls(window);

    if (!window || window.isDestroyed()) {
      return;
    }

    captureBackgroundSnapshot(window);
    window.on('blur', () => captureBackgroundSnapshot(window));
    window.on('minimize', () => captureBackgroundSnapshot(window));
    window.on('hide', () => captureBackgroundSnapshot(window));
    window.on('focus', () => {
      lastFocusedAt = Date.now();
    });
    window.on('restore', () => {
      if (safelyReadWindowState(window, 'isFocused', false)) {
        lastFocusedAt = Date.now();
        return;
      }

      captureBackgroundSnapshot(window);
    });

    window.webContents?.once?.('did-finish-load', () => {
      updateWindowControls(window);
    });
  }

  function clear() {
    const window = getMainWindow();

    if (!window || window.isDestroyed()) {
      return;
    }

    try {
      window.setThumbarButtons([]);
      window.setThumbnailToolTip('');
    } catch (error) {
      console.warn('[taskbar-controls:clear]', error);
    }
  }

  function updateWindowControls(window) {
    if (!isWindows || !window || window.isDestroyed()) {
      return;
    }

    const playPauseIcon = currentState.isPlaying ? icons.pause : icons.play;
    const playPauseTooltip = currentState.isPlaying
      ? '\u6682\u505c'
      : '\u64ad\u653e';
    try {
      const installed = window.setThumbarButtons([
        {
          tooltip: '\u4e0a\u4e00\u9996',
          icon: icons.previous,
          flags: ENABLED_BUTTON_FLAGS,
          click: () => sendCommand('previous'),
        },
        {
          tooltip: currentState.isLoading
            ? '\u52a0\u8f7d\u4e2d'
            : playPauseTooltip,
          icon: playPauseIcon,
          flags: ENABLED_BUTTON_FLAGS,
          click: () => sendCommand('toggle-play'),
        },
        {
          tooltip: '\u4e0b\u4e00\u9996',
          icon: icons.next,
          flags: ENABLED_BUTTON_FLAGS,
          click: () => sendCommand('next'),
        },
      ]);

      if (!installed) {
        console.warn('[taskbar-controls:update] failed to install buttons');
      }

      window.setTitle(createWindowTitle(currentState));
      applyThumbnailClip(window, currentState.thumbnailClip);
      window.setThumbnailToolTip(createThumbnailTooltip(currentState));
    } catch (error) {
      console.warn('[taskbar-controls:update]', error);
    }
  }

  function sendCommand(action) {
    const window = getMainWindow();

    if (!window || window.isDestroyed() || window.webContents?.isDestroyed()) {
      return;
    }

    const activationSnapshot = getCommandActivationSnapshot(window);
    guardAgainstForegroundActivation(window, activationSnapshot);

    if (currentState.isLoading) {
      return;
    }

    const command = {
      id: createCommandId(action),
      action,
      requestedAt: Date.now(),
    };

    trackPendingCommand(command);
    sendToWindow(window, 'taskbar-controls:command', command);
    dispatchCommandEvent(window, command);
  }

  function createPublicState() {
    return {
      available: isWindows,
      isPlaying: currentState.isPlaying,
      isLoading: currentState.isLoading,
      hasTrack: currentState.hasTrack,
      canPrevious: currentState.canPrevious,
      canNext: currentState.canNext,
    };
  }

  function isTrustedSender(event) {
    const window = getMainWindow();

    return Boolean(
      window &&
        !window.isDestroyed() &&
        event?.sender &&
        event.sender === window.webContents,
    );
  }

  return {
    registerIpc,
    attachToWindow,
    updateState,
    updateWindowControls,
    clear,
  };

  function createCommandId(action) {
    commandSequence += 1;
    return `${Date.now()}-${commandSequence}-${action}`;
  }

  function trackPendingCommand(command) {
    const timeout = setTimeout(() => {
      pendingCommands.delete(command.id);
      console.warn('[taskbar-controls:command:timeout]', command.action);
    }, COMMAND_RESULT_TIMEOUT_MS);

    pendingCommands.set(command.id, {
      action: command.action,
      timeout,
    });
  }

  function completeCommand(payload = {}) {
    const id = cleanText(payload.id);

    if (!id) {
      return;
    }

    const pending = pendingCommands.get(id);

    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    pendingCommands.delete(id);

    if (payload.handled === false) {
      console.warn('[taskbar-controls:command:unhandled]', pending.action);
    }
  }

  function captureBackgroundSnapshot(window) {
    const snapshot = createActivationSnapshot(window);

    if (!snapshot) {
      return;
    }

    if (!snapshot.wasFocused || snapshot.wasMinimized || !snapshot.wasVisible) {
      lastBackgroundSnapshot = {
        ...snapshot,
        capturedAt: Date.now(),
      };
    }
  }

  function getCommandActivationSnapshot(window) {
    const snapshot = createActivationSnapshot(window);

    if (!snapshot) {
      return null;
    }

    if (!snapshot.wasFocused) {
      lastBackgroundSnapshot = {
        ...snapshot,
        capturedAt: Date.now(),
      };
      return snapshot;
    }

    if (
      lastBackgroundSnapshot &&
      lastFocusedAt &&
      Date.now() - lastFocusedAt < 1000
    ) {
      return lastBackgroundSnapshot;
    }

    return snapshot;
  }
}

function dispatchCommandEvent(window, command) {
  const commandJson = JSON.stringify(command).replace(/</g, '\\u003c');
  const script = [
    'window.dispatchEvent(new CustomEvent("lanyin:taskbar-command",',
    `{ detail: ${commandJson} }));`,
    'true;',
  ].join('');

  window.webContents
    .executeJavaScript(script, true)
    .catch((error) => {
      console.warn('[taskbar-controls:command:event-fallback]', error);
    });
}

function createActivationSnapshot(window) {
  if (!window || window.isDestroyed()) {
    return null;
  }

  return {
    wasFocused: safelyReadWindowState(window, 'isFocused', true),
    wasMinimized: safelyReadWindowState(window, 'isMinimized', false),
    wasVisible: safelyReadWindowState(window, 'isVisible', true),
  };
}

function guardAgainstForegroundActivation(window, snapshot) {
  if (!window || window.isDestroyed() || !snapshot || snapshot.wasFocused) {
    return;
  }

  ACTIVATION_GUARD_DELAYS_MS.forEach((delay) => {
    setTimeout(() => restoreBackgroundWindowState(window, snapshot), delay);
  });
}

function restoreBackgroundWindowState(window, snapshot) {
  if (!window || window.isDestroyed()) {
    return;
  }

  if (!snapshot.wasVisible && safelyReadWindowState(window, 'isVisible', false)) {
    window.hide();
    return;
  }

  if (
    snapshot.wasMinimized &&
    !safelyReadWindowState(window, 'isMinimized', false)
  ) {
    window.minimize();
    return;
  }

  if (!snapshot.wasFocused && safelyReadWindowState(window, 'isFocused', false)) {
    window.blur();
  }
}

function safelyReadWindowState(window, methodName, fallback) {
  try {
    return typeof window?.[methodName] === 'function'
      ? Boolean(window[methodName]())
      : fallback;
  } catch {
    return fallback;
  }
}

function normalizeState(payload = {}, fallback = {}) {
  const track = payload.track || {};
  const title = cleanText(track.name || payload.title);
  const artist = cleanText(track.artist || payload.artist);
  const controls = payload.controls || {};
  const thumbnailClip = normalizeThumbnailClip(
    payload.thumbnailClip,
    fallback.thumbnailClip,
  );
  const hasTrack = Boolean(track.id || title);

  return {
    available: isWindows,
    isPlaying: Boolean(payload.playback?.isPlaying ?? payload.isPlaying),
    isLoading: Boolean(payload.playback?.isLoading ?? payload.isLoading),
    title,
    artist,
    hasTrack,
    canPrevious: Boolean(controls.canPrevious ?? payload.canPrevious ?? hasTrack),
    canNext: Boolean(controls.canNext ?? payload.canNext ?? hasTrack),
    thumbnailClip,
  };
}

function cleanText(value) {
  return String(value ?? '').trim();
}

function createThumbnailTooltip(state) {
  if (!state.hasTrack) {
    return APP_TITLE;
  }

  if (state.title && state.artist) {
    return `${state.title} - ${state.artist}`;
  }

  return state.title || state.artist || APP_TITLE;
}

function createWindowTitle(state) {
  if (state.title && state.artist) {
    return `${state.title} - ${state.artist}`;
  }

  return state.title || state.artist || APP_TITLE;
}

function normalizeThumbnailClip(value, fallback = null) {
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const x = Math.round(Number(value.x ?? value.left));
  const y = Math.round(Number(value.y ?? value.top));
  const width = Math.round(Number(value.width));
  const height = Math.round(Number(value.height));

  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return fallback;
  }

  return {
    x,
    y,
    width,
    height,
  };
}

function applyThumbnailClip(window, thumbnailClip) {
  if (!thumbnailClip) {
    window.setThumbnailClip({ x: 0, y: 0, width: 0, height: 0 });
    return;
  }

  window.setThumbnailClip(thumbnailClip);
}

function createIcons() {
  return {
    previous: createIcon(previousSvgPath()),
    play: createIcon(playSvgPath()),
    pause: createIcon(pauseSvgPath()),
    next: createIcon(nextSvgPath()),
  };
}

function createIcon(draw) {
  const pixels = Buffer.alloc(BUTTON_SIZE * BUTTON_SIZE * 4);

  draw((x, y) => setPixel(pixels, x, y));

  return nativeImage.createFromBitmap(pixels, {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
  });
}

function setPixel(pixels, x, y) {
  if (x < 0 || x >= BUTTON_SIZE || y < 0 || y >= BUTTON_SIZE) {
    return;
  }

  const offset = (y * BUTTON_SIZE + x) * 4;
  pixels[offset] = ICON_COLOR[2];
  pixels[offset + 1] = ICON_COLOR[1];
  pixels[offset + 2] = ICON_COLOR[0];
  pixels[offset + 3] = ICON_COLOR[3];
}

function previousSvgPath() {
  return (point) => {
    drawRect(point, 3, 3, 2, 10);
    drawTriangleLeft(point, 5, 8, 8);
    drawTriangleLeft(point, 9, 8, 8);
  };
}

function playSvgPath() {
  return (point) => {
    drawTriangleRight(point, 5, 8, 9);
  };
}

function pauseSvgPath() {
  return (point) => {
    drawRect(point, 5, 3, 3, 10);
    drawRect(point, 10, 3, 3, 10);
  };
}

function nextSvgPath() {
  return (point) => {
    drawTriangleRight(point, 3, 8, 8);
    drawTriangleRight(point, 7, 8, 8);
    drawRect(point, 12, 3, 2, 10);
  };
}

function drawRect(point, x, y, width, height) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      point(column, row);
    }
  }
}

function drawTriangleRight(point, left, centerY, height) {
  const half = Math.floor(height / 2);

  for (let row = 0; row < height; row += 1) {
    const y = centerY - half + row;
    const span = row <= half ? row + 1 : height - row;

    for (let column = 0; column < span; column += 1) {
      point(left + column, y);
    }
  }
}

function drawTriangleLeft(point, right, centerY, height) {
  const half = Math.floor(height / 2);

  for (let row = 0; row < height; row += 1) {
    const y = centerY - half + row;
    const span = row <= half ? row + 1 : height - row;

    for (let column = 0; column < span; column += 1) {
      point(right - column, y);
    }
  }
}

module.exports = {
  createTaskbarControlsManager,
};
