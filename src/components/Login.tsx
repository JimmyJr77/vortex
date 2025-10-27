import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Lock, User } from 'lucide-react'

interface LoginProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function Login({ isOpen, onClose, onSuccess }: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (username === 'admin' && password === 'T3@Mvortex25!') {
      onSuccess()
      onClose()
      // Store login state in localStorage
      localStorage.setItem('vortex_admin', 'true')
    } else {
      setError('Invalid username or password')
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
                Admin Login
              </h2>
              <p className="text-gray-600">Enter your credentials to access the admin dashboard</p>
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                <strong className="font-bold">Error!</strong>
                <span className="block sm:inline"> {error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-gray-700 text-sm font-bold mb-2">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vortex-red focus:border-transparent transition-colors"
                    required
                    autoFocus
                  />
                </div>
              </div>

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

              <motion.button
                type="submit"
                className="w-full bg-vortex-red text-white px-6 py-3 rounded-lg font-semibold text-lg transition-all duration-300 hover:bg-red-700 hover:scale-105 hover:shadow-lg"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Login
              </motion.button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

