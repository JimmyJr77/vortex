import { Link } from 'react-router-dom'
import { CONTACT_INQUIRY_PATH } from '../../config/contact'

export default function RecurringBookingTerms() {
  return <p className="np-booking-terms">
    Choose your weekly time and start date during registration. Review{' '}
    <Link to="/terms-of-service">membership and cancellation terms</Link> or{' '}
    <Link to={CONTACT_INQUIRY_PATH}>contact Vortex with questions</Link>.
  </p>
}
