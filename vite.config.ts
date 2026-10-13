import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        // Long-lived vendor chunks: app deploys don't invalidate cached libraries.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/node_modules[\/](react|react-dom|react-router|scheduler)[\/]/.test(id)) return 'react';
          if (/node_modules[\/](@tanstack|zustand)[\/]/.test(id)) return 'data';
          if (/node_modules[\/](motion|framer-motion|motion-dom|motion-utils)[\/]/.test(id)) return 'motion';
        },
      },
    },
  },
  // Pre-bundle lazily imported deps so the dev server doesn't re-optimise
  // mid-session (which loads a second copy of React).
  optimizeDeps: {
    include: ['leaflet', 'react-leaflet'],
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  }
})
