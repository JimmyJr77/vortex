import { Link } from 'react-router-dom'
import { ArrowUpRight, CalendarDays, ChevronDown } from 'lucide-react'
import { BOWIE_YOUTH_SPORTS_GUIDE } from '../../config/bowieYouthSportsGuide'

const programNavigation = [
  { label: 'Youth gymnastics', key: 'explore_gymnastics', to: '/gymnastics' },
  { label: 'Fit & Flip youth training', key: 'explore_fit-flip', to: '/fit-and-flip' },
  { label: 'Adult gymnastics', key: 'explore_adult_gymnastics', to: '/adult-gymnastics' },
  { label: 'Bowie youth sports guide', key: 'read_bowie_youth_sports_guide', to: BOWIE_YOUTH_SPORTS_GUIDE.path },
  { label: 'All programs', key: 'programs', to: '/#programs' },
]

const navigation = [
  { label: 'Free trial', key: 'free_trial_section', to: '/#free-trial' },
  { label: 'The triad', key: 'triad', to: '/#triad' },
  { label: 'Our approach', key: 'approach', to: '/#approach' },
  { label: 'Visit us', key: 'visit', to: '/#visit', mobileOnly: true },
  { label: 'Schedule', key: 'schedule', to: '/read-board#schedule', calendar: true },
]

/** The homepage and public booking pages always use the same navigation. */
export default function PublicNavigationLinks({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  return <>
    <details
      className="np-nav-programs"
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false
      }}
      onKeyDown={event => {
        const disclosure = event.currentTarget
        if (event.key === 'Escape' && disclosure.open) {
          event.preventDefault()
          event.stopPropagation()
          disclosure.open = false
          disclosure.querySelector('summary')?.focus()
        }
      }}
    >
      <summary>Our programs <ChevronDown size={16} aria-hidden="true" /></summary>
      <ul>
        {programNavigation.map(({ to, label, key }) => (
          <li key={to}>
            <Link
              to={to}
              data-analytics-cta={key}
              data-analytics-section="navigation"
              onClick={event => {
                const disclosure = event.currentTarget.closest('details')
                if (disclosure) disclosure.open = false
                onNavigate?.()
              }}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </details>
    {navigation.filter(item => mobile || !item.mobileOnly).map(item => (
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
    ))}
  </>
}
