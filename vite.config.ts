import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      // Proxy ComfyUI REST API requests to avoid CORS
      '/comfyui-api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/comfyui-api/, ''),
      },
      // Proxy ComfyUI WebSocket connections
      '/comfyui-ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
        changeOrigin: true, // Set to true so Host header is target
        rewrite: (path) => path.replace(/^\/comfyui-ws/, '/ws'),
        configure: (proxy) => {
          proxy.on('proxyReqWs', (proxyReq, _req, _socket, _options, _head) => {
            // Force Origin to match target for WS upgrade
            proxyReq.setHeader('Origin', 'http://127.0.0.1:8000');
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})
