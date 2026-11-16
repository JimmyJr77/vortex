import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import { SOCIAL_PROFILES, TEAM_EMAIL, TEAM_PHONE, TEAM_PHONE_E164 } from '../../config/contact'
import { useSiteHeaderHeight } from '../../hooks/useSiteHeaderHeight'
import PublicNavigationLinks from './PublicNavigationLinks'
import './NewPage.css'
import './PublicSiteChrome.css'

function PublicBrand() {
  return <Link className="np-brand" to="/" aria-label="Vortex Athletics, home"><img src="/vortex-athletics-gymnastics-logo.png" width="2172" height="342" alt="Vortex Athletics & Gymnastics" /></Link>
}

export function PublicSiteHeader({ isLoggedIn, onLogin }: { isLoggedIn: boolean; onLogin: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  useSiteHeaderHeight(headerRef)
  const closeMenu = () => setMenuOpen(false)
  const login = () => { closeMenu(); onLogin() }

  return <>
    <a className="np-skip" href="#public-content">Skip to content</a>
    <header ref={headerRef} className="np-header np-public-header" onKeyDown={(event) => { if (event.key === 'Escape') setMenuOpen(false) }}>
      <div className="np-container np-nav">
        <PublicBrand />
        <nav className="np-desktop-nav" aria-label="Main navigation">
          <PublicNavigationLinks />
        </nav>
        <div className="np-nav-actions">
          <button type="button" className="np-login" onClick={login}>{isLoggedIn ? 'My portal' : 'Member login'}<ArrowUpRight size={14} /></button>
          <Link className="np-button np-nav-cta" to="/#free-trial" onClick={closeMenu}>Try a free class <ArrowUpRight size={16} /></Link>
          <button type="button" className="np-menu-toggle" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="np-public-mobile-nav" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
        </div>
      </div>
      {menuOpen && <nav id="np-public-mobile-nav" className="np-mobile-nav" aria-label="Mobile navigation">
        <PublicNavigationLinks mobile onNavigate={closeMenu} />
        <button type="button" onClick={login}>{isLoggedIn ? 'My portal' : 'Member login'}<ArrowUpRight size={18} /></button>
      </nav>}
    </header>
  </>
}

export function PublicSiteFooter() {
  return <footer className="np-footer np-container">
    <div className="np-footer-main">
      <div><PublicBrand /><p>Gymnastics. Athletic development.<br />Built for more.</p></div>
      <div><span className="np-footer-label">COME TRAIN WITH US</span><a href={`tel:${TEAM_PHONE_E164}`}>{TEAM_PHONE}</a><a href={`mailto:${TEAM_EMAIL}`}>{TEAM_EMAIL}</a></div>
      <div><span className="np-footer-label">STAY CONNECTED</span><a href={SOCIAL_PROFILES[0]} target="_blank" rel="noreferrer">Instagram <ArrowUpRight size={14} /></a><a href={SOCIAL_PROFILES[2]} target="_blank" rel="noreferrer">YouTube <ArrowUpRight size={14} /></a></div>
      <Link className="np-back-top" to="/">Back to home <ArrowUpRight size={17} /></Link>
    </div>
    <div className="np-footer-bottom"><span>© {new Date().getFullYear()} Vortex Athletics and Gymnastics</span><div><Link to="/privacy-policy">Privacy</Link><Link to="/terms-of-service">Terms</Link></div></div>
  </footer>
}
