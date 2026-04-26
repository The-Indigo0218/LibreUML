import { defineConfig } from 'vitest/config'; 
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    open: false,
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