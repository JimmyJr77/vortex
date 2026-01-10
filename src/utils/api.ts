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

/**
 * Get admin token from localStorage
 */
export const getAdminToken = (): string | null => {
  return localStorage.getItem('adminToken')
}

/**
 * Make an authenticated admin API request
 * Automatically includes the Authorization header with the admin token
 */
export const adminApiRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const apiUrl = getApiUrl()
  const token = getAdminToken()
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  return fetch(`${apiUrl}${endpoint}`, {
    ...options,
    headers,
  })
}

