import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// base para GitHub Pages: https://tatishernandez.github.io/cubo/
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/cubo/' : '/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        print: resolve(import.meta.dirname, 'print.html'),
      },
    },
  },
});
