import { motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { NAV_MENU_DIVIDER_CLASS } from '../NavMenuDivider'
import SportSiteMenuLinks from '../sport/SportSiteMenuLinks'
import type { StubSiteConfig } from '../../config/stubSites'
import { getSportBrandName, getSportHomeUrl } from '../../utils/sportSite'
import { HUB_HEADER_LOGO } from '../../utils/seo'

interface StubHeaderProps {
  config: StubSiteConfig
  onContactClick: () => void
  onAdminLoginClick: () => void
}

const StubHeader = ({
  config,
  onContactClick,
  onAdminLoginClick,
}: StubHeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const sportBrandName = getSportBrandName(config.sportLabel)
  const sportHomeHref = getSportHomeUrl(config)

  const closeMenu = () => setIsMenuOpen(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm header-slide-in">
      <div className="container-custom">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-4 md:py-0 md:h-20">
          <div className="flex items-center justify-between md:justify-start mb-4 md:mb-0">
            <a href={sportHomeHref} className="block">
              <motion.div
                className="flex items-center cursor-pointer"
                whileHover={{ scale: 1.05 }}
              >
                <img
                  src={HUB_HEADER_LOGO}
                  alt={sportBrandName}
                  className="h-10 md:h-12 w-auto"
                />
              </motion.div>
            </a>

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
          <div className={`py-4 space-y-4 ${NAV_MENU_DIVIDER_CLASS}`}>
            <SportSiteMenuLinks
              sportBrandName={sportBrandName}
              sportHomeHref={sportHomeHref}
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
          </div>
        </motion.nav>
      </div>
    </header>
  )
}

export default StubHeader
