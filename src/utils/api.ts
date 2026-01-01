/**
 * Get the API URL based on environment
 * - Uses VITE_API_URL if set (for local development)
 * - Falls back to production URL in production builds
 * - Falls back to localhost in development
 */
export const getApiUrl = (): string => {
  // If VITE_API_URL is explicitly set, use it (for local dev)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  
  // In production builds, use production backend
  if (import.meta.env.PROD) {
    return 'https://vortex-backend-qybl.onrender.com'
  }
  
  // In development, use localhost
  return 'http://localhost:3001'
}

