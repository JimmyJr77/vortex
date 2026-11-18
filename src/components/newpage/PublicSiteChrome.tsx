import { useRef, useState, type MouseEventHandler } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CalendarDays, Menu, X } from 'lucide-react'
import { SOCIAL_PROFILES, TEAM_EMAIL, TEAM_PHONE, TEAM_PHONE_E164 } from '../../config/contact'
import { useSiteHeaderHeight } from '../../hooks/useSiteHeaderHeight'
import PublicBrandImage from './PublicBrandImage'
import PublicNavigationLinks from './PublicNavigationLinks'
import './PublicSiteChrome.css'

function PublicBrand({ footer = false }: { footer?: boolean }) {
  return <Link className="np-brand" to="/" aria-label="Vortex Athletics, home"><PublicBrandImage footer={footer} /></Link>
}

export function PublicSiteHeader({ isLoggedIn, onLogin, adultProgram = false, homeTrial }: {
  isLoggedIn: boolean
  onLogin: () => void
  adultProgram?: boolean
  homeTrial?: { href: string; onClick: MouseEventHandler<HTMLAnchorElement> }
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const menuToggleRef = useRef<HTMLButtonElement>(null)
  useSiteHeaderHeight(headerRef)
  const closeMenu = () => setMenuOpen(false)
  const portalActions = (
    <div className="np-portal-actions">
      <Link
        className="np-nav-schedule"
        to="/read-board#schedule"
        aria-label="Schedule"
        title="Schedule"
        data-analytics-cta="schedule"
        data-analytics-section="navigation"
        onClick={closeMenu}
      >
        <CalendarDays size={18} aria-hidden="true" />
      </Link>
      <button type="button" className="np-login" data-analytics-cta="member_login" data-analytics-section="navigation" onClick={() => { closeMenu(); onLogin() }}>
        {isLoggedIn ? 'My portal' : 'Member login'}<ArrowUpRight size={14} aria-hidden="true" />
      </button>
    </div>
  )

  return <>
    <a className="np-skip" href={homeTrial ? '#main' : '#public-content'}>Skip to content</a>
    <header ref={headerRef} className="np-header np-public-header" onKeyDown={event => {
      if (event.key !== 'Escape' || !menuOpen) return
      closeMenu()
      menuToggleRef.current?.focus({ preventScroll: true })
    }}>
      <div className="np-container np-nav">
        {homeTrial ? <a className="np-brand" href="#top" aria-label="Vortex Athletics, back to top"><PublicBrandImage /></a> : <PublicBrand />}
        <nav className="np-desktop-nav" aria-label="Main navigation">
          <PublicNavigationLinks />
        </nav>
        <div className="np-nav-actions">
          {portalActions}
          {homeTrial ? (
            <a className="np-button np-nav-cta" href={homeTrial.href} aria-haspopup="dialog"
              data-analytics-cta="free_trial" data-analytics-section="navigation" onClick={event => {
                homeTrial.onClick(event)
                if (event.defaultPrevented) closeMenu()
              }}>
              Try a free class <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          ) : (
            <Link className="np-button np-nav-cta" to={adultProgram ? '/contact' : '/#free-trial'} aria-label={adultProgram ? 'Ask about adult gymnastics classes' : undefined} data-analytics-cta={adultProgram ? 'contact_adult_gymnastics' : 'free_trial_section'} data-analytics-section="navigation" onClick={closeMenu}>
              {adultProgram ? 'Ask Vortex' : 'Try a free class'} <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          )}
          <button ref={menuToggleRef} type="button" className="np-menu-toggle" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="np-public-mobile-nav" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
        </div>
      </div>
      {menuOpen && <nav id="np-public-mobile-nav" className="np-mobile-nav" aria-label="Mobile navigation">
        <PublicNavigationLinks mobile onNavigate={closeMenu} />
        {portalActions}
      </nav>}
    </header>
  </>
}

export function PublicSiteFooter() {
  return <footer className="np-footer np-container">
    <div className="np-footer-main">
      <div><PublicBrand footer /><p>Gymnastics. Athletic development.<br />Built for more.</p></div>
      <div><span className="np-footer-label">COME TRAIN WITH US</span><Link to="/gymnastics">Youth gymnastics</Link><Link to="/fit-and-flip">Fit &amp; Flip youth training</Link><Link to="/adult-gymnastics">Adult gymnastics</Link><a href={`tel:${TEAM_PHONE_E164}`}>{TEAM_PHONE}</a><a href={`mailto:${TEAM_EMAIL}`}>{TEAM_EMAIL}</a></div>
      <div><span className="np-footer-label">STAY CONNECTED</span><a href={SOCIAL_PROFILES[0]} target="_blank" rel="noreferrer">Instagram <ArrowUpRight size={14} /></a><a href={SOCIAL_PROFILES[2]} target="_blank" rel="noreferrer">YouTube <ArrowUpRight size={14} /></a></div>
      <Link className="np-back-top" to="/">Back to home <ArrowUpRight size={17} /></Link>
    </div>
    <div className="np-footer-bottom"><span>© {new Date().getFullYear()} Vortex Athletics and Gymnastics</span><div><Link to="/privacy-policy">Privacy</Link><Link to="/terms-of-service">Terms</Link></div></div>
  </footer>
}
