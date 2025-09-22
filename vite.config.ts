import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Use a relative base path by default so the bundle works both on GitHub Pages
  // (where it may live under a project subdirectory) and on a root-level
  // custom domain without requiring extra configuration.
  base: process.env.GITHUB_PAGES_BASE ?? './',
  plugins: [react()],
});
