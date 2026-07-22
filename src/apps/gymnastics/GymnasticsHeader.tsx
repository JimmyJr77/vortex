import { motion } from 'framer-motion'
import { LayoutGrid, Menu, UserCircle, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useSiteHeaderHeight } from '../../hooks/useSiteHeaderHeight'
import { Link, useLocation } from 'react-router-dom'
import NavMenuDivider, { NAV_MENU_DIVIDER_CLASS } from '../../components/NavMenuDivider'
import SportSiteMenuLinks from '../../components/sport/SportSiteMenuLinks'
import SportSiteHubMenuLogo from '../../components/sport/SportSiteHubMenuLogo'
import { getHubSiteUrl } from '../../utils/crossDomainConsent'
import { getSportBrandName, getSportHomeUrl } from '../../utils/sportSite'
import type { StubSiteConfig } from '../../config/stubSites'
import { STUB_SITES } from '../../config/stubSites'
import { GYMNASTICS_HEADER_LOGO } from '../../config/gymnasticsSeo'
import { getSiteEnrollHref } from '../../utils/enrollSite'
import SpecialPageNavSection from '../../components/SpecialPageNavSection'
import useSpecialPages from '../../hooks/useSpecialPages'

const GYMNASTICS_CONFIG = STUB_SITES['vortex-gymnastics.com']

interface GymnasticsHeaderProps {
  onContactClick: () => void
  onAdminLoginClick: () => void
  member?: unknown
  onMemberDashboardClick?: () => void
}

/**
 * Vortex Gymnastics site header — separate from hub Header.tsx, matched visually
 * for the gymnastics domain (Inquire, Classes & Events, Enroll, nav).
 */
const GymnasticsHeader = ({
  onContactClick,
  onAdminLoginClick,
  member,
  onMemberDashboardClick,
}: GymnasticsHeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  useSiteHeaderHeight(headerRef)
  const location = useLocation()
  const { pages: specialPages } = useSpecialPages()
  const sportBrandName = getSportBrandName(GYMNASTICS_CONFIG.sportLabel)
  const sportHomeHref = getSportHomeUrl(GYMNASTICS_CONFIG as StubSiteConfig)

  const menuItems = [
    { name: sportBrandName, to: '/', isHome: true },
    { name: 'Vortex Gymnastics Team', to: '/artistic-gymnastics-13-18', indented: true },
    { name: 'Developmental Gymnastics', to: '/artistic-gymnastics-6-12', indented: true },
    { name: 'Trampoline & Tumbling', to: '/trampoline-tumbling', indented: true },
    { name: 'Rhythmic Gymnastics', to: '/rhythmic-gymnastics', indented: true },
    { name: 'Mommy & Me', to: '/artistic-gymnastics-early', indented: true },
  ]

  const isNavItemActive = (to: string, isHome?: boolean) => {
    if (isHome) {
      return location.pathname === '/' || location.pathname === '/gymnastics'
    }
    return location.pathname === to
  }

  const closeMenu = () => setIsMenuOpen(false)
  const handleProfileClick = () => {
    if (member && onMemberDashboardClick) {
      onMemberDashboardClick()
      return
    }
    onAdminLoginClick()
  }

  return (
    <header
      ref={headerRef}
      className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm header-slide-in"
    >
      <div className="container-custom">
        <div className="flex flex-col min-[1075px]:flex-row min-[1075px]:items-center min-[1075px]:justify-between py-4 min-[1075px]:py-0 min-[1075px]:h-20">
          <div className="flex items-center justify-between gap-5 px-1 mb-4 min-[1075px]:mb-0 min-[1075px]:justify-start min-[1075px]:px-0">
            <Link to="/" className="block min-w-0 flex-1 min-[1075px]:flex-none">
              <motion.div
                className="flex items-center cursor-pointer"
                whileHover={{ scale: 1.05 }}
              >
                <img
                  src={GYMNASTICS_HEADER_LOGO}
                  alt="Vortex Gymnastics"
                  className="h-10 max-w-full w-auto min-[1075px]:h-12 object-contain object-left"
                />
              </motion.div>
            </Link>

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

          <div className="flex items-center space-x-2 min-[1075px]:space-x-4 flex-wrap gap-2 min-[1075px]:gap-0">
            <motion.button
              onClick={onContactClick}
              className="bg-vortex-red text-white px-4 py-2 min-[1075px]:px-5 min-[1075px]:py-2.5 rounded-lg font-semibold text-xs min-[1075px]:text-sm transition-all duration-300 hover:bg-red-700 hover:scale-105 hover:shadow-lg flex-1 min-[1075px]:flex-none min-w-[80px] min-[1075px]:min-w-0"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Inquire
            </motion.button>

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

            {member && onMemberDashboardClick ? (
              <motion.button
                onClick={onMemberDashboardClick}
                className="bg-vortex-red text-white px-4 py-2 min-[1075px]:px-5 min-[1075px]:py-2.5 rounded-lg font-semibold text-xs min-[1075px]:text-sm transition-all duration-300 hover:bg-red-700 hover:scale-105 hover:shadow-lg flex-1 min-[1075px]:flex-none min-w-[80px] min-[1075px]:min-w-0"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Member Portal
              </motion.button>
            ) : (
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
            )}

            <button
              type="button"
              onClick={handleProfileClick}
              className="hidden text-white transition-colors duration-300 hover:text-vortex-red min-[1075px]:block"
              aria-label={member ? 'Open member portal' : 'Account login'}
              title={member ? 'Member Portal' : 'Account Login'}
            >
              <UserCircle size={28} />
            </button>

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

        <motion.nav
          className={`${isMenuOpen ? 'block' : 'hidden'}`}
          initial={{ opacity: 0, height: 0 }}
          animate={{
            opacity: isMenuOpen ? 1 : 0,
            height: isMenuOpen ? 'auto' : 0,
          }}
          transition={{ duration: 0.3 }}
        >
          <div className={`py-4 space-y-4 ${NAV_MENU_DIVIDER_CLASS}`}>
            <a
              href={getHubSiteUrl()}
              onClick={closeMenu}
              className="block text-white hover:text-vortex-red transition-colors duration-300 font-medium"
            >
              Home
            </a>

            {menuItems.map((item) => (
              <Link
                key={item.name}
                to={item.to}
                onClick={closeMenu}
                className={`block ${item.indented ? 'pl-4' : ''} ${
                  isNavItemActive(item.to, item.isHome)
                    ? 'text-vortex-red'
                    : 'text-white'
                } hover:text-vortex-red transition-colors duration-300 font-medium`}
              >
                {item.name}
              </Link>
            ))}

            <SpecialPageNavSection
              pages={specialPages}
              siteKey="gymnastics"
              onNavigate={closeMenu}
            />

            <NavMenuDivider className="my-4" />
            <a
              href={getHubSiteUrl('/vortex-athletics')}
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMenu}
              className="block text-white hover:text-vortex-red transition-colors duration-300 font-medium"
            >
              Vortex Athletics
            </a>
            <NavMenuDivider className="my-4" />

            <SportSiteMenuLinks
              sportBrandName={sportBrandName}
              sportHomeHref={sportHomeHref}
              includeSportHome={false}
              includeHubLogo={false}
              includeHubHome={false}
              onNavigate={closeMenu}
              onAdminLoginClick={() => {
                onAdminLoginClick()
                closeMenu()
              }}
              onInquireClick={() => {
                onContactClick()
                closeMenu()
              }}
            />
            <SportSiteHubMenuLogo onNavigate={closeMenu} />
          </div>
        </motion.nav>
      </div>
    </header>
  )
}

export default GymnasticsHeader
