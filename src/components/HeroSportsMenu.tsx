import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { getGymnasticsSiteUrl } from '../utils/gymnasticsSite'
import { getStubSportSiteUrl } from '../utils/sportSite'

const SPORT_MENU_ITEMS = [
  {
    label: 'Gymnastics',
    href: getGymnasticsSiteUrl(),
    external: true as const,
  },
  { label: 'Vortex Ninja', to: '/ninja' as const },
  {
    label: 'Basketball',
    href: getStubSportSiteUrl('basketball'),
    external: true as const,
  },
]

interface HeroSportsMenuProps {
  fullWidth?: boolean
}

const HeroSportsMenu = ({ fullWidth = false }: HeroSportsMenuProps) => {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [open])

  const menuItemClass =
    'block w-full px-4 py-3 text-left text-white font-medium hover:bg-vortex-red/20 hover:text-vortex-red transition-colors'

  return (
    <div ref={rootRef} className={`relative ${fullWidth ? 'w-full max-w-xs' : ''}`}>
      <motion.button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((prev) => !prev)}
        className={`btn-secondary group inline-flex items-center justify-center gap-2 ${
          fullWidth ? 'w-full' : ''
        }`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        Sports
        <ChevronDown
          className={`w-5 h-5 shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Choose a sport"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className={`absolute z-50 mt-2 overflow-hidden rounded-lg border border-white/20 bg-black/95 shadow-xl ${
              fullWidth ? 'left-0 right-0' : 'left-1/2 min-w-[12rem] -translate-x-1/2'
            }`}
          >
            {SPORT_MENU_ITEMS.map((item) =>
              'to' in item ? (
                <Link
                  key={item.label}
                  to={item.to}
                  role="menuitem"
                  className={menuItemClass}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  role="menuitem"
                  className={menuItemClass}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ),
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default HeroSportsMenu
