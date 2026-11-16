import { Link } from 'react-router-dom'
import { ArrowUpRight, CalendarDays } from 'lucide-react'

const navigation = [
  { label: 'Our programs', to: '/#programs' },
  { label: 'Free trial', to: '/#free-trial' },
  { label: 'The triad', to: '/#triad' },
  { label: 'Our approach', to: '/#approach' },
  { label: 'Visit us', to: '/#visit', mobileOnly: true },
  { label: 'Schedule', to: '/read-board#schedule', calendar: true },
]

/** The homepage and public booking pages always use the same navigation. */
export default function PublicNavigationLinks({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  return navigation.filter(item => mobile || !item.mobileOnly).map(item => (
    <Link key={item.to} to={item.to} onClick={onNavigate}>
      <span className="np-nav-label">{item.calendar && <CalendarDays size={mobile ? 18 : 16} aria-hidden="true" />}{item.label}</span>
      {mobile && <ArrowUpRight size={18} aria-hidden="true" />}
    </Link>
  ))
}
