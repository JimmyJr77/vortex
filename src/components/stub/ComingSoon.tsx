import { lazy, Suspense, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { GraduationCap, PlayCircle, Users, Dumbbell } from 'lucide-react'
import SeoHead from '../SeoHead'
import ContactForm from '../ContactForm'
import Login from '../Login'
import MemberLogin from '../MemberLogin'
import StubHeader from './StubHeader'
import { getStubSeo, HUB_URL, type StubSiteConfig } from '../../config/stubSites'
import { setSportSiteContext } from '../../utils/sportSite'
import { useSiteHighlights } from '../../hooks/useSiteHighlights'
import HighlightsModal from '../HighlightsModal'

const Admin = lazy(() => import('../Admin'))
const MemberDashboard = lazy(() => import('../MemberDashboard'))

function AdminLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
    </div>
  )
}

interface ComingSoonProps {
  config: StubSiteConfig
  isPreview?: boolean
}

const pillars = [
  {
    icon: GraduationCap,
    title: 'Level-Appropriate Learning',
    body: 'Every athlete trains where they are, not where a scoreboard says they should be. We meet kids at their level and build the skills that actually last.',
  },
  {
    icon: PlayCircle,
    title: 'Training Packages That Teach',
    body: 'Programs are built to support real learning with video breakdowns and resources you can revisit anytime, so progress continues between sessions.',
  },
  {
    icon: Users,
    title: 'Coaches Who Know Their Sport',
    body: 'Top-level coaches who not only know the game inside out, but know how to coach it, communicate it, and develop the athlete behind the player.',
  },
  {
    icon: Dumbbell,
    title: 'Facilities Built for Athleticism',
    body: 'The space, equipment, and environment to build the fitness and athleticism required to excel, all under one roof.',
  },
]

const ComingSoon = ({ config, isPreview = false }: ComingSoonProps) => {
  const seo = getStubSeo(config, { isPreview })
  const [isContactFormOpen, setIsContactFormOpen] = useState(false)
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [isMemberLoginOpen, setIsMemberLoginOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(
    () => localStorage.getItem('vortex_admin') === 'true',
  )
  const [member, setMember] = useState<unknown>(null)
  const [memberToken, setMemberToken] = useState<string | null>(null)
  const [showMemberDashboard, setShowMemberDashboard] = useState(false)
  const {
    highlights,
    isOpen: isHighlightsOpen,
    open: openHighlights,
    close: closeHighlights,
    hasHighlights,
  } = useSiteHighlights({ homePageOnly: true })

  useEffect(() => {
    const storedToken = localStorage.getItem('vortex_member_token')
    const storedMember = localStorage.getItem('vortex_member')
    if (storedToken && storedMember) {
      try {
        setMemberToken(storedToken)
        setMember(JSON.parse(storedMember))
      } catch {
        localStorage.removeItem('vortex_member_token')
        localStorage.removeItem('vortex_member')
      }
    }
  }, [])

  const handleAdminLoginSuccess = () => {
    setIsAdmin(true)
  }

  const handleAdminLogout = () => {
    localStorage.removeItem('vortex_admin')
    localStorage.removeItem('adminToken')
    localStorage.removeItem('vortex-admin-info')
    localStorage.removeItem('vortex-admin-id')
    setIsAdmin(false)
  }

  const handleMemberLoginSuccess = (token: string, memberData: unknown) => {
    setSportSiteContext(config.key)
    localStorage.setItem('vortex_member_token', token)
    localStorage.setItem('vortex_member', JSON.stringify(memberData))
    setMemberToken(token)
    setMember(memberData)
    setShowMemberDashboard(true)
  }

  const handleMemberLogout = () => {
    localStorage.removeItem('vortex_member_token')
    localStorage.removeItem('vortex_member')
    setMemberToken(null)
    setMember(null)
    setShowMemberDashboard(false)
  }

  if (isAdmin) {
    return (
      <Suspense fallback={<AdminLoader />}>
        <Admin onLogout={handleAdminLogout} />
      </Suspense>
    )
  }

  if (member && memberToken && showMemberDashboard) {
    return (
      <Suspense fallback={<AdminLoader />}>
        <MemberDashboard
          member={member}
          onLogout={handleMemberLogout}
          onReturnToWebsite={() => setShowMemberDashboard(false)}
        />
      </Suspense>
    )
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <SeoHead {...seo} />
      <StubHeader
        config={config}
        onContactClick={() => setIsContactFormOpen(true)}
        onAdminLoginClick={() => setIsLoginOpen(true)}
        onMemberLoginClick={() => setIsMemberLoginOpen(true)}
      />

      {/* Hero */}
      <section className="relative bg-vortex-dark text-white overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-vortex-dark to-black opacity-95" />
        <div className="container-custom relative">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="max-w-3xl"
          >
            <span className="inline-block bg-vortex-red/15 text-vortex-red border border-vortex-red/40 rounded-full px-4 py-1.5 text-xs md:text-sm font-semibold tracking-wide uppercase">
              League Coming Soon
            </span>

            <h1 className="font-display font-bold uppercase leading-tight mt-6 text-4xl sm:text-5xl md:text-7xl">
              Vortex <span className="text-vortex-red">{config.sportLabel}</span>
            </h1>

            <p className="mt-6 text-lg md:text-2xl text-gray-300 font-display">
              {config.headline}
            </p>

            <p className="mt-6 text-base md:text-lg text-gray-400 leading-relaxed">
              We don&apos;t train for championships. We train for development, so the
              championships come when it counts. Vortex {config.sportLabel} is on the way,
              built around athletes who get better every season.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              {hasHighlights && (
                <button
                  type="button"
                  onClick={openHighlights}
                  className="border-2 border-white bg-white text-vortex-red px-8 py-4 rounded-lg font-semibold text-base md:text-lg transition-all duration-300 hover:bg-white/90 hover:scale-105"
                >
                  Highlights
                </button>
              )}
              <a
                href={HUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-vortex-red text-white px-8 py-4 rounded-lg font-semibold text-base md:text-lg transition-all duration-300 hover:bg-red-700 hover:scale-105 hover:shadow-lg inline-block"
              >
                Explore Vortex Athletics
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pillars */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <div className="max-w-3xl">
            <h2 className="font-display font-bold uppercase text-3xl md:text-5xl">
              Development First
            </h2>
            <p className="mt-4 text-gray-600 text-lg leading-relaxed">
              Vortex {config.sportLabel} is being built on the same foundation as everything
              we do: long-term athlete development over short-term trophies. Here&apos;s what
              that looks like.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {pillars.map((pillar, index) => {
              const Icon = pillar.icon
              return (
                <motion.div
                  key={pillar.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                  className="border border-gray-200 rounded-2xl p-7 hover:shadow-lg transition-shadow duration-300"
                >
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-vortex-red/10 text-vortex-red">
                    <Icon size={26} />
                  </div>
                  <h3 className="mt-5 font-display font-semibold text-xl uppercase tracking-wide">
                    {pillar.title}
                  </h3>
                  <p className="mt-3 text-gray-600 leading-relaxed">{pillar.body}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-vortex-dark text-white py-16">
        <div className="container-custom text-center">
          <h2 className="font-display font-bold uppercase text-2xl md:text-4xl">
            Be Ready When the Whistle Blows
          </h2>
          <p className="mt-4 text-gray-400 max-w-2xl mx-auto text-lg">
            In the meantime, everything Vortex lives on our main hub. Programs, classes,
            events, and the full story behind how we develop athletes.
          </p>
          <a
            href={HUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-block bg-vortex-red text-white px-8 py-4 rounded-lg font-semibold text-base md:text-lg transition-all duration-300 hover:bg-red-700 hover:scale-105 hover:shadow-lg"
          >
            Visit VortexAthletics.com
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-gray-400 py-8">
        <div className="container-custom flex flex-col md:flex-row items-center justify-between gap-4">
          <img src="/vortex_logo_1.png" alt="Vortex Athletics" className="h-10 w-auto" />
          <p className="text-sm">
            &copy; {new Date().getFullYear()} Vortex Athletics. All rights reserved.
          </p>
          <a
            href={HUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm hover:text-vortex-red transition-colors duration-300"
          >
            vortexathletics.com
          </a>
        </div>
      </footer>

      <ContactForm
        isOpen={isContactFormOpen}
        onClose={() => setIsContactFormOpen(false)}
        sportLabel={config.sportLabel}
      />
      <Login
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={handleAdminLoginSuccess}
      />
      <MemberLogin
        isOpen={isMemberLoginOpen}
        onClose={() => setIsMemberLoginOpen(false)}
        onSuccess={handleMemberLoginSuccess}
      />
      {hasHighlights && (
        <HighlightsModal
          highlights={highlights}
          isOpen={isHighlightsOpen}
          onClose={closeHighlights}
        />
      )}
    </div>
  )
}

export default ComingSoon
