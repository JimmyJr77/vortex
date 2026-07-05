import { Link } from 'react-router-dom'
import LegalPageLayout, { list, paragraph, sectionHeading } from './LegalPageLayout'
import {
  BUSINESS_HOURS,
  BUSINESS_NAP,
  GOOGLE_MAPS_URL,
  TEAM_EMAIL,
  TEAM_PHONE,
} from '../../config/contact'
import { getSiteEnrollHref } from '../../utils/enrollSite'

export default function SupportPage() {
  return (
    <LegalPageLayout title="Customer Support">
      <p className={paragraph}>
        Vortex Athletics is here to help with enrollment, billing, scheduling, and general
        questions about our programs in Bowie, Maryland.
      </p>

      <h2 className={sectionHeading}>Contact us</h2>
      <ul className={list}>
        <li>
          Email:{' '}
          <a href={`mailto:${TEAM_EMAIL}`} className="text-vortex-red hover:underline">
            {TEAM_EMAIL}
          </a>
        </li>
        <li>
          Phone:{' '}
          <a href="tel:+14434224794" className="text-vortex-red hover:underline">
            {TEAM_PHONE}
          </a>
        </li>
        <li>
          Address: {BUSINESS_NAP.streetAddress}, {BUSINESS_NAP.addressLocality},{' '}
          {BUSINESS_NAP.addressRegion} {BUSINESS_NAP.postalCode}
        </li>
        <li>
          <a
            href={GOOGLE_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-vortex-red hover:underline"
          >
            View on Google Maps
          </a>
        </li>
      </ul>

      <h2 className={sectionHeading}>Hours of operation</h2>
      <ul className={list}>
        {BUSINESS_HOURS.map((block) => (
          <li key={block.label}>{block.label}</li>
        ))}
        <li>Sunday: Closed</li>
      </ul>

      <h2 className={sectionHeading}>Common requests</h2>
      <ul className={list}>
        <li>
          <strong>Enroll or change classes:</strong>{' '}
          <Link to={getSiteEnrollHref()} className="text-vortex-red hover:underline">
            Start enrollment
          </Link>{' '}
          or email us with your athlete&apos;s name and program interest.
        </li>
        <li>
          <strong>Account login:</strong> Use the Account Login link in the site footer to access
          the member or coach portal for billing, messages, and training information.
        </li>
        <li>
          <strong>Billing and payments:</strong> Payment questions for active memberships can be
          directed to {TEAM_EMAIL}. Include the account holder name and a brief description of
          your question.
        </li>
        <li>
          <strong>Classes and events:</strong> See upcoming offerings on our{' '}
          <Link to="/read-board" className="text-vortex-red hover:underline">
            Classes &amp; Events
          </Link>{' '}
          page.
        </li>
      </ul>

      <h2 className={sectionHeading}>Response times</h2>
      <p className={paragraph}>
        We aim to respond to email within one to two business days. Phone calls are answered during
        facility hours when staff are available. Messages sent through your member portal are
        routed to the appropriate coach or administrator.
      </p>

      <h2 className={sectionHeading}>Policies</h2>
      <p className={paragraph}>
        For information about how we handle personal data, see our{' '}
        <Link to="/privacy-policy" className="text-vortex-red hover:underline">
          Privacy Policy
        </Link>
        . For enrollment, payment, and facility rules, see our{' '}
        <Link to="/terms-of-service" className="text-vortex-red hover:underline">
          Terms of Service
        </Link>
        .
      </p>
    </LegalPageLayout>
  )
}
