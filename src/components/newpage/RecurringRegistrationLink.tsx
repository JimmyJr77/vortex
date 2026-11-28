import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function RecurringRegistrationLink({ href, className, section }: { href: string; className?: string; section: string }) {
  return <Link to={href} className="np-button np-booking-register"
    aria-label={className ? `Register for ${className} recurring classes` : undefined}
    data-analytics-cta="browse_classes" data-analytics-section={section}>
    Register for recurring classes <ArrowUpRight size={16} aria-hidden="true" />
  </Link>
}
