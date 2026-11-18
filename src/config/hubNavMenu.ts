import { NINJA_PROGRAM_ON_HOLD } from '../utils/ninjaProgram'
import guideIndex from './publicGuideIndex.json'

export type HubNavMenuEntry =
  | { kind: 'item'; label: string; to: string; onHold?: boolean; indented?: boolean }
  | { kind: 'specialPages' }
  | { kind: 'divider' }

/** Public navigation for the unified programs and shared account services. */
export const HUB_NAV_MENU_ENTRIES: HubNavMenuEntry[] = [
  { kind: 'item', label: 'Vortex Athletics', to: '/' },
  { kind: 'item', label: 'Youth Gymnastics', to: '/gymnastics', indented: true },
  { kind: 'item', label: 'Fit & Flip', to: '/fit-and-flip', indented: true },
  { kind: 'item', label: 'Adult Gymnastics', to: '/adult-gymnastics', indented: true },
  { kind: 'item', label: guideIndex.label, to: guideIndex.path },
  { kind: 'item', label: 'Drop-In Classes', to: '/drop-in', indented: true },
  { kind: 'item', label: 'Contact & Location', to: '/contact' },
  { kind: 'item', label: 'Jobs', to: '/jobs' },
  { kind: 'item', label: 'Store', to: '/store' },
  { kind: 'specialPages' },
  { kind: 'divider' },
  {
    kind: 'item',
    label: 'Vortex Ninja',
    to: '/ninja',
    onHold: NINJA_PROGRAM_ON_HOLD,
  },
]
