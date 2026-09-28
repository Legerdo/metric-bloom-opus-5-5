import { defineConfig } from 'vite';

// Relative base so the built game can be served from any sub-path (itch.io, GitHub Pages, etc.)
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    target: 'es2022',
  },
  server: {
    port: 5173,
  },
});
