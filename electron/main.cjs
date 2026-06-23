const { app, BrowserWindow, net, protocol } = require('electron');
const path = require('node:path');
const { createDesktopLyricsManager } = require('./desktopLyricsWindow.cjs');
const { createAppProtocolRegistrar } = require('./protocolProxy.cjs');
const { openExternalUrl } = require('./windowUtils.cjs');
const {
  captureFirstScreenSmoke,
  captureFpsSmoke,
} = require('./smoke.cjs');

const APP_PROTOCOL = 'mappic';
const isDev = !app.isPackaged;
const isDebug =
  process.env.MAPPIC_DESKTOP_DEBUG === '1' || process.argv.includes('--debug');
const electronSmokeMode =
  process.env.MAPPIC_ELECTRON_SMOKE_MODE ||
  (process.env.MAPPIC_FIRST_SCREEN_SMOKE === '1' ? 'first-screen' : '');
const isFirstScreenSmoke = electronSmokeMode === 'first-screen';
const isFpsSmoke = electronSmokeMode === 'fps';
const isAutomationSmoke = isFirstScreenSmoke || isFpsSmoke;
const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';
const kugouApiTarget =
  process.env.KUGOU_API_TARGET || 'https://kugou.cyouhong.cn';
const neteaseApiTarget =
  process.env.NETEASE_API_TARGET || 'https://music-api.xcj.pw';
const preloadPath = path.join(__dirname, 'preload.cjs');
const distRoot = path.join(__dirname, '..', 'dist');
const cookieJarPath = path.join(app.getPath('userData'), 'kugou-proxy-cookies.json');

let mainWindow = null;

if (isAutomationSmoke) {
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
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
  kugouApiTarget,
  neteaseApiTarget,
  distRoot,
  cookieJarPath,
});

const desktopLyrics = createDesktopLyricsManager({
  appProtocol: APP_PROTOCOL,
  preloadPath,
  getMainWindow: () => mainWindow,
  openExternalUrl,
});

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
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

app.whenReady()
  .then(async () => {
    protocolRegistrar.registerAppProtocol();
    desktopLyrics.registerIpc();
    await createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow().catch((error) => {
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

module.exports = {
  attachNavigationGuards,
  createMainWindow,
};
