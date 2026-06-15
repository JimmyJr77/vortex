import { motion } from 'framer-motion'
import { Plus, Send, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  CAMP_INQUIRY_AUTO_CLASS,
  CAMP_INQUIRY_OTHER_CLASS_TYPES,
  GYMNASTICS_INTERESTS,
  type InquiryCamper,
} from '../../../config/inquiryOptions'
import { getApiUrl } from '../../../utils/api'
import {
  adaptRegistrationPayloadForApi,
  getRegistrationApiCapabilities,
} from '../../../utils/registrationApi'
import { getActiveConsent } from '../../../utils/consent'
import { trackEvent } from '../../../utils/analyticsClient'
import { getVisitorId, getSessionId } from '../../../utils/visitorId'
import { getAttributionPayload } from '../../../utils/utmCapture'

type CamperRow = { dateOfBirth: string }

const emptyCamper = (): CamperRow => ({ dateOfBirth: '' })

function cleanPhone(raw: string): string {
  let clean = raw.trim()
  if (!clean) return ''
  clean = clean.replace(/[^\d+]/g, '')
  if (clean.startsWith('+')) {
    clean = '+' + clean.substring(1).replace(/\D/g, '')
  }
  return clean
}

const SummerCampInquiryForm = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    message: '',
  })
  const [campers, setCampers] = useState<CamperRow[]>([])
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [selectedOtherClassTypes, setSelectedOtherClassTypes] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    trackEvent('inquiry_form_start', location.pathname, {
      properties: { sport_label: 'Gymnastics', form: 'summer_camp_inquiry' },
    })
  }, [location.pathname])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleInterestToggle = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest],
    )
  }

  const handleClassTypeToggle = (classType: string) => {
    setSelectedOtherClassTypes((prev) =>
      prev.includes(classType) ? prev.filter((t) => t !== classType) : [...prev, classType],
    )
  }

  const updateCamper = (index: number, dateOfBirth: string) => {
    setCampers((prev) => prev.map((row, i) => (i === index ? { dateOfBirth } : row)))
  }

  const addCamper = () => {
    setCampers((prev) => [...prev, emptyCamper()])
  }

  const removeCamper = (index: number) => {
    setCampers((prev) => prev.filter((_, i) => i !== index))
  }

  const goToThankYou = () => {
    navigate('/camp_interest/thank-you')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    trackEvent('inquiry_form_submit', location.pathname, {
      properties: { sport_label: 'Gymnastics', form: 'summer_camp_inquiry' },
    })

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
    if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
      alert('Please enter a valid email address.')
      setIsSubmitting(false)
      return
    }

    const phone = cleanPhone(formData.phone)
    if (!phone) {
      alert('Phone number is required.')
      setIsSubmitting(false)
      return
    }
    const digitsOnly = phone.replace(/\D/g, '')
    if (digitsOnly.length < 10) {
      alert('Phone number must be at least 10 digits long.')
      setIsSubmitting(false)
      return
    }

    const completedCampers: InquiryCamper[] = []
    for (const row of campers) {
      const dob = row.dateOfBirth.trim()
      if (!dob) continue
      completedCampers.push({ dateOfBirth: dob })
    }

    const classTypes = [CAMP_INQUIRY_AUTO_CLASS, ...selectedOtherClassTypes]

    try {
      const apiUrl = getApiUrl()
      const payload: Record<string, unknown> = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        phone,
        classTypes,
        newsletter: false,
        inquirySource: location.pathname,
      }

      if (selectedInterests.length > 0) payload.interests = selectedInterests
      if (completedCampers.length > 0) payload.campers = completedCampers
      if (formData.message.trim()) payload.message = formData.message.trim()

      const consent = getActiveConsent()
      const attribution = getAttributionPayload()
      payload.visitorId = getVisitorId(consent.analytics)
      payload.sessionId = getSessionId(consent.analytics)
      Object.assign(payload, attribution)

      const capabilities = await getRegistrationApiCapabilities()
      const apiPayload = adaptRegistrationPayloadForApi(payload, capabilities.registrationInquiryOverhaul)

      const response = await fetch(`${apiUrl}/api/registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload),
        signal: AbortSignal.timeout(10000),
      })

      const result = await response.json()

      if (result.success || result.message === 'Email already registered') {
        goToThankYou()
        return
      }

      const errorMessage =
        result.errors && result.errors.length > 0
          ? `Please fix the following errors:\n${result.errors.map((err: string) => `• ${err}`).join('\n')}`
          : result.message || 'Please try again.'
      alert(`Registration failed: ${errorMessage}`)
    } catch (error) {
      console.error('Camp inquiry submission error:', error)
      alert('Unable to submit. Please check your connection and try again later.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto w-full space-y-6">
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vortex-red focus:border-transparent"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vortex-red focus:border-transparent"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vortex-red focus:border-transparent"
                placeholder="Email Address"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number *</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vortex-red focus:border-transparent"
                placeholder="Phone Number"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-gray-700">Campers</label>
              <button
                type="button"
                onClick={addCamper}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-vortex-red hover:text-red-700"
              >
                <Plus className="w-4 h-4" />
                Add camper
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-3">
              Optional — add each camper&apos;s date of birth.
            </p>
            {campers.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No campers added yet.</p>
            ) : (
              <ul className="space-y-3">
                {campers.map((camper, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50"
                  >
                    <label className="text-sm text-gray-600 shrink-0">DOB</label>
                    <input
                      type="date"
                      value={camper.dateOfBirth}
                      onChange={(e) => updateCamper(index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      aria-label={`Camper ${index + 1} date of birth`}
                    />
                    <button
                      type="button"
                      onClick={() => removeCamper(index)}
                      className="p-2 text-gray-500 hover:text-vortex-red"
                      aria-label={`Remove camper ${index + 1}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Aside from summer camp, what are your and your camper&apos;s other interests:
            </label>
            <div className="space-y-2">
              {GYMNASTICS_INTERESTS.map((interest) => (
                <label
                  key={interest}
                  className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
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

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Aside from our Gymnastics Summer Camp, are you interested in any of these other class
              types?
            </label>
            <div className="space-y-2">
              {CAMP_INQUIRY_OTHER_CLASS_TYPES.map((classType) => (
                <label
                  key={classType}
                  className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedOtherClassTypes.includes(classType)}
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
              Questions or comments
            </label>
            <textarea
              name="message"
              value={formData.message}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vortex-red focus:border-transparent resize-none"
              placeholder="Anything else we should know?"
            />
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
  )
}

export default SummerCampInquiryForm
