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

  build: {
    // Augmente le seuil d'avertissement (les pages sont déjà découpées via React.lazy)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Sépare les grosses librairies tierces dans leurs propres chunks
        // pour profiter du cache navigateur entre les déploiements.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-motion': ['framer-motion'],
          'vendor-xlsx': ['xlsx'],
        },
      },
    },
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
  },
});