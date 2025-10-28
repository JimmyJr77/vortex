import { useState, useEffect } from 'react'
import Header from './components/Header'
import Hero from './components/Hero'
import ParallaxGym from './components/ParallaxGym'
import About from './components/About'
import Programs from './components/Programs'
import Technology from './components/Technology'
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

  useEffect(() => {
    // Check if user is already logged in
    const adminStatus = localStorage.getItem('vortex_admin')
    if (adminStatus === 'true') {
      setIsAdmin(true)
    }

    // Show opening popup after a short delay (only if not admin)
    if (!adminStatus) {
      const timer = setTimeout(() => {
        setIsOpeningPopupOpen(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [])

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
      <Hero onContactClick={() => setIsContactFormOpen(true)} />
      <ParallaxGym />
      <About />
      <Programs />
      <Technology />
      <ContactForm
        isOpen={isContactFormOpen}
        onClose={() => setIsContactFormOpen(false)}
      />
      <Footer 
        onContactClick={() => setIsContactFormOpen(true)} 
        onLoginClick={() => setIsLoginOpen(true)}
      />
      
      {/* Opening Popup */}
      <OpeningPopup
        isOpen={isOpeningPopupOpen}
        onClose={() => setIsOpeningPopupOpen(false)}
        onSignUp={() => setIsContactFormOpen(true)}
      />

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
