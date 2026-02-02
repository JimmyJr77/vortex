import { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/Header'
import HomePage from './components/HomePage'
import AthleticismAccelerator from './components/AthleticismAccelerator'
import Gymnastics from './components/Gymnastics'
import StrengthFitness from './components/StrengthFitness'
import Ninja from './components/Ninja'
import Value from './components/Value'
import ReadBoard from './components/ReadBoard'
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

  // Scroll to top when navigating to a new page
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

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

    // Show opening popup after a short delay (only if not admin/member and first visit)
    if (!adminStatus && !storedToken) {
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
    // Clear all admin-related localStorage items
    localStorage.removeItem('vortex_admin')
    localStorage.removeItem('adminToken')
    localStorage.removeItem('vortex-admin-info')
    localStorage.removeItem('vortex-admin-id')
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
    <div className="min-h-screen bg-white relative">
      <Header 
        onContactClick={handleContactClick}
        onAdminLoginClick={() => setIsLoginOpen(true)}
        member={member}
        onMemberDashboardClick={() => setShowMemberDashboard(true)}
      />
      <Routes>
        <Route 
          path="/" 
          element={<HomePage onSignUpClick={() => setIsContactFormOpen(true)} />} 
        />
        <Route 
          path="/athleticism-accelerator" 
          element={<AthleticismAccelerator onSignUpClick={handleContactClick} />} 
        />
        <Route 
          path="/gymnastics" 
          element={<Gymnastics onSignUpClick={handleContactClick} />} 
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
      <ContactForm
        isOpen={isContactFormOpen}
        onClose={() => setIsContactFormOpen(false)}
      />
      <Footer 
        onContactClick={handleContactClick} 
        onLoginClick={() => setIsLoginOpen(true)}
        onMemberLoginClick={() => setIsMemberLoginOpen(true)}
      />
      
      {/* Opening Popup - shows on first visit */}
      <OpeningPopup
        isOpen={isOpeningPopupOpen}
        onClose={() => setIsOpeningPopupOpen(false)}
        onSignUp={handleContactClick}
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
    </div>
  )
}

export default App
