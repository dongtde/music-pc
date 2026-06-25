const { app, BrowserWindow, ipcMain, net, protocol } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { createDesktopLyricsManager } = require('./desktopLyricsWindow.cjs');
const { createAppProtocolRegistrar } = require('./protocolProxy.cjs');
const { createTaskbarControlsManager } = require('./taskbarControls.cjs');
const { openExternalUrl, sendToWindow } = require('./windowUtils.cjs');
const {
  captureFirstScreenSmoke,
  captureFpsSmoke,
} = require('./smoke.cjs');

const projectRoot = path.join(__dirname, '..');
const initialEnvKeys = new Set(Object.keys(process.env));

loadEnvFile(path.join(projectRoot, '.env'), { initialEnvKeys });
loadEnvFile(path.join(projectRoot, '.env.local'), {
  initialEnvKeys,
  override: true,
});

const APP_PROTOCOL = 'mappic';
const APP_USER_MODEL_ID = 'com.lanyin.music';
const isDev = !app.isPackaged;
const isDebug =
  process.env.MAPPIC_DESKTOP_DEBUG === '1' || process.argv.includes('--debug');
const electronSmokeMode =
  process.env.MAPPIC_ELECTRON_SMOKE_MODE ||
  (process.env.MAPPIC_FIRST_SCREEN_SMOKE === '1' ? 'first-screen' : '');
const isFirstScreenSmoke = electronSmokeMode === 'first-screen';
const isFpsSmoke = electronSmokeMode === 'fps';
const isAutomationSmoke = isFirstScreenSmoke || isFpsSmoke;
const devServerUrl = readEnv(['VITE_DEV_SERVER_URL'], 'http://127.0.0.1:5173');
const kugouApiBase = readEnv(['VITE_KUGOU_API_BASE'], '/api');
const neteaseApiBase = readEnv(['VITE_NETEASE_API_BASE'], '/netease-api');
const kugouApiTarget = readEnv(
  ['VITE_KUGOU_API_TARGET', 'KUGOU_API_TARGET'],
  '',
);
const neteaseApiTarget = readEnv(
  ['VITE_NETEASE_API_TARGET', 'NETEASE_API_TARGET'],
  '',
);
const preloadPath = path.join(__dirname, 'preload.cjs');
const distRoot = path.join(__dirname, '..', 'dist');
const appIconPath = path.join(__dirname, '..', 'build', 'icon.ico');
const cookieJarPath = path.join(app.getPath('userData'), 'kugou-proxy-cookies.json');
const desktopLyricsStatePath = path.join(
  app.getPath('userData'),
  'desktop-lyrics-state.json',
);

let mainWindow = null;
let mainWindowIpcRegistered = false;

if (isAutomationSmoke) {
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

if (process.platform === 'win32') {
  app.setAppUserModelId(APP_USER_MODEL_ID);
}

process.on('uncaughtException', (error) => {
  console.error('[main:uncaught-exception]', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[main:unhandled-rejection]', reason);
});

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const protocolRegistrar = createAppProtocolRegistrar({
  protocol,
  net,
  appProtocol: APP_PROTOCOL,
  isDev,
  isDebug,
  devServerUrl,
  kugouApiBase,
  kugouApiTarget,
  neteaseApiBase,
  neteaseApiTarget,
  distRoot,
  cookieJarPath,
});

const desktopLyrics = createDesktopLyricsManager({
  appProtocol: APP_PROTOCOL,
  preloadPath,
  getMainWindow: () => mainWindow,
  openExternalUrl,
  statePath: desktopLyricsStatePath,
});
const taskbarControls = createTaskbarControlsManager({
  ipcMain,
  getMainWindow: () => mainWindow,
});

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    icon: appIconPath,
    title: '澜音',
    backgroundColor: '#0b0d11',
    autoHideMenuBar: true,
    show: !isFirstScreenSmoke,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  attachNavigationGuards(mainWindow);
  attachDebugLogging(mainWindow);
  attachWindowStateEvents(mainWindow);
  taskbarControls.attachToWindow(mainWindow);

  await mainWindow.loadURL(`${APP_PROTOCOL}://app/#/home`);

  if (isFirstScreenSmoke) {
    await captureFirstScreenSmoke({
      app,
      appProtocol: APP_PROTOCOL,
      window: mainWindow,
    });
  }

  if (isFpsSmoke) {
    await captureFpsSmoke({
      app,
      appProtocol: APP_PROTOCOL,
      window: mainWindow,
    });
  }

  if (isDebug) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;

    if (desktopLyrics.isOpen()) {
      desktopLyrics.close();
    }
  });
}

function registerMainWindowIpc() {
  if (mainWindowIpcRegistered) {
    return;
  }

  mainWindowIpcRegistered = true;

  ipcMain.on('main-window:minimize', (event) => {
    const window = getMainWindowFromEvent(event);
    window?.minimize();
  });

  ipcMain.on('main-window:toggle-maximize', (event) => {
    const window = getMainWindowFromEvent(event);

    if (!window) {
      return;
    }

    if (window.isMaximized()) {
      window.unmaximize();
      return;
    }

    window.maximize();
  });

  ipcMain.on('main-window:close', (event) => {
    const window = getMainWindowFromEvent(event);
    window?.close();
  });

  ipcMain.handle('main-window:get-state', (event) => {
    const window = getMainWindowFromEvent(event);
    return getMainWindowState(window);
  });
}

function getMainWindowFromEvent(event) {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);

  if (!senderWindow || senderWindow !== mainWindow) {
    return null;
  }

  return senderWindow;
}

function getMainWindowState(window = mainWindow) {
  if (!window || window.isDestroyed()) {
    return {
      isMaximized: false,
      isFullScreen: false,
      platform: process.platform,
    };
  }

  return {
    isMaximized: window.isMaximized(),
    isFullScreen: window.isFullScreen(),
    platform: process.platform,
  };
}

function sendMainWindowState(window = mainWindow) {
  sendToWindow(window, 'main-window:state', getMainWindowState(window));
}

function attachWindowStateEvents(window) {
  [
    'maximize',
    'unmaximize',
    'enter-full-screen',
    'leave-full-screen',
    'restore',
  ].forEach((eventName) => {
    window.on(eventName, () => sendMainWindowState(window));
  });

  window.webContents.on('did-finish-load', () => {
    sendMainWindowState(window);
  });
}

function attachNavigationGuards(window) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    let target;
    let current = null;

    try {
      const currentUrl = window.webContents.getURL();
      target = new URL(url);
      current = currentUrl ? new URL(currentUrl) : null;
    } catch (error) {
      console.warn('[main:will-navigate]', error);
      event.preventDefault();
      return;
    }

    if (current && target.origin !== current.origin) {
      event.preventDefault();
      openExternalUrl(url);
    }
  });
}

function attachDebugLogging(window) {
  if (!isDebug) {
    return;
  }

  window.webContents.on(
    'console-message',
    (_event, level, message, line, sourceId) => {
      console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
    },
  );

  window.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL) => {
      console.warn(
        '[renderer:did-fail-load]',
        errorCode,
        errorDescription,
        validatedURL,
      );
    },
  );
}

function loadEnvFile(filePath, { initialEnvKeys, override = false } = {}) {
  let content = '';

  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('[env:load]', filePath, error);
    }

    return;
  }

  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex <= 0) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = normalizeEnvValue(trimmed.slice(separatorIndex + 1));

    if (!key || initialEnvKeys?.has(key)) {
      return;
    }

    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

function normalizeEnvValue(rawValue = '') {
  const value = rawValue.trim();
  const quote = value[0];

  if (
    (quote === '"' || quote === "'") &&
    value.length >= 2 &&
    value[value.length - 1] === quote
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function readEnv(keys, fallback) {
  for (const key of keys) {
    const value = process.env[key];

    if (value !== undefined && value !== '') {
      return value;
    }
  }

  return fallback;
}

app.whenReady()
  .then(async () => {
    protocolRegistrar.registerAppProtocol();
    registerMainWindowIpc();
    desktopLyrics.registerIpc();
    taskbarControls.registerIpc();
    await createMainWindow();
    await restoreDesktopLyricsOnStartup();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow()
          .then(restoreDesktopLyricsOnStartup)
          .catch((error) => {
            console.error('[main:create-window:activate]', error);
          });
      }
    });
  })
  .catch((error) => {
    console.error('[main:ready]', error);

    if (isFirstScreenSmoke) {
      app.exit(1);
    }
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

async function restoreDesktopLyricsOnStartup() {
  if (isAutomationSmoke || !desktopLyrics.shouldRestoreLastSession()) {
    return;
  }

  try {
    await desktopLyrics.restoreLastSession();
  } catch (error) {
    console.warn('[desktop-lyrics:restore-startup]', error);
  }
}

module.exports = {
  attachNavigationGuards,
  createMainWindow,
};
