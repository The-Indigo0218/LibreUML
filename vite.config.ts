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
        manualChunks: {
          'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
          'vendor-konva':  ['konva', 'react-konva'],
          'vendor-i18n':   ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          'vendor-state':  ['zustand', 'immer'],
          'vendor-export': ['jszip', 'file-saver'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  }
});