import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { adminApiRequest } from '../../../utils/api'

export default function MemberAccountSecurityTab({ memberId }: { memberId: number }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const updatePassword = async () => {
    setMessage(null)
    if (newPassword.length < 8) {
      setMessage({ ok: false, text: 'Password must be at least 8 characters.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage({ ok: false, text: 'Passwords do not match.' })
      return
    }

    setSaving(true)
    try {
      const res = await adminApiRequest(`/api/admin/members/${memberId}`, {
        method: 'PUT',
        body: JSON.stringify({ password: newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update password')
      }
      setMessage({ ok: true, text: 'Password updated successfully.' })
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Failed to update password' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <h4 className="font-semibold text-gray-900">Account security</h4>
        <p className="text-sm text-gray-500 mt-1">
          Set a new password for this account. The member will use it to log in to the Member Portal.
        </p>
      </div>

      {message && (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            message.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Confirm password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
            autoComplete="new-password"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => void updatePassword()}
        disabled={saving || !newPassword || !confirmPassword}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-vortex-red text-white text-sm font-semibold disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Update password
      </button>
    </div>
  )
}
