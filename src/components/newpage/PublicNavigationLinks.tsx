import { Link } from 'react-router-dom'
import { ArrowUpRight, CalendarDays } from 'lucide-react'

const navigation = [
  { label: 'Our programs', key: 'programs', to: '/#programs' },
  { label: 'Free trial', key: 'free_trial_section', to: '/#free-trial' },
  { label: 'The triad', key: 'triad', to: '/#triad' },
  { label: 'Our approach', key: 'approach', to: '/#approach' },
  { label: 'Visit us', key: 'visit', to: '/#visit', mobileOnly: true },
  { label: 'Schedule', key: 'schedule', to: '/read-board#schedule', calendar: true },
]

/** The homepage and public booking pages always use the same navigation. */
export default function PublicNavigationLinks({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  return navigation.filter(item => mobile || !item.mobileOnly).map(item => (
    <Link
      key={item.to}
      to={item.to}
      data-analytics-cta={item.key}
      data-analytics-section="navigation"
      onClick={onNavigate}
      className={item.calendar && !mobile ? 'np-nav-schedule' : undefined}
      aria-label={item.calendar ? item.label : undefined}
      title={item.calendar && !mobile ? item.label : undefined}
    >
      <span className="np-nav-label">
        {item.calendar && !mobile && <CalendarDays size={18} aria-hidden="true" />}
        <span className="np-nav-text">{item.label}</span>
      </span>
      {mobile && <ArrowUpRight size={18} aria-hidden="true" />}
    </Link>
  ))
}
