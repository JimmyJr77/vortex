import { motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useSiteHeaderHeight } from '../hooks/useSiteHeaderHeight'
import { Link, useLocation } from 'react-router-dom'
import { HUB_NAV_MENU_ENTRIES } from '../config/hubNavMenu'
import NavMenuDivider, { NAV_MENU_DIVIDER_CLASS } from './NavMenuDivider'
import {
  NINJA_HOLD_TITLE,
  ninjaOnHoldNavClass,
} from '../utils/ninjaProgram'
import { HUB_HEADER_LOGO } from '../utils/seo'
import { getSiteEnrollHref } from '../utils/enrollSite'
import {
  JACKRABBIT_CLASS_REGISTRATION_URL,
  JACKRABBIT_PARENT_PORTAL_URL,
} from '../config/contact'

interface HeaderProps {
  onContactClick: () => void
  onAdminLoginClick?: () => void
  member?: any
  onMemberDashboardClick?: () => void
}

const Header = ({ onContactClick, onAdminLoginClick, member, onMemberDashboardClick }: HeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  useSiteHeaderHeight(headerRef)
  const location = useLocation()

  const linkClass = (active: boolean) =>
    `block ${
      active ? 'text-vortex-red' : 'text-white'
    } hover:text-vortex-red transition-colors duration-300 font-medium`

  return (
    <header
      ref={headerRef}
      className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm header-slide-in"
    >
      <div className="container-custom">
        {/* Mobile Layout: Logo on top, buttons below */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-4 md:py-0 md:h-20">
          {/* Logo - Clickable - Full width on mobile, auto on desktop */}
          <div className="flex items-center justify-between md:justify-start mb-4 md:mb-0">
            <Link to="/" className="block">
              <motion.div 
                className="flex items-center cursor-pointer"
                whileHover={{ scale: 1.05 }}
              >
                <img 
                  src={HUB_HEADER_LOGO} 
                  alt="Vortex Athletics" 
                  className="h-10 md:h-12 w-auto"
                />
              </motion.div>
            </Link>

            {/* Hamburger Menu Button - Only visible on mobile, next to logo */}
            <button
              className="text-white hover:text-vortex-red transition-colors duration-300 md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>

          {/* Primary Navigation Buttons - Below logo on mobile, to the right on desktop */}
          <div className="flex items-center space-x-2 md:space-x-4 flex-wrap gap-2 md:gap-0">
            {/* Inquire Button */}
            <motion.button
              onClick={onContactClick}
              className="bg-vortex-red text-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-semibold text-xs md:text-sm transition-all duration-300 hover:bg-red-700 hover:scale-105 hover:shadow-lg flex-1 md:flex-none min-w-[80px] md:min-w-0"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Inquire
            </motion.button>

            {/* Classes & Events Button */}
            <Link to="/read-board" className="flex-1 md:flex-none min-w-[80px] md:min-w-0">
              <motion.button
                className="bg-white text-black px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-semibold text-xs md:text-sm transition-all duration-300 hover:bg-gray-100 hover:scale-105 hover:shadow-lg w-full"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Classes & Events
              </motion.button>
            </Link>

            {/* Member Dashboard or Login Button */}
            {member && onMemberDashboardClick ? (
              <motion.button
                onClick={onMemberDashboardClick}
                className="bg-vortex-red text-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-semibold text-xs md:text-sm transition-all duration-300 hover:bg-red-700 hover:scale-105 hover:shadow-lg flex-1 md:flex-none min-w-[80px] md:min-w-0"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Member Portal
              </motion.button>
            ) : (
              <Link
                to={getSiteEnrollHref()}
                className="bg-vortex-red text-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-semibold text-xs md:text-sm transition-all duration-300 hover:bg-red-700 hover:scale-105 hover:shadow-lg inline-block flex-1 md:flex-none min-w-[80px] md:min-w-0 text-center"
              >
                <motion.span
                  className="inline-block"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Enroll
                </motion.span>
              </Link>
            )}

            {/* Hamburger Menu Button - Only visible on desktop */}
            <button
              className="text-white hover:text-vortex-red transition-colors duration-300 hidden md:block"
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
          <div className={`py-4 space-y-4 ${NAV_MENU_DIVIDER_CLASS}`}>
            {HUB_NAV_MENU_ENTRIES.map((entry, index) => {
              if (entry.kind === 'divider') {
                return <NavMenuDivider key={`divider-${index}`} />
              }

              if ('onHold' in entry && entry.onHold) {
                return (
                  <span
                    key={entry.label}
                    aria-disabled="true"
                    title={NINJA_HOLD_TITLE}
                    className={ninjaOnHoldNavClass}
                  >
                    {entry.label}
                    <span className="sr-only"> (on hold)</span>
                  </span>
                )
              }

              if ('href' in entry) {
                return (
                  <a
                    key={entry.label}
                    href={entry.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsMenuOpen(false)}
                    className={linkClass(false)}
                  >
                    {entry.label}
                  </a>
                )
              }

              return (
                <Link
                  key={entry.label}
                  to={entry.to}
                  onClick={() => setIsMenuOpen(false)}
                  className={linkClass(location.pathname === entry.to)}
                >
                  {entry.label}
                </Link>
              )
            })}
            
            <NavMenuDivider className="my-4" />
            
            {/* Login Links */}
            <div className="space-y-3">
              {!member && (
                <a
                  href={JACKRABBIT_PARENT_PORTAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsMenuOpen(false)}
                  className="block w-full text-left text-white hover:text-vortex-red transition-colors duration-300 font-medium"
                >
                  Member Login
                </a>
              )}
              <a
                href={JACKRABBIT_CLASS_REGISTRATION_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsMenuOpen(false)}
                className="block w-full text-left text-white hover:text-vortex-red transition-colors duration-300 font-medium"
              >
                Jackrabbit Class Login
              </a>
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
    </header>
  )
}

export default Header
