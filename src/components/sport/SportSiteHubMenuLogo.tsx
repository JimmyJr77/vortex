import { HUB_URL } from '../../utils/sportSite'

interface SportSiteHubMenuLogoProps {
  onNavigate?: () => void
  className?: string
}

/** Vortex Athletics hub logo for sport-site sandwich menus (bottom-right). */
const SportSiteHubMenuLogo = ({
  onNavigate,
  className = '',
}: SportSiteHubMenuLogoProps) => (
  <div className={`flex justify-end pt-4 mt-2 border-t border-gray-800 ${className}`}>
    <a
      href={HUB_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onNavigate}
      className="inline-block opacity-90 hover:opacity-100 transition-opacity duration-300"
      aria-label="Vortex Athletics — vortexathletics.com"
    >
      <img
        src="/vortex_logo_1.png"
        alt="Vortex Athletics"
        className="h-10 w-auto"
      />
    </a>
  </div>
)

export default SportSiteHubMenuLogo
