import { NAV_MENU_DIVIDER_CLASS } from '../NavMenuDivider'
import { getHubSiteUrl } from '../../utils/crossDomainConsent'
import { HUB_HEADER_LOGO } from '../../utils/seo'

interface SportSiteHubMenuLogoProps {
  onNavigate?: () => void
  className?: string
}

/** Vortex Athletics hub logo for sport-site sandwich menus (bottom-right). */
const SportSiteHubMenuLogo = ({
  onNavigate,
  className = '',
}: SportSiteHubMenuLogoProps) => (
  <div className={`flex justify-end pt-4 mt-2 ${NAV_MENU_DIVIDER_CLASS} ${className}`}>
    <a
      href={getHubSiteUrl()}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onNavigate}
      className="inline-block opacity-90 hover:opacity-100 transition-opacity duration-300"
      aria-label="Vortex Athletics — vortexathletics.com"
    >
      <img
        src={HUB_HEADER_LOGO}
        alt="Vortex Athletics"
        className="h-8 w-auto"
      />
    </a>
  </div>
)

export default SportSiteHubMenuLogo
