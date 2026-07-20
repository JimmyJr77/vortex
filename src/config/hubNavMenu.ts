import { getGymnasticsSiteUrl } from '../utils/gymnasticsSite'
import { NINJA_PROGRAM_ON_HOLD } from '../utils/ninjaProgram'
import { getStubSportSiteUrl } from '../utils/sportSite'

export type HubNavMenuEntry =
  | { kind: 'item'; label: string; to: string; onHold?: boolean }
  | { kind: 'item'; label: string; href: string; external: true }
  | { kind: 'divider' }

/** Hub site nav: programs, summer offerings, then sport sites. */
export const HUB_NAV_MENU_ENTRIES: HubNavMenuEntry[] = [
  { kind: 'item', label: 'Home', to: '/' },
  { kind: 'item', label: 'Sports', to: '/sports' },
  { kind: 'item', label: 'Athleticism Accelerator', to: '/athleticism-accelerator' },
  { kind: 'item', label: 'Fit & Flip', to: '/strength-conditioning' },
  { kind: 'divider' },
  { kind: 'item', label: 'Summer Athletic Program', to: '/summer-athletic-training' },
  {
    kind: 'item',
    label: 'Summer Gymnastics Program',
    href: getGymnasticsSiteUrl('/summer-camp-26'),
    external: true,
  },
  { kind: 'divider' },
  {
    kind: 'item',
    label: 'Gymnastics',
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
