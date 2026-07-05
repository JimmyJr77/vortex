import { Suspense, useState, useEffect } from 'react'
import { lazyWithRetry } from './utils/chunkLoadRecovery'
import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import Header from './components/Header'
import HubSeo from './components/HubSeo'
import ContactForm from './components/ContactForm'
import Footer from './components/Footer'
import Login from './components/Login'
import { trackPageView, trackEngagement } from './utils/analytics'
import { captureUtmFromLocation } from './utils/utmCapture'
import { hasAdminSession } from './utils/api'
import {
  bestPortalForAccount,
  clearPortalSession,
  getAvailablePortals,
  persistAdminSessionFromAccount,
  persistMemberSession,
  type PortalAccount,
  type PortalId,
} from './utils/portalSession'
import CookieConsent from './components/CookieConsent'
import { useSiteHighlights } from './hooks/useSiteHighlights'
import HighlightsModal from './components/HighlightsModal'

// Lazy-load heavy routes and portals so dev server / first paint stay fast
const HomePage = lazyWithRetry(() => import('./components/HomePage'))
const AthleticismAccelerator = lazyWithRetry(() => import('./components/AthleticismAccelerator'))
const SummerAthleticTraining = lazyWithRetry(() => import('./components/SummerAthleticTraining'))
const StrengthFitness = lazyWithRetry(() => import('./components/StrengthFitness'))
const Ninja = lazyWithRetry(() => import('./components/Ninja'))
const Value = lazyWithRetry(() => import('./components/Value'))
const ReadBoard = lazyWithRetry(() => import('./components/ReadBoard'))
const SchedulingPage = lazyWithRetry(() => import('./components/SchedulingPage'))
const SignupFamilyPage = lazyWithRetry(() => import('./components/signup/SignupFamilyPage'))
const SignupInvitePage = lazyWithRetry(() => import('./components/signup/SignupInvitePage'))
const VerifyEmailPage = lazyWithRetry(() => import('./components/VerifyEmailPage'))
const EnrollmentReceiptPage = lazyWithRetry(() => import('./components/EnrollmentReceiptPage'))
const SupportPage = lazyWithRetry(() => import('./components/legal/SupportPage'))
const PrivacyPolicyPage = lazyWithRetry(() => import('./components/legal/PrivacyPolicyPage'))
const TermsOfServicePage = lazyWithRetry(() => import('./components/legal/TermsOfServicePage'))
const Admin = lazyWithRetry(() => import('./components/Admin'))
const MemberDashboard = lazyWithRetry(() => import('./components/MemberDashboard'))
const CoachDashboard = lazyWithRetry(() => import('./components/CoachDashboard'))

function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
    </div>
  )
}

function App() {
  const [isContactFormOpen, setIsContactFormOpen] = useState(false)
  const [inquirySourcePath, setInquirySourcePath] = useState('')
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(() => hasAdminSession())
  const [member, setMember] = useState<PortalAccount | null>(null)
  const [memberToken, setMemberToken] = useState<string | null>(null)
  const [showMemberDashboard, setShowMemberDashboard] = useState(false)
  const [activePortal, setActivePortal] = useState<PortalId>(() => (hasAdminSession() ? 'admin' : 'website'))
  const location = useLocation()
  const {
    highlights,
    isOpen: isHighlightsOpen,
    open: openHighlights,
    close: closeHighlights,
    hasHighlights,
  } = useSiteHighlights()

  // Scroll to top when navigating to a new page
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  useEffect(() => {
    // Admin portal requires both flag and JWT (see Login.tsx)
    setIsAdmin(hasAdminSession())

    // Check if member is already logged in
    const storedToken = localStorage.getItem('vortex_member_token')
    const storedMember = localStorage.getItem('vortex_member')
    
    if (storedToken && storedMember) {
      try {
        setMemberToken(storedToken)
        setMember(JSON.parse(storedMember))
        // Don't auto-show dashboard, let them browse the site
        setShowMemberDashboard(false)
      } catch (error) {
        console.error('Error parsing stored member data:', error)
        clearPortalSession()
      }
    }

    captureUtmFromLocation()
    trackPageView(location.pathname)
  }, [location.pathname])

  // Deep link from emails (e.g. waiver requests): ?login=1 opens the login modal.
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('login') === '1' && !localStorage.getItem('vortex_member_token')) {
      setIsLoginOpen(true)
    }
  }, [location.search])

  const handleContactClick = () => {
    trackEngagement('form_open', 'Contact Form', location.pathname)
    setInquirySourcePath(location.pathname)
    setIsContactFormOpen(true)
  }

  const handleAccountLoginSuccess = (token: string, accountData: PortalAccount) => {
    persistMemberSession(token, accountData)
    if (getAvailablePortals(accountData).includes('admin')) {
      persistAdminSessionFromAccount(token, accountData)
      setIsAdmin(true)
    }
    setMemberToken(token)
    setMember(accountData)
    setActivePortal(bestPortalForAccount(accountData))
    setShowMemberDashboard(true)
  }

  const handleLogout = () => {
    clearPortalSession()
    setIsAdmin(false)
    setMemberToken(null)
    setMember(null)
    setShowMemberDashboard(false)
    setActivePortal('website')
  }

  const handleMemberLogout = () => {
    clearPortalSession()
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
    setActivePortal(portal)
    setShowMemberDashboard(portal === 'member' || portal === 'coach')
  }

  // If user is admin, show admin panel
  if (isAdmin && activePortal === 'admin') {
    return (
      <Suspense fallback={<PageLoader />}>
        <Admin
          onLogout={handleLogout}
          availablePortals={getAvailablePortals(member)}
          onSwitchPortal={switchPortal}
        />
      </Suspense>
    )
  }

  // If member is logged in and wants to see dashboard, show member dashboard
  if (member && memberToken && showMemberDashboard) {
    const availablePortals = getAvailablePortals(member)
    if (activePortal === 'coach') {
      return (
        <Suspense fallback={<PageLoader />}>
          <CoachDashboard
            coach={member}
            onLogout={handleMemberLogout}
            onReturnToWebsite={() => switchPortal('website')}
            availablePortals={availablePortals}
            onSwitchPortal={switchPortal}
          />
        </Suspense>
      )
    }
    return (
      <Suspense fallback={<PageLoader />}>
        <MemberDashboard 
          member={member} 
          onLogout={handleMemberLogout}
          onReturnToWebsite={() => switchPortal('website')}
          availablePortals={availablePortals}
          onSwitchPortal={switchPortal}
        />
      </Suspense>
    )
  }

  // Otherwise show normal website
  return (
    <div className="min-h-screen bg-white relative">
      <HubSeo />
      <Header 
        onContactClick={handleContactClick}
        onAdminLoginClick={() => setIsLoginOpen(true)}
        member={member}
        onMemberDashboardClick={() => {
          const portals = getAvailablePortals(member)
          switchPortal(portals.includes('member') ? 'member' : portals.includes('coach') ? 'coach' : 'admin')
        }}
      />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route 
            path="/" 
            element={
              <HomePage
                onSignUpClick={() => setIsContactFormOpen(true)}
                onHighlightsClick={hasHighlights ? openHighlights : undefined}
              />
            } 
          />
          <Route 
            path="/athleticism-accelerator" 
            element={<AthleticismAccelerator onSignUpClick={handleContactClick} />} 
          />
          <Route
            path="/summer-athletic-training"
            element={<SummerAthleticTraining />}
          />
          <Route 
            path="/strength-conditioning" 
            element={<StrengthFitness onSignUpClick={handleContactClick} />} 
          />
          <Route 
            path="/ninja" 
            element={<Ninja onSignUpClick={handleContactClick} />} 
          />
          <Route 
            path="/value" 
            element={<Value />} 
          />
          <Route 
            path="/read-board" 
            element={<ReadBoard />} 
          />
          <Route
            path="/enroll"
            element={<SchedulingPage />}
          />
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
          <Route path="/support" element={<SupportPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms-of-service" element={<TermsOfServicePage />} />
          <Route path="/scheduling" element={<Navigate to="/enroll" replace />} />
          <Route path="/schedule" element={<Navigate to="/enroll" replace />} />
        </Routes>
      </Suspense>
      <ContactForm
        isOpen={isContactFormOpen}
        onClose={() => setIsContactFormOpen(false)}
        title="Athlete Inquiry"
        inquiryVariant="athletics"
        inquirySource={inquirySourcePath}
      />
      <Footer 
        onContactClick={handleContactClick} 
        onLoginClick={() => setIsLoginOpen(true)}
      />

      <Login
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={handleAccountLoginSuccess}
      />

      {hasHighlights && (
        <HighlightsModal
          highlights={highlights}
          isOpen={isHighlightsOpen}
          onClose={closeHighlights}
        />
      )}
      <CookieConsent />
    </div>
  )
}

export default App
