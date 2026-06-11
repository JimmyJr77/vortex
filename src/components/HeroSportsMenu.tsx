import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { HUB_NAV_MENU_ENTRIES } from '../config/hubNavMenu'
import NavMenuDivider from './NavMenuDivider'
import {
  NINJA_HOLD_TITLE,
  ninjaOnHoldMenuItemClass,
} from '../utils/ninjaProgram'

interface HeroSportsMenuProps {
  fullWidth?: boolean
}

const HeroSportsMenu = ({ fullWidth = false }: HeroSportsMenuProps) => {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

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

  const activeMenuItemClass =
    'block w-full px-4 py-3 text-left text-vortex-red font-medium bg-vortex-red/10'

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
        Vortex Athletics
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
            aria-label="Vortex Athletics programs and sports"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className={`absolute z-50 mt-2 overflow-hidden rounded-lg border border-white/20 bg-black/95 shadow-xl ${
              fullWidth ? 'left-0 right-0' : 'left-1/2 min-w-[16rem] -translate-x-1/2'
            }`}
          >
            {HUB_NAV_MENU_ENTRIES.map((entry, index) => {
              if (entry.kind === 'divider') {
                return <NavMenuDivider key={`divider-${index}`} />
              }

              if ('onHold' in entry && entry.onHold) {
                return (
                  <span
                    key={entry.label}
                    role="menuitem"
                    aria-disabled="true"
                    title={NINJA_HOLD_TITLE}
                    className={ninjaOnHoldMenuItemClass}
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
                    role="menuitem"
                    className={menuItemClass}
                    onClick={() => setOpen(false)}
                  >
                    {entry.label}
                  </a>
                )
              }

              const isActive = location.pathname === entry.to
              return (
                <Link
                  key={entry.label}
                  to={entry.to}
                  role="menuitem"
                  className={isActive ? activeMenuItemClass : menuItemClass}
                  onClick={() => setOpen(false)}
                >
                  {entry.label}
                </Link>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default HeroSportsMenu
