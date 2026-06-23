import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const appBuildVersion = `${Date.now().toString(36)}`;
  const desktopDevPort = Number(process.env.VITE_DEV_SERVER_PORT) || 5174;
  const kugouApiTarget =
    process.env.KUGOU_API_TARGET || 'https://kugou.cyouhong.cn/';
  const neteaseApiTarget =
    process.env.NETEASE_API_TARGET || 'https://music-api.xcj.pw';

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
      proxy: {
        '^/api': {
          target: kugouApiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '^/netease-api': {
          target: neteaseApiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/netease-api/, ''),
        },
      },
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
