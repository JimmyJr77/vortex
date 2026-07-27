import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const SPECIALIZED_TRAINING_ITEMS = [
  'Conditioning',
  'Speed & Agility',
  'Strength & Explosiveness',
  'Lifting Fundamentals',
]

interface HeroSpecializedTrainingMenuProps {
  fullWidth?: boolean
}

export default function HeroSpecializedTrainingMenu({
  fullWidth = false,
}: HeroSpecializedTrainingMenuProps) {
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

  return (
    <div ref={rootRef} className={`relative ${fullWidth ? 'w-full max-w-xs' : ''}`}>
      <motion.button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
        className={`btn-secondary group inline-flex items-center justify-center gap-2 ${
          fullWidth ? 'w-full' : ''
        }`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        Specialized Training
        <ChevronDown
          className={`h-5 w-5 shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Specialized training registration"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className={`absolute z-50 mt-2 overflow-hidden rounded-lg border border-white/20 bg-black/95 shadow-xl ${
              fullWidth ? 'left-0 right-0' : 'left-1/2 min-w-[15rem] -translate-x-1/2'
            }`}
          >
            {SPECIALIZED_TRAINING_ITEMS.map((item) => (
              <span
                key={item}
                role="menuitem"
                aria-disabled="true"
                className="block w-full cursor-not-allowed select-none px-4 py-3 text-left font-medium text-gray-500 opacity-60"
              >
                {item}
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
