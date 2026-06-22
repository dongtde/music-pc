const {
  app,
  BrowserWindow,
  ipcMain,
  net,
  protocol,
  screen,
  shell,
} = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

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
const DESKTOP_LYRICS_WINDOW_WIDTH = 700;
const DESKTOP_LYRICS_WINDOW_BASE_HEIGHT = 80;
const DESKTOP_LYRICS_WINDOW_MAX_HEIGHT = 108;
const DESKTOP_LYRICS_BASE_FONT_SIZE = 15;
const DESKTOP_LYRICS_ALWAYS_ON_TOP_LEVEL = 'screen-saver';
const DESKTOP_LYRICS_TOP_GUARD_INTERVAL_MS = 1200;
const DESKTOP_LYRICS_ELEVATE_RETRY_DELAYS = [0, 80, 240];
const proxyCookieJars = new Map();
let mainWindow = null;
let desktopLyricsWindow = null;
let desktopLyricsLocked = false;
let lastDesktopLyricsPayload = null;
let desktopLyricsDragState = null;
let desktopLyricsTopGuardTimer = null;
const desktopLyricsElevateTimers = new Set();

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

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'Mappic Music',
    backgroundColor: '#101011',
    autoHideMenuBar: true,
    show: !isFirstScreenSmoke,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    let target;
    let current = null;

    try {
      const currentUrl = mainWindow.webContents.getURL();
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

  if (isDebug) {
    mainWindow.webContents.on(
      'console-message',
      (_event, level, message, line, sourceId) => {
        console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
      },
    );

    mainWindow.webContents.on(
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

  await mainWindow.loadURL(`${APP_PROTOCOL}://app/#/home`);

  if (isFirstScreenSmoke) {
    await captureFirstScreenSmoke(mainWindow);
  }

  if (isFpsSmoke) {
    await captureFpsSmoke(mainWindow);
  }

  if (isDebug) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;

    if (isDesktopLyricsWindowOpen()) {
      closeDesktopLyricsWindow();
    }
  });
}

async function createDesktopLyricsWindow() {
  if (isDesktopLyricsWindowOpen()) {
    elevateDesktopLyricsWindow();
    safelyCallWindowMethod(desktopLyricsWindow, 'showInactive');
    sendDesktopLyricsWindowState();
    sendDesktopLyricsPayload();
    return desktopLyricsWindow;
  }

  const bounds = getDesktopLyricsInitialBounds();

  try {
    desktopLyricsWindow = new BrowserWindow({
      ...bounds,
      minWidth: DESKTOP_LYRICS_WINDOW_WIDTH,
      maxWidth: DESKTOP_LYRICS_WINDOW_WIDTH,
      minHeight: DESKTOP_LYRICS_WINDOW_BASE_HEIGHT,
      maxHeight: DESKTOP_LYRICS_WINDOW_BASE_HEIGHT,
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
        preload: path.join(__dirname, 'preload.cjs'),
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
    broadcastDesktopLyricsWindowState();
    return null;
  }

  elevateDesktopLyricsWindow();
  startDesktopLyricsTopGuard();

  try {
    desktopLyricsWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
    });
  } catch (error) {
    console.warn('[desktop-lyrics:workspace-visibility]', error);
  }

  desktopLyricsWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: 'deny' };
  });

  desktopLyricsWindow.once('ready-to-show', () => {
    safelyCallWindowMethod(desktopLyricsWindow, 'showInactive');
    scheduleDesktopLyricsElevation();
    sendDesktopLyricsWindowState();
  });

  desktopLyricsWindow.webContents.on('did-finish-load', () => {
    scheduleDesktopLyricsElevation();
    sendDesktopLyricsWindowState();
    sendDesktopLyricsPayload();
  });

  desktopLyricsWindow.on('show', () => {
    scheduleDesktopLyricsElevation();
  });

  desktopLyricsWindow.on('blur', () => {
    scheduleDesktopLyricsElevation();
  });

  desktopLyricsWindow.on('move', () => {
    scheduleDesktopLyricsElevation([0]);
  });

  desktopLyricsWindow.on('resize', () => {
    scheduleDesktopLyricsElevation([0]);
  });

  desktopLyricsWindow.on('closed', () => {
    stopDesktopLyricsTopGuard();
    desktopLyricsWindow = null;
    desktopLyricsLocked = false;
    broadcastDesktopLyricsWindowState();
  });

  try {
    await desktopLyricsWindow.loadURL(`${APP_PROTOCOL}://app/#/desktop-lyrics`);
    broadcastDesktopLyricsWindowState();
    return desktopLyricsWindow;
  } catch (error) {
    console.warn('[desktop-lyrics:load]', error);
    closeDesktopLyricsWindow();
    return null;
  }
}

function getDesktopLyricsInitialBounds() {
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

function isDesktopLyricsWindowOpen() {
  return Boolean(desktopLyricsWindow && !desktopLyricsWindow.isDestroyed());
}

function elevateDesktopLyricsWindow() {
  if (!isDesktopLyricsWindowOpen()) {
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

function scheduleDesktopLyricsElevation(
  delays = DESKTOP_LYRICS_ELEVATE_RETRY_DELAYS,
) {
  if (!isDesktopLyricsWindowOpen()) {
    return;
  }

  clearDesktopLyricsElevateTimers();

  delays.forEach((delay) => {
    const timer = setTimeout(() => {
      desktopLyricsElevateTimers.delete(timer);
      elevateDesktopLyricsWindow();
    }, Math.max(0, Number(delay) || 0));

    desktopLyricsElevateTimers.add(timer);
  });
}

function clearDesktopLyricsElevateTimers() {
  desktopLyricsElevateTimers.forEach((timer) => {
    clearTimeout(timer);
  });
  desktopLyricsElevateTimers.clear();
}

function startDesktopLyricsTopGuard() {
  if (desktopLyricsTopGuardTimer) {
    return;
  }

  desktopLyricsTopGuardTimer = setInterval(() => {
    elevateDesktopLyricsWindow();
  }, DESKTOP_LYRICS_TOP_GUARD_INTERVAL_MS);
}

function stopDesktopLyricsTopGuard() {
  clearDesktopLyricsElevateTimers();

  if (!desktopLyricsTopGuardTimer) {
    return;
  }

  clearInterval(desktopLyricsTopGuardTimer);
  desktopLyricsTopGuardTimer = null;
}

function getDesktopLyricsWindowState() {
  const bounds = isDesktopLyricsWindowOpen()
    ? desktopLyricsWindow.getBounds()
    : null;

  return {
    open: isDesktopLyricsWindowOpen(),
    locked: desktopLyricsLocked,
    height: bounds?.height || DESKTOP_LYRICS_WINDOW_BASE_HEIGHT,
  };
}

function getDesktopLyricsHeightForFontSize(fontSize) {
  const normalizedFontSize = clampNumber(
    Number(fontSize),
    12,
    36,
    DESKTOP_LYRICS_BASE_FONT_SIZE,
  );
  const lineHeight = Math.ceil(normalizedFontSize * 1.08);
  const extraLineHeight = Math.max(0, lineHeight - Math.ceil(DESKTOP_LYRICS_BASE_FONT_SIZE * 1.08));

  return clampNumber(
    DESKTOP_LYRICS_WINDOW_BASE_HEIGHT + extraLineHeight,
    DESKTOP_LYRICS_WINDOW_BASE_HEIGHT,
    DESKTOP_LYRICS_WINDOW_MAX_HEIGHT,
    DESKTOP_LYRICS_WINDOW_BASE_HEIGHT,
  );
}

function resizeDesktopLyricsWindowForFontSize(fontSize) {
  if (!isDesktopLyricsWindowOpen()) {
    return;
  }

  const nextHeight = getDesktopLyricsHeightForFontSize(fontSize);
  const bounds = desktopLyricsWindow.getBounds();

  setDesktopLyricsFixedHeight(nextHeight, bounds.height);

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
  broadcastDesktopLyricsWindowState();
}

function setDesktopLyricsFixedHeight(nextHeight, currentHeight = nextHeight) {
  if (!isDesktopLyricsWindowOpen()) {
    return;
  }

  if (nextHeight > currentHeight) {
    desktopLyricsWindow.setMaximumSize(DESKTOP_LYRICS_WINDOW_WIDTH, nextHeight);
    desktopLyricsWindow.setMinimumSize(DESKTOP_LYRICS_WINDOW_WIDTH, nextHeight);
    return;
  }

  desktopLyricsWindow.setMinimumSize(DESKTOP_LYRICS_WINDOW_WIDTH, nextHeight);
  desktopLyricsWindow.setMaximumSize(DESKTOP_LYRICS_WINDOW_WIDTH, nextHeight);
}

function sendDesktopLyricsWindowState(targetWindow = desktopLyricsWindow) {
  if (!targetWindow || targetWindow.isDestroyed()) {
    return;
  }

  sendToWindow(
    targetWindow,
    'desktop-lyrics:window-state',
    getDesktopLyricsWindowState(),
  );
}

function broadcastDesktopLyricsWindowState() {
  const state = getDesktopLyricsWindowState();

  BrowserWindow.getAllWindows().forEach((window) => {
    sendToWindow(window, 'desktop-lyrics:window-state', state);
  });
}

function sendDesktopLyricsPayload(targetWindow = desktopLyricsWindow) {
  if (!lastDesktopLyricsPayload || !targetWindow || targetWindow.isDestroyed()) {
    return;
  }

  sendToWindow(targetWindow, 'desktop-lyrics:state', lastDesktopLyricsPayload);
}

function registerDesktopLyricsIpc() {
  ipcMain.handle('desktop-lyrics:toggle', async () => {
    if (isDesktopLyricsWindowOpen()) {
      closeDesktopLyricsWindow();
      return getDesktopLyricsWindowState();
    }

    await createDesktopLyricsWindow();
    return getDesktopLyricsWindowState();
  });

  ipcMain.handle('desktop-lyrics:show', async () => {
    await createDesktopLyricsWindow();
    return getDesktopLyricsWindowState();
  });

  ipcMain.handle('desktop-lyrics:hide', () => {
    if (isDesktopLyricsWindowOpen()) {
      closeDesktopLyricsWindow();
    }

    return getDesktopLyricsWindowState();
  });

  ipcMain.handle('desktop-lyrics:get-window-state', () =>
    getDesktopLyricsWindowState(),
  );

  ipcMain.on('desktop-lyrics:ready', (event) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    sendDesktopLyricsWindowState(senderWindow);
    sendDesktopLyricsPayload(senderWindow);
  });

  ipcMain.on('desktop-lyrics:state', (_event, payload) => {
    lastDesktopLyricsPayload = payload;
    sendDesktopLyricsPayload();
  });

  ipcMain.on('desktop-lyrics:set-locked', (_event, locked) => {
    desktopLyricsLocked = Boolean(locked);

    if (desktopLyricsLocked) {
      desktopLyricsDragState = null;
    }

    if (isDesktopLyricsWindowOpen()) {
      safelyCallWindowMethod(
        desktopLyricsWindow,
        'setMovable',
        !desktopLyricsLocked,
      );
    }

    broadcastDesktopLyricsWindowState();
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

    resizeDesktopLyricsWindowForFontSize(layout.fontSize);
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
  });

  ipcMain.on('desktop-lyrics:command', (_event, command) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      sendToWindow(mainWindow, 'desktop-lyrics:command', command);
    }
  });
}

function closeDesktopLyricsWindow() {
  if (!isDesktopLyricsWindowOpen()) {
    return;
  }

  safelyCallWindowMethod(desktopLyricsWindow, 'close');
}

function safelyCallWindowMethod(window, methodName, ...args) {
  if (
    !window ||
    window.isDestroyed() ||
    typeof window[methodName] !== 'function'
  ) {
    return undefined;
  }

  try {
    return window[methodName](...args);
  } catch (error) {
    console.warn(`[desktop-lyrics:${methodName}]`, error);
    return undefined;
  }
}

function sendToWindow(window, channel, payload) {
  if (!window || window.isDestroyed() || window.webContents?.isDestroyed()) {
    return;
  }

  try {
    window.webContents.send(channel, payload);
  } catch (error) {
    console.warn(`[desktop-lyrics:send:${channel}]`, error);
  }
}

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function openExternalUrl(url) {
  if (/^https?:\/\//i.test(url)) {
    shell.openExternal(url).catch((error) => {
      console.warn('[shell:open-external]', error);
    });
  }
}

function registerAppProtocol() {
  protocol.handle(APP_PROTOCOL, async (request) => {
    try {
      const url = new URL(request.url);
      const pathname = safeDecodePathname(url.pathname);

      if (url.hostname === 'api' || pathname.startsWith('/api/')) {
        url.pathname = pathname.replace(/^\/api/, '') || '/';
        return await proxyRequest(request, kugouApiTarget, url);
      }

      if (
        url.hostname === 'netease-api' ||
        pathname.startsWith('/netease-api/')
      ) {
        url.pathname = pathname.replace(/^\/netease-api/, '') || '/';
        return await proxyRequest(request, neteaseApiTarget, url);
      }

      if (url.hostname === 'media' || pathname === '/media') {
        return await proxyMediaRequest(request, url);
      }

      return await serveStaticAsset(url);
    } catch (error) {
      console.warn('[app-protocol:error]', request.url, error);
      return new Response('App protocol request failed', { status: 500 });
    }
  });
}

function safeDecodePathname(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

async function serveStaticAsset(url) {
  if (isDev) {
    return net.fetch(
      new URL(url.pathname + url.search, devServerUrl).toString(),
    );
  }

  const distRoot = path.join(__dirname, '..', 'dist');
  const pathname = decodeURIComponent(url.pathname);
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(distRoot, requestedPath));

  if (!filePath.startsWith(distRoot)) {
    return new Response('Forbidden', { status: 403 });
  }

  return net.fetch(pathToFileUrl(filePath));
}

function pathToFileUrl(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const prefix = normalized.startsWith('/') ? 'file://' : 'file:///';

  return `${prefix}${encodeURI(normalized)}`;
}

async function captureFirstScreenSmoke(window) {
  const screenshotPath = process.env.MAPPIC_FIRST_SCREEN_SMOKE_SCREENSHOT;
  const metricsPath = process.env.MAPPIC_FIRST_SCREEN_SMOKE_METRICS;
  const startedAt = Date.now();

  if (!screenshotPath || !metricsPath) {
    throw new Error('Missing first-screen smoke output paths');
  }

  await waitForSmokeApp(window);
  safelyCallWindowMethod(window, 'show');
  safelyCallWindowMethod(window, 'focus');
  await delay(800);

  const pageMetrics = await collectSmokePageMetrics(window);
  const image = await window.webContents.capturePage();
  const screenshotBytes = image.toPNG();
  const screenshotSize = image.getSize();
  const pixelMetrics = sampleSmokePixels(image);

  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await fs.mkdir(path.dirname(metricsPath), { recursive: true });
  await fs.writeFile(screenshotPath, screenshotBytes);
  await fs.writeFile(
    metricsPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        targetUrl: `${APP_PROTOCOL}://app/#/home`,
        elapsedMs: Date.now() - startedAt,
        screenshotBytes: screenshotBytes.length,
        screenshotSize,
        ...pixelMetrics,
        ...pageMetrics,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  app.exit(0);
}

async function captureFpsSmoke(window) {
  const metricsPath = process.env.MAPPIC_FPS_SMOKE_METRICS;
  const startedAt = Date.now();

  if (!metricsPath) {
    throw new Error('Missing FPS smoke metrics path');
  }

  await waitForSmokeApp(window);
  safelyCallWindowMethod(window, 'show');
  safelyCallWindowMethod(window, 'focus');
  await delay(800);

  const metrics = await collectFpsSmokeMetrics(window);

  await fs.mkdir(path.dirname(metricsPath), { recursive: true });
  await fs.writeFile(
    metricsPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        targetUrl: `${APP_PROTOCOL}://app/#/home`,
        elapsedMs: Date.now() - startedAt,
        ...metrics,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  app.exit(0);
}

async function waitForSmokeApp(window) {
  const startedAt = Date.now();
  const timeoutMs = 10000;

  while (Date.now() - startedAt < timeoutMs) {
    const mounted = await window.webContents
      .executeJavaScript(`
        Boolean(
          document.readyState !== 'loading' &&
          document.querySelector('#app') &&
          document.querySelector('#app').children.length > 0
        )
      `)
      .catch(() => false);

    if (mounted) {
      return;
    }

    await delay(100);
  }

  throw new Error('Timed out waiting for first-screen app mount');
}

function collectSmokePageMetrics(window) {
  return window.webContents.executeJavaScript(`
    (() => {
      const appEl = document.querySelector('#app')
      const appRect = appEl?.getBoundingClientRect()
      const navigation = performance.getEntriesByType('navigation')[0]
      const text = (document.body.innerText || '').trim()

      return {
        url: location.href,
        title: document.title,
        readyState: document.readyState,
        textLength: text.length,
        textSample: text.slice(0, 240),
        appChildCount: appEl?.children.length || 0,
        appRect: appRect
          ? {
              width: Math.round(appRect.width),
              height: Math.round(appRect.height)
            }
          : null,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio
        },
        documentHeight: document.documentElement.scrollHeight,
        navigation: navigation
          ? {
              domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
              loadEventMs: Math.round(navigation.loadEventEnd),
              transferSize: navigation.transferSize
            }
          : null
      }
    })()
  `);
}

function collectFpsSmokeMetrics(window) {
  return window.webContents.executeJavaScript(`
    (async () => {
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
      const text = (document.body.innerText || '').trim()

      function sampleFrames(durationMs = 1200) {
        return new Promise((resolve) => {
          const startedAt = performance.now()
          let frames = 0
          let lastFrameAt = 0
          let maxFrameDeltaMs = 0
          let longFrames = 0

          function tick(now) {
            frames += 1

            if (lastFrameAt) {
              const delta = now - lastFrameAt
              maxFrameDeltaMs = Math.max(maxFrameDeltaMs, delta)

              if (delta > 50) {
                longFrames += 1
              }
            }

            lastFrameAt = now

            if (now - startedAt >= durationMs) {
              const actualDurationMs = now - startedAt

              resolve({
                frames,
                durationMs: Math.round(actualDurationMs),
                fps: Number(((frames * 1000) / actualDurationMs).toFixed(1)),
                maxFrameDeltaMs: Number(maxFrameDeltaMs.toFixed(1)),
                longFrames
              })
              return
            }

            requestAnimationFrame(tick)
          }

          requestAnimationFrame(tick)
        })
      }

      async function sampleScroller(selector, label) {
        const scroller = document.querySelector(selector)
        const result = {
          label,
          selector,
          found: Boolean(scroller),
          childCount: scroller?.children?.length || 0,
          hydratedCount: scroller
            ? Array.from(scroller.children).filter((child) => (
                !child.classList.contains('soda-slide--light') &&
                !child.classList.contains('soda-mv-slide--light')
              )).length
            : 0,
          clientHeight: scroller?.clientHeight || 0,
          scrollHeight: scroller?.scrollHeight || 0,
          idle: null,
          scroll: null,
          recovery: null
        }

        if (!scroller) {
          return result
        }

        scroller.focus?.()
        result.idle = await sampleFrames(1200)

        const scrollDistance = scroller.clientHeight || 0

        if (scrollDistance > 0 && scroller.scrollHeight > scroller.clientHeight) {
          scroller.scrollTo({
            top: Math.min(scroller.scrollTop + scrollDistance, scroller.scrollHeight - scroller.clientHeight),
            behavior: 'smooth'
          })
        }

        result.scroll = await sampleFrames(1800)

        if (scrollDistance > 0) {
          scroller.scrollTo({ top: 0, behavior: 'auto' })
        }

        await delay(400)
        result.recovery = await sampleFrames(1000)

        return result
      }

      const music = await sampleScroller('.soda-feed__scroller', 'home-music')
      const videoTab = Array.from(document.querySelectorAll('.soda-feed__tabs button'))
        .find((button) => /视频/.test(button.textContent || ''))

      if (videoTab) {
        videoTab.click()
        await delay(1000)
      }

      const video = await sampleScroller('.soda-video-feed__scroller', 'home-video')

      return {
        url: location.href,
        title: document.title,
        readyState: document.readyState,
        textLength: text.length,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio
        },
        music,
        video
      }
    })()
  `);
}

function sampleSmokePixels(image) {
  const { width, height } = image.getSize();
  const bitmap = image.toBitmap();
  const totalPixels = width * height;
  const step = Math.max(1, Math.floor(totalPixels / 20000));
  let sampled = 0;
  let nonWhite = 0;
  let varied = 0;

  for (let pixel = 0; pixel < totalPixels; pixel += step) {
    const offset = pixel * 4;
    const blue = bitmap[offset];
    const green = bitmap[offset + 1];
    const red = bitmap[offset + 2];
    const alpha = bitmap[offset + 3];

    if (alpha < 10) {
      continue;
    }

    sampled += 1;

    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);

    if (max < 245 || min < 245) {
      nonWhite += 1;
    }

    if (max - min > 8) {
      varied += 1;
    }
  }

  return {
    sampledPixels: sampled,
    nonWhiteRatio: sampled ? Number((nonWhite / sampled).toFixed(4)) : 0,
    variedColorRatio: sampled ? Number((varied / sampled).toFixed(4)) : 0,
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function proxyRequest(request, target, sourceUrl) {
  const targetUrl = new URL(sourceUrl.pathname + sourceUrl.search, target);
  const headers = new Headers(request.headers);
  const noCookie = headers.has('x-kugou-no-cookie');

  headers.delete('host');
  headers.delete('origin');
  headers.delete('referer');
  headers.delete('x-kugou-no-cookie');

  if (noCookie) {
    headers.delete('cookie');
  } else {
    appendProxyCookies(headers, targetUrl);
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body:
        request.method === 'GET' || request.method === 'HEAD'
          ? undefined
          : request.body,
      redirect: 'follow',
    });

    if (isDebug && response.status >= 400) {
      console.warn(
        '[api:proxy]',
        response.status,
        request.method,
        targetUrl.href,
      );
    }

    storeProxyCookies(response, targetUrl);
    return response;
  } catch (error) {
    console.warn('[api:proxy:error]', request.method, targetUrl.href, error);
    return new Response(error?.message || 'Proxy request failed', {
      status: 502,
    });
  }
}

function appendProxyCookies(headers, targetUrl) {
  const jarCookie = getProxyCookieHeader(targetUrl);

  if (!jarCookie) {
    return;
  }

  const currentCookie = headers.get('cookie');
  headers.set('cookie', mergeCookieHeaders(currentCookie, jarCookie));
}

function storeProxyCookies(response, targetUrl) {
  const cookies = getSetCookieHeaders(response.headers);

  if (!cookies.length) {
    return;
  }

  const origin = targetUrl.origin;
  const jar = proxyCookieJars.get(origin) || new Map();

  cookies.forEach((cookie) => {
    const parsed = parseSetCookie(cookie);

    if (!parsed.name) {
      return;
    }

    if (parsed.expired) {
      jar.delete(parsed.name);
    } else {
      jar.set(parsed.name, parsed.value);
    }
  });

  if (jar.size) {
    proxyCookieJars.set(origin, jar);
  } else {
    proxyCookieJars.delete(origin);
  }

  if (isDebug) {
    console.log(
      '[api:cookies]',
      origin,
      Array.from(jar.keys()).join(',') || '(empty)',
    );
  }
}

function getProxyCookieHeader(targetUrl) {
  const jar = proxyCookieJars.get(targetUrl.origin);

  if (!jar?.size) {
    return '';
  }

  return Array.from(jar.entries())
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function getSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }

  if (typeof headers.raw === 'function') {
    return headers.raw()['set-cookie'] || [];
  }

  const setCookie = headers.get('set-cookie');
  return setCookie ? splitSetCookieHeader(setCookie) : [];
}

function splitSetCookieHeader(header) {
  const cookies = [];
  let start = 0;
  let inExpires = false;

  for (let index = 0; index < header.length; index += 1) {
    const char = header[index];
    const maybeExpires = header.slice(index, index + 8).toLowerCase();

    if (maybeExpires === 'expires=') {
      inExpires = true;
      index += 7;
      continue;
    }

    if (inExpires && char === ';') {
      inExpires = false;
      continue;
    }

    if (!inExpires && char === ',') {
      cookies.push(header.slice(start, index).trim());
      start = index + 1;
    }
  }

  cookies.push(header.slice(start).trim());
  return cookies.filter(Boolean);
}

function parseSetCookie(cookie) {
  const parts = String(cookie || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
  const pair = parts[0] || '';
  const separatorIndex = pair.indexOf('=');

  if (separatorIndex === -1) {
    return {};
  }

  const name = pair.slice(0, separatorIndex).trim();
  const value = pair.slice(separatorIndex + 1).trim();
  const expired = parts.slice(1).some((part) => {
    const [rawKey, rawValue = ''] = part.split('=');
    const key = rawKey.trim().toLowerCase();

    if (key === 'max-age') {
      return Number(rawValue) <= 0;
    }

    if (key === 'expires') {
      const expiresAt = Date.parse(rawValue);
      return Number.isFinite(expiresAt) && expiresAt <= Date.now();
    }

    return false;
  });

  return { name, value, expired };
}

function mergeCookieHeaders(currentCookie = '', jarCookie = '') {
  const values = new Map();

  parseCookieHeader(jarCookie).forEach((value, name) =>
    values.set(name, value),
  );
  parseCookieHeader(currentCookie).forEach((value, name) =>
    values.set(name, value),
  );

  return Array.from(values.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function parseCookieHeader(cookie = '') {
  return String(cookie)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((values, part) => {
      const separatorIndex = part.indexOf('=');

      if (separatorIndex === -1) {
        return values;
      }

      const name = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();

      if (name) {
        values.set(name, value);
      }

      return values;
    }, new Map());
}

async function proxyMediaRequest(request, sourceUrl) {
  const rawTargetUrl = sourceUrl.searchParams.get('url') || '';

  if (!rawTargetUrl) {
    return new Response('Missing media url', { status: 400 });
  }

  let targetUrl;

  try {
    targetUrl = new URL(rawTargetUrl);
  } catch {
    return new Response('Invalid media url', { status: 400 });
  }

  if (!/^https?:$/.test(targetUrl.protocol)) {
    return new Response('Unsupported media protocol', { status: 400 });
  }

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('origin');
  headers.delete('referer');

  if (isDebug) {
    console.log(
      '[media:proxy]',
      request.method,
      targetUrl.href,
      headers.get('range') || '',
    );
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body:
        request.method === 'GET' || request.method === 'HEAD'
          ? undefined
          : request.body,
      redirect: 'follow',
    });

    if (isDebug && response.status >= 400) {
      console.warn(
        '[media:proxy]',
        response.status,
        request.method,
        targetUrl.href,
      );
    }

    return response;
  } catch (error) {
    console.warn('[media:proxy:error]', request.method, targetUrl.href, error);
    return new Response(error?.message || 'Media proxy request failed', {
      status: 502,
    });
  }
}

app.whenReady()
  .then(async () => {
    registerAppProtocol();
    registerDesktopLyricsIpc();
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
