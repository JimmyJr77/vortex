import { Link } from 'react-router-dom'
import NavMenuDivider from '../NavMenuDivider'
import SportSiteHubMenuLogo from './SportSiteHubMenuLogo'

export interface SportSiteMenuLinksProps {
  sportBrandName: string
  sportHomeHref: string
  /** When true, sport home uses React Router Link (in-app). */
  useRouterHome?: boolean
  onNavigate?: () => void
  onMemberLoginClick: () => void
  onAdminLoginClick: () => void
  onInquireClick: () => void
  showMemberLogin?: boolean
  /** When false, omit sport home link and top divider (home lives in parent nav). */
  includeSportHome?: boolean
  /** When false, parent renders {@link SportSiteHubMenuLogo} (e.g. gymnastics nav). */
  includeHubLogo?: boolean
}

/**
 * Standard sport-site sandwich menu block (shared across stubs and sport apps).
 */
const SportSiteMenuLinks = ({
  sportBrandName,
  sportHomeHref,
  useRouterHome = false,
  onNavigate,
  onMemberLoginClick,
  onAdminLoginClick,
  onInquireClick,
  showMemberLogin = true,
  includeSportHome = true,
  includeHubLogo = true,
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
      {includeSportHome && (
        <>
          {homeLink}
          <NavMenuDivider className="my-4" />
        </>
      )}
      <div className="space-y-3">
        {showMemberLogin && (
          <button type="button" onClick={onMemberLoginClick} className={linkClass}>
            Member Login
          </button>
        )}
        <button type="button" onClick={onAdminLoginClick} className={linkClass}>
          Admin Login
        </button>
        <button type="button" onClick={onInquireClick} className={linkClass}>
          Inquire
        </button>
      </div>
      {includeHubLogo && <SportSiteHubMenuLogo onNavigate={onNavigate} />}
    </>
  )
}

export default SportSiteMenuLinks
