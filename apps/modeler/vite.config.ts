import { defineConfig } from 'vitest/config'; 
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    open: false,
    headers: {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "connect-src 'self' http://localhost:8080 ws://localhost:5173 https://app.posthog.com",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
      ].join('; '),
    },
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('konva') || id.includes('react-konva')) return 'vendor-konva';
            if (id.includes('lucide-react')) return 'vendor-ui';
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) return 'vendor-react';
            if (id.includes('i18next')) return 'vendor-i18n';
            if (id.includes('zustand') || id.includes('immer')) return 'vendor-state';
            if (id.includes('jszip') || id.includes('file-saver')) return 'vendor-export';
          }
          if (id.includes('/src/canvas/') || id.includes('/src/hooks/canvas/')) return 'app-canvas';
          if (id.includes('/src/store/') || id.includes('/src/core/') || id.includes('/src/services/') || id.includes('/src/adapters/')) return 'app-stores';
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  }
});