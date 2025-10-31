import { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/Header'
import HomePage from './components/HomePage'
import LandingPage from './components/LandingPage'
import AthleticismAccelerator from './components/AthleticismAccelerator'
import TrampolineTumbling from './components/TrampolineTumbling'
import ContactForm from './components/ContactForm'
import Footer from './components/Footer'
import OpeningPopup from './components/OpeningPopup'
import Login from './components/Login'
import Admin from './components/Admin'

function App() {
  const [isContactFormOpen, setIsContactFormOpen] = useState(false)
  const [isOpeningPopupOpen, setIsOpeningPopupOpen] = useState(false)
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const location = useLocation()

  useEffect(() => {
    // Check if user is already logged in
    const adminStatus = localStorage.getItem('vortex_admin')
    if (adminStatus === 'true') {
      setIsAdmin(true)
    }

    // Show opening popup after a short delay (only if not admin and on home page)
    if (!adminStatus && location.pathname === '/') {
      const timer = setTimeout(() => {
        setIsOpeningPopupOpen(true)
      }, 1000);
      return () => clearTimeout(timer)
    }
  }, [location.pathname])

  const handleLoginSuccess = () => {
    setIsAdmin(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('vortex_admin')
    setIsAdmin(false)
  }

  // If user is admin, show admin panel
  if (isAdmin) {
    return (
      <Admin onLogout={handleLogout} />
    )
  }

  // Otherwise show normal website
  return (
    <div className="min-h-screen bg-white">
      <Header 
        onContactClick={() => setIsContactFormOpen(true)} 
      />
      <Routes>
        <Route 
          path="/" 
          element={<HomePage />} 
        />
        <Route 
          path="/overview" 
          element={<LandingPage onSignUpClick={() => setIsContactFormOpen(true)} />} 
        />
        <Route 
          path="/athleticism-accelerator" 
          element={<AthleticismAccelerator onSignUpClick={() => setIsContactFormOpen(true)} />} 
        />
        <Route 
          path="/trampoline-tumbling" 
          element={<TrampolineTumbling onSignUpClick={() => setIsContactFormOpen(true)} />} 
        />
      </Routes>
      <ContactForm
        isOpen={isContactFormOpen}
        onClose={() => setIsContactFormOpen(false)}
      />
      <Footer 
        onContactClick={() => setIsContactFormOpen(true)} 
        onLoginClick={() => setIsLoginOpen(true)}
      />
      
      {/* Opening Popup - only show on home page */}
      {location.pathname === '/' && (
        <OpeningPopup
          isOpen={isOpeningPopupOpen}
          onClose={() => setIsOpeningPopupOpen(false)}
          onSignUp={() => setIsContactFormOpen(true)}
        />
      )}

      {/* Login Modal */}
      <Login
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={handleLoginSuccess}
      />
    </div>
  )
}

export default App
