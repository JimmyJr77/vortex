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
  const isOverviewPage = location.pathname === '/overview'

  const menuItems = isOverviewPage 
    ? [
        { name: 'FAQ', href: '#faq' },
        { name: 'Contact', action: onContactClick },
      ]
    : [
        { name: 'About', href: '#about' },
        { name: 'Programs', href: '#programs' },
        { name: 'Technology', href: '#technology' },
        { name: 'Contact', action: onContactClick },
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
          {/* Logo */}
          <motion.div 
            className="flex items-center"
            whileHover={{ scale: 1.05 }}
          >
            <img 
              src="/vortex_logo_1.png" 
              alt="Vortex Athletics" 
              className="h-16 w-auto"
            />
          </motion.div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {menuItems.map((item, index) => (
              <motion.a
                key={item.name}
                href={item.href}
                onClick={item.action}
                className="text-white hover:text-vortex-red transition-colors duration-300 font-medium"
                whileHover={{ scale: 1.05 }}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                {item.name}
              </motion.a>
            ))}
            <motion.button
              onClick={onContactClick}
              className="bg-vortex-red text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 hover:bg-red-700 hover:scale-105 hover:shadow-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Stay Informed
            </motion.button>
            {isOverviewPage && (
              <Link to="/">
                <motion.button
                  className="bg-white text-vortex-red px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 hover:bg-gray-100 hover:scale-105 hover:shadow-lg"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Home Page
                </motion.button>
              </Link>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-white"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        <motion.nav
          className={`md:hidden ${isMenuOpen ? 'block' : 'hidden'}`}
          initial={{ opacity: 0, height: 0 }}
          animate={{ 
            opacity: isMenuOpen ? 1 : 0, 
            height: isMenuOpen ? 'auto' : 0 
          }}
          transition={{ duration: 0.3 }}
        >
          <div className="py-4 space-y-4 border-t border-gray-800">
            {menuItems.map((item) => (
              <a
                key={item.name}
                href={item.href}
                onClick={() => {
                  item.action?.()
                  setIsMenuOpen(false)
                }}
                className="block text-white hover:text-vortex-red transition-colors duration-300 font-medium"
              >
                {item.name}
              </a>
            ))}
            <button
              onClick={() => {
                onContactClick()
                setIsMenuOpen(false)
              }}
              className="btn-primary w-full"
            >
              Stay Informed
            </button>
            {isOverviewPage && (
              <Link
                to="/"
                onClick={() => setIsMenuOpen(false)}
                className="block"
              >
                <button className="bg-white text-vortex-red w-full px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 hover:bg-gray-100">
                  Home Page
                </button>
              </Link>
            )}
          </div>
        </motion.nav>
      </div>
    </motion.header>
  )
}

export default Header
