import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Uploaded menu photos are served by the backend from /uploads; proxy it
      // in dev so <img src="/uploads/menu/..."> resolves the same way it will
      // in production (where both are the same origin).
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Split the 934KB monolithic bundle into per-page and per-vendor chunks.
    // Cashiers almost exclusively use the POS page; they shouldn't pay the
    // download/parse cost of Reports, Staff scheduling, Inventory, etc on
    // every session. Vendor splitting lets the browser cache heavy libs
    // (recharts, react-icons) independently of app code changes.
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — almost never changes, caches forever
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Charting lib — large, only needed on Reports/Dashboard
          'vendor-charts': ['recharts'],
          // Toast notifications — used everywhere but tiny, keep separate
          'vendor-toast': ['react-hot-toast'],
          // Icon library
          'vendor-icons': ['lucide-react'],
          // Axios
          'vendor-axios': ['axios'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});