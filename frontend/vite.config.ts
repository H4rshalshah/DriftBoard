import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: '/',
  plugins: [
    react({
      // Enable fast refresh with proper error handling
      fastRefresh: true,
      // Babel configuration for optimal transform speed
      babel: {
        plugins: [],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    // Enable HMR with WebSocket for fast reloading
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 3001,
      timeout: 30000,
    },
    // Warm up frequently used files for instant reload
    warmup: {
      clientFiles: [
        './src/main.tsx',
        './src/App.tsx',
        './src/store/index.ts',
      ],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
      },
    },
  },
  // Optimize dependency pre-bundling for faster startup
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'framer-motion',
      'lucide-react',
      'zustand',
      'axios',
    ],
    // Exclude large dependencies from pre-bundling
    exclude: ['@monaco-editor/react'],
  },
  build: {
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Minify with esbuild for speed
    minify: 'esbuild',
    // Target modern browsers
    target: 'es2020',
    // Rollup options for optimal chunking
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          animation: ['framer-motion'],
          ui: ['lucide-react', 'recharts', '@xyflow/react'],
          state: ['zustand', 'axios'],
        },
      },
    },
  },
});
