import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // React changes rarely: its own chunk stays cached across releases.
        manualChunks: { react: ['react', 'react-dom'] },
      },
    },
  },
  server: { port: 5174 },
});
