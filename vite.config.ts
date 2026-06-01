import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // react-draggable (via react-rnd) reads process.env.DRAGGABLE_DEBUG on drag
    'process.env.DRAGGABLE_DEBUG': JSON.stringify(''),
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  server: {
    host: true,
    port: 5173,
  },
})
