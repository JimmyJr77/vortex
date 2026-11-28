import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function RecurringRegistrationLink({ href, className, section, dropInHref }: {
  href: string; className?: string; section: string; dropInHref?: string
}) {
  const enrollment = <Link to={href} className="np-button np-booking-register"
    aria-label={className ? `Enroll now — ${className}` : undefined}
    data-analytics-cta="browse_classes" data-analytics-section={section}>
    Enroll now <ArrowUpRight size={16} aria-hidden="true" />
  </Link>
  return <span className="np-program-page-actions np-booking-actions">
    {enrollment}
    {dropInHref && <Link to={dropInHref} className="np-button np-booking-register"
      data-analytics-cta="browse_drop_ins" data-analytics-section={section}>
      Non-member drop-in <ArrowUpRight size={16} aria-hidden="true" />
    </Link>}
  </span>
}
