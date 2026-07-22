import { NINJA_PROGRAM_ON_HOLD } from '../utils/ninjaProgram'
import { getStubSportSiteUrl } from '../utils/sportSite'
import { getGymnasticsSiteUrl } from '../utils/gymnasticsSite'

export type HubNavMenuEntry =
  | { kind: 'item'; label: string; to: string; onHold?: boolean; indented?: boolean }
  | { kind: 'item'; label: string; href: string; external: true }
  | { kind: 'specialPages' }
  | { kind: 'divider' }

/** Hub site nav: programs, summer offerings, then sport sites. */
export const HUB_NAV_MENU_ENTRIES: HubNavMenuEntry[] = [
  { kind: 'item', label: 'Vortex Athletics', to: '/vortex-athletics' },
  { kind: 'item', label: 'Fit & Flip', to: '/strength-conditioning', indented: true },
  { kind: 'specialPages' },
  { kind: 'divider' },
  {
    kind: 'item',
    label: 'Vortex Gymnastics',
    href: getGymnasticsSiteUrl(),
    external: true,
  },
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
