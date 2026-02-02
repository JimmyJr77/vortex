import { motion, AnimatePresence } from 'framer-motion'
import { X, Mail, Phone, MapPin, Send } from 'lucide-react'
import { useState } from 'react'
import { getApiUrl } from '../utils/api'

interface ContactFormProps {
  isOpen: boolean
  onClose: () => void
}

const ContactForm = ({ isOpen, onClose }: ContactFormProps) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    message: ''
  })

  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [selectedClassTypes, setSelectedClassTypes] = useState<string[]>([])
  const [selectedAges, setSelectedAges] = useState<number[]>([])
  const [newsletter, setNewsletter] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const interests = [
    'Gymnastics (Artistic)',
    'Rhythmic Gymnastics',
    'Trampoline & Tumbling',
    'Ninja Athlete',
    'Athleticism Accelerator',
    'Strength & Conditioning',
    'Homeschool'
  ]

  const classTypes = [
    'Adult Classes',
    'Child Classes'
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    // Frontend validation
    if (formData.firstName.trim().length < 2) {
      alert('First name must be at least 2 characters long.')
      setIsSubmitting(false)
      return
    }
    
    if (formData.lastName.trim().length < 2) {
      alert('Last name must be at least 2 characters long.')
      setIsSubmitting(false)
      return
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!formData.email.trim()) {
      alert('Email address is required.')
      setIsSubmitting(false)
      return
    }
    if (!emailRegex.test(formData.email.trim())) {
      alert('Please enter a valid email address.')
      setIsSubmitting(false)
      return
    }
    
    // Clean phone number - remove all special characters like ()- and spaces
    let cleanPhone = formData.phone?.trim() || ''
    if (cleanPhone) {
      // Remove all non-digit characters except + at the start
      cleanPhone = cleanPhone.replace(/[^\d+]/g, '')
      if (cleanPhone.startsWith('+')) {
        cleanPhone = '+' + cleanPhone.substring(1).replace(/\D/g, '')
      }
      
      // Phone number validation - must be at least 10 digits (US format) or valid international format
      const digitsOnly = cleanPhone.replace(/\D/g, '')
      if (digitsOnly.length > 0 && digitsOnly.length < 10) {
        alert('Phone number must be at least 10 digits long.')
        setIsSubmitting(false)
        return
      }
      if (digitsOnly.length > 15) {
        alert('Phone number is too long. Maximum 15 digits allowed.')
        setIsSubmitting(false)
        return
      }
    }
    
    try {
      const apiUrl = getApiUrl()
      
      const payload: any = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
      }
      
      // Only include optional fields if they have values
      if (cleanPhone) {
        payload.phone = cleanPhone
      }
      if (selectedInterests.length > 0) {
        payload.interests = selectedInterests
      }
      if (selectedClassTypes.length > 0) {
        payload.classTypes = selectedClassTypes
      }
      if (selectedAges.length > 0) {
        payload.childAges = selectedAges
      }
      if (formData.message) {
        payload.message = formData.message
      }
      payload.newsletter = newsletter
      
      let response: Response
      try {
        response = await fetch(`${apiUrl}/api/registrations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000) // 10 second timeout
        })
      } catch (fetchError: any) {
        // Handle network errors or connection refused
        if (fetchError.name === 'AbortError' || fetchError.name === 'TypeError') {
          // Store submission locally as fallback
          const pendingSubmissions = JSON.parse(localStorage.getItem('vortex_pending_submissions') || '[]')
          pendingSubmissions.push({
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: cleanPhone || undefined,
            interests: selectedInterests.length > 0 ? selectedInterests : undefined,
            childAges: selectedAges.length > 0 ? selectedAges : undefined,
            message: formData.message || undefined,
            newsletter,
            timestamp: new Date().toISOString()
          })
          localStorage.setItem('vortex_pending_submissions', JSON.stringify(pendingSubmissions))
          
          // Show success anyway - we've stored their info
          setIsSubmitted(true)
          setTimeout(() => {
            setIsSubmitted(false)
            resetForm()
            onClose()
          }, 3000)
          return
        }
        throw fetchError
      }

      const result = await response.json()

      if (result.success) {
        // If newsletter checkbox is checked, also subscribe to newsletter
        if (newsletter) {
          try {
            await fetch(`${apiUrl}/api/newsletter`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ email: formData.email }),
              signal: AbortSignal.timeout(5000) // 5 second timeout
            })
          } catch (error) {
            console.error('Newsletter subscription error:', error)
            // Don't fail the form if newsletter subscription fails
          }
        }

        setIsSubmitted(true)
        // Reset form after 3 seconds
        setTimeout(() => {
          setIsSubmitted(false)
          resetForm()
          onClose()
        }, 3000)
      } else {
        // If email already registered, show success anyway (they're already in the system)
        if (result.message === 'Email already registered') {
          // Subscribe to newsletter if checkbox is checked
          if (newsletter) {
            try {
              await fetch(`${apiUrl}/api/newsletter`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: formData.email }),
                signal: AbortSignal.timeout(5000) // 5 second timeout
              })
            } catch (error) {
              console.error('Newsletter subscription error:', error)
            }
          }
          
          setIsSubmitted(true)
          setTimeout(() => {
            setIsSubmitted(false)
            resetForm()
            onClose()
          }, 3000)
        } else {
          console.error('Backend response:', result)
          console.error('Validation errors:', result.errors)
          
          // Display validation errors in a user-friendly way
          const errorMessage = result.errors && result.errors.length > 0
            ? `Please fix the following errors:\n${result.errors.map((err: string) => `• ${err}`).join('\n')}`
            : result.message || 'Please try again.'
          
          alert(`Registration failed: ${errorMessage}`)
        }
      }
    } catch (error: any) {
      console.error('Registration error:', error)
      // Only show error if we haven't already handled it as a connection error
      if (!error.handled) {
        // For other errors, try to store locally as backup
        try {
          const pendingSubmissions = JSON.parse(localStorage.getItem('vortex_pending_submissions') || '[]')
          pendingSubmissions.push({
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: cleanPhone || undefined,
            interests: selectedInterests.length > 0 ? selectedInterests : undefined,
            childAges: selectedAges.length > 0 ? selectedAges : undefined,
            message: formData.message || undefined,
            newsletter,
            timestamp: new Date().toISOString()
          })
          localStorage.setItem('vortex_pending_submissions', JSON.stringify(pendingSubmissions))
          
          // Show success message even if backend failed
          alert('We\'ve received your information and stored it locally. We\'ll process it once our server is back online. Thank you!')
          setIsSubmitted(true)
          setTimeout(() => {
            setIsSubmitted(false)
            resetForm()
            onClose()
          }, 3000)
        } catch (storageError) {
          // If even localStorage fails, show error
          alert('Unable to submit. Please check your connection and try again later.')
        }
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      message: ''
    })
    setSelectedInterests([])
    setSelectedClassTypes([])
    setSelectedAges([])
    setNewsletter(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleInterestToggle = (interest: string) => {
    setSelectedInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    )
  }

  const handleClassTypeToggle = (classType: string) => {
    setSelectedClassTypes(prev => {
      const newTypes = prev.includes(classType)
        ? prev.filter(t => t !== classType)
        : [...prev, classType]
      
      // If Child Classes is deselected, clear ages
      if (classType === 'Child Classes' && !newTypes.includes('Child Classes')) {
        setSelectedAges([])
      }
      
      return newTypes
    })
  }

  const handleAgeToggle = (age: number) => {
    setSelectedAges(prev => 
      prev.includes(age) 
        ? prev.filter(a => a !== age)
        : [...prev, age]
    )
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            className="relative bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", duration: 0.5 }}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-display font-bold text-black">
                    Inquire
                  </h2>
                  <p className="text-gray-600 mt-2">
                    Let us know how we can support! Ask any questions, provide comments or feedback, tell us about your interests, and stay informed! We will reach back out to you shortly.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-8">
              {!isSubmitted ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Enroll Button Section */}
                  <div className="bg-vortex-red/10 border-2 border-vortex-red/30 rounded-lg p-4 text-center">
                    <p className="text-gray-700 mb-3 font-medium">
                      If you are looking to Enroll, click here:
                    </p>
                    <motion.a
                      href="https://app3.jackrabbitclass.com/regv2.asp?id=557920"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block bg-vortex-red text-white px-8 py-3 rounded-lg font-semibold text-lg transition-all duration-300 hover:bg-red-700 hover:scale-105"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Enroll
                    </motion.a>
                  </div>

                  {/* Name Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        First Name *
                      </label>
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        required
                        minLength={2}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vortex-red focus:border-transparent transition-colors"
                        placeholder="First Name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        required
                        minLength={2}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vortex-red focus:border-transparent transition-colors"
                        placeholder="Last Name"
                      />
                    </div>
                  </div>

                  {/* Contact Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vortex-red focus:border-transparent transition-colors"
                        placeholder="Email Address"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vortex-red focus:border-transparent transition-colors"
                        placeholder="Phone Number"
                      />
                    </div>
                  </div>

                  {/* Interests Section */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Interests
                    </label>
                    <div className="space-y-2">
                      {interests.map((interest) => (
                        <label
                          key={interest}
                          className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedInterests.includes(interest)}
                            onChange={() => handleInterestToggle(interest)}
                            className="w-5 h-5 accent-vortex-red cursor-pointer"
                          />
                          <span className="text-gray-700">{interest}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Class Types Section */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Class Types
                    </label>
                    <div className="space-y-2">
                      {classTypes.map((classType) => (
                        <label
                          key={classType}
                          className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedClassTypes.includes(classType)}
                            onChange={() => handleClassTypeToggle(classType)}
                            className="w-5 h-5 accent-vortex-red cursor-pointer"
                          />
                          <span className="text-gray-700">{classType}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Child Ages Section - Show if Child Classes is selected */}
                  {selectedClassTypes.includes('Child Classes') && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Select Ages for Child Classes (1-18)
                      </label>
                      <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                        {Array.from({ length: 18 }, (_, i) => i + 1).map((age) => (
                          <label
                            key={age}
                            className="flex items-center justify-center p-2 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedAges.includes(age)}
                              onChange={() => handleAgeToggle(age)}
                              className="w-4 h-4 accent-vortex-red cursor-pointer"
                            />
                            <span className="ml-2 text-sm text-gray-700">{age}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Message */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Leave a comment or ask any questions
                    </label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vortex-red focus:border-transparent transition-colors resize-none"
                      placeholder="Tell us about your athletic goals, experience level, or ask any questions you have..."
                    />
                  </div>

                  {/* Newsletter Checkbox */}
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="newsletter"
                      checked={newsletter}
                      onChange={(e) => setNewsletter(e.target.checked)}
                      className="w-5 h-5 accent-vortex-red cursor-pointer"
                    />
                    <label htmlFor="newsletter" className="text-sm text-gray-700 cursor-pointer">
                      I would like to receive fitness and nutrition tips, recruiting information, and high school or collegiate sporting news from Vortex Athletics.
                    </label>
                  </div>

                  {/* Submit Button */}
                  <motion.button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full btn-primary flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                    whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        <span>Submit</span>
                      </>
                    )}
                  </motion.button>
                </form>
              ) : (
                <motion.div
                  className="text-center py-12"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-3xl font-display font-bold text-black mb-4">
                    Thank You!
                  </h3>
                  <p className="text-lg text-gray-600 mb-6">
                    We've received your information and will contact you soon with updates about Vortex Athletics.
                  </p>
                  <p className="text-sm text-gray-500">
                    This window will close automatically in a few seconds.
                  </p>
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-8 py-6 rounded-b-3xl">
              <div className="space-y-4 text-sm text-gray-600">
                {/* Address on one line */}
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4" />
                  <span>4961 Tesla Dr, Ste E, Bowie, MD 20715</span>
                </div>
                {/* Phone on left, email on right */}
                <div className="flex items-center space-x-8">
                  <div className="flex items-center space-x-2">
                    <Phone className="w-4 h-4" />
                    <span>+1 (443) 422-4794</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4" />
                    <span>team.vortexathletics@gmail.com</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ContactForm
