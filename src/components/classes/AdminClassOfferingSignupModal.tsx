import { useEffect, useState } from 'react'
import { Loader2, Search, UserPlus, X } from 'lucide-react'
import { getApiUrl } from '../../utils/api'
import {
  adminCreateSignup,
  checkSchedulingEmail,
  type SchedulingOffering,
  type SchedulingSlotGroup,
} from '../../utils/schedulingApi'
import { formatOfferingDates, formatSlotOccurrence } from '../../utils/classSchedulingSummary'

interface SearchMember {
  id: number
  first_name: string
  last_name: string
  email?: string
  phone?: string
}

type SignupMode = 'search' | 'email'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  formId: number
  className: string
  offering: SchedulingOffering | null
  slotGroup: SchedulingSlotGroup
}

const AdminClassOfferingSignupModal = ({
  open,
  onClose,
  onSuccess,
  formId,
  className,
  offering,
  slotGroup,
}: Props) => {
  const [mode, setMode] = useState<SignupMode>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchMember[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedMember, setSelectedMember] = useState<SearchMember | null>(null)

  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [emailChecked, setEmailChecked] = useState(false)
  const [emailExists, setEmailExists] = useState(false)
  const [checkingEmail, setCheckingEmail] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setMode('search')
    setSearchQuery('')
    setSearchResults([])
    setSelectedMember(null)
    setEmail('')
    setFirstName('')
    setLastName('')
    setEmailChecked(false)
    setEmailExists(false)
    setError(null)
    setSuccessMessage(null)
  }, [open])

  useEffect(() => {
    if (!open || mode !== 'search' || !searchQuery.trim()) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const adminToken = localStorage.getItem('adminToken')
        const res = await fetch(
          `${getApiUrl()}/api/admin/search-members?q=${encodeURIComponent(searchQuery.trim())}`,
          { headers: { Authorization: `Bearer ${adminToken}` } },
        )
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data.users || data.data || [])
        } else {
          setSearchResults([])
        }
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery, mode, open])

  const handleCheckEmail = async () => {
    const trimmed = email.trim()
    if (!trimmed) return
    setCheckingEmail(true)
    setError(null)
    try {
      const result = await checkSchedulingEmail(formId, trimmed)
      setEmailChecked(true)
      setEmailExists(result.exists)
      if (result.exists) {
        setFirstName(result.firstName || '')
        setLastName(result.lastName || '')
      } else {
        setFirstName('')
        setLastName('')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to check email')
    } finally {
      setCheckingEmail(false)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const timeSlotId = slotGroup.occurrences[0]?.id
      let result
      if (mode === 'search') {
        if (!selectedMember) {
          throw new Error('Select a member to sign up')
        }
        result = await adminCreateSignup({
          formId,
          slotGroupId: slotGroup.id,
          timeSlotId,
          memberId: selectedMember.id,
        })
      } else {
        const trimmedEmail = email.trim()
        if (!trimmedEmail) throw new Error('Email is required')
        if (!emailChecked) throw new Error('Check the email address first')
        if (!emailExists && (!firstName.trim() || !lastName.trim())) {
          throw new Error('First and last name are required for new accounts')
        }
        result = await adminCreateSignup({
          formId,
          slotGroupId: slotGroup.id,
          timeSlotId,
          email: trimmedEmail,
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
        })
      }
      setSuccessMessage('Signup created successfully')
      onSuccess()
      setTimeout(() => onClose(), 1200)
      void result
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signup failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  const offeringLabel = offering ? formatOfferingDates(offering) : 'Unassigned slots'
  const slotLabel = formatSlotOccurrence(slotGroup)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-vortex-red" />
            Sign someone up
          </h3>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4 text-sm text-gray-700">
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-1">
            <p><span className="font-semibold text-gray-900">Class:</span> {className}</p>
            <p><span className="font-semibold text-gray-900">Offering:</span> {offeringLabel}</p>
            <p><span className="font-semibold text-gray-900">Slot:</span> {slotLabel}</p>
            <p>
              <span className="font-semibold text-gray-900">Capacity:</span>{' '}
              {slotGroup.signupCount}/{slotGroup.maxParticipants}
              {slotGroup.isFull && (
                <span className="ml-2 text-amber-700 font-medium">(will waitlist)</span>
              )}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('search')}
              className={`flex-1 px-3 py-2 rounded-lg font-semibold text-sm ${
                mode === 'search'
                  ? 'bg-vortex-red text-white'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Search member
            </button>
            <button
              type="button"
              onClick={() => setMode('email')}
              className={`flex-1 px-3 py-2 rounded-lg font-semibold text-sm ${
                mode === 'email'
                  ? 'bg-vortex-red text-white'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Email signup
            </button>
          </div>

          {mode === 'search' && (
            <div className="space-y-3">
              <label className="block">
                <span className="font-semibold text-gray-900">Search by name, email, or phone</span>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setSelectedMember(null)
                    }}
                    placeholder="Type to search…"
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 focus:border-vortex-red outline-none"
                  />
                </div>
              </label>
              {searching && (
                <p className="text-gray-500 inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Searching…
                </p>
              )}
              {searchResults.length > 0 && (
                <ul className="border border-gray-200 rounded-lg divide-y max-h-48 overflow-y-auto">
                  {searchResults.map((member) => (
                    <li key={member.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedMember(member)}
                        className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${
                          selectedMember?.id === member.id ? 'bg-red-50' : ''
                        }`}
                      >
                        <span className="font-medium text-gray-900">
                          {member.first_name} {member.last_name}
                        </span>
                        {member.email && (
                          <span className="block text-xs text-gray-500">{member.email}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {selectedMember && (
                <p className="text-green-800 font-medium">
                  Selected: {selectedMember.first_name} {selectedMember.last_name}
                </p>
              )}
            </div>
          )}

          {mode === 'email' && (
            <div className="space-y-3">
              <label className="block">
                <span className="font-semibold text-gray-900">Email address</span>
                <div className="flex gap-2 mt-1">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setEmailChecked(false)
                    }}
                    placeholder="athlete@email.com"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:border-vortex-red outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCheckEmail}
                    disabled={checkingEmail || !email.trim()}
                    className="px-3 py-2 rounded-lg border border-gray-300 font-semibold hover:bg-gray-50 disabled:opacity-50"
                  >
                    {checkingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check'}
                  </button>
                </div>
              </label>
              {emailChecked && (
                <p className="text-sm text-gray-600">
                  {emailExists
                    ? 'Existing account found. Signup will use this member.'
                    : 'New account — enter first and last name below.'}
                </p>
              )}
              {emailChecked && !emailExists && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="font-semibold text-gray-900">First name</span>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-vortex-red outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="font-semibold text-gray-900">Last name</span>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-vortex-red outline-none"
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-red-700 text-sm">{error}</p>}
          {successMessage && <p className="text-green-700 text-sm font-medium">{successMessage}</p>}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              submitting ||
              (mode === 'search' && !selectedMember) ||
              (mode === 'email' && (!emailChecked || (!emailExists && (!firstName.trim() || !lastName.trim()))))
            }
            className="px-4 py-2 rounded-lg bg-vortex-red text-white font-semibold hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirm signup
          </button>
        </div>
      </div>
    </div>
  )
}

export default AdminClassOfferingSignupModal
