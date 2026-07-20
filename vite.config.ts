import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import os from 'os';

// Détecte l'IP WiFi locale (192.168.x.x) pour les QR codes accessibles sur le même réseau
function getLocalNetworkIP(): string {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address.startsWith('192.168.')) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

export default defineConfig({
  plugins: [react()],
  define: {
    // IP réseau locale injectée au démarrage de Vite (utilisée pour les QR codes)
    __LOCAL_NETWORK_IP__: JSON.stringify(getLocalNetworkIP()),
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },

  server: {
    host: true,   // écoute sur 0.0.0.0 → accessible depuis le réseau local
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