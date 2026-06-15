import { lazy, Suspense, useState, useEffect } from 'react'
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom'
import GymnasticsHeader from './GymnasticsHeader'
import GymnasticsSeo from './GymnasticsSeo'
import ContactForm from '../../components/ContactForm'
import Footer from '../../components/Footer'
import Login from '../../components/Login'
import MemberLogin from '../../components/MemberLogin'
import { trackPageView, trackEngagement } from '../../utils/analytics'
import { captureUtmFromLocation } from '../../utils/utmCapture'
import CookieConsent from '../../components/CookieConsent'
import { setSportSiteContext } from '../../utils/sportSite'
import { useSiteHighlights } from '../../hooks/useSiteHighlights'
import HighlightsModal from '../../components/HighlightsModal'

const GymnasticsPage = lazy(() => import('./pages/GymnasticsPage'))
const ArtisticGymnasticsEarlyLandingPage = lazy(
  () => import('./pages/ArtisticGymnasticsEarlyLandingPage'),
)
const ArtisticGymnasticsAges6to12LandingPage = lazy(
  () => import('./pages/ArtisticGymnasticsAges6to12LandingPage'),
)
const ArtisticGymnasticsAges13to18LandingPage = lazy(
  () => import('./pages/ArtisticGymnasticsAges13to18LandingPage'),
)
const GymnasticsReadBoardPage = lazy(() => import('./pages/GymnasticsReadBoardPage'))
const SummerCamp2026LandingPage = lazy(
  () => import('./pages/SummerCamp2026LandingPage'),
)
const CampInterestPage = lazy(() => import('./pages/CampInterestPage'))
const CampInterestThankYouPage = lazy(() => import('./pages/CampInterestThankYouPage'))
const SchedulingPage = lazy(() => import('../../components/SchedulingPage'))
const AcroGymnasticsPage = lazy(() => import('./pages/AcroGymnasticsPage'))
const ArtisticGymnasticsDisciplinePage = lazy(
  () => import('./pages/ArtisticGymnasticsDisciplinePage'),
)
const RhythmicGymnasticsPage = lazy(() => import('./pages/RhythmicGymnasticsPage'))
const TrampolineTumblingGymnasticsPage = lazy(
  () => import('./pages/TrampolineTumblingGymnasticsPage'),
)
const AerobicGymnasticsPage = lazy(() => import('./pages/AerobicGymnasticsPage'))
const MemberDashboard = lazy(() => import('../../components/MemberDashboard'))
const Admin = lazy(() => import('../../components/Admin'))

function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
    </div>
  )
}

interface GymnasticsAppProps {
  isPreview?: boolean
}

function GymnasticsApp({ isPreview = false }: GymnasticsAppProps) {
  const [isContactFormOpen, setIsContactFormOpen] = useState(false)
  const [inquirySourcePath, setInquirySourcePath] = useState('')
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [isMemberLoginOpen, setIsMemberLoginOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(
    () => localStorage.getItem('vortex_admin') === 'true',
  )
  const [member, setMember] = useState<any>(null)
  const [memberToken, setMemberToken] = useState<string | null>(null)
  const [showMemberDashboard, setShowMemberDashboard] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const {
    highlights,
    isOpen: isHighlightsOpen,
    open: openHighlights,
    close: closeHighlights,
    hasHighlights,
  } = useSiteHighlights()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

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

    captureUtmFromLocation()
    trackPageView(location.pathname, { googleAnalytics: !isPreview })
  }, [location.pathname, isPreview])

  const handleContactClick = () => {
    trackEngagement('form_open', 'Contact Form', location.pathname)
    setInquirySourcePath(location.pathname)
    setIsContactFormOpen(true)
  }

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

  const handleMemberLoginSuccess = (token: string, memberData: any) => {
    setSportSiteContext('gymnastics')
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
      <Suspense fallback={<PageLoader />}>
        <Admin onLogout={handleAdminLogout} />
      </Suspense>
    )
  }

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

  return (
    <div className="min-h-screen bg-white relative">
      <GymnasticsSeo isPreview={isPreview} />
      <GymnasticsHeader
        onContactClick={handleContactClick}
        onAdminLoginClick={() => setIsLoginOpen(true)}
        onMemberLoginClick={() => setIsMemberLoginOpen(true)}
        member={member}
        onMemberDashboardClick={() => setShowMemberDashboard(true)}
      />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route
            path="/"
            element={
              <GymnasticsPage
                onSignUpClick={handleContactClick}
                onHighlightsClick={hasHighlights ? openHighlights : undefined}
              />
            }
          />
          <Route
            path="/gymnastics"
            element={
              <GymnasticsPage
                onSignUpClick={handleContactClick}
                onHighlightsClick={hasHighlights ? openHighlights : undefined}
              />
            }
          />
          <Route
            path="/artistic-gymnastics-early"
            element={
              <ArtisticGymnasticsEarlyLandingPage onSignUpClick={handleContactClick} />
            }
          />
          <Route
            path="/artistic-gymnastics-6-12"
            element={
              <ArtisticGymnasticsAges6to12LandingPage onSignUpClick={handleContactClick} />
            }
          />
          <Route
            path="/artistic-gymnastics-13-18"
            element={
              <ArtisticGymnasticsAges13to18LandingPage onSignUpClick={handleContactClick} />
            }
          />
          <Route
            path="/campaigns/artistic-gymnastics-early"
            element={
              <ArtisticGymnasticsEarlyLandingPage onSignUpClick={handleContactClick} />
            }
          />
          <Route
            path="/campaigns/artistic-gymnastics-6-12"
            element={
              <ArtisticGymnasticsAges6to12LandingPage onSignUpClick={handleContactClick} />
            }
          />
          <Route
            path="/campaigns/artistic-gymnastics-13-18"
            element={
              <ArtisticGymnasticsAges13to18LandingPage onSignUpClick={handleContactClick} />
            }
          />
          <Route path="/read-board" element={<GymnasticsReadBoardPage />} />
          <Route
            path="/summer-camp-26"
            element={
              <SummerCamp2026LandingPage onInquireClick={() => navigate('/camp_interest')} />
            }
          />
          <Route path="/camp_interest" element={<CampInterestPage />} />
          <Route path="/camp_interest/thank-you" element={<CampInterestThankYouPage />} />
          <Route path="/enroll" element={<SchedulingPage />} />
          <Route path="/scheduling" element={<Navigate to="/enroll" replace />} />
          <Route path="/schedule" element={<Navigate to="/enroll" replace />} />
          <Route
            path="/acro-gymnastics"
            element={<AcroGymnasticsPage onSignUpClick={handleContactClick} />}
          />
          <Route
            path="/artistic-gymnastics"
            element={
              <ArtisticGymnasticsDisciplinePage onSignUpClick={handleContactClick} />
            }
          />
          <Route
            path="/rhythmic-gymnastics"
            element={<RhythmicGymnasticsPage onSignUpClick={handleContactClick} />}
          />
          <Route
            path="/trampoline-tumbling"
            element={
              <TrampolineTumblingGymnasticsPage onSignUpClick={handleContactClick} />
            }
          />
          <Route
            path="/aerobic-gymnastics"
            element={<AerobicGymnasticsPage onSignUpClick={handleContactClick} />}
          />
        </Routes>
      </Suspense>
      <ContactForm
        isOpen={isContactFormOpen}
        onClose={() => setIsContactFormOpen(false)}
        title="Gymnastics Inquiry"
        inquiryVariant="gymnastics"
        inquirySource={inquirySourcePath}
      />
      <Footer
        onContactClick={handleContactClick}
        onLoginClick={() => setIsLoginOpen(true)}
        onMemberLoginClick={() => setIsMemberLoginOpen(true)}
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
      {!isPreview && <CookieConsent />}
    </div>
  )
}

export default GymnasticsApp
