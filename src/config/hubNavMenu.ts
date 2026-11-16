import { NINJA_PROGRAM_ON_HOLD } from '../utils/ninjaProgram'
import { getStubSportSiteUrl } from '../utils/sportSite'

export type HubNavMenuEntry =
  | { kind: 'item'; label: string; to: string; onHold?: boolean; indented?: boolean }
  | { kind: 'item'; label: string; href: string; external: true }
  | { kind: 'specialPages' }
  | { kind: 'divider' }

/** Public navigation for the unified programs and shared account services. */
export const HUB_NAV_MENU_ENTRIES: HubNavMenuEntry[] = [
  { kind: 'item', label: 'Vortex Athletics', to: '/' },
  { kind: 'item', label: 'Gymnastics', to: '/#gymnastics', indented: true },
  { kind: 'item', label: 'Fit & Flip', to: '/#fit-flip', indented: true },
  { kind: 'item', label: 'Drop-In Classes', to: '/drop-in', indented: true },
  { kind: 'item', label: 'Contact & Location', to: '/contact' },
  { kind: 'item', label: 'Store', to: '/store' },
  { kind: 'specialPages' },
  { kind: 'divider' },
  {
    kind: 'item',
    label: 'Vortex Ninja',
    to: '/ninja',
    onHold: NINJA_PROGRAM_ON_HOLD,
  },
  {
    kind: 'item',
    label: 'Basketball',
    href: getStubSportSiteUrl('basketball'),
    external: true,
  },
]
