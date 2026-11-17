import { Link } from 'react-router-dom'
import { getSiteEnrollHref } from '../utils/enrollSite'
import { Mail, Phone, MapPin, Instagram, Facebook, ArrowUp } from 'lucide-react'
import {
  BUSINESS_NAP,
  FACEBOOK_PROFILE_URL,
  GOOGLE_MAPS_URL,
  JACKRABBIT_PARENT_PORTAL_URL,
  TEAM_EMAIL,
  TEAM_PHONE,
  TEAM_PHONE_E164,
} from '../config/contact'
import { getHubSiteUrl } from '../utils/crossDomainConsent'
import {
  NINJA_HOLD_TITLE,
  NINJA_PROGRAM_ON_HOLD,
  ninjaOnHoldFooterLinkClass,
} from '../utils/ninjaProgram'

interface FooterProps {
  onContactClick: () => void
  onLoginClick?: () => void
}

const Footer = ({ onLoginClick }: FooterProps) => {
  const scrollToTop = () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'instant' : 'smooth' })
  }

  const quickLinks: { name: string; href: string; onHold?: boolean }[] = [
    { name: 'Youth Gymnastics', href: getHubSiteUrl('/gymnastics') },
    { name: 'Fit & Flip', href: getHubSiteUrl('/fit-and-flip') },
    { name: 'Adult Gymnastics', href: getHubSiteUrl('/adult-gymnastics') },
    {
      name: 'Kids Ninja Classes',
      href: getHubSiteUrl('/ninja'),
      onHold: NINJA_PROGRAM_ON_HOLD,
    },
    {
      name: 'The Triad of Athleticism',
      href: getHubSiteUrl('/#triad'),
    },
    { name: 'Classes & Events', href: getHubSiteUrl('/read-board') },
    { name: 'Drop-In Classes', href: getHubSiteUrl('/drop-in') },
    { name: 'Store', href: getHubSiteUrl('/store') },
    { name: 'Contact & Location', href: getHubSiteUrl('/contact') },
    { name: 'FAQ', href: getHubSiteUrl('/#faq') },
  ]

  const socialLinks = [
    { name: 'Instagram', icon: Instagram, href: 'https://www.instagram.com/vortexathletics.usa/' },
    {
      name: 'Facebook',
      icon: Facebook,
      href: FACEBOOK_PROFILE_URL,
    },
  ]

  return (
    <footer className="bg-black text-white">
      <div className="container-custom">
        {/* Main Footer Content */}
        <div className="py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
            {/* Brand Section */}
            <div className="lg:col-span-2">
              <div className="flex items-center space-x-3 mb-6">
                <img
                  src="/vortex-logo-footer.webp"
                  alt="Vortex Athletics"
                  width="840"
                  height="200"
                  className="h-16 w-auto"
                />
              </div>

              <p className="text-gray-300 text-lg leading-relaxed mb-8 max-w-md">
                Purposeful gymnastics and athletic development that build strength,
                explosiveness, and body control. Built for every athlete.
              </p>

              <div className="flex space-x-4">
                {socialLinks.map((social) => (
                  <a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Vortex Athletics on ${social.name}`}
                    className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-vortex-red motion-safe:transition-colors motion-safe:duration-300"
                  >
                    <social.icon aria-hidden="true" className="w-5 h-5" />
                  </a>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h2 className="text-xl font-bold mb-6">Quick Links</h2>
              <ul className="space-y-3">
                {quickLinks.map((link) => (
                  <li key={link.name}>
                    {link.onHold ? (
                      <span
                        aria-disabled="true"
                        title={NINJA_HOLD_TITLE}
                        className={ninjaOnHoldFooterLinkClass}
                      >
                        {link.name}
                        <span className="sr-only"> (on hold)</span>
                      </span>
                    ) : (
                      <a
                        href={link.href}
                        className="text-gray-300 hover:text-vortex-red motion-safe:transition-colors motion-safe:duration-300"
                      >
                        {link.name}
                      </a>
                    )}
                  </li>
                ))}
                {onLoginClick && (
                  <li>
                    <button
                      type="button"
                      onClick={onLoginClick}
                      className="text-gray-300 hover:text-vortex-red motion-safe:transition-colors motion-safe:duration-300"
                    >
                      Account Login
                    </button>
                  </li>
                )}
                <li>
                  <a
                    href={JACKRABBIT_PARENT_PORTAL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-analytics-cta="jackrabbit_login"
                    data-analytics-section="footer"
                    className="text-gray-300 hover:text-vortex-red motion-safe:transition-colors motion-safe:duration-300"
                  >
                    Jackrabbit Class Login
                  </a>
                </li>
              </ul>
            </div>

            {/* Contact Info */}
            <div className="lg:col-span-2">
              <h2 className="text-xl font-bold mb-6">Contact Info</h2>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Mail aria-hidden="true" className="w-5 h-5 text-vortex-red" />
                  <a
                    href={`mailto:${TEAM_EMAIL}`}
                    className="text-gray-300 hover:text-vortex-red motion-safe:transition-colors"
                  >
                    {TEAM_EMAIL}
                  </a>
                </div>
                <div className="flex items-center space-x-3">
                  <Phone aria-hidden="true" className="w-5 h-5 text-vortex-red" />
                  <a
                    href={`tel:${TEAM_PHONE_E164}`}
                    className="text-gray-300 hover:text-vortex-red motion-safe:transition-colors"
                  >
                    {TEAM_PHONE}
                  </a>
                </div>
                <div className="flex items-start space-x-3">
                  <MapPin aria-hidden="true" className="w-5 h-5 text-vortex-red mt-1" />
                  <a
                    href={GOOGLE_MAPS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-300 hover:text-vortex-red motion-safe:transition-colors"
                    aria-label={`Get directions to ${BUSINESS_NAP.name}`}
                  >
                    <div>{BUSINESS_NAP.name}</div>
                    <div>{BUSINESS_NAP.streetAddress}</div>
                    <div className="text-sm">
                      {BUSINESS_NAP.addressLocality}, {BUSINESS_NAP.addressRegion}{' '}
                      {BUSINESS_NAP.postalCode}
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="border-t border-gray-800 py-8">
          <div className="text-center">
            <h3 className="text-2xl font-display font-bold mb-4">
              Ready to Perform?
            </h3>
            <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
              Experience the future of athletic development.
            </p>
            <Link to={getSiteEnrollHref()} className="inline-block btn-primary motion-safe:active:scale-95 motion-reduce:transition-none motion-reduce:hover:transform-none">
              Enroll now
            </Link>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-400 text-sm text-center md:text-left">
              © 2024 Vortex Athletics, LLC. All rights reserved.
            </p>

            <nav
              className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-gray-400"
              aria-label="Legal"
            >
              <a href={getHubSiteUrl('/support')} className="hover:text-vortex-red motion-safe:transition-colors">
                Support
              </a>
              <a
                href={getHubSiteUrl('/privacy-policy')}
                className="hover:text-vortex-red motion-safe:transition-colors"
              >
                Privacy Policy
              </a>
              <a
                href={getHubSiteUrl('/terms-of-service')}
                className="hover:text-vortex-red motion-safe:transition-colors"
              >
                Terms of Service
              </a>
            </nav>

            <button
              type="button"
              onClick={scrollToTop}
              className="flex items-center space-x-2 text-gray-400 hover:text-vortex-red motion-safe:transition motion-safe:duration-300 motion-safe:hover:scale-105"
            >
              <span className="text-sm font-medium">Back to Top</span>
              <ArrowUp aria-hidden="true" className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
