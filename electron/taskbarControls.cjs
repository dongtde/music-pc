const { nativeImage } = require('electron');
const { sendToWindow } = require('./windowUtils.cjs');

const isWindows = process.platform === 'win32';

const BUTTON_SIZE = 16;
const ICON_COLOR = [255, 255, 255, 255];
const APP_TITLE = '\u6f9c\u97f3';

function createTaskbarControlsManager({ ipcMain, getMainWindow }) {
  let registered = false;
  let currentState = {
    available: isWindows,
    isPlaying: false,
    isLoading: false,
    title: '',
    artist: '',
    hasTrack: false,
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
    const transportFlags = currentState.isLoading ? ['disabled'] : ['enabled'];
    const playFlags = currentState.isLoading ? ['disabled'] : ['enabled'];

    try {
      window.setThumbarButtons([
        {
          tooltip: '\u4e0a\u4e00\u9996',
          icon: icons.previous,
          flags: transportFlags,
          click: () => sendCommand('previous'),
        },
        {
          tooltip: currentState.isLoading
            ? '\u52a0\u8f7d\u4e2d'
            : playPauseTooltip,
          icon: playPauseIcon,
          flags: playFlags,
          click: () => sendCommand('toggle-play'),
        },
        {
          tooltip: '\u4e0b\u4e00\u9996',
          icon: icons.next,
          flags: transportFlags,
          click: () => sendCommand('next'),
        },
      ]);

      window.setTitle(createWindowTitle(currentState));
      applyThumbnailClip(window, currentState.thumbnailClip);
      window.setThumbnailToolTip(createThumbnailTooltip(currentState));
    } catch (error) {
      console.warn('[taskbar-controls:update]', error);
    }
  }

  function sendCommand(action) {
    if (currentState.isLoading) {
      return;
    }

    sendToWindow(getMainWindow(), 'taskbar-controls:command', { action });
  }

  function createPublicState() {
    return {
      available: isWindows,
      isPlaying: currentState.isPlaying,
      isLoading: currentState.isLoading,
      hasTrack: currentState.hasTrack,
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
}

function normalizeState(payload = {}, fallback = {}) {
  const track = payload.track || {};
  const title = cleanText(track.name || payload.title);
  const artist = cleanText(track.artist || payload.artist);
  const thumbnailClip = normalizeThumbnailClip(
    payload.thumbnailClip,
    fallback.thumbnailClip,
  );

  return {
    available: isWindows,
    isPlaying: Boolean(payload.playback?.isPlaying ?? payload.isPlaying),
    isLoading: Boolean(payload.playback?.isLoading ?? payload.isLoading),
    title,
    artist,
    hasTrack: Boolean(track.id || title),
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
