import { lazy, Suspense, useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/Header'
import HubSeo from './components/HubSeo'
import ContactForm from './components/ContactForm'
import Footer from './components/Footer'
import Login from './components/Login'
import MemberLogin from './components/MemberLogin'
import { trackPageView, trackEngagement } from './utils/analytics'
import { captureUtmFromLocation } from './utils/utmCapture'
import { clearAdminSession, hasAdminSession } from './utils/api'
import CookieConsent from './components/CookieConsent'
import { useSiteHighlights } from './hooks/useSiteHighlights'
import HighlightsModal from './components/HighlightsModal'

// Lazy-load heavy routes and portals so dev server / first paint stay fast
const HomePage = lazy(() => import('./components/HomePage'))
const AthleticismAccelerator = lazy(() => import('./components/AthleticismAccelerator'))
const StrengthFitness = lazy(() => import('./components/StrengthFitness'))
const Ninja = lazy(() => import('./components/Ninja'))
const Value = lazy(() => import('./components/Value'))
const ReadBoard = lazy(() => import('./components/ReadBoard'))
const Admin = lazy(() => import('./components/Admin'))
const MemberDashboard = lazy(() => import('./components/MemberDashboard'))

function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
    </div>
  )
}

function App() {
  const [isContactFormOpen, setIsContactFormOpen] = useState(false)
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [isMemberLoginOpen, setIsMemberLoginOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(() => hasAdminSession())
  const [member, setMember] = useState<any>(null)
  const [memberToken, setMemberToken] = useState<string | null>(null)
  const [showMemberDashboard, setShowMemberDashboard] = useState(false)
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
        localStorage.removeItem('vortex_member_token')
        localStorage.removeItem('vortex_member')
      }
    }

    captureUtmFromLocation()
    trackPageView(location.pathname)
  }, [location.pathname])

  const handleContactClick = () => {
    trackEngagement('form_open', 'Contact Form', location.pathname)
    setIsContactFormOpen(true)
  }

  const handleLoginSuccess = () => {
    setIsAdmin(true)
  }

  const handleLogout = () => {
    clearAdminSession()
    setIsAdmin(false)
    console.log('[Logout] All admin data cleared from localStorage')
  }

  const handleMemberLoginSuccess = (token: string, memberData: any) => {
    localStorage.setItem('vortex_member_token', token)
    localStorage.setItem('vortex_member', JSON.stringify(memberData))
    setMemberToken(token)
    setMember(memberData)
    // Automatically redirect to member portal after login
    setShowMemberDashboard(true)
  }

  const handleMemberLogout = () => {
    localStorage.removeItem('vortex_member_token')
    localStorage.removeItem('vortex_member')
    setMemberToken(null)
    setMember(null)
  }

  // If user is admin, show admin panel
  if (isAdmin) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Admin onLogout={handleLogout} />
      </Suspense>
    )
  }

  // If member is logged in and wants to see dashboard, show member dashboard
  if (member && memberToken && showMemberDashboard) {
    return (
      <Suspense fallback={<PageLoader />}>
        <MemberDashboard 
          member={member} 
          onLogout={handleMemberLogout}
          onReturnToWebsite={() => setShowMemberDashboard(false)}
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
        onMemberDashboardClick={() => setShowMemberDashboard(true)}
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
        </Routes>
      </Suspense>
      <ContactForm
        isOpen={isContactFormOpen}
        onClose={() => setIsContactFormOpen(false)}
      />
      <Footer 
        onContactClick={handleContactClick} 
        onLoginClick={() => setIsLoginOpen(true)}
        onMemberLoginClick={() => setIsMemberLoginOpen(true)}
      />

      {/* Admin Login Modal */}
      <Login
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={handleLoginSuccess}
      />

      {/* Member Login Modal */}
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
      <CookieConsent />
    </div>
  )
}

export default App
