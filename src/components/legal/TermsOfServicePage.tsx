import { Link } from 'react-router-dom'
import LegalPageLayout, { list, paragraph, sectionHeading } from './LegalPageLayout'
import { BUSINESS_NAP, TEAM_EMAIL } from '../../config/contact'

const LEGAL_ENTITY = 'Vortex Athletics, LLC'

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout title="Terms of Service">
      <p className={paragraph}>
        These Terms of Service (&quot;Terms&quot;) govern your use of the websites, enrollment systems,
        and online portals operated by {LEGAL_ENTITY} (&quot;Vortex Athletics,&quot; &quot;we,&quot; &quot;us,&quot; or
        &quot;our&quot;), and your participation in our programs. By using our services or enrolling in a
        program, you agree to these Terms.
      </p>

      <h2 className={sectionHeading}>Eligibility and accounts</h2>
      <ul className={list}>
        <li>
          A parent or legal guardian must create and manage accounts for minor athletes and must
          be at least 18 years old.
        </li>
        <li>
          You are responsible for maintaining the confidentiality of your login credentials and for
          activity under your account.
        </li>
        <li>
          Information you provide during enrollment must be accurate and kept up to date.
        </li>
      </ul>

      <h2 className={sectionHeading}>Enrollment and program participation</h2>
      <ul className={list}>
        <li>
          Enrollment is subject to class availability, skill level requirements, coach approval,
          and completion of required waivers and policies.
        </li>
        <li>
          Program schedules, coaches, and curriculum may change due to operational needs, safety,
          or enrollment levels.
        </li>
        <li>
          Athletes must follow facility rules, coach instructions, and safety requirements at all
          times. We may suspend or terminate participation for conduct that jeopardizes safety or
          disrupts programs.
        </li>
        <li>
          Physical activity involves inherent risk of injury. Participation is voluntary; you
          acknowledge these risks as part of enrollment and waiver acceptance.
        </li>
      </ul>

      <h2 className={sectionHeading}>Fees, billing, and payments</h2>
      <ul className={list}>
        <li>
          Tuition, membership fees, camp fees, and other charges are described at enrollment or in
          program materials. By completing enrollment and payment authorization, you agree to pay
          applicable fees.
        </li>
        <li>
          Recurring membership or tuition may be billed automatically according to the billing
          schedule shown during enrollment or in your member portal.
        </li>
        <li>
          Payments are processed through Stripe or other authorized payment providers. You agree to
          their applicable terms for payment processing.
        </li>
        <li>
          Refunds, credits, and cancellation policies vary by program and are disclosed during
          enrollment or in separate program policies. Unless otherwise stated, fees for services
          already rendered are non-refundable.
        </li>
        <li>
          Failed or disputed payments may result in suspension of enrollment until the account is
          brought current.
        </li>
      </ul>

      <h2 className={sectionHeading}>Waivers and releases</h2>
      <p className={paragraph}>
        Enrollment may require electronic acceptance of liability waivers, payment policies, and
        other program agreements. Those documents are incorporated into these Terms by reference
        and must be accepted before participation where required.
      </p>

      <h2 className={sectionHeading}>Communications</h2>
      <p className={paragraph}>
        By providing contact information, you consent to receive transactional communications
        related to enrollment, billing, scheduling, safety, and account administration by email,
        phone, SMS (where provided and permitted), or through our member portal messaging features.
        Marketing messages, where sent, will comply with applicable law and your preferences.
      </p>

      <h2 className={sectionHeading}>Website and portal use</h2>
      <ul className={list}>
        <li>
          You may not misuse our websites or portals, attempt unauthorized access, interfere with
          security, scrape data, or use our services for unlawful purposes.
        </li>
        <li>
          Content on our websites (text, images, videos, logos) is owned by Vortex Athletics or
          licensors and may not be copied or reused without permission.
        </li>
        <li>
          We may modify, suspend, or discontinue website features or portal functionality with
          reasonable notice where practicable.
        </li>
      </ul>

      <h2 className={sectionHeading}>Privacy</h2>
      <p className={paragraph}>
        Our collection and use of personal information is described in our{' '}
        <Link to="/privacy-policy" className="text-vortex-red hover:underline">
          Privacy Policy
        </Link>
        , which is incorporated into these Terms by reference.
      </p>

      <h2 className={sectionHeading}>Disclaimer of warranties</h2>
      <p className={paragraph}>
        Our websites and online services are provided on an &quot;as is&quot; and &quot;as available&quot; basis to
        the fullest extent permitted by law. We do not guarantee uninterrupted or error-free
        operation of online systems.
      </p>

      <h2 className={sectionHeading}>Limitation of liability</h2>
      <p className={paragraph}>
        To the fullest extent permitted by law, {LEGAL_ENTITY} and its officers, employees, and
        coaches shall not be liable for indirect, incidental, special, consequential, or punitive
        damages arising from your use of our websites or portals. Our total liability for claims
        related to online services shall not exceed the amount you paid to us for the service giving
        rise to the claim in the twelve months before the claim, except where prohibited by law.
      </p>

      <h2 className={sectionHeading}>Indemnification</h2>
      <p className={paragraph}>
        You agree to indemnify and hold harmless {LEGAL_ENTITY} from claims arising from your
        violation of these Terms, misuse of our services, or inaccurate information you provide,
        except to the extent caused by our negligence or willful misconduct.
      </p>

      <h2 className={sectionHeading}>Governing law</h2>
      <p className={paragraph}>
        These Terms are governed by the laws of the State of Maryland, without regard to conflict-of-law
        principles. Disputes shall be brought in the state or federal courts located in Maryland,
        unless otherwise required by applicable law.
      </p>

      <h2 className={sectionHeading}>Changes to these Terms</h2>
      <p className={paragraph}>
        We may update these Terms from time to time. Continued use of our services after changes are
        posted constitutes acceptance of the revised Terms. The &quot;Last updated&quot; date at the top of
        this page indicates when they were last revised.
      </p>

      <h2 className={sectionHeading}>Contact</h2>
      <p className={paragraph}>
        Questions about these Terms may be sent to{' '}
        <a href={`mailto:${TEAM_EMAIL}`} className="text-vortex-red hover:underline">
          {TEAM_EMAIL}
        </a>{' '}
        or through our{' '}
        <Link to="/support" className="text-vortex-red hover:underline">
          customer support page
        </Link>
        .
      </p>
      <p className={paragraph}>
        {LEGAL_ENTITY}
        <br />
        {BUSINESS_NAP.streetAddress}, {BUSINESS_NAP.addressLocality}, {BUSINESS_NAP.addressRegion}{' '}
        {BUSINESS_NAP.postalCode}
      </p>
    </LegalPageLayout>
  )
}
