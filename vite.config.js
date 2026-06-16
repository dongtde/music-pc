import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

function stripProxyCookies(proxy) {
  proxy.on('proxyReq', (proxyReq) => {
    proxyReq.removeHeader('cookie');
  });

  proxy.on('proxyRes', (proxyRes) => {
    delete proxyRes.headers['set-cookie'];
  });
}

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    allowedHosts: ['.cpolar.top'], // 带点=放行所有xxx.cpolar.top二级域名
    // 新增代理配置
    proxy: {
      '^/api': {
        target: 'http://localhost:4000', // 后端地址
        // target: 'https://ku-gou-music-lz3rukudb-dongtdes-projects.vercel.app', // 后端地址
        changeOrigin: true,
        configure: stripProxyCookies,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '^/netease-api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        configure: stripProxyCookies,
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
});
