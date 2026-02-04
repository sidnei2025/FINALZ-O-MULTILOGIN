
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // CRÍTICO: Permite que o app funcione com o protocolo file:// no Electron
  resolve: {
    alias: {
      '@': path.resolve('src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
  },
  server: {
    port: 5173,
    strictPort: true,
  }
});
