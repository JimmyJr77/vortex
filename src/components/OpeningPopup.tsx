import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Calendar, Users, AlertCircle } from 'lucide-react'

interface OpeningPopupProps {
  isOpen: boolean
  onClose: () => void
  onSignUp: () => void
}

export default function OpeningPopup({ isOpen, onClose, onSignUp }: OpeningPopupProps) {
  const [hasSeenPopup, setHasSeenPopup] = useState(false)

  useEffect(() => {
    // Check if user has already seen the popup
    const seen = localStorage.getItem('vortex-opening-popup-seen')
    if (seen) {
      setHasSeenPopup(true)
    }
  }, [])

  const handleClose = () => {
    // Mark as seen in localStorage
    localStorage.setItem('vortex-opening-popup-seen', 'true')
    setHasSeenPopup(true)
    onClose()
  }

  const handleSignUp = () => {
    onSignUp()
    handleClose()
  }

  // Don't show if user has already seen it
  if (hasSeenPopup) {
    return null
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          {/* Popup Content */}
          <motion.div
            className="relative bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
          >
            {/* Close Button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Content */}
            <div className="text-center">
              {/* Icon */}
              <motion.div
                className="mx-auto w-16 h-16 bg-vortex-red/10 rounded-full flex items-center justify-center mb-6"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", duration: 0.5 }}
              >
                <Calendar className="w-8 h-8 text-vortex-red" />
              </motion.div>

              {/* Title */}
              <motion.h2
                className="text-3xl font-display font-bold text-black mb-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                Opening November 30th, 2025!
              </motion.h2>

              {/* Message */}
              <motion.div
                className="space-y-4 mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <p className="text-lg text-gray-700">
                  Programs starting November 30th, 2025
                </p>
                
                <div className="flex items-center justify-center space-x-2 text-vortex-red font-semibold">
                  <Users className="w-5 h-5" />
                  <span>Spots are limited</span>
                </div>

                <p className="text-gray-600">
                  Sign up for updates to get information as soon as registration opens!
                </p>
              </motion.div>

              {/* CTA Buttons */}
              <motion.div
                className="flex flex-col sm:flex-row gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <button
                  onClick={handleSignUp}
                  className="flex-1 bg-vortex-red text-white px-6 py-3 rounded-lg font-semibold text-lg transition-all duration-300 hover:bg-red-700 hover:scale-105 hover:shadow-lg"
                >
                  Stay Updated
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold text-lg transition-all duration-300 hover:border-gray-400 hover:bg-gray-50"
                >
                  Maybe Later
                </button>
              </motion.div>

              {/* Urgency Indicator */}
              <motion.div
                className="mt-6 flex items-center justify-center space-x-2 text-sm text-gray-500"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <AlertCircle className="w-4 h-4" />
                <span>Don't miss out on early registration!</span>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
