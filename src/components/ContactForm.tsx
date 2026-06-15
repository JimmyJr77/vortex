import { motion, AnimatePresence } from 'framer-motion'
import { X, Mail, Phone, MapPin, Send, Plus, Trash2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { getApiUrl } from '../utils/api'
import { TEAM_EMAIL } from '../config/contact'
import { getAttributionPayload } from '../utils/utmCapture'
import { getVisitorId, getSessionId } from '../utils/visitorId'
import { getActiveConsent } from '../utils/consent'
import { trackEvent } from '../utils/analyticsClient'
import {
  ATHLETICS_SPORT_INTERESTS,
  ATHLETICS_TRAINING_INTERESTS,
  GYMNASTICS_INTERESTS,
  INQUIRY_CLASS_TYPES,
  SUBMITTER_ROLES,
  type InquiryCamper,
  type InquiryVariant,
  type SubmitterRole,
} from '../config/inquiryOptions'

interface ContactFormProps {
  isOpen?: boolean
  onClose?: () => void
  /** Modal heading (e.g. "Athlete Inquiry", "Gymnastics Inquiry"). */
  title?: string
  inquiryVariant?: InquiryVariant
  /** Pathname when the user opened the inquire modal. */
  inquirySource?: string
  /** Render inline (not as a modal) for embedding directly in a page. */
  embedded?: boolean
}

type AthleteRow = { dateOfBirth: string }

const emptyAthlete = (): AthleteRow => ({ dateOfBirth: '' })

const ContactForm = ({
  isOpen = false,
  onClose,
  title = 'Inquire',
  inquiryVariant = 'athletics',
  inquirySource,
  embedded = false,
}: ContactFormProps) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    message: '',
  })
  const [submitterRole, setSubmitterRole] = useState<SubmitterRole | ''>('')
  const [athletes, setAthletes] = useState<AthleteRow[]>([])
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [sportOtherText, setSportOtherText] = useState('')
  const [selectedClassTypes, setSelectedClassTypes] = useState<string[]>([])
  const [newsletter, setNewsletter] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  useEffect(() => {
    if (isOpen || embedded) {
      trackEvent('inquiry_form_start', inquirySource || window.location.pathname, {
        properties: { inquiry_variant: inquiryVariant },
      })
    }
  }, [isOpen, embedded, inquiryVariant, inquirySource])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    trackEvent('inquiry_form_submit', inquirySource || window.location.pathname, {
      properties: { inquiry_variant: inquiryVariant },
    })

    if (!submitterRole) {
      alert('Please select whether you are the Athlete, Parent/Guardian, or Other.')
      setIsSubmitting(false)
      return
    }

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

    let cleanPhone = formData.phone?.trim() || ''
    if (cleanPhone) {
      cleanPhone = cleanPhone.replace(/[^\d+]/g, '')
      if (cleanPhone.startsWith('+')) {
        cleanPhone = '+' + cleanPhone.substring(1).replace(/\D/g, '')
      }
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

    const completedAthletes: InquiryCamper[] = []
    for (let i = 0; i < athletes.length; i++) {
      const dob = athletes[i].dateOfBirth.trim()
      if (!dob) continue
      completedAthletes.push({ dateOfBirth: dob })
    }

    let interestsToSubmit = [...selectedInterests]
    if (inquiryVariant === 'athletics' && selectedInterests.includes('Other')) {
      const otherLabel = sportOtherText.trim()
        ? `Other: ${sportOtherText.trim()}`
        : 'Other'
      interestsToSubmit = interestsToSubmit.filter((i) => i !== 'Other')
      interestsToSubmit.push(otherLabel)
    }

    try {
      const apiUrl = getApiUrl()

      const payload: Record<string, unknown> = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        submitterRole,
        newsletter,
      }

      if (cleanPhone) payload.phone = cleanPhone
      if (interestsToSubmit.length > 0) payload.interests = interestsToSubmit
      if (selectedClassTypes.length > 0) payload.classTypes = selectedClassTypes
      if (completedAthletes.length > 0) payload.campers = completedAthletes
      if (formData.message) payload.message = formData.message
      if (inquirySource) payload.inquirySource = inquirySource

      const consent = getActiveConsent()
      const attribution = getAttributionPayload()
      payload.visitorId = getVisitorId(consent.analytics)
      payload.sessionId = getSessionId(consent.analytics)
      Object.assign(payload, attribution)

      let response: Response
      try {
        response = await fetch(`${apiUrl}/api/registrations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        })
      } catch (fetchError: unknown) {
        const err = fetchError as { name?: string }
        if (err.name === 'AbortError' || err.name === 'TypeError') {
          const pendingSubmissions = JSON.parse(localStorage.getItem('vortex_pending_submissions') || '[]')
          pendingSubmissions.push({ ...payload, timestamp: new Date().toISOString() })
          localStorage.setItem('vortex_pending_submissions', JSON.stringify(pendingSubmissions))
          setIsSubmitted(true)
          return
        }
        throw fetchError
      }

      const result = await response.json()

      if (result.success) {
        if (newsletter) {
          try {
            await fetch(`${apiUrl}/api/newsletter`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: formData.email }),
              signal: AbortSignal.timeout(5000),
            })
          } catch (error) {
            console.error('Newsletter subscription error:', error)
          }
        }

        setIsSubmitted(true)
      } else if (result.message === 'Email already registered') {
        if (newsletter) {
          try {
            await fetch(`${apiUrl}/api/newsletter`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: formData.email }),
              signal: AbortSignal.timeout(5000),
            })
          } catch (error) {
            console.error('Newsletter subscription error:', error)
          }
        }
        setIsSubmitted(true)
      } else {
        const errorMessage =
          result.errors && result.errors.length > 0
            ? `Please fix the following errors:\n${result.errors.map((err: string) => `• ${err}`).join('\n')}`
            : result.message || 'Please try again.'
        alert(`Registration failed: ${errorMessage}`)
      }
    } catch (error: unknown) {
      console.error('Registration error:', error)
      try {
        const pendingSubmissions = JSON.parse(localStorage.getItem('vortex_pending_submissions') || '[]')
        pendingSubmissions.push({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          submitterRole,
          phone: cleanPhone || undefined,
          interests: selectedInterests.length > 0 ? selectedInterests : undefined,
          message: formData.message || undefined,
          newsletter,
          inquirySource,
          timestamp: new Date().toISOString(),
        })
        localStorage.setItem('vortex_pending_submissions', JSON.stringify(pendingSubmissions))
        alert("We've received your information and stored it locally. We'll process it once our server is back online. Thank you!")
        setIsSubmitted(true)
      } catch {
        alert('Unable to submit. Please check your connection and try again later.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({ firstName: '', lastName: '', email: '', phone: '', message: '' })
    setSubmitterRole('')
    setAthletes([])
    setSelectedInterests([])
    setSportOtherText('')
    setSelectedClassTypes([])
    setNewsletter(true)
  }

  const handleDismiss = () => {
    if (isSubmitted) {
      resetForm()
      setIsSubmitted(false)
    }
    onClose?.()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleInterestToggle = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest],
    )
    if (interest === 'Other' && selectedInterests.includes('Other')) {
      setSportOtherText('')
    }
  }

  const handleClassTypeToggle = (classType: string) => {
    setSelectedClassTypes((prev) =>
      prev.includes(classType) ? prev.filter((t) => t !== classType) : [...prev, classType],
    )
  }

  const addAthlete = () => setAthletes((prev) => [...prev, emptyAthlete()])

  const updateAthlete = (index: number, dateOfBirth: string) => {
    setAthletes((prev) => prev.map((row, i) => (i === index ? { dateOfBirth } : row)))
  }

  const removeAthlete = (index: number) => {
    setAthletes((prev) => prev.filter((_, i) => i !== index))
  }

  const renderInterestCheckbox = (interest: string) => (
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
  )

  const card = (
    <motion.div
      className={`relative bg-white max-w-2xl w-full ${
        embedded
          ? 'rounded-2xl border border-gray-200 shadow-lg'
          : 'rounded-3xl max-h-[90vh] overflow-y-auto'
      }`}
      initial={embedded ? false : { scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ type: 'spring', duration: 0.5 }}
    >
      <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 rounded-t-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-display font-bold text-black">{title}</h2>
            <p className="text-gray-600 mt-2">
              Let us know how we can support! Ask any questions, provide comments or feedback, tell us about your interests, and stay informed! We will reach back out to you shortly.
            </p>
          </div>
          {!embedded && (
            <button onClick={handleDismiss} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>

      <div className="p-8">
        {!isSubmitted ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-vortex-red/10 border-2 border-vortex-red/30 rounded-lg p-4 text-center">
              <p className="text-gray-700 mb-3 font-medium">If you are looking to Enroll, click here:</p>
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

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Are you the Athlete, Parent/Guardian, or Other? *
              </label>
              <div className="space-y-2">
                {SUBMITTER_ROLES.map((role) => (
                  <label
                    key={role}
                    className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="radio"
                      name="submitterRole"
                      value={role}
                      checked={submitterRole === role}
                      onChange={() => setSubmitterRole(role)}
                      className="w-5 h-5 accent-vortex-red cursor-pointer"
                    />
                    <span className="text-gray-700">{role}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">First Name *</label>
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">Last Name *</label>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address *</label>
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
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

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-semibold text-gray-700">Athlete Information</label>
                <button
                  type="button"
                  onClick={addAthlete}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-vortex-red hover:text-red-700"
                >
                  <Plus className="w-4 h-4" />
                  Add athlete
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-3">Optional — add each athlete&apos;s date of birth.</p>
              {athletes.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No athletes added yet.</p>
              ) : (
                <ul className="space-y-3">
                  {athletes.map((athlete, index) => (
                    <li
                      key={index}
                      className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50"
                    >
                      <label className="text-sm text-gray-600 shrink-0">DOB</label>
                      <input
                        type="date"
                        value={athlete.dateOfBirth}
                        onChange={(e) => updateAthlete(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        aria-label={`Athlete ${index + 1} date of birth`}
                      />
                      <button
                        type="button"
                        onClick={() => removeAthlete(index)}
                        className="p-2 text-gray-500 hover:text-vortex-red"
                        aria-label={`Remove athlete ${index + 1}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {inquiryVariant === 'athletics' ? (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Training Interests</label>
                  <div className="space-y-2">
                    {ATHLETICS_TRAINING_INTERESTS.map((interest) => renderInterestCheckbox(interest))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Sport Interests</label>
                  <div className="space-y-2">
                    {ATHLETICS_SPORT_INTERESTS.map((interest) => renderInterestCheckbox(interest))}
                  </div>
                  {selectedInterests.includes('Other') && (
                    <input
                      type="text"
                      value={sportOtherText}
                      onChange={(e) => setSportOtherText(e.target.value)}
                      placeholder="Please specify"
                      className="mt-3 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vortex-red focus:border-transparent"
                      aria-label="Other sport interest"
                    />
                  )}
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Interests</label>
                <div className="space-y-2">
                  {GYMNASTICS_INTERESTS.map((interest) => renderInterestCheckbox(interest))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Class Type Interests</label>
              <div className="space-y-2">
                {INQUIRY_CLASS_TYPES.map((classType) => (
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
            <h3 className="text-3xl font-display font-bold text-black mb-4">Thank You!</h3>
            <p className="text-lg text-gray-600 mb-8">
              We&apos;ve received your information and will contact you soon with updates about Vortex Athletics.
            </p>
            <motion.button
              type="button"
              onClick={handleDismiss}
              className="inline-flex items-center justify-center px-8 py-3 bg-vortex-red text-white rounded-lg font-semibold text-lg hover:bg-red-700 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Close
            </motion.button>
          </motion.div>
        )}
      </div>

      <div className="bg-gray-50 px-8 py-6 rounded-b-3xl">
        <div className="space-y-4 text-sm text-gray-600">
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4" />
            <span>4961 Tesla Dr, Ste E, Bowie, MD 20715</span>
          </div>
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
              <Phone className="w-4 h-4" />
              <span>+1 (443) 422-4794</span>
            </div>
            <div className="flex items-center space-x-2">
              <Mail className="w-4 h-4" />
              <a href={`mailto:${TEAM_EMAIL}`} className="hover:text-vortex-red transition-colors">
                {TEAM_EMAIL}
              </a>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )

  if (embedded) {
    return <div className="w-full flex justify-center">{card}</div>
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
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={isSubmitted ? undefined : handleDismiss}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          {card}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ContactForm
