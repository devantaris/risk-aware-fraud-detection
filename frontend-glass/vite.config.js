import { defineConfig } from 'vite';

export default defineConfig({
  // Dev server — proxy /api → localhost:8000 (only active during npm run dev)
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  // Production build — outputs to dist/ (Vercel reads this directory)
  build: {
    outDir: 'dist',
  },
});
