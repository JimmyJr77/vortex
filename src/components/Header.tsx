import { motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

interface HeaderProps {
  onContactClick: () => void
}

const Header = ({ onContactClick }: HeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const location = useLocation()

  const menuItems = [
    { name: 'Athleticism Accelerator', to: '/athleticism-accelerator' },
    { name: 'Tramp & Tumble', to: '/trampoline-tumbling' },
    { name: 'Artistic Gymnastics', to: '/artistic-gymnastics' },
    { name: 'Rhythmic Gymnastics', to: '/rhythmic-gymnastics' },
    { name: 'Ninja and Fitness', to: '/ninja' },
  ]

  return (
    <motion.header 
      className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="container-custom">
        <div className="flex items-center justify-between h-20">
          {/* Logo - Clickable */}
          <Link to="/" className="block">
            <motion.div 
              className="flex items-center cursor-pointer"
              whileHover={{ scale: 1.05 }}
            >
              <img 
                src="/vortex_logo_1.png" 
                alt="Vortex Athletics" 
                className="h-16 w-auto"
              />
            </motion.div>
          </Link>

          {/* Sign Up Button and Hamburger Menu */}
          <div className="flex items-center space-x-4">

            {/* Stay Updated Button */}
            <motion.button
              onClick={onContactClick}
              className="bg-vortex-red text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 hover:bg-red-700 hover:scale-105 hover:shadow-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Stay Updated
            </motion.button>

            {/* Hamburger Menu Button */}
            <button
              className="text-white hover:text-vortex-red transition-colors duration-300"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>

        {/* Navigation Menu (Mobile & Desktop) */}
        <motion.nav
          className={`${isMenuOpen ? 'block' : 'hidden'}`}
          initial={{ opacity: 0, height: 0 }}
          animate={{ 
            opacity: isMenuOpen ? 1 : 0, 
            height: isMenuOpen ? 'auto' : 0 
          }}
          transition={{ duration: 0.3 }}
        >
          <div className="py-4 space-y-4 border-t border-gray-800">
            {menuItems.map((item) => (
              <Link
                key={item.name}
                to={item.to}
                onClick={() => setIsMenuOpen(false)}
                className={`block ${
                  location.pathname === item.to ? 'text-vortex-red' : 'text-white'
                } hover:text-vortex-red transition-colors duration-300 font-medium`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </motion.nav>
      </div>
    </motion.header>
  )
}

export default Header
