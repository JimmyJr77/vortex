import { Link } from 'react-router-dom'
import { ArrowUpRight, ChevronDown } from 'lucide-react'
import { ENROLL_PATH } from '../../config/enrollSites'
import guideIndex from '../../config/publicGuideIndex.json'

const programNavigation = [
  { label: 'All classes', key: 'browse_classes', to: ENROLL_PATH },
  { label: 'Youth gymnastics', key: 'explore_gymnastics', to: '/gymnastics' },
  { label: 'Fit & Flip youth training', key: 'explore_fit-flip', to: '/fit-and-flip' },
  { label: 'Adult gymnastics', key: 'explore_adult_gymnastics', to: '/adult-gymnastics' },
  { label: 'All programs', key: 'programs', to: '/#programs' },
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
      <summary>Our Programs <ChevronDown size={16} aria-hidden="true" /></summary>
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
    <Link
      to="/contact"
      data-analytics-cta="contact"
      data-analytics-section="navigation"
      onClick={onNavigate}
    >
      Contact Us
      {mobile && <ArrowUpRight size={18} aria-hidden="true" />}
    </Link>
    <Link
      to={guideIndex.path}
      data-analytics-cta="training_guides"
      data-analytics-section="navigation"
      onClick={onNavigate}
    >
      Training Blog
      {mobile && <ArrowUpRight size={18} aria-hidden="true" />}
    </Link>
  </>
}
