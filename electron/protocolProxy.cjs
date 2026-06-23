const nodeNet = require('node:net');
const fs = require('node:fs');
const path = require('node:path');

function createAppProtocolRegistrar({
  protocol,
  net,
  appProtocol,
  isDev,
  isDebug,
  devServerUrl,
  kugouApiTarget,
  neteaseApiTarget,
  distRoot,
  cookieJarPath,
  mediaHostAllowList = process.env.MAPPIC_MEDIA_PROXY_ALLOWED_HOSTS || '',
  allowPrivateMediaHosts =
    process.env.MAPPIC_MEDIA_PROXY_ALLOW_PRIVATE === '1',
} = {}) {
  const proxyCookieJars = loadProxyCookieJars(cookieJarPath);
  const allowedMediaHosts = parseHostAllowList(mediaHostAllowList);
  const resolvedDistRoot = path.resolve(distRoot);

  function registerAppProtocol() {
    protocol.handle(appProtocol, async (request) => {
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

  async function serveStaticAsset(url) {
    if (isDev) {
      return net.fetch(
        new URL(url.pathname + url.search, devServerUrl).toString(),
      );
    }

    const pathname = safeDecodePathname(url.pathname);
    const requestedPath = pathname === '/' ? '/index.html' : pathname;
    const filePath = path.resolve(
      path.normalize(path.join(resolvedDistRoot, requestedPath)),
    );
    const relativePath = path.relative(resolvedDistRoot, filePath);

    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return new Response('Forbidden', { status: 403 });
    }

    return net.fetch(pathToFileUrl(filePath));
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

    saveProxyCookieJars(proxyCookieJars, cookieJarPath);

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

  async function proxyMediaRequest(request, sourceUrl) {
    if (!isAllowedMediaMethod(request.method)) {
      return new Response('Method not allowed', {
        status: 405,
        headers: { allow: 'GET, HEAD' },
      });
    }

    const validation = validateMediaTargetUrl(
      sourceUrl.searchParams.get('url') || '',
      {
        allowedHosts: allowedMediaHosts,
        allowPrivateHosts: allowPrivateMediaHosts,
      },
    );

    if (!validation.ok) {
      return new Response(validation.message, { status: validation.status });
    }

    const targetUrl = validation.targetUrl;
    const headers = sanitizeMediaProxyHeaders(request.headers);

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

  return {
    proxyMediaRequest,
    proxyRequest,
    registerAppProtocol,
    serveStaticAsset,
  };
}

function safeDecodePathname(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

function pathToFileUrl(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const prefix = normalized.startsWith('/') ? 'file://' : 'file:///';

  return `${prefix}${encodeURI(normalized)}`;
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

function loadProxyCookieJars(filePath) {
  if (!filePath) {
    return new Map();
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return new Map();
    }

    return new Map(
      Object.entries(data)
        .map(([origin, cookies]) => {
          if (!isHttpOrigin(origin) || !cookies || typeof cookies !== 'object') {
            return null;
          }

          const jar = new Map(
            Object.entries(cookies)
              .filter(([name, value]) => name && value !== undefined && value !== null)
              .map(([name, value]) => [name, String(value)]),
          );

          return jar.size ? [origin, jar] : null;
        })
        .filter(Boolean),
    );
  } catch {
    return new Map();
  }
}

function saveProxyCookieJars(cookieJars, filePath) {
  if (!filePath) {
    return;
  }

  try {
    const data = {};

    cookieJars.forEach((jar, origin) => {
      if (!isHttpOrigin(origin) || !jar?.size) {
        return;
      }

      data[origin] = Object.fromEntries(jar.entries());
    });

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
  } catch (error) {
    console.warn('[api:cookies:persist]', error);
  }
}

function isHttpOrigin(origin = '') {
  try {
    return /^https?:$/.test(new URL(origin).protocol);
  } catch {
    return false;
  }
}

function isAllowedMediaMethod(method = '') {
  return method === 'GET' || method === 'HEAD';
}

function validateMediaTargetUrl(rawTargetUrl, options = {}) {
  if (!rawTargetUrl) {
    return { ok: false, status: 400, message: 'Missing media url' };
  }

  let targetUrl;

  try {
    targetUrl = new URL(rawTargetUrl);
  } catch {
    return { ok: false, status: 400, message: 'Invalid media url' };
  }

  if (!/^https?:$/.test(targetUrl.protocol)) {
    return {
      ok: false,
      status: 400,
      message: 'Unsupported media protocol',
    };
  }

  if (targetUrl.username || targetUrl.password) {
    return {
      ok: false,
      status: 400,
      message: 'Unsupported media credentials',
    };
  }

  if (!options.allowPrivateHosts && isLocalOrPrivateHostname(targetUrl.hostname)) {
    return { ok: false, status: 403, message: 'Forbidden media host' };
  }

  if (
    options.allowedHosts?.length &&
    !hostMatchesAllowList(targetUrl.hostname, options.allowedHosts)
  ) {
    return { ok: false, status: 403, message: 'Media host is not allowed' };
  }

  return { ok: true, targetUrl };
}

function sanitizeMediaProxyHeaders(sourceHeaders) {
  const headers = new Headers(sourceHeaders);

  headers.delete('authorization');
  headers.delete('cookie');
  headers.delete('host');
  headers.delete('origin');
  headers.delete('referer');

  return headers;
}

function parseHostAllowList(rawList = '') {
  if (Array.isArray(rawList)) {
    return rawList
      .map((entry) => normalizeHostname(entry))
      .filter(Boolean);
  }

  return String(rawList)
    .split(/[\s,;]+/)
    .map((entry) => normalizeHostname(entry))
    .filter(Boolean);
}

function hostMatchesAllowList(hostname, allowedHosts) {
  const normalizedHost = normalizeHostname(hostname);

  return allowedHosts.some((entry) => {
    const normalizedEntry = normalizeHostname(entry);

    if (!normalizedEntry) {
      return false;
    }

    if (normalizedEntry.startsWith('.')) {
      const suffix = normalizedEntry.slice(1);
      return normalizedHost === suffix || normalizedHost.endsWith(normalizedEntry);
    }

    return normalizedHost === normalizedEntry;
  });
}

function normalizeHostname(hostname = '') {
  return String(hostname)
    .trim()
    .replace(/^\[|\]$/g, '')
    .toLowerCase();
}

function isLocalOrPrivateHostname(hostname) {
  const normalizedHost = normalizeHostname(hostname);

  if (
    !normalizedHost ||
    normalizedHost === 'localhost' ||
    normalizedHost.endsWith('.localhost')
  ) {
    return true;
  }

  const ipVersion = nodeNet.isIP(normalizedHost);

  if (ipVersion === 4) {
    return isPrivateIpv4(normalizedHost);
  }

  if (ipVersion === 6) {
    return isPrivateIpv6(normalizedHost);
  }

  return false;
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split('.').map((part) => Number(part));

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return true;
  }

  const [a, b] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isPrivateIpv6(hostname) {
  const host = normalizeHostname(hostname);

  return (
    host === '::' ||
    host === '::1' ||
    host === '0:0:0:0:0:0:0:1' ||
    host.startsWith('fc') ||
    host.startsWith('fd') ||
    host.startsWith('fe80:')
  );
}

module.exports = {
  createAppProtocolRegistrar,
  hostMatchesAllowList,
  isAllowedMediaMethod,
  isLocalOrPrivateHostname,
  loadProxyCookieJars,
  parseCookieHeader,
  parseHostAllowList,
  pathToFileUrl,
  sanitizeMediaProxyHeaders,
  saveProxyCookieJars,
  splitSetCookieHeader,
  validateMediaTargetUrl,
};
