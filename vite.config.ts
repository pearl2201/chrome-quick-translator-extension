import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite'
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config.ts' // FIX: Clean relative import
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest }),],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html'),
        crop: resolve(__dirname, 'crop.html'),
        translate: resolve(__dirname, 'translate.html'),
        dict: resolve(__dirname, 'dict.html'),
        batch: resolve(__dirname, 'batch.html'),
      },
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-ocr',
              test: /node_modules[\\/]tesseract\.js/,
              priority: 20,
            },
            {
              name: 'vendor-canvas',
              test: /node_modules[\\/](konva|react-konva)/,
              priority: 15,
            }
          ]
        }
      }
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // FIX: Replaced server.hmr with server.ws to eliminate the deprecation warning
    ws: {
      port: 5174,
    },
  },
})
