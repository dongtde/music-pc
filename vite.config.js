import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const desktopDevPort = Number(process.env.VITE_DEV_SERVER_PORT) || 5174;

  return {
  base: mode === 'desktop' ? './' : '/',
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    hmr: mode === 'desktop'
      ? {
          protocol: 'ws',
          host: '127.0.0.1',
          clientPort: desktopDevPort,
        }
      : undefined,
    allowedHosts: ['.cpolar.top'], // 带点=放行所有xxx.cpolar.top二级域名
    // 新增代理配置
    proxy: {
      '^/api': {
        target: 'http://localhost:4000', // 后端地址
        // target: 'https://ku-gou-music-api-i2hh.vercel.app', // 后端地址
        changeOrigin: true,

        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '^/netease-api': {
        target: 'http://localhost:3000',
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
