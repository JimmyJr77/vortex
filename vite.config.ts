import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { loadPublicBooking } from './scripts/load-public-booking'
import { PUBLIC_API_ORIGIN } from './src/config/publicCatalog'

// https://vite.dev/config/
export default defineConfig(async ({ command, mode }) => {
  const { VITE_API_URL } = loadEnv(mode, process.cwd(), 'VITE_')
  const usePublicCatalog = command === 'build' && mode === 'production' &&
    (!VITE_API_URL || VITE_API_URL.replace(/\/$/, '') === PUBLIC_API_ORIGIN)
  const booking = usePublicCatalog ? await loadPublicBooking().catch(() => null) : null
  if (usePublicCatalog) {
    const loaded = Object.entries(booking ?? {}).flatMap(([path, summary]) => summary ? [path] : [])
    console.info(loaded.length ? `Loaded booking summaries for ${loaded.join(', ')}` : 'Booking summaries unavailable; using live booking links')
  }
  return {
    plugins: [react()],
    define: {
      // react-draggable (via react-rnd) reads process.env.DRAGGABLE_DEBUG on drag
      'process.env.DRAGGABLE_DEBUG': JSON.stringify(''),
      __PUBLIC_BOOKING_SNAPSHOT__: JSON.stringify(booking),
    },
    server: {
      host: true,
      port: 5173,
    },
  }
})
