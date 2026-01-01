import { motion, AnimatePresence } from 'framer-motion'
import { X, Mail, Phone, MapPin, Send, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { getApiUrl } from '../utils/api'

interface ContactFormProps {
  isOpen: boolean
  onClose: () => void
}

interface AthleteData {
  age: string
  interests: string
}

const ContactForm = ({ isOpen, onClose }: ContactFormProps) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    message: ''
  })

  const [athletes, setAthletes] = useState<AthleteData[]>([
    { age: '', interests: '' }
  ])

  const [newsletter, setNewsletter] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

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
    
    // Helper function to convert age range to number
    const convertAgeRange = (ageRange: string): number | null => {
      if (ageRange === '3-5') return 4
      if (ageRange === '6-8') return 7
      if (ageRange === '9-12') return 10
      if (ageRange === '13-18') return 15
      if (ageRange === 'adult') return 18
      return null
    }
    
    // Clean phone number - remove all non-digit characters except + at the start
    let cleanPhone = formData.phone?.trim() || ''
    if (cleanPhone) {
      cleanPhone = cleanPhone.replace(/[^\d+]/g, '') // Remove all non-digit, non-plus characters
      if (cleanPhone.startsWith('+')) {
        cleanPhone = '+' + cleanPhone.substring(1).replace(/\D/g, '')
      }
    }
    
    try {
      const apiUrl = getApiUrl()
      
      // Submit for each athlete (or at least one submission with first athlete's info)
      const firstAthlete = athletes[0]
      const athleteAgeNum = convertAgeRange(firstAthlete?.age || '')
      
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: cleanPhone || undefined,
        athleteAge: athleteAgeNum || undefined,
        interests: firstAthlete?.interests || undefined,
        message: formData.message || undefined,
        additionalAthletes: athletes.slice(1).map((athlete, index) => ({
          name: `Athlete ${index + 2}`,
          age: convertAgeRange(athlete.age),
          interests: athlete.interests || undefined
        }))
      }
      
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
          console.warn('Backend server unavailable. Storing submission locally for later processing.')
          // Store submission locally as fallback
          const pendingSubmissions = JSON.parse(localStorage.getItem('vortex_pending_submissions') || '[]')
          pendingSubmissions.push({
            ...payload,
            timestamp: new Date().toISOString(),
            newsletter
          })
          localStorage.setItem('vortex_pending_submissions', JSON.stringify(pendingSubmissions))
          
          // Show success anyway - we've stored their info
          setIsSubmitted(true)
          setTimeout(() => {
            setIsSubmitted(false)
            setFormData({
              firstName: '',
              lastName: '',
              email: '',
              phone: '',
              message: ''
            })
            setAthletes([{ age: '', interests: '' }])
            setNewsletter(false)
            onClose()
          }, 3000)
          return
        }
        throw fetchError
      }

      console.log('Response status:', response.status)
      const result = await response.json()
      console.log('Response data:', result)

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
          setFormData({
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            message: ''
          })
          setAthletes([{ age: '', interests: '' }])
          setNewsletter(false)
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
            setFormData({
              firstName: '',
              lastName: '',
              email: '',
              phone: '',
              message: ''
            })
            setAthletes([{ age: '', interests: '' }])
            setNewsletter(false)
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
          const firstAthlete = athletes[0]
          const athleteAgeNum = convertAgeRange(firstAthlete?.age || '')
          pendingSubmissions.push({
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: cleanPhone || undefined,
            athleteAge: athleteAgeNum || undefined,
            interests: firstAthlete?.interests || undefined,
            message: formData.message || undefined,
            additionalAthletes: athletes.slice(1).map((athlete, index) => ({
              name: `Athlete ${index + 2}`,
              age: convertAgeRange(athlete.age),
              interests: athlete.interests || undefined
            })),
            timestamp: new Date().toISOString(),
            newsletter
          })
          localStorage.setItem('vortex_pending_submissions', JSON.stringify(pendingSubmissions))
          
          // Show success message even if backend failed
          alert('We\'ve received your information and stored it locally. We\'ll process it once our server is back online. Thank you!')
          setIsSubmitted(true)
          setTimeout(() => {
            setIsSubmitted(false)
            setFormData({
              firstName: '',
              lastName: '',
              email: '',
              phone: '',
              message: ''
            })
            setAthletes([{ age: '', interests: '' }])
            setNewsletter(false)
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleAthleteChange = (index: number, field: keyof AthleteData, value: string) => {
    setAthletes(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const addAthlete = () => {
    if (athletes.length < 3) {
      setAthletes(prev => [...prev, { age: '', interests: '' }])
    }
  }

  const removeAthlete = (index: number) => {
    if (athletes.length > 1) {
      setAthletes(prev => prev.filter((_, i) => i !== index))
    }
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
                    Stay Informed
                  </h2>
                  <p className="text-gray-600 mt-2">
                    Tell us what you are interested in and we will let you know how we can help! Stay up to date with Vortex Athletics as we grow our program and offerings.
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
                        placeholder="Enter first name (minimum 2 characters)"
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
                        placeholder="Enter last name (minimum 2 characters)"
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
                        placeholder="Enter email address"
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
                        placeholder="Enter phone number"
                      />
                    </div>
                  </div>

                  {/* Athletes Info */}
                  <div className="space-y-6">
                    {athletes.map((athlete, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-gray-800">
                            Athlete {index + 1}
                          </h3>
                          {athletes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeAthlete(index)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remove athlete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Athlete Age
                            </label>
                            <select
                              value={athlete.age}
                              onChange={(e) => handleAthleteChange(index, 'age', e.target.value)}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vortex-red focus:border-transparent transition-colors bg-white"
                            >
                              <option value="">Select age range</option>
                              <option value="3-5">3-5 years (Preschool)</option>
                              <option value="6-8">6-8 years (Elementary)</option>
                              <option value="9-12">9-12 years (Middle School)</option>
                              <option value="13-18">13-18 years (High School)</option>
                              <option value="adult">Adult (18+)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Primary Interest
                            </label>
                            <select
                              value={athlete.interests}
                              onChange={(e) => handleAthleteChange(index, 'interests', e.target.value)}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vortex-red focus:border-transparent transition-colors bg-white"
                            >
                              <option value="">Select interest</option>
                              <option value="competition">Competition Gymnastics</option>
                              <option value="recreational">Recreational Classes</option>
                              <option value="athleticism">Athleticism Accelerator</option>
                              <option value="private">Private Coaching</option>
                              <option value="adult">Adult Fitness</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {athletes.length < 3 && (
                      <button
                        type="button"
                        onClick={addAthlete}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-vortex-red hover:text-vortex-red transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                        <span>Add Another Athlete</span>
                      </button>
                    )}
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Additional Information or Questions
                    </label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vortex-red focus:border-transparent transition-colors resize-none"
                      placeholder="Tell us about your athletic goals, experience level, or any questions you have..."
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
                      I would like to receive fitness tips, recruiting information, and high school or collegiate sporting news from Vortex Athletics.
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
                        <span>Stay Informed</span>
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
