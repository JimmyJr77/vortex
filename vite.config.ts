import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { loadPublicAdultBooking } from './scripts/load-public-adult-booking'
import { PUBLIC_API_ORIGIN } from './src/config/publicCatalog'

// https://vite.dev/config/
export default defineConfig(async ({ command, mode }) => {
  const { VITE_API_URL } = loadEnv(mode, process.cwd(), 'VITE_')
  const usePublicCatalog = command === 'build' && mode === 'production' &&
    (!VITE_API_URL || VITE_API_URL.replace(/\/$/, '') === PUBLIC_API_ORIGIN)
  const adultBooking = usePublicCatalog ? await loadPublicAdultBooking().catch(() => null) : null
  if (usePublicCatalog) {
    console.info(adultBooking ? 'Loaded adult gymnastics booking summary' : 'Adult gymnastics booking summary unavailable; using live booking links')
  }
  return {
    plugins: [react()],
    define: {
      // react-draggable (via react-rnd) reads process.env.DRAGGABLE_DEBUG on drag
      'process.env.DRAGGABLE_DEBUG': JSON.stringify(''),
      __PUBLIC_ADULT_BOOKING__: JSON.stringify(adultBooking),
    },
    server: {
      host: true,
      port: 5173,
    },
  }
})
