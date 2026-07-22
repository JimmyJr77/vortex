import { motion } from 'framer-motion'
import { LayoutGrid, Menu, UserCircle, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useSiteHeaderHeight } from '../hooks/useSiteHeaderHeight'
import { Link, useLocation } from 'react-router-dom'
import { HUB_NAV_MENU_ENTRIES } from '../config/hubNavMenu'
import NavMenuDivider, { NAV_MENU_DIVIDER_CLASS } from './NavMenuDivider'
import SpecialPageNavSection from './SpecialPageNavSection'
import useSpecialPages from '../hooks/useSpecialPages'
import {
  NINJA_HOLD_TITLE,
  ninjaOnHoldNavClass,
} from '../utils/ninjaProgram'
import { HUB_HEADER_LOGO } from '../utils/seo'
import { getSiteEnrollHref } from '../utils/enrollSite'

interface HeaderProps {
  onContactClick: () => void
  onAdminLoginClick?: () => void
  member?: unknown
  onMemberDashboardClick?: () => void
}

const Header = ({ onContactClick, onAdminLoginClick, member, onMemberDashboardClick }: HeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  useSiteHeaderHeight(headerRef)
  const location = useLocation()
  const { pages: specialPages } = useSpecialPages()
  const showPrimaryActions = true
  const hasMobilePrimaryActions = showPrimaryActions || Boolean(member && onMemberDashboardClick)
  const handleProfileClick = () => {
    if (member && onMemberDashboardClick) {
      onMemberDashboardClick()
      return
    }
    onAdminLoginClick?.()
  }

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
        <div className="flex flex-col min-[1075px]:flex-row min-[1075px]:items-center min-[1075px]:justify-between py-4 min-[1075px]:py-0 min-[1075px]:h-20">
          {/* Logo - Clickable - Full width on mobile, auto on desktop */}
          <div
            className={`flex items-center justify-between gap-5 px-1 min-[1075px]:justify-start min-[1075px]:px-0 ${
              hasMobilePrimaryActions ? 'mb-4' : 'mb-0'
            } min-[1075px]:mb-0`}
          >
            <Link to="/" className="block min-w-0 flex-1 min-[1075px]:flex-none">
              <motion.div 
                className="flex items-center cursor-pointer"
                whileHover={{ scale: 1.05 }}
              >
                <img 
                  src={HUB_HEADER_LOGO} 
                  alt="Vortex Athletics" 
                  className="h-10 max-w-full w-auto min-[1075px]:h-12"
                />
              </motion.div>
            </Link>

            {/* Hamburger Menu Button - Only visible on mobile, next to logo */}
            <div className="flex shrink-0 items-center gap-5 min-[1075px]:hidden">
              <button
                type="button"
                onClick={handleProfileClick}
                className="text-white transition-colors duration-300 hover:text-vortex-red"
                aria-label={member ? 'Open member portal' : 'Account login'}
                title={member ? 'Member Portal' : 'Account Login'}
              >
                <UserCircle size={28} />
              </button>
              <button
                type="button"
                className="text-white hover:text-vortex-red transition-colors duration-300"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              >
                {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
              </button>
            </div>
          </div>

          {/* Primary Navigation Buttons - Below logo on mobile, to the right on desktop */}
          <div className="flex items-center space-x-2 min-[1075px]:space-x-4 flex-wrap gap-2 min-[1075px]:gap-0">
            {showPrimaryActions && (
              <>
                {/* Inquire Button */}
                <motion.button
                  onClick={onContactClick}
                  className="bg-vortex-red text-white px-4 py-2 min-[1075px]:px-5 min-[1075px]:py-2.5 rounded-lg font-semibold text-xs min-[1075px]:text-sm transition-all duration-300 hover:bg-red-700 hover:scale-105 hover:shadow-lg flex-1 min-[1075px]:flex-none min-w-[80px] min-[1075px]:min-w-0"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Inquire
                </motion.button>

                {/* Classes & Events Button */}
                <Link
                  to="/read-board"
                  className="min-w-[3rem] flex-none min-[1075px]:min-w-0"
                  aria-label="Classes and Events"
                  title="Classes & Events"
                >
                  <motion.button
                    className="flex w-full items-center justify-center gap-2 rounded-lg border-0 bg-white px-3 py-2 text-xs font-semibold text-black transition-all duration-300 hover:bg-gray-100 hover:scale-105 hover:shadow-lg min-[1075px]:px-5 min-[1075px]:py-2.5 min-[1075px]:text-sm"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="hidden min-[1075px]:inline">Classes &amp; Events</span>
                  </motion.button>
                </Link>
              </>
            )}

            {/* Member Dashboard or Login Button */}
            {member && onMemberDashboardClick ? (
              <motion.button
                onClick={onMemberDashboardClick}
                className="bg-vortex-red text-white px-4 py-2 min-[1075px]:px-5 min-[1075px]:py-2.5 rounded-lg font-semibold text-xs min-[1075px]:text-sm transition-all duration-300 hover:bg-red-700 hover:scale-105 hover:shadow-lg flex-1 min-[1075px]:flex-none min-w-[80px] min-[1075px]:min-w-0"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Member Portal
              </motion.button>
            ) : showPrimaryActions ? (
              <Link
                to={getSiteEnrollHref()}
                className="bg-vortex-red text-white px-4 py-2 min-[1075px]:px-5 min-[1075px]:py-2.5 rounded-lg font-semibold text-xs min-[1075px]:text-sm transition-all duration-300 hover:bg-red-700 hover:scale-105 hover:shadow-lg inline-block flex-1 min-[1075px]:flex-none min-w-[80px] min-[1075px]:min-w-0 text-center"
              >
                <motion.span
                  className="inline-block"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Enroll
                </motion.span>
              </Link>
            ) : null}

            <button
              type="button"
              onClick={handleProfileClick}
              className="hidden text-white transition-colors duration-300 hover:text-vortex-red min-[1075px]:block"
              aria-label={member ? 'Open member portal' : 'Account login'}
              title={member ? 'Member Portal' : 'Account Login'}
            >
              <UserCircle size={28} />
            </button>

            {/* Hamburger Menu Button - Only visible on desktop */}
            <button
              type="button"
              className="text-white hover:text-vortex-red transition-colors duration-300 hidden min-[1075px]:block"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
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
              if (entry.kind === 'specialPages') {
                return (
                  <SpecialPageNavSection
                    key="special-pages"
                    pages={specialPages}
                    siteKey="hub"
                    onNavigate={() => setIsMenuOpen(false)}
                  />
                )
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
                  className={`${linkClass(location.pathname === entry.to)} ${entry.indented ? 'pl-4' : ''}`}
                >
                  {entry.label}
                </Link>
              )
            })}
            
            <NavMenuDivider className="my-4" />
            
            {/* Login Links */}
            <div className="space-y-3">
              {onAdminLoginClick && (
                <button
                  onClick={() => {
                    onAdminLoginClick()
                    setIsMenuOpen(false)
                  }}
                  className="block w-full text-left text-white hover:text-vortex-red transition-colors duration-300 font-medium"
                >
                  Account Login
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
              <Link
                to={getSiteEnrollHref()}
                onClick={() => setIsMenuOpen(false)}
                className="block text-white hover:text-vortex-red transition-colors duration-300 font-medium"
              >
                Enroll
              </Link>
            </div>
          </div>
        </motion.nav>
      </div>
    </header>
  )
}

export default Header
