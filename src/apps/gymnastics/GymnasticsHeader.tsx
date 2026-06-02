import { motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useSiteHeaderHeight } from '../../hooks/useSiteHeaderHeight'
import { Link, useLocation } from 'react-router-dom'
import SportSiteMenuLinks from '../../components/sport/SportSiteMenuLinks'
import SportSiteHubMenuLogo from '../../components/sport/SportSiteHubMenuLogo'
import { getSportBrandName, getSportHomeUrl } from '../../utils/sportSite'
import type { StubSiteConfig } from '../../config/stubSites'
import { STUB_SITES } from '../../config/stubSites'
import { GYMNASTICS_HEADER_LOGO } from '../../config/gymnasticsSeo'

const GYMNASTICS_CONFIG = STUB_SITES['vortex-gymnastics.com']

interface GymnasticsHeaderProps {
  onContactClick: () => void
  onAdminLoginClick: () => void
  onMemberLoginClick: () => void
  member?: any
  onMemberDashboardClick?: () => void
}

/**
 * Vortex Gymnastics site header — separate from hub Header.tsx, matched visually
 * for the gymnastics domain (Inquire, Classes & Events, Enroll, nav).
 */
const GymnasticsHeader = ({
  onContactClick,
  onAdminLoginClick,
  onMemberLoginClick,
  member,
  onMemberDashboardClick,
}: GymnasticsHeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  useSiteHeaderHeight(headerRef)
  const location = useLocation()
  const sportBrandName = getSportBrandName(GYMNASTICS_CONFIG.sportLabel)
  const sportHomeHref = getSportHomeUrl(GYMNASTICS_CONFIG as StubSiteConfig)

  const menuItems = [
    { name: sportBrandName, to: '/', isHome: true },
    { name: 'Summer Camp 2026', to: '/summer-camp-26' },
    { name: 'Early Development', to: '/artistic-gymnastics-early' },
    { name: 'Ages 6-12', to: '/artistic-gymnastics-6-12' },
    { name: 'Ages 13-18', to: '/artistic-gymnastics-13-18' },
  ]

  const isNavItemActive = (to: string, isHome?: boolean) => {
    if (isHome) {
      return location.pathname === '/' || location.pathname === '/gymnastics'
    }
    return location.pathname === to
  }

  const closeMenu = () => setIsMenuOpen(false)

  return (
    <header
      ref={headerRef}
      className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm header-slide-in"
    >
      <div className="container-custom">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-4 md:py-0 md:h-20">
          <div className="flex items-center justify-between md:justify-start mb-4 md:mb-0">
            <Link to="/" className="block">
              <motion.div
                className="flex items-center cursor-pointer"
                whileHover={{ scale: 1.05 }}
              >
                <img
                  src={GYMNASTICS_HEADER_LOGO}
                  alt="Vortex Gymnastics"
                  className="h-[3.75rem] sm:h-[4.125rem] md:h-[4.5rem] w-auto max-w-[min(100%,21rem)] sm:max-w-[30rem] object-contain object-left"
                />
              </motion.div>
            </Link>

            <button
              type="button"
              className="text-white hover:text-vortex-red transition-colors duration-300 md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>

          <div className="flex items-center space-x-2 md:space-x-4 flex-wrap gap-2 md:gap-0">
            <motion.button
              onClick={onContactClick}
              className="bg-vortex-red text-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-semibold text-xs md:text-sm transition-all duration-300 hover:bg-red-700 hover:scale-105 hover:shadow-lg flex-1 md:flex-none min-w-[80px] md:min-w-0"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Inquire
            </motion.button>

            <Link to="/read-board" className="flex-1 md:flex-none min-w-[80px] md:min-w-0">
              <motion.button
                className="bg-white text-black px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-semibold text-xs md:text-sm transition-all duration-300 hover:bg-gray-100 hover:scale-105 hover:shadow-lg w-full"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Classes & Events
              </motion.button>
            </Link>

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
              <motion.a
                href="https://app3.jackrabbitclass.com/regv2.asp?id=557920"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-vortex-red text-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-semibold text-xs md:text-sm transition-all duration-300 hover:bg-red-700 hover:scale-105 hover:shadow-lg inline-block flex-1 md:flex-none min-w-[80px] md:min-w-0 text-center"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Enroll
              </motion.a>
            )}

            <button
              type="button"
              className="text-white hover:text-vortex-red transition-colors duration-300 hidden md:block"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>

        <motion.nav
          className={`${isMenuOpen ? 'block' : 'hidden'}`}
          initial={{ opacity: 0, height: 0 }}
          animate={{
            opacity: isMenuOpen ? 1 : 0,
            height: isMenuOpen ? 'auto' : 0,
          }}
          transition={{ duration: 0.3 }}
        >
          <div className="py-4 space-y-4 border-t border-gray-800">
            {menuItems.map((item) => (
              <Link
                key={item.name}
                to={item.to}
                onClick={closeMenu}
                className={`block ${
                  isNavItemActive(item.to, item.isHome)
                    ? 'text-vortex-red'
                    : 'text-white'
                } hover:text-vortex-red transition-colors duration-300 font-medium`}
              >
                {item.name}
              </Link>
            ))}

            <div className="border-t border-gray-700 my-4" />

            <SportSiteMenuLinks
              sportBrandName={sportBrandName}
              sportHomeHref={sportHomeHref}
              includeSportHome={false}
              includeHubLogo={false}
              onNavigate={closeMenu}
              onMemberLoginClick={() => {
                onMemberLoginClick()
                closeMenu()
              }}
              onAdminLoginClick={() => {
                onAdminLoginClick()
                closeMenu()
              }}
              onInquireClick={() => {
                onContactClick()
                closeMenu()
              }}
              showMemberLogin={!member}
            />
            <SportSiteHubMenuLogo onNavigate={closeMenu} />
          </div>
        </motion.nav>
      </div>
    </header>
  )
}

export default GymnasticsHeader
