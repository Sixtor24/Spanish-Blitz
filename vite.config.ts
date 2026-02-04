import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tsconfigPaths(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  clearScreen: false,
  server: {
    host: '0.0.0.0',
    port: 4000,
    strictPort: true,
    hmr: {
      overlay: false,
      clientPort: 4000,
    },
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
  build: {
    target: 'es2020',
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].[hash].js`,
        chunkFileNames: `assets/[name].[hash].js`,
        assetFileNames: `assets/[name].[hash].[ext]`,
        manualChunks(id) {
          // Only chunk vendor modules for client build
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react') || id.includes('sonner')) {
              return 'ui-vendor';
            }
            if (id.includes('react-hook-form') || id.includes('yup')) {
              return 'form-vendor';
            }
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: ['lucide-react', 'sonner'],
  },
});
