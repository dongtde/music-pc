const { app, BrowserWindow, net, protocol, shell } = require('electron');
const path = require('node:path');

const APP_PROTOCOL = 'mappic';
const isDev = !app.isPackaged;
const isDebug = process.env.MAPPIC_DESKTOP_DEBUG === '1' || process.argv.includes('--debug');
const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';
const kugouApiTarget = process.env.KUGOU_API_TARGET || 'http://localhost:4000';
const neteaseApiTarget = process.env.NETEASE_API_TARGET || 'http://localhost:3000';
const proxyCookieJars = new Map();

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
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'Mappic Music',
    backgroundColor: '#101011',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const currentUrl = mainWindow.webContents.getURL();
    const target = new URL(url);
    const current = currentUrl ? new URL(currentUrl) : null;

    if (current && target.origin !== current.origin) {
      event.preventDefault();
      openExternalUrl(url);
    }
  });

  if (isDebug) {
    mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
    });

    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      console.warn('[renderer:did-fail-load]', errorCode, errorDescription, validatedURL);
    });
  }

  await mainWindow.loadURL(`${APP_PROTOCOL}://app/#/home`);

  if (isDebug) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function openExternalUrl(url) {
  if (/^https?:\/\//i.test(url)) {
    shell.openExternal(url);
  }
}

function registerAppProtocol() {
  protocol.handle(APP_PROTOCOL, async (request) => {
    const url = new URL(request.url);
    const pathname = decodeURIComponent(url.pathname);

    if (url.hostname === 'api' || pathname.startsWith('/api/')) {
      url.pathname = pathname.replace(/^\/api/, '') || '/';
      return proxyRequest(request, kugouApiTarget, url);
    }

    if (url.hostname === 'netease-api' || pathname.startsWith('/netease-api/')) {
      url.pathname = pathname.replace(/^\/netease-api/, '') || '/';
      return proxyRequest(request, neteaseApiTarget, url);
    }

    if (url.hostname === 'media' || pathname === '/media') {
      return proxyMediaRequest(request, url);
    }

    return serveStaticAsset(url);
  });
}

async function serveStaticAsset(url) {
  if (isDev) {
    return net.fetch(new URL(url.pathname + url.search, devServerUrl).toString());
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

async function proxyRequest(request, target, sourceUrl) {
  const targetUrl = new URL(sourceUrl.pathname + sourceUrl.search, target);
  const headers = new Headers(request.headers);

  headers.delete('host');
  headers.delete('origin');
  headers.delete('referer');
  appendProxyCookies(headers, targetUrl);

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'follow',
    });

    if (isDebug && response.status >= 400) {
      console.warn('[api:proxy]', response.status, request.method, targetUrl.href);
    }

    storeProxyCookies(response, targetUrl);
    return response;
  } catch (error) {
    console.warn('[api:proxy:error]', request.method, targetUrl.href, error);
    return new Response(error?.message || 'Proxy request failed', { status: 502 });
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
    console.log('[api:cookies]', origin, Array.from(jar.keys()).join(',') || '(empty)');
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
  const parts = String(cookie || '').split(';').map((part) => part.trim()).filter(Boolean);
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

  parseCookieHeader(jarCookie).forEach((value, name) => values.set(name, value));
  parseCookieHeader(currentCookie).forEach((value, name) => values.set(name, value));

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
    console.log('[media:proxy]', request.method, targetUrl.href, headers.get('range') || '');
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'follow',
    });

    if (isDebug && response.status >= 400) {
      console.warn('[media:proxy]', response.status, request.method, targetUrl.href);
    }

    return response;
  } catch (error) {
    console.warn('[media:proxy:error]', request.method, targetUrl.href, error);
    return new Response(error?.message || 'Media proxy request failed', { status: 502 });
  }
}

app.whenReady().then(() => {
  registerAppProtocol();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
