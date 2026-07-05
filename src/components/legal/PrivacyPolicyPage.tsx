import { Link } from 'react-router-dom'
import LegalPageLayout, { list, paragraph, sectionHeading } from './LegalPageLayout'
import { BUSINESS_NAP, TEAM_EMAIL } from '../../config/contact'

const LEGAL_ENTITY = 'Vortex Athletics, LLC'

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Privacy Policy">
      <p className={paragraph}>
        This Privacy Policy describes how {LEGAL_ENTITY} (&quot;Vortex Athletics,&quot; &quot;we,&quot;
        &quot;us,&quot; or &quot;our&quot;) collects, uses, discloses, and protects personal information when
        you visit our websites (including vortexathletics.com and related program sites), enroll in
        classes, use our member or coach portals, or otherwise interact with us.
      </p>

      <h2 className={sectionHeading}>Information we collect</h2>
      <p className={paragraph}>We may collect the following categories of information:</p>
      <ul className={list}>
        <li>
          <strong>Contact and identity information:</strong> name, email address, phone number,
          mailing address, date of birth, gender, and graduation year (where applicable).
        </li>
        <li>
          <strong>Account credentials:</strong> username and password (stored in hashed form) for
          member, coach, and administrator portals.
        </li>
        <li>
          <strong>Enrollment and program information:</strong> class selections, program
          enrollments, waivers and electronic signatures, attendance-related records, and
          communications you send through our messaging features.
        </li>
        <li>
          <strong>Billing and payment information:</strong> billing address and transaction
          details. Payment card numbers are collected and processed by Stripe; we do not store
          full card numbers on our servers.
        </li>
        <li>
          <strong>Inquiry and marketing information:</strong> information you submit through
          contact forms, camp interest forms, or similar requests, including optional message
          content and referral source (such as UTM parameters).
        </li>
        <li>
          <strong>Technical and usage information:</strong> IP address, browser type, device
          information, pages viewed, and similar analytics data when you use our websites (subject
          to your cookie preferences).
        </li>
        <li>
          <strong>Children&apos;s information:</strong> when a parent or guardian enrolls a minor,
          we collect athlete information necessary to provide coaching, safety, and program
          administration. We do not knowingly collect personal information directly from children
          under 13 without appropriate parental involvement.
        </li>
      </ul>

      <h2 className={sectionHeading}>How we use information</h2>
      <p className={paragraph}>We use personal information to:</p>
      <ul className={list}>
        <li>Provide, operate, and improve our classes, camps, and athletic programs</li>
        <li>Process enrollments, waivers, scheduling, and membership accounts</li>
        <li>Process payments, issue receipts, and manage billing accounts</li>
        <li>Communicate with you about enrollment, scheduling, safety, billing, and support</li>
        <li>Enable coach–family messaging and program-related notifications in our portals</li>
        <li>Respond to inquiries submitted through our website or email</li>
        <li>Maintain security, prevent fraud, and enforce our terms and facility policies</li>
        <li>
          Analyze site usage to improve our programs and marketing (only with your consent where
          required for non-essential cookies)
        </li>
        <li>Comply with legal obligations and protect our rights</li>
      </ul>

      <h2 className={sectionHeading}>How we disclose information</h2>
      <p className={paragraph}>
        We do not sell your personal information. We may disclose information to the following
        categories of recipients, only as needed for the purposes described above:
      </p>
      <ul className={list}>
        <li>
          <strong>Service providers:</strong> vendors that help us operate our business, such as
          payment processing (Stripe), email delivery, hosting, and analytics providers. These
          parties are authorized to use information only to perform services for us.
        </li>
        <li>
          <strong>Coaches and staff:</strong> authorized Vortex Athletics personnel who need access
          to athlete and family information to deliver coaching, scheduling, safety, and
          administrative services.
        </li>
        <li>
          <strong>Legal and safety:</strong> when required by law, regulation, legal process, or to
          protect the rights, property, or safety of Vortex Athletics, our athletes, families, or
          others.
        </li>
        <li>
          <strong>Business transfers:</strong> in connection with a merger, acquisition, or sale of
          assets, subject to appropriate confidentiality protections.
        </li>
      </ul>
      <p className={paragraph}>
        Disclosures may occur through secure electronic systems (for example, our web application,
        email, or vendor APIs), in person at our facility, or by phone when necessary to provide
        support or fulfill a request you initiate.
      </p>

      <h2 className={sectionHeading}>Cookies and analytics</h2>
      <p className={paragraph}>
        We use necessary cookies to operate our websites and optional analytics and marketing
        cookies only with your consent. You can manage preferences through the cookie banner on our
        site. We use Google Analytics (measurement ID G-XDE178DQWY) to understand how visitors use
        our pages when analytics cookies are enabled. We do not use cookies to build advertising
        audiences from children&apos;s information.
      </p>

      <h2 className={sectionHeading}>Security practices</h2>
      <p className={paragraph}>
        We implement reasonable administrative, technical, and physical safeguards designed to protect
        personal information, including:
      </p>
      <ul className={list}>
        <li>Encrypted connections (HTTPS) for data transmitted through our websites</li>
        <li>Password hashing and authenticated access controls for portal accounts</li>
        <li>Role-based access limiting staff and coach visibility to information needed for their duties</li>
        <li>
          Payment card data handled by Stripe in accordance with PCI DSS standards; we do not store
          full card numbers
        </li>
        <li>Regular review of systems and vendor relationships relevant to data handling</li>
      </ul>
      <p className={paragraph}>
        No method of transmission or storage is completely secure. If you believe your account has
        been compromised, contact us promptly at{' '}
        <a href={`mailto:${TEAM_EMAIL}`} className="text-vortex-red hover:underline">
          {TEAM_EMAIL}
        </a>
        .
      </p>

      <h2 className={sectionHeading}>Data retention</h2>
      <p className={paragraph}>
        We retain personal information for as long as needed to provide services, maintain
        enrollment and billing records, comply with legal obligations, resolve disputes, and enforce
        our agreements. When information is no longer required, we take reasonable steps to delete
        or de-identify it.
      </p>

      <h2 className={sectionHeading}>Your choices and rights</h2>
      <p className={paragraph}>
        Depending on your location, you may have rights to access, correct, delete, or obtain a copy
        of certain personal information, or to opt out of certain processing. To make a request,
        email{' '}
        <a href={`mailto:${TEAM_EMAIL}`} className="text-vortex-red hover:underline">
          {TEAM_EMAIL}
        </a>
        . We may need to verify your identity before fulfilling a request. Parents or guardians may
        request access to or correction of information about a minor enrolled under their account.
      </p>

      <h2 className={sectionHeading}>Third-party links</h2>
      <p className={paragraph}>
        Our websites may link to third-party sites (for example, social media or mapping services).
        Those sites have their own privacy practices, and we are not responsible for their content or
        policies.
      </p>

      <h2 className={sectionHeading}>Changes to this policy</h2>
      <p className={paragraph}>
        We may update this Privacy Policy from time to time. The &quot;Last updated&quot; date at the top
        of this page indicates when it was most recently revised. Material changes will be posted on
        this page.
      </p>

      <h2 className={sectionHeading}>Contact us</h2>
      <p className={paragraph}>
        Questions about this Privacy Policy or our data practices may be directed to:
      </p>
      <ul className={list}>
        <li>{LEGAL_ENTITY}</li>
        <li>
          {BUSINESS_NAP.streetAddress}, {BUSINESS_NAP.addressLocality}, {BUSINESS_NAP.addressRegion}{' '}
          {BUSINESS_NAP.postalCode}
        </li>
        <li>
          Email:{' '}
          <a href={`mailto:${TEAM_EMAIL}`} className="text-vortex-red hover:underline">
            {TEAM_EMAIL}
          </a>
        </li>
        <li>
          Support:{' '}
          <Link to="/support" className="text-vortex-red hover:underline">
            vortexathletics.com/support
          </Link>
        </li>
      </ul>
    </LegalPageLayout>
  )
}
