import { motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

interface HeaderProps {
  onContactClick: () => void
  onMemberLoginClick?: () => void
  onAdminLoginClick?: () => void
  member?: any
  onMemberDashboardClick?: () => void
}

const Header = ({ onContactClick, onMemberLoginClick, onAdminLoginClick, member, onMemberDashboardClick }: HeaderProps) => {
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

            {/* Inquire Button */}
            <motion.button
              onClick={onContactClick}
              className="bg-vortex-red text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 hover:bg-red-700 hover:scale-105 hover:shadow-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Inquire
            </motion.button>

            {/* Read Board Button */}
            <Link to="/read-board">
              <motion.button
                className="bg-white text-black px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 hover:bg-gray-100 hover:scale-105 hover:shadow-lg"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Read Board
              </motion.button>
            </Link>

            {/* Member Dashboard or Login Button */}
            {member && onMemberDashboardClick ? (
              <motion.button
                onClick={onMemberDashboardClick}
                className="bg-vortex-red text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 hover:bg-red-700 hover:scale-105 hover:shadow-lg"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Member Portal
              </motion.button>
            ) : (
              <motion.a
                href="https://app.jackrabbitclass.com/jr4.0/ParentPortal/Login?orgId=557920"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 hover:bg-gray-600 hover:scale-105 hover:shadow-lg inline-block"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Login
              </motion.a>
            )}

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
            
            {/* Divider Line */}
            <div className="border-t border-gray-700 my-4"></div>
            
            {/* Login Links */}
            <div className="space-y-3">
              {!member && (
                <a
                  href="https://app.jackrabbitclass.com/jr4.0/ParentPortal/Login?orgId=557920"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsMenuOpen(false)}
                  className="block w-full text-left text-white hover:text-vortex-red transition-colors duration-300 font-medium"
                >
                  Member Login
                </a>
              )}
              {onAdminLoginClick && (
                <button
                  onClick={() => {
                    onAdminLoginClick()
                    setIsMenuOpen(false)
                  }}
                  className="block w-full text-left text-white hover:text-vortex-red transition-colors duration-300 font-medium"
                >
                  Admin Login
                </button>
              )}
              <button
                onClick={() => {
                  onContactClick()
                  setIsMenuOpen(false)
                }}
                className="block w-full text-left text-white hover:text-vortex-red transition-colors duration-300 font-medium"
              >
                Inquire
              </button>
            </div>
          </div>
        </motion.nav>
      </div>
    </motion.header>
  )
}

export default Header
