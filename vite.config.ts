import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8030',
        changeOrigin: true,
        secure: false,
      },
      '/media': {
        target: 'http://localhost:8030',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  build: {
    chunkSizeWarningLimit: 1000,
    // Supprime tous les console.* du bundle de production (sécurité)
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-motion': ['framer-motion'],
          'vendor-xlsx': ['xlsx'],
        },
      },
    },
  },
  esbuild: {
    // Élimine tous les appels console.* dans le build de production
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
  },
});