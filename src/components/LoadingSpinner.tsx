import { motion } from 'framer-motion'

const LoadingSpinner = () => {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      <motion.div
        className="flex flex-col items-center space-y-4"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="w-16 h-16 bg-vortex-red rounded-2xl flex items-center justify-center">
          <span className="text-white font-bold text-2xl">V</span>
        </div>
        <motion.div
          className="w-8 h-8 border-4 border-vortex-red border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        <p className="text-white text-lg font-semibold">Loading Vortex Athletics...</p>
      </motion.div>
    </div>
  )
}

export default LoadingSpinner
