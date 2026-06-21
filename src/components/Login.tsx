import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Lock, User } from 'lucide-react'
import { getApiUrl } from '../utils/api'

interface LoginProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (admin?: Record<string, unknown>, token?: string) => void
}

export default function Login({ isOpen, onClose, onSuccess }: LoginProps) {
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [resetEmail, setResetEmail] = useState('')
  const [forgotMode, setForgotMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail, password })
      })

      const data = await response.json()
      
      if (response.ok && data.success) {
        // Store login state in localStorage
        localStorage.setItem('vortex_admin', 'true')
        // Store admin token - check both 'token' and 'adminToken' field names
        const tokenValue = data.token || data.adminToken

        if (tokenValue) {
          localStorage.setItem('adminToken', tokenValue)
        } else {
          setError('Login succeeded but no auth token was returned by the server.')
          return
        }
        // Store admin info for edit tracking
        const adminData = {
          email: data.admin.email,
          name: `${data.admin.firstName} ${data.admin.lastName}`,
          id: data.admin.id,
          firstName: data.admin.firstName,
          lastName: data.admin.lastName,
          phone: data.admin.phone,
          username: data.admin.username,
          isMaster: data.admin.isMaster
        }
        localStorage.setItem('vortex-admin-info', JSON.stringify(adminData))
        localStorage.setItem('vortex-admin-id', data.admin.id.toString())
        onSuccess(data.admin, tokenValue)
        onClose()
        setUsernameOrEmail('')
        setPassword('')
      } else {
        setError(data.message || 'Invalid username/email or password')
      }
    } catch (error) {
      console.error('Login error:', error)
      setError('Unable to connect to server. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResetSent(false)
    setIsSubmitting(true)
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.success === false) {
        setError(data.message || 'Unable to process password reset request')
      } else {
        setResetSent(true)
      }
    } catch (err) {
      console.error('Admin reset request error:', err)
      setError('Unable to connect to server. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100] p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 relative"
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-6">
              <div className="mx-auto w-16 h-16 bg-vortex-red/10 rounded-full flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-vortex-red" />
              </div>
              <h2 className="text-3xl font-display font-bold text-black mb-2">
                {forgotMode ? 'Reset Admin Password' : 'Admin Login'}
              </h2>
              <p className="text-gray-600">
                {forgotMode
                  ? 'Enter your admin account email to receive a temporary password.'
                  : 'Enter your credentials to access the admin dashboard'}
              </p>
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                <strong className="font-bold">Error!</strong>
                <span className="block sm:inline"> {error}</span>
              </div>
            )}

            <form onSubmit={forgotMode ? handleReset : handleSubmit} className="space-y-4">
              {resetSent && (
                <div className="bg-green-100 border border-green-300 text-green-800 px-4 py-3 rounded">
                  If an admin account exists for this email, a temporary password has been sent.
                </div>
              )}
              <div>
                <label htmlFor="usernameOrEmail" className="block text-gray-700 text-sm font-bold mb-2">
                  {forgotMode ? 'Admin Email' : 'Username or Email'}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={forgotMode ? 'email' : 'text'}
                    id="usernameOrEmail"
                    name="usernameOrEmail"
                    value={forgotMode ? resetEmail : usernameOrEmail}
                    onChange={(e) => (forgotMode ? setResetEmail(e.target.value) : setUsernameOrEmail(e.target.value))}
                    placeholder={forgotMode ? 'Enter admin email' : 'Enter username or email'}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vortex-red focus:border-transparent transition-colors"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {!forgotMode && (
              <div>
                <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vortex-red focus:border-transparent transition-colors"
                    required
                  />
                </div>
              </div>
              )}

              <motion.button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-vortex-red text-white px-6 py-3 rounded-lg font-semibold text-lg transition-all duration-300 hover:bg-red-700 hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
              >
                {isSubmitting ? (forgotMode ? 'Submitting...' : 'Logging in...') : (forgotMode ? 'Send Temporary Password' : 'Login')}
              </motion.button>
              <button
                type="button"
                className="w-full text-sm text-vortex-red hover:text-red-700"
                onClick={() => {
                  setError('')
                  setResetSent(false)
                  setForgotMode((value) => !value)
                }}
              >
                {forgotMode ? 'Back to login' : 'Forgot password?'}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

