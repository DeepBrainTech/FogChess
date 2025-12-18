import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    // 静态资源处理优化
    assetsInlineLimit: 0, // 确保图片不被内联为 base64，使用 HTTP 缓存
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]', // 使用 hash 确保缓存
      },
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0', // 允许外部访问
    watch: {
      usePolling: true, // Docker 环境推荐使用轮询模式
      interval: 1000, // 轮询间隔
    },
    hmr: {
      host: 'localhost', // HMR 客户端连接的主机
      port: 8080, // HMR 端口（映射到宿主机的端口）
    },
    proxy: {
      '/api': {
        // In docker-compose, the backend is reachable by service name 'backend'
        // Fallback to localhost for non-docker local runs
        target: process.env.BACKEND_URL || 'http://backend:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  define: {
    'process.env': {},
  },
});