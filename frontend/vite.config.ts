import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
      base: './',
      define: {
        // This is just generic value for the GEMINI API key.
        // This is not used at all, and can be ignored!
        'process.env.API_KEY' : JSON.stringify('api-key-this-is-not-used-can-be-ignored!'),
      },
      server: {
        proxy: {
          //Target your Node.js backend
          '/api-proxy': {
            target: process.env.NODE_ENV === 'production' ? 'https://quan-scan-backend.onrender.com' : 'http://localhost:8080',
            changeOrigin: true
          },
          '/ws-proxy': {
            target: process.env.NODE_ENV === 'production' ? 'wss://quan-scan-backend.onrender.com' : 'ws://localhost:8080',
            ws: true,
            changeOrigin: true
          },
        },
      },
      plugins: react(),
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
