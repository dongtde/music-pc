const { BrowserWindow, ipcMain, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const {
  clampNumber,
  safelyCallWindowMethod,
  sendToWindow,
} = require('./windowUtils.cjs');

const DESKTOP_LYRICS_WINDOW_WIDTH = 700;
const DESKTOP_LYRICS_WINDOW_BASE_HEIGHT = 80;
const DESKTOP_LYRICS_WINDOW_MAX_HEIGHT = 108;
const DESKTOP_LYRICS_BASE_FONT_SIZE = 15;
const DESKTOP_LYRICS_ALWAYS_ON_TOP_LEVEL = 'screen-saver';
const DESKTOP_LYRICS_TOP_GUARD_INTERVAL_MS = 1200;
const DESKTOP_LYRICS_ELEVATE_RETRY_DELAYS = [0, 80, 240];
const DESKTOP_LYRICS_PERSIST_DEBOUNCE_MS = 160;
const DESKTOP_LYRICS_STATE_VERSION = 1;

function createDesktopLyricsManager({
  appProtocol,
  preloadPath,
  getMainWindow,
  openExternalUrl,
  statePath,
} = {}) {
  let desktopLyricsWindow = null;
  let desktopLyricsLocked = false;
  let desktopLyricsClickThrough = false;
  let lastDesktopLyricsPayload = null;
  let desktopLyricsDragState = null;
  let desktopLyricsTopGuardTimer = null;
  let desktopLyricsState = readPersistedState();
  let persistStateTimer = null;
  let ipcRegistered = false;
  const desktopLyricsElevateTimers = new Set();

  async function createWindow() {
    if (isOpen()) {
      elevateWindow();
      safelyCallWindowMethod(desktopLyricsWindow, 'showInactive');
      sendWindowState();
      sendPayload();
      return desktopLyricsWindow;
    }

    const bounds = getInitialBounds();

    try {
      desktopLyricsWindow = new BrowserWindow({
        ...bounds,
        minWidth: DESKTOP_LYRICS_WINDOW_WIDTH,
        maxWidth: DESKTOP_LYRICS_WINDOW_WIDTH,
        minHeight: bounds.height,
        maxHeight: bounds.height,
        title: 'Desktop lyrics',
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        hasShadow: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: true,
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
          preload: preloadPath,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          backgroundThrottling: false,
        },
      });
    } catch (error) {
      console.warn('[desktop-lyrics:create-window]', error);
      desktopLyricsWindow = null;
      desktopLyricsLocked = false;
      broadcastWindowState();
      return null;
    }

    elevateWindow();
    startTopGuard();

    try {
      desktopLyricsWindow.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true,
      });
    } catch (error) {
      console.warn('[desktop-lyrics:workspace-visibility]', error);
    }

    desktopLyricsWindow.webContents.setWindowOpenHandler(({ url }) => {
      openExternalUrl?.(url);
      return { action: 'deny' };
    });

    desktopLyricsWindow.once('ready-to-show', () => {
      safelyCallWindowMethod(desktopLyricsWindow, 'showInactive');
      scheduleElevation();
      sendWindowState();
    });

    desktopLyricsWindow.webContents.on('did-finish-load', () => {
      scheduleElevation();
      sendWindowState();
      sendPayload();
    });

    desktopLyricsWindow.on('show', () => {
      scheduleElevation();
    });

    desktopLyricsWindow.on('blur', () => {
      scheduleElevation();
    });

    desktopLyricsWindow.on('move', () => {
      scheduleElevation([0]);
      scheduleBoundsPersist();
    });

    desktopLyricsWindow.on('resize', () => {
      scheduleElevation([0]);
      scheduleBoundsPersist();
    });

    desktopLyricsWindow.on('close', () => {
      persistCurrentBounds();
      persistStateNow();
    });

    desktopLyricsWindow.on('closed', () => {
      stopTopGuard();
      desktopLyricsWindow = null;
      desktopLyricsLocked = false;
      desktopLyricsClickThrough = false;
      broadcastWindowState();
    });

    try {
      await desktopLyricsWindow.loadURL(`${appProtocol}://app/#/desktop-lyrics`);
      broadcastWindowState();
      return desktopLyricsWindow;
    } catch (error) {
      console.warn('[desktop-lyrics:load]', error);
      close();
      return null;
    }
  }

  function getInitialBounds() {
    const restoredBounds = fitBoundsToVisibleDisplay(
      normalizeBounds(desktopLyricsState.bounds),
    );

    if (restoredBounds) {
      return restoredBounds;
    }

    let workArea;

    try {
      workArea = screen.getPrimaryDisplay().workArea;
    } catch (error) {
      console.warn('[desktop-lyrics:display]', error);
      return {
        width: DESKTOP_LYRICS_WINDOW_WIDTH,
        height: DESKTOP_LYRICS_WINDOW_BASE_HEIGHT,
        x: 160,
        y: 680,
      };
    }

    const width = DESKTOP_LYRICS_WINDOW_WIDTH;
    const height = DESKTOP_LYRICS_WINDOW_BASE_HEIGHT;

    return {
      width,
      height,
      x: workArea.x + Math.round((workArea.width - width) / 2),
      y: workArea.y + Math.max(24, workArea.height - height - 92),
    };
  }

  function isOpen() {
    return Boolean(desktopLyricsWindow && !desktopLyricsWindow.isDestroyed());
  }

  function elevateWindow() {
    if (!isOpen()) {
      return;
    }

    safelyCallWindowMethod(desktopLyricsWindow, 'setSkipTaskbar', true);
    safelyCallWindowMethod(
      desktopLyricsWindow,
      'setAlwaysOnTop',
      true,
      DESKTOP_LYRICS_ALWAYS_ON_TOP_LEVEL,
    );
    safelyCallWindowMethod(desktopLyricsWindow, 'moveTop');
  }

  function scheduleElevation(delays = DESKTOP_LYRICS_ELEVATE_RETRY_DELAYS) {
    if (!isOpen()) {
      return;
    }

    clearElevationTimers();

    delays.forEach((delay) => {
      const timer = setTimeout(() => {
        desktopLyricsElevateTimers.delete(timer);
        elevateWindow();
      }, Math.max(0, Number(delay) || 0));

      desktopLyricsElevateTimers.add(timer);
    });
  }

  function clearElevationTimers() {
    desktopLyricsElevateTimers.forEach((timer) => {
      clearTimeout(timer);
    });
    desktopLyricsElevateTimers.clear();
  }

  function startTopGuard() {
    if (desktopLyricsTopGuardTimer) {
      return;
    }

    desktopLyricsTopGuardTimer = setInterval(() => {
      elevateWindow();
    }, DESKTOP_LYRICS_TOP_GUARD_INTERVAL_MS);
  }

  function stopTopGuard() {
    clearElevationTimers();

    if (!desktopLyricsTopGuardTimer) {
      return;
    }

    clearInterval(desktopLyricsTopGuardTimer);
    desktopLyricsTopGuardTimer = null;
  }

  function getWindowState() {
    const bounds = isOpen() ? desktopLyricsWindow.getBounds() : null;

    return {
      open: isOpen(),
      enabled: Boolean(desktopLyricsState.enabled),
      locked: desktopLyricsLocked,
      height: bounds?.height || DESKTOP_LYRICS_WINDOW_BASE_HEIGHT,
      bounds: normalizeBounds(bounds),
    };
  }

  function getHeightForFontSize(fontSize) {
    const normalizedFontSize = clampNumber(
      Number(fontSize),
      12,
      36,
      DESKTOP_LYRICS_BASE_FONT_SIZE,
    );
    const lineHeight = Math.ceil(normalizedFontSize * 1.08);
    const baseLineHeight = Math.ceil(DESKTOP_LYRICS_BASE_FONT_SIZE * 1.08);
    const extraLineHeight = Math.max(0, lineHeight - baseLineHeight);

    return clampNumber(
      DESKTOP_LYRICS_WINDOW_BASE_HEIGHT + extraLineHeight,
      DESKTOP_LYRICS_WINDOW_BASE_HEIGHT,
      DESKTOP_LYRICS_WINDOW_MAX_HEIGHT,
      DESKTOP_LYRICS_WINDOW_BASE_HEIGHT,
    );
  }

  function resizeForFontSize(fontSize) {
    if (!isOpen()) {
      return;
    }

    const nextHeight = getHeightForFontSize(fontSize);
    const bounds = desktopLyricsWindow.getBounds();

    setFixedHeight(nextHeight, bounds.height);

    if (bounds.height === nextHeight) {
      return;
    }

    desktopLyricsWindow.setBounds(
      {
        x: bounds.x,
        y: bounds.y + bounds.height - nextHeight,
        width: DESKTOP_LYRICS_WINDOW_WIDTH,
        height: nextHeight,
      },
      false,
    );
    persistCurrentBounds();
    broadcastWindowState();
  }

  function setFixedHeight(nextHeight, currentHeight = nextHeight) {
    if (!isOpen()) {
      return;
    }

    if (nextHeight > currentHeight) {
      desktopLyricsWindow.setMaximumSize(
        DESKTOP_LYRICS_WINDOW_WIDTH,
        nextHeight,
      );
      desktopLyricsWindow.setMinimumSize(
        DESKTOP_LYRICS_WINDOW_WIDTH,
        nextHeight,
      );
      return;
    }

    desktopLyricsWindow.setMinimumSize(
      DESKTOP_LYRICS_WINDOW_WIDTH,
      nextHeight,
    );
    desktopLyricsWindow.setMaximumSize(
      DESKTOP_LYRICS_WINDOW_WIDTH,
      nextHeight,
    );
  }

  function setClickThrough(clickThrough) {
    const nextClickThrough = Boolean(clickThrough);

    if (!isOpen()) {
      desktopLyricsClickThrough = false;
      return;
    }

    if (desktopLyricsClickThrough === nextClickThrough) {
      return;
    }

    desktopLyricsClickThrough = nextClickThrough;

    try {
      if (nextClickThrough) {
        desktopLyricsWindow.setIgnoreMouseEvents(true, { forward: true });
        return;
      }

      desktopLyricsWindow.setIgnoreMouseEvents(false);
    } catch (error) {
      console.warn('[desktop-lyrics:click-through]', error);
    }
  }

  function sendWindowState(targetWindow = desktopLyricsWindow) {
    if (!targetWindow || targetWindow.isDestroyed()) {
      return;
    }

    sendToWindow(targetWindow, 'desktop-lyrics:window-state', getWindowState());
  }

  function broadcastWindowState() {
    const state = getWindowState();

    BrowserWindow.getAllWindows().forEach((window) => {
      sendToWindow(window, 'desktop-lyrics:window-state', state);
    });
  }

  function sendPayload(targetWindow = desktopLyricsWindow) {
    if (!lastDesktopLyricsPayload || !targetWindow || targetWindow.isDestroyed()) {
      return;
    }

    sendToWindow(targetWindow, 'desktop-lyrics:state', lastDesktopLyricsPayload);
  }

  function registerIpc() {
    if (ipcRegistered) {
      return;
    }

    ipcRegistered = true;

    ipcMain.handle('desktop-lyrics:toggle', async () => {
      if (isOpen()) {
        close({ rememberEnabled: false });
        return getWindowState();
      }

      setEnabledState(true);
      await createWindow();
      return getWindowState();
    });

    ipcMain.handle('desktop-lyrics:show', async () => {
      setEnabledState(true);
      await createWindow();
      return getWindowState();
    });

    ipcMain.handle('desktop-lyrics:hide', () => {
      close({ rememberEnabled: false });
      return getWindowState();
    });

    ipcMain.handle('desktop-lyrics:get-window-state', () => getWindowState());

    ipcMain.on('desktop-lyrics:ready', (event) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      sendWindowState(senderWindow);
      sendPayload(senderWindow);
    });

    ipcMain.on('desktop-lyrics:state', (_event, payload) => {
      lastDesktopLyricsPayload = payload;
      sendPayload();
    });

    ipcMain.on('desktop-lyrics:set-locked', (_event, locked) => {
      desktopLyricsLocked = Boolean(locked);

      if (desktopLyricsLocked) {
        desktopLyricsDragState = null;
      }

      if (isOpen()) {
        safelyCallWindowMethod(
          desktopLyricsWindow,
          'setMovable',
          !desktopLyricsLocked,
        );
      }

      broadcastWindowState();
    });

    ipcMain.on('desktop-lyrics:set-layout', (event, layout = {}) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);

      if (
        !senderWindow ||
        senderWindow !== desktopLyricsWindow ||
        senderWindow.isDestroyed()
      ) {
        return;
      }

      resizeForFontSize(layout.fontSize);
    });

    ipcMain.on('desktop-lyrics:set-click-through', (event, clickThrough) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);

      if (
        !senderWindow ||
        senderWindow !== desktopLyricsWindow ||
        senderWindow.isDestroyed()
      ) {
        return;
      }

      setClickThrough(clickThrough);
    });

    ipcMain.on('desktop-lyrics:start-drag', (event) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);

      if (
        desktopLyricsLocked ||
        !senderWindow ||
        senderWindow !== desktopLyricsWindow ||
        senderWindow.isDestroyed()
      ) {
        return;
      }

      const cursorPoint = screen.getCursorScreenPoint();
      const windowBounds = senderWindow.getBounds();

      desktopLyricsDragState = {
        startCursor: cursorPoint,
        startBounds: windowBounds,
      };
      setClickThrough(false);
    });

    ipcMain.on('desktop-lyrics:drag-move', (event) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);

      if (
        desktopLyricsLocked ||
        !desktopLyricsDragState ||
        !senderWindow ||
        senderWindow !== desktopLyricsWindow ||
        senderWindow.isDestroyed()
      ) {
        return;
      }

      const cursorPoint = screen.getCursorScreenPoint();
      const nextX =
        desktopLyricsDragState.startBounds.x +
        cursorPoint.x -
        desktopLyricsDragState.startCursor.x;
      const nextY =
        desktopLyricsDragState.startBounds.y +
        cursorPoint.y -
        desktopLyricsDragState.startCursor.y;

      senderWindow.setPosition(Math.round(nextX), Math.round(nextY), false);
    });

    ipcMain.on('desktop-lyrics:end-drag', () => {
      desktopLyricsDragState = null;
      persistCurrentBounds();
      persistStateNow();
    });

    ipcMain.on('desktop-lyrics:command', (_event, command) => {
      const mainWindow = getMainWindow?.();

      if (mainWindow && !mainWindow.isDestroyed()) {
        sendToWindow(mainWindow, 'desktop-lyrics:command', command);
      }
    });
  }

  function close(options = {}) {
    const { rememberEnabled } = options;

    if (typeof rememberEnabled === 'boolean') {
      setEnabledState(rememberEnabled);
    }

    persistCurrentBounds();
    persistStateNow();

    if (!isOpen()) {
      return;
    }

    safelyCallWindowMethod(desktopLyricsWindow, 'close');
  }

  function shouldRestoreLastSession() {
    return Boolean(desktopLyricsState.enabled);
  }

  async function restoreLastSession() {
    if (!shouldRestoreLastSession()) {
      return getWindowState();
    }

    await createWindow();
    return getWindowState();
  }

  function setEnabledState(enabled) {
    const nextEnabled = Boolean(enabled);

    if (desktopLyricsState.enabled === nextEnabled) {
      return;
    }

    desktopLyricsState = {
      ...desktopLyricsState,
      enabled: nextEnabled,
    };
    persistStateNow();
    broadcastWindowState();
  }

  function scheduleBoundsPersist() {
    if (!isOpen()) {
      return;
    }

    persistCurrentBounds();
    scheduleStatePersist();
  }

  function persistCurrentBounds() {
    if (!isOpen()) {
      return;
    }

    const bounds = normalizeBounds(desktopLyricsWindow.getBounds());

    if (!bounds) {
      return;
    }

    desktopLyricsState = {
      ...desktopLyricsState,
      bounds,
    };
  }

  function scheduleStatePersist() {
    if (!statePath) {
      return;
    }

    if (persistStateTimer) {
      clearTimeout(persistStateTimer);
    }

    persistStateTimer = setTimeout(() => {
      persistStateTimer = null;
      persistStateNow();
    }, DESKTOP_LYRICS_PERSIST_DEBOUNCE_MS);
    persistStateTimer.unref?.();
  }

  function persistStateNow() {
    if (!statePath) {
      return;
    }

    if (persistStateTimer) {
      clearTimeout(persistStateTimer);
      persistStateTimer = null;
    }

    try {
      fs.mkdirSync(path.dirname(statePath), { recursive: true });
      fs.writeFileSync(
        statePath,
        `${JSON.stringify(normalizePersistedState(desktopLyricsState), null, 2)}\n`,
        'utf8',
      );
    } catch (error) {
      console.warn('[desktop-lyrics:persist-state]', error);
    }
  }

  function readPersistedState() {
    if (!statePath) {
      return getDefaultPersistedState();
    }

    try {
      const rawState = fs.readFileSync(statePath, 'utf8');
      return normalizePersistedState(JSON.parse(rawState));
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        console.warn('[desktop-lyrics:read-state]', error);
      }

      return getDefaultPersistedState();
    }
  }

  function normalizePersistedState(state = {}) {
    return {
      version: DESKTOP_LYRICS_STATE_VERSION,
      enabled: state.enabled === undefined ? true : Boolean(state.enabled),
      bounds: normalizeBounds(state.bounds),
    };
  }

  function getDefaultPersistedState() {
    return {
      version: DESKTOP_LYRICS_STATE_VERSION,
      enabled: true,
      bounds: null,
    };
  }

  function normalizeBounds(bounds = {}) {
    if (!bounds || typeof bounds !== 'object') {
      return null;
    }

    const x = normalizeCoordinate(bounds.x);
    const y = normalizeCoordinate(bounds.y);

    if (x === null || y === null) {
      return null;
    }

    return {
      x,
      y,
      width: DESKTOP_LYRICS_WINDOW_WIDTH,
      height: clampNumber(
        Number(bounds.height),
        DESKTOP_LYRICS_WINDOW_BASE_HEIGHT,
        DESKTOP_LYRICS_WINDOW_MAX_HEIGHT,
        DESKTOP_LYRICS_WINDOW_BASE_HEIGHT,
      ),
    };
  }

  function normalizeCoordinate(value) {
    const coordinate = Number(value);

    if (!Number.isFinite(coordinate) || Math.abs(coordinate) > 100000) {
      return null;
    }

    return Math.round(coordinate);
  }

  function fitBoundsToVisibleDisplay(bounds) {
    if (!bounds) {
      return null;
    }

    let workArea;

    try {
      const centerPoint = {
        x: bounds.x + Math.round(bounds.width / 2),
        y: bounds.y + Math.round(bounds.height / 2),
      };
      workArea = screen.getDisplayNearestPoint(centerPoint).workArea;
    } catch (error) {
      console.warn('[desktop-lyrics:restore-display]', error);
      return bounds;
    }

    const maxX = workArea.x + Math.max(0, workArea.width - bounds.width);
    const maxY = workArea.y + Math.max(0, workArea.height - bounds.height);

    return {
      ...bounds,
      x: clampNumber(bounds.x, workArea.x, maxX, workArea.x),
      y: clampNumber(bounds.y, workArea.y, maxY, workArea.y),
    };
  }

  return {
    close,
    createWindow,
    getWindowState,
    isOpen,
    registerIpc,
    restoreLastSession,
    shouldRestoreLastSession,
  };
}

module.exports = {
  createDesktopLyricsManager,
};
