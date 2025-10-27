import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Header from './components/Header'
import Hero from './components/Hero'
import ParallaxGym from './components/ParallaxGym'
import About from './components/About'
import Programs from './components/Programs'
import Technology from './components/Technology'
import ContactForm from './components/ContactForm'
import Footer from './components/Footer'
import OpeningPopup from './components/OpeningPopup'

function App() {
  const [isContactFormOpen, setIsContactFormOpen] = useState(false)
  const [isOpeningPopupOpen, setIsOpeningPopupOpen] = useState(false)

  useEffect(() => {
    // Show opening popup after a short delay
    const timer = setTimeout(() => {
      setIsOpeningPopupOpen(true)
    }, 1000) // 1 second delay

    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <Header onContactClick={() => setIsContactFormOpen(true)} />
      <Hero onContactClick={() => setIsContactFormOpen(true)} />
      <ParallaxGym />
      <About />
      <Programs />
      <Technology />
      <ContactForm
        isOpen={isContactFormOpen}
        onClose={() => setIsContactFormOpen(false)}
      />
      <Footer onContactClick={() => setIsContactFormOpen(true)} />
      
      {/* Opening Popup */}
      <OpeningPopup
        isOpen={isOpeningPopupOpen}
        onClose={() => setIsOpeningPopupOpen(false)}
        onSignUp={() => setIsContactFormOpen(true)}
      />
    </div>
  )
}

export default App
