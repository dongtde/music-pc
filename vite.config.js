import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const readEnv = (keys, fallback) => {
    for (const key of keys) {
      const value = process.env[key] ?? env[key];

      if (value !== undefined && value !== '') {
        return value;
      }
    }

    return fallback;
  };
  const appBuildVersion = `${Date.now().toString(36)}`;
  const desktopDevPort =
    Number(readEnv(['VITE_DEV_SERVER_PORT'], '5174')) || 5174;
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
  const proxy = createProxyConfig({
    kugouApiBase,
    kugouApiTarget,
    neteaseApiBase,
    neteaseApiTarget,
  });

  return {
    base: mode === 'desktop' ? './' : '/',
    plugins: [vue()],
    define: {
      __APP_BUILD_VERSION__: JSON.stringify(appBuildVersion),
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      hmr:
        mode === 'desktop'
          ? {
              protocol: 'ws',
              host: '127.0.0.1',
              clientPort: desktopDevPort,
            }
          : undefined,
      allowedHosts: ['.cpolar.top'],
      proxy,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined;
            }

            if (id.includes('naive-ui')) {
              return 'vendor-naive';
            }

            if (id.includes('lucide-vue-next')) {
              return 'vendor-icons';
            }

            if (id.includes('axios')) {
              return 'vendor-http';
            }

            return 'vendor';
          },
        },
      },
    },
  };
});

function createProxyConfig({
  kugouApiBase,
  kugouApiTarget,
  neteaseApiBase,
  neteaseApiTarget,
}) {
  const proxy = {};

  if (kugouApiTarget) {
    proxy[`^${escapeRegExp(kugouApiBase)}`] = createProxyEntry(
      kugouApiBase,
      kugouApiTarget,
    );
  }

  if (neteaseApiTarget) {
    proxy[`^${escapeRegExp(neteaseApiBase)}`] = createProxyEntry(
      neteaseApiBase,
      neteaseApiTarget,
    );
  }

  return proxy;
}

function createProxyEntry(basePath, target) {
  return {
    target,
    changeOrigin: true,
    rewrite: (path) =>
      path.replace(new RegExp(`^${escapeRegExp(basePath)}`), ''),
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
