import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import {
  adminResetSignupMemberPassword,
  type SchedulingSignup,
} from '../../utils/schedulingApi'

type ResetMode = 'email_temp' | 'manual'

interface Props {
  signup: SchedulingSignup
  open: boolean
  onClose: () => void
  onSuccess: () => void | Promise<void>
}

const AdminSignupPasswordResetModal = ({ signup, open, onClose, onSuccess }: Props) => {
  const [mode, setMode] = useState<ResetMode>('email_temp')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  if (!open) return null

  const email = signup.email || String(signup.responses.email || '')
  const name = [signup.firstName || signup.responses.first_name, signup.lastName || signup.responses.last_name]
    .filter(Boolean)
    .join(' ')

  const resetForm = () => {
    setMode('email_temp')
    setPassword('')
    setConfirmPassword('')
    setError(null)
    setSuccessMessage(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (mode === 'manual') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters')
        return
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match')
        return
      }
    }

    setSubmitting(true)
    try {
      const result = await adminResetSignupMemberPassword(signup.id, {
        mode,
        password: mode === 'manual' ? password : undefined,
      })
      setSuccessMessage(result.message || 'Password updated')
      await onSuccess()
      setTimeout(() => handleClose(), 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="text-lg font-bold text-black">Reset password</h3>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="px-5 py-4 space-y-4">
          <p className="text-sm text-gray-600">
            {name ? <span className="font-semibold text-black">{name}</span> : 'Member'}
            {email ? <span className="block mt-1">{email}</span> : null}
          </p>

          <div className="space-y-2">
            <label className="flex items-start gap-2 text-sm text-gray-800 cursor-pointer">
              <input
                type="radio"
                name="reset-mode"
                checked={mode === 'email_temp'}
                onChange={() => setMode('email_temp')}
                className="mt-1"
              />
              <span>
                Email a temporary password
                <span className="block text-xs text-gray-500 mt-0.5">
                  The member must choose a new password after signing in once.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-800 cursor-pointer">
              <input
                type="radio"
                name="reset-mode"
                checked={mode === 'manual'}
                onChange={() => setMode('manual')}
                className="mt-1"
              />
              <span>Set password manually</span>
            </label>
          </div>

          {mode === 'manual' && (
            <div className="space-y-3">
              <div>
                <label htmlFor="reset-password" className="block text-xs font-semibold text-gray-600 mb-1">
                  New password
                </label>
                <input
                  id="reset-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label
                  htmlFor="reset-password-confirm"
                  className="block text-xs font-semibold text-gray-600 mb-1"
                >
                  Confirm password
                </label>
                <input
                  id="reset-password-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          {successMessage && <p className="text-sm text-green-700">{successMessage}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-black"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-vortex-red text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'email_temp' ? 'Send temporary password' : 'Save password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AdminSignupPasswordResetModal
