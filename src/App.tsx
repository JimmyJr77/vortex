import { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/Header'
import HomePage from './components/HomePage'
import LandingPage from './components/LandingPage'
import AthleticismAccelerator from './components/AthleticismAccelerator'
import TrampolineTumbling from './components/TrampolineTumbling'
import ArtisticGymnastics from './components/ArtisticGymnastics'
import RhythmicGymnastics from './components/RhythmicGymnastics'
import Ninja from './components/Ninja'
import Value from './components/Value'
import ContactForm from './components/ContactForm'
import Footer from './components/Footer'
import OpeningPopup from './components/OpeningPopup'
import Login from './components/Login'
import Admin from './components/Admin'
import MemberLogin from './components/MemberLogin'
import MemberDashboard from './components/MemberDashboard'
import { trackPageView, trackEngagement } from './utils/analytics'

function App() {
  const [isContactFormOpen, setIsContactFormOpen] = useState(false)
  const [isOpeningPopupOpen, setIsOpeningPopupOpen] = useState(false)
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [isMemberLoginOpen, setIsMemberLoginOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [member, setMember] = useState<any>(null)
  const [memberToken, setMemberToken] = useState<string | null>(null)
  const [showMemberDashboard, setShowMemberDashboard] = useState(false)
  const location = useLocation()

  useEffect(() => {
    // Check if user is already logged in as admin
    const adminStatus = localStorage.getItem('vortex_admin')
    if (adminStatus === 'true') {
      setIsAdmin(true)
    }

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

    // Track page view
    if (!adminStatus && !storedToken) {
      trackPageView(location.pathname)
    }

    // Show opening popup after a short delay (only if not admin/member and on home page)
    if (!adminStatus && !storedToken && location.pathname === '/') {
      const timer = setTimeout(() => {
        setIsOpeningPopupOpen(true)
      }, 1000);
      return () => clearTimeout(timer)
    }
  }, [location.pathname])

  const handleContactClick = () => {
    trackEngagement('form_open', 'Contact Form', location.pathname)
    setIsContactFormOpen(true)
  }

  const handleLoginSuccess = () => {
    setIsAdmin(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('vortex_admin')
    setIsAdmin(false)
  }

  const handleMemberLoginSuccess = (token: string, memberData: any) => {
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
  }

  // If user is admin, show admin panel
  if (isAdmin) {
    return (
      <Admin onLogout={handleLogout} />
    )
  }

  // If member is logged in and wants to see dashboard, show member dashboard
  if (member && memberToken && showMemberDashboard) {
    return (
      <MemberDashboard 
        member={member} 
        onLogout={handleMemberLogout}
        onReturnToWebsite={() => setShowMemberDashboard(false)}
      />
    )
  }

  // Otherwise show normal website
  return (
    <div className="min-h-screen bg-white">
      <Header 
        onContactClick={handleContactClick}
        onMemberLoginClick={() => setIsMemberLoginOpen(true)}
        member={member}
        onMemberDashboardClick={() => setShowMemberDashboard(true)}
      />
      <Routes>
        <Route 
          path="/" 
          element={<HomePage onSignUpClick={() => setIsContactFormOpen(true)} />} 
        />
        <Route 
          path="/overview" 
          element={<LandingPage onSignUpClick={handleContactClick} />} 
        />
        <Route 
          path="/athleticism-accelerator" 
          element={<AthleticismAccelerator onSignUpClick={handleContactClick} />} 
        />
        <Route 
          path="/trampoline-tumbling" 
          element={<TrampolineTumbling onSignUpClick={handleContactClick} />} 
        />
        <Route 
          path="/artistic-gymnastics" 
          element={<ArtisticGymnastics onSignUpClick={handleContactClick} />} 
        />
        <Route 
          path="/rhythmic-gymnastics" 
          element={<RhythmicGymnastics onSignUpClick={handleContactClick} />} 
        />
        <Route 
          path="/ninja" 
          element={<Ninja onSignUpClick={handleContactClick} />} 
        />
        <Route 
          path="/value" 
          element={<Value />} 
        />
      </Routes>
      <ContactForm
        isOpen={isContactFormOpen}
        onClose={() => setIsContactFormOpen(false)}
      />
      <Footer 
        onContactClick={handleContactClick} 
        onLoginClick={() => setIsLoginOpen(true)}
      />
      
      {/* Opening Popup - only show on home page */}
      {location.pathname === '/' && (
        <OpeningPopup
          isOpen={isOpeningPopupOpen}
          onClose={() => setIsOpeningPopupOpen(false)}
          onSignUp={handleContactClick}
        />
      )}

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
    </div>
  )
}

export default App
