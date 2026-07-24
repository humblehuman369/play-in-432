import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths required for Capacitor (file / capacitor origin).
  base: './',
  build: {
    // Keep sourcemaps off for smaller store packages
    sourcemap: false,
  },
  server: {
    // Useful if you ever use `cap run` with live reload
    host: true,
  },
})
