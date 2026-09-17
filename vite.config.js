import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  define: {
    '%VITE_GTM_ID%': JSON.stringify(process.env.VITE_GTM_ID || ''),
  },
  server: {
    host: true,
    port: 5173,
    open: true,
  },
});
