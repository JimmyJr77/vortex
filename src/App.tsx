import { Suspense, useState, useEffect, useCallback } from 'react'
import { lazyWithRetry } from './utils/chunkLoadRecovery'
import { Routes, Route, useLocation, Navigate, matchPath } from 'react-router-dom'
import HubSeo from './components/HubSeo'
import { loadHomePage, loadPublicProgramPage, publicGuideLoaders, type PublicSnapshotPage } from './config/publicPageLoaders'
import { PublicSiteFooter, PublicSiteHeader } from './components/newpage/PublicSiteChrome'
import PortalTheme from './components/portal/PortalTheme'
import { trackEngagement } from './utils/analytics'
import PublicSiteAnalytics from './components/analytics/PublicSiteAnalytics'
import { hasAdminSession } from './utils/api'
import {
  bestPortalForAccount,
  clearPortalSession,
  getAvailablePortals,
  getLoggedInMemberAccount,
  getMemberSessionToken,
  PORTAL_SESSION_CHANGED,
  persistAdminSessionFromAccount,
  persistMemberSession,
  updateMemberSessionCredentials,
  type PortalAccount,
  type PortalId,
} from './utils/portalSession'
import CookieConsent from './components/CookieConsent'
import publicLandingRedirects from './config/publicLandingRedirects.json'
import { PUBLIC_PROGRAMS } from './config/publicPrograms'
import { isAdultBookingProgram } from './utils/publicBookingPrograms'
// Lazy-load heavy routes and portals so dev server / first paint stay fast
const Header = lazyWithRetry(() => import('./components/Header'))
const Footer = lazyWithRetry(() => import('./components/Footer'))
const ContactForm = lazyWithRetry(() => import('./components/ContactForm'))
const Login = lazyWithRetry(() => import('./components/Login'))
const CopyPage = lazyWithRetry(() => import('./components/CopyPage'))
const NewPage = lazyWithRetry(loadHomePage)
const PublicProgramPage = lazyWithRetry(loadPublicProgramPage)
const Ninja = lazyWithRetry(() => import('./components/Ninja'))
const ReadBoard = lazyWithRetry(() => import('./components/ReadBoard'))
const SchedulingPage = lazyWithRetry(() => import('./components/SchedulingPage'))
const CampInterestPage = lazyWithRetry(() => import('./apps/gymnastics/pages/CampInterestPage'))
const CampInterestThankYouPage = lazyWithRetry(() => import('./apps/gymnastics/pages/CampInterestThankYouPage'))
const SignupFamilyPage = lazyWithRetry(() => import('./components/signup/SignupFamilyPage'))
const SignupLeadPage = lazyWithRetry(() => import('./components/signup/SignupLeadPage'))
const SignupInvitePage = lazyWithRetry(() => import('./components/signup/SignupInvitePage'))
const VerifyEmailPage = lazyWithRetry(() => import('./components/VerifyEmailPage'))
const EnrollmentReceiptPage = lazyWithRetry(() => import('./components/EnrollmentReceiptPage'))
const WaiversMembershipsPage = lazyWithRetry(() => import('./components/waiversMemberships/WaiversMembershipsPage'))
const DropInPage = lazyWithRetry(() => import('./components/DropInPage'))
const publicGuideRoutes = publicGuideLoaders.map(({ path, load }) => ({ path, Component: lazyWithRetry(load) }))
const ContactLocationPage = lazyWithRetry(() => import('./components/ContactLocationPage'))
const SupportPage = lazyWithRetry(() => import('./components/legal/SupportPage'))
const PrivacyPolicyPage = lazyWithRetry(() => import('./components/legal/PrivacyPolicyPage'))
const TermsOfServicePage = lazyWithRetry(() => import('./components/legal/TermsOfServicePage'))
const NewAdmin = lazyWithRetry(() => import('./components/newAdmin/NewAdmin'))
const Admin = lazyWithRetry(() => import('./components/Admin'))
const MemberDashboard = lazyWithRetry(() => import('./components/MemberDashboard'))
const MemberWaiverPrompt = lazyWithRetry(() => import('./components/MemberWaiverPrompt'))
const CoachDashboard = lazyWithRetry(() => import('./components/CoachDashboard'))
const Storefront = lazyWithRetry(() => import('./components/store/Storefront'))
const I9PreparerPortal = lazyWithRetry(() => import('./components/payroll/I9PreparerPortal'))
const PayrollEmployeePortal = lazyWithRetry(() => import('./components/payroll/PayrollEmployeePortal'))

function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
    </div>
  )
}

function PublicLandingRedirect({ destination }: { destination: string }) {
  const location = useLocation()
  const [pathname, anchor] = destination.split('#')
  return <Navigate to={{ pathname: pathname || '/', search: location.search, hash: anchor ? `#${anchor}` : location.hash }} replace />
}

function App({ snapshotPage }: { snapshotPage?: PublicSnapshotPage }) {
  const HomePage = snapshotPage?.kind === 'home' ? snapshotPage.Component : NewPage
  const ProgramPage = snapshotPage?.kind === 'program' ? snapshotPage.Component : PublicProgramPage
  // Mount on first use, then retain each dialog's state across close and reopen.
  const [isContactFormOpen, setIsContactFormOpen] = useState<boolean | null>(null)
  const [inquirySourcePath, setInquirySourcePath] = useState('')
  const [isLoginOpen, setIsLoginOpen] = useState<boolean | null>(null)
  const [isAdmin, setIsAdmin] = useState(() => hasAdminSession())
  const [member, setMember] = useState<PortalAccount | null>(null)
  const [memberToken, setMemberToken] = useState<string | null>(null)
  const [pendingWaiverToken, setPendingWaiverToken] = useState<string | null>(null)
  const finishWaiverCheck = useCallback(() => {
    setPendingWaiverToken(pending => pending === memberToken ? null : pending)
  }, [memberToken])
  const [showMemberDashboard, setShowMemberDashboard] = useState(false)
  const [adultEnrollmentLocationKey, setAdultEnrollmentLocationKey] = useState<string | null>(null)
  const [activePortal, setActivePortal] = useState<PortalId>(() => {
    // The redesign preview should open even when a portal session is stored.
    if (window.location.pathname.replace(/\/$/, '') === '/newpage') return 'website'
    return hasAdminSession() ? (localStorage.getItem('vortex_admin_portal') === 'new-admin' ? 'new-admin' : 'admin') : 'website'
  })
  const location = useLocation()
  const isLeadRegistration = Boolean(matchPath('/signup/lead', location.pathname))
  const isLandingPage = location.pathname === '/' || Boolean(matchPath('/newpage', location.pathname))
  const isPublicRegistrationPage = ['/signup/family', '/signup/invite', '/signup/lead', '/verify-email', '/registration/receipt', '/waivers-memberships'].some(path => Boolean(matchPath(path, location.pathname)))
  const programPage = Object.values(PUBLIC_PROGRAMS).find(({ path }) => Boolean(matchPath(path, location.pathname)))
  const isEnrollmentPage = Boolean(matchPath('/enroll', location.pathname))
  const isAdultProgram = programPage?.path === '/adult-gymnastics'
    || (isEnrollmentPage && (
      adultEnrollmentLocationKey === location.key
      || isAdultBookingProgram(new URLSearchParams(location.search).get('program'))
    ))
  const isModernPublicPage =
    Boolean(programPage)
    || isPublicRegistrationPage
    || publicGuideRoutes.some(({ path }) => Boolean(matchPath(path, location.pathname)))
    || isEnrollmentPage
    || ['/read-board', '/drop-in'].some(path => Boolean(matchPath(path, location.pathname)))
  // Clear any inline overlay scroll lock when returning to the public website.
  useEffect(() => {
    if (activePortal !== 'website') return
    document.documentElement.style.overflow = ''
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
  }, [activePortal, location.pathname])

  // Scroll to top when navigating to a new page
  useEffect(() => {
    // Section links are positioned by the landing page once its lazy content
    // has mounted. Do not overwrite that position during the route transition.
    if (!location.hash) window.scrollTo(0, 0)
  }, [location.pathname, location.hash])

  useEffect(() => {
    // Admin portal requires both flag and JWT (see Login.tsx)
    setIsAdmin(hasAdminSession())

    // Restore member session from storage. Do not force activePortal back to
    // "website" on every location change — that kicks users out of admin/coach/
    // member while they are still logged in. Explicit portal links and Stripe
    // returns are the exception.
    const storedToken = localStorage.getItem('vortex_member_token')
    const storedMember = localStorage.getItem('vortex_member')

    if (storedToken && storedMember) {
      try {
        const storedAccount = JSON.parse(storedMember) as PortalAccount
        setMemberToken(storedToken)
        setMember(storedAccount)
        const returnParams = new URLSearchParams(location.search)
        const isBillingReturn = returnParams.has('billing') || returnParams.has('enrollment')
        const isDropInCheckout = location.pathname === '/drop-in' && (returnParams.has('signupSlot') || returnParams.has('booking'))
        const isPortalReturn = isBillingReturn || (!isDropInCheckout && returnParams.get('login') === '1')
        if (isPortalReturn) {
          setActivePortal(isBillingReturn ? 'member' : bestPortalForAccount(storedAccount))
          setShowMemberDashboard(true)
        }
      } catch (error) {
        console.error('Error parsing stored member data:', error)
        clearPortalSession()
      }
    }
  }, [location.pathname, location.search])

  // Embedded registration can sign a family in without changing the page.
  useEffect(() => {
    const syncSession = () => {
      setMemberToken(getMemberSessionToken())
      setMember(getLoggedInMemberAccount())
      setIsAdmin(hasAdminSession())
    }
    window.addEventListener(PORTAL_SESSION_CHANGED, syncSession)
    return () => window.removeEventListener(PORTAL_SESSION_CHANGED, syncSession)
  }, [])

  // If the user selected Admin but the admin flag/token was missing, restore it
  // from the shared member session instead of falling through to the public site.
  useEffect(() => {
    if ((activePortal !== 'admin' && activePortal !== 'new-admin') || isAdmin || !member || !memberToken) return
    if (!getAvailablePortals(member).includes('admin')) return
    persistAdminSessionFromAccount(memberToken, member)
    setIsAdmin(true)
  }, [activePortal, isAdmin, member, memberToken])

  // Deep links that require account context open login when the session expired.
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const requiresAccount =
      params.get('login') === '1' || params.has('billing') || params.has('enrollment')
    if (requiresAccount && !localStorage.getItem('vortex_member_token')) {
      setIsLoginOpen(true)
    }
  }, [location.search])

  const handleContactClick = () => {
    trackEngagement('form_open', 'Contact Form', location.pathname)
    setInquirySourcePath(location.pathname)
    setIsContactFormOpen(true)
  }

  const handleAccountLoginSuccess = (token: string, accountData: PortalAccount) => {
    setPendingWaiverToken(accountData.requiresInitialWaiverCheck === true ? token : null)
    persistMemberSession(token, accountData)
    if (getAvailablePortals(accountData).includes('admin')) {
      persistAdminSessionFromAccount(token, accountData)
      setIsAdmin(true)
    }
    setMemberToken(token)
    setMember(accountData)
    // Keep public checkout flows open after account login.
    if (['/store', '/drop-in', '/enroll'].includes(location.pathname)) {
      setActivePortal('website')
      setShowMemberDashboard(false)
    } else {
      setActivePortal(bestPortalForAccount(accountData))
      setShowMemberDashboard(true)
    }
  }

  const handleLogout = () => {
    clearPortalSession()
    setPendingWaiverToken(null)
    setIsAdmin(false)
    setMemberToken(null)
    setMember(null)
    setShowMemberDashboard(false)
    setActivePortal('website')
  }

  const handleMemberLogout = () => {
    clearPortalSession()
    setPendingWaiverToken(null)
    setIsAdmin(false)
    setMemberToken(null)
    setMember(null)
    setShowMemberDashboard(false)
    setActivePortal('website')
  }

  const switchPortal = (portal: PortalId) => {
    if (portal === 'website') {
      setActivePortal('website')
      setShowMemberDashboard(false)
      return
    }

    if (portal === 'admin' || portal === 'new-admin') {
      if (member && memberToken && getAvailablePortals(member).includes('admin')) {
        persistAdminSessionFromAccount(memberToken, member)
        setIsAdmin(true)
      } else if (!hasAdminSession()) {
        // Admin requested but no admin session — keep them in a portal they can use.
        const fallback = member ? bestPortalForAccount(member) : 'website'
        if (fallback === 'website' || fallback === 'admin') {
          setActivePortal('website')
          setShowMemberDashboard(false)
          return
        }
        setActivePortal(fallback)
        setShowMemberDashboard(true)
        return
      }
      localStorage.setItem('vortex_admin_portal', portal)
      setActivePortal(portal)
      setShowMemberDashboard(false)
      return
    }

    setActivePortal(portal)
    setShowMemberDashboard(true)
  }

  // Older admin logins may have only the admin session, without a member
  // profile. Both admin shells still use that same authenticated API session.
  const availablePortals: PortalId[] = [...new Set([
    ...getAvailablePortals(member),
    ...(isAdmin ? ['admin', 'new-admin'] as const : []),
  ])]

  if (location.pathname === '/employee/payroll/preparer') return <PortalTheme><Suspense fallback={<PageLoader />}><I9PreparerPortal /></Suspense></PortalTheme>

  if (location.pathname === '/employee/payroll') {
    return <PortalTheme><Suspense fallback={<PageLoader />}><PayrollEmployeePortal /></Suspense></PortalTheme>
  }

  // Only a fresh account login can start waiver onboarding. Registration and
  // restored sessions use their own waiver flows.
  if (!isLeadRegistration && !(isLandingPage && activePortal === 'website') && memberToken && pendingWaiverToken === memberToken && availablePortals.includes('member')) {
    return (
      <PortalTheme><Suspense fallback={<PageLoader />}>
        <MemberWaiverPrompt key={memberToken} token={memberToken} onContinue={finishWaiverCheck} onLogout={handleMemberLogout} />
      </Suspense></PortalTheme>
    )
  }

  // If user is admin, show admin panel
  if (!isLeadRegistration && isAdmin && (activePortal === 'admin' || activePortal === 'new-admin')) {
    const AdminPortal = activePortal === 'new-admin' ? NewAdmin : Admin
    return (
      <PortalTheme><Suspense fallback={<PageLoader />}>
        <AdminPortal
          onLogout={handleLogout}
          availablePortals={availablePortals}
          onSwitchPortal={switchPortal}
        />
      </Suspense></PortalTheme>
    )
  }

  // If member is logged in and wants to see dashboard, show member dashboard
  if (!isLeadRegistration && member && memberToken && showMemberDashboard) {
    if (activePortal === 'coach') {
      return (
        <PortalTheme><Suspense fallback={<PageLoader />}>
          <CoachDashboard
            coach={member}
            onLogout={handleMemberLogout}
            onReturnToWebsite={() => switchPortal('website')}
            availablePortals={availablePortals}
            onSwitchPortal={switchPortal}
          />
        </Suspense></PortalTheme>
      )
    }
    return (
      <PortalTheme><Suspense fallback={<PageLoader />}>
        <MemberDashboard 
          member={member} 
          onLogout={handleMemberLogout}
          onReturnToWebsite={() => switchPortal('website')}
          availablePortals={availablePortals}
          onSwitchPortal={switchPortal}
          onCredentialsChanged={(credentials) => {
            const updated = updateMemberSessionCredentials(memberToken, credentials)
            if (updated) setMember(updated)
          }}
        />
      </Suspense></PortalTheme>
    )
  }

  // Otherwise show normal website
  return (
    <div className={`min-h-screen bg-white relative${isModernPublicPage ? ' np-public-site' : ''}`}>
      {!isLandingPage && <HubSeo />}
      {isModernPublicPage && <PublicSiteHeader key={location.pathname} adultProgram={isAdultProgram} isLoggedIn={Boolean(member) || isAdmin} onLogin={() => {
        if (member || isAdmin) {
          const portals = getAvailablePortals(member)
          const adminPortal = localStorage.getItem('vortex_admin_portal') === 'new-admin' ? 'new-admin' : 'admin'
          switchPortal(portals.includes('member') ? 'member' : portals.includes('coach') ? 'coach' : adminPortal)
        } else setIsLoginOpen(true)
      }} />}
      {!isLandingPage && !isModernPublicPage && <Suspense fallback={null}><Header
        onContactClick={handleContactClick}
        onAdminLoginClick={() => setIsLoginOpen(true)}
        isLoggedIn={Boolean(member) || isAdmin}
        onMemberDashboardClick={() => {
          const portals = getAvailablePortals(member)
          const adminPortal = localStorage.getItem('vortex_admin_portal') === 'new-admin' ? 'new-admin' : 'admin'
          switchPortal(portals.includes('member') ? 'member' : portals.includes('coach') ? 'coach' : adminPortal)
        }}
      /></Suspense>}
      <div id={isModernPublicPage && !programPage ? 'public-content' : undefined} role={isModernPublicPage && !isLeadRegistration && !programPage ? 'main' : undefined} className={isModernPublicPage ? `np-public-content${isPublicRegistrationPage ? ' np-public-registration' : ''}` : undefined}>
      <Suspense fallback={<PageLoader />}>
      <PublicSiteAnalytics disabled={Boolean((publicLandingRedirects as Record<string, string>)[location.pathname.toLowerCase().replace(/\/+$/, '')])} />
        <Routes>
          <Route path="/" element={<HomePage isLoggedIn={Boolean(member) || isAdmin} onLogin={() => {
            if (member || isAdmin) {
              const portals = getAvailablePortals(member)
              const adminPortal = localStorage.getItem('vortex_admin_portal') === 'new-admin' ? 'new-admin' : 'admin'
              switchPortal(portals.includes('member') ? 'member' : portals.includes('coach') ? 'coach' : adminPortal)
            } else setIsLoginOpen(true)
          }} />} />
          {Object.values(PUBLIC_PROGRAMS).map(({ path }) => <Route key={path} path={path} element={<ProgramPage key={path} path={path} />} />)}
          {Object.entries(publicLandingRedirects).map(([path, destination]) => <Route key={path} path={path} element={<PublicLandingRedirect destination={destination} />} />)}
          <Route path="/copy" element={<CopyPage />} />
          <Route path="/camp_interest" element={<CampInterestPage />} />
          <Route path="/camp_interest/thank-you" element={<CampInterestThankYouPage />} />
          <Route 
            path="/ninja" 
            element={<Ninja onSignUpClick={handleContactClick} />} 
          />
          <Route 
            path="/read-board" 
            element={<ReadBoard />} 
          />
          <Route
            path="/enroll"
            element={<SchedulingPage onAdultEnrollmentResolved={setAdultEnrollmentLocationKey} />}
          />
          <Route
            path="/store"
            element={<Storefront memberToken={memberToken} mode="public" onSignIn={() => setIsLoginOpen(true)} />}
          />
          <Route path="/drop-in" element={<DropInPage />} />
          {publicGuideRoutes.map(({ path, Component }) => {
            const Guide = snapshotPage?.kind === 'guide' && snapshotPage.path === path ? snapshotPage.Component : Component
            return <Route key={path} path={path} element={<Guide />} />
          })}
          <Route
            path="/contact"
            element={<ContactLocationPage onInquireClick={handleContactClick} />}
          />
          <Route path="/signup/lead" element={<SignupLeadPage />} />
          <Route
            path="/signup/family"
            element={<SignupFamilyPage />}
          />
          <Route
            path="/signup/invite"
            element={<SignupInvitePage />}
          />
          <Route
            path="/verify-email"
            element={<VerifyEmailPage />}
          />
          <Route
            path="/registration/receipt"
            element={<EnrollmentReceiptPage />}
          />
          <Route path="/waivers-memberships" element={<WaiversMembershipsPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms-of-service" element={<TermsOfServicePage />} />
        </Routes>
      </Suspense>
      </div>
      {isContactFormOpen !== null && <Suspense fallback={null}><ContactForm
        isOpen={isContactFormOpen}
        onClose={() => setIsContactFormOpen(false)}
        title="Athlete Inquiry"
        inquiryVariant="athletics"
        inquirySource={inquirySourcePath}
      /></Suspense>}
      {isModernPublicPage && <PublicSiteFooter />}
      {!isLandingPage && !isModernPublicPage && <Suspense fallback={null}><Footer
        onContactClick={handleContactClick} 
        onLoginClick={() => setIsLoginOpen(true)}
      /></Suspense>}

      {isLoginOpen !== null && <Suspense fallback={null}><Login
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={handleAccountLoginSuccess}
      /></Suspense>}

      <CookieConsent />
    </div>
  )
}

export default App
