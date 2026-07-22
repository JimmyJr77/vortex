import { Link } from 'react-router-dom'
import NavMenuDivider from '../NavMenuDivider'
import SportSiteHubMenuLogo from './SportSiteHubMenuLogo'
import { getSiteEnrollHref } from '../../utils/enrollSite'
import { getHubSiteUrl } from '../../utils/crossDomainConsent'

export interface SportSiteMenuLinksProps {
  sportBrandName: string
  sportHomeHref: string
  /** When true, sport home uses React Router Link (in-app). */
  useRouterHome?: boolean
  onNavigate?: () => void
  onAdminLoginClick: () => void
  onInquireClick: () => void
  /** When false, omit sport home link and top divider (home lives in parent nav). */
  includeSportHome?: boolean
  /** When false, parent renders {@link SportSiteHubMenuLogo} (e.g. gymnastics nav). */
  includeHubLogo?: boolean
  /** When false, the parent renders the hub Home link at the top of its custom nav. */
  includeHubHome?: boolean
}

/**
 * Standard sport-site sandwich menu block (shared across stubs and sport apps).
 */
const SportSiteMenuLinks = ({
  sportBrandName,
  sportHomeHref,
  useRouterHome = false,
  onNavigate,
  onAdminLoginClick,
  onInquireClick,
  includeSportHome = true,
  includeHubLogo = true,
  includeHubHome = true,
}: SportSiteMenuLinksProps) => {
  const linkClass =
    'block w-full text-left text-white hover:text-vortex-red transition-colors duration-300 font-medium'

  const homeLink = useRouterHome ? (
    <Link to="/" onClick={onNavigate} className={linkClass}>
      {sportBrandName}
    </Link>
  ) : (
    <a href={sportHomeHref} onClick={onNavigate} className={linkClass}>
      {sportBrandName}
    </a>
  )

  return (
    <>
      {includeHubHome && (
        <a href={getHubSiteUrl()} onClick={onNavigate} className={linkClass}>
          Home
        </a>
      )}
      {includeSportHome && (
        <>
          {homeLink}
          <NavMenuDivider className="my-4" />
        </>
      )}
      <div className="space-y-3">
        <button type="button" onClick={onAdminLoginClick} className={linkClass}>
          Account Login
        </button>
        <button type="button" onClick={onInquireClick} className={linkClass}>
          Inquire
        </button>
        <Link to={getSiteEnrollHref()} onClick={onNavigate} className={linkClass}>
          Enroll
        </Link>
      </div>
      {includeHubLogo && <SportSiteHubMenuLogo onNavigate={onNavigate} />}
    </>
  )
}

export default SportSiteMenuLinks
