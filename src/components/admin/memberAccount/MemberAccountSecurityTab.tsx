import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Loader2, Power } from 'lucide-react'
import { adminApiRequest } from '../../../utils/api'

type PortalAccessStatus = 'active' | 'setup_required' | 'suspended' | 'no_login'
type PortalSuspensionReason =
  | 'member_archived'
  | 'login_link_invalid'
  | 'account_inactive'
  | 'portal_suspended'
  | 'setup_required'

type PortalAccess = {
  status: PortalAccessStatus
  canRestore: boolean
  memberIsActive: boolean
  accountIsActive: boolean
  hasPassword: boolean
  isStaff: boolean
  suspensionReasons: PortalSuspensionReason[]
}

const portalStatusLabel: Record<PortalAccessStatus, string> = {
  active: 'Active',
  setup_required: 'Setup required',
  suspended: 'Suspended',
  no_login: 'No login',
}

const portalReasonLabel: Partial<Record<PortalSuspensionReason, string>> = {
  member_archived: 'Unarchive the member record before restoring login.',
  login_link_invalid: 'The linked login account needs repair before portal access can be restored.',
  account_inactive: 'The global login account needs repair before portal access can be restored.',
  setup_required: 'Set a password to finish setting up Member Portal access.',
}

export default function MemberAccountSecurityTab({
  memberId,
  onAccessChange,
}: {
  memberId: number
  onAccessChange?: () => void | Promise<void>
}) {
  const inputId = useId()
  const [savedUsername, setSavedUsername] = useState('')
  const [username, setUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [portalAccess, setPortalAccess] = useState<PortalAccess | null>(null)
  const [portalLoading, setPortalLoading] = useState(true)
  const [updatingPortal, setUpdatingPortal] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const portalRequestSequence = useRef(0)

  const loadPortalAccess = useCallback(async () => {
    const requestSequence = ++portalRequestSequence.current
    setPortalLoading(true)
    try {
      const response = await adminApiRequest(`/api/admin/members/${memberId}/portal-access`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'Failed to load Member Portal access')
      if (requestSequence !== portalRequestSequence.current) return
      const currentUsername = payload.data?.username ?? ''
      setSavedUsername(currentUsername)
      setUsername(currentUsername)
      setPortalAccess({
        status: payload.data?.status ?? 'no_login',
        canRestore: payload.data?.canRestore === true,
        memberIsActive: payload.data?.memberIsActive === true,
        accountIsActive: payload.data?.accountIsActive === true,
        hasPassword: payload.data?.hasPassword === true,
        isStaff: payload.data?.isStaff === true,
        suspensionReasons: Array.isArray(payload.data?.suspensionReasons)
          ? payload.data.suspensionReasons
          : [],
      })
    } catch (error) {
      if (requestSequence !== portalRequestSequence.current) return
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : 'Failed to load Member Portal access',
      })
    } finally {
      if (requestSequence === portalRequestSequence.current) setPortalLoading(false)
    }
  }, [memberId])

  useEffect(() => {
    void loadPortalAccess()
  }, [loadPortalAccess])

  const usernameChanged = username.trim() !== savedUsername.trim()
  const settingUpLogin = portalAccess?.status === 'no_login' || portalAccess?.status === 'setup_required'
  const needsPassword = settingUpLogin && !portalAccess?.hasPassword

  const updateCredentials = async () => {
    setMessage(null)
    if ((needsPassword || newPassword) && newPassword.length < 8) {
      setMessage({ ok: false, text: 'Password must be at least 8 characters.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage({ ok: false, text: 'Passwords do not match.' })
      return
    }

    setSaving(true)
    try {
      const credentials: { username?: string; password?: string } = {}
      if (usernameChanged) credentials.username = username.trim()
      if (newPassword) credentials.password = newPassword
      const res = await adminApiRequest(`/api/admin/members/${memberId}`, {
        method: 'PUT',
        body: JSON.stringify(credentials),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update login credentials')
      }
      setMessage({ ok: true, text: 'Login credentials updated.' })
      setNewPassword('')
      setConfirmPassword('')
      await loadPortalAccess()
      await onAccessChange?.()
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Failed to update login credentials' })
    } finally {
      setSaving(false)
    }
  }

  const updatePortalAccess = async () => {
    const portalStatus = portalAccess?.status
    if (portalStatus !== 'active' && portalStatus !== 'suspended') return
    if (portalStatus === 'suspended' && portalAccess?.canRestore !== true) return
    const isActive = portalStatus === 'suspended'
    if (!isActive && !window.confirm('Suspend this member\'s portal login? Their member record and enrollments will remain active.')) {
      return
    }

    setUpdatingPortal(true)
    setMessage(null)
    try {
      const response = await adminApiRequest(`/api/admin/members/${memberId}/portal-access`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'Failed to update Member Portal access')
      setMessage({ ok: true, text: isActive ? 'Member Portal access restored.' : 'Member Portal access suspended.' })
      await loadPortalAccess()
      await onAccessChange?.()
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : 'Failed to update Member Portal access',
      })
    } finally {
      setUpdatingPortal(false)
    }
  }

  const portalStatus = portalAccess?.status ?? null
  const portalBlockers = portalAccess?.suspensionReasons
    .map((reason) => portalReasonLabel[reason])
    .filter((reason): reason is string => Boolean(reason)) ?? []
  const credentialsBlocked = portalLoading
    || portalAccess?.memberIsActive !== true
    || portalAccess.isStaff
    || portalAccess.suspensionReasons.some((reason) => (
      reason === 'login_link_invalid' || reason === 'account_inactive'
    ))

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <h4 className="font-semibold text-gray-900">Account security</h4>
        <p className="text-sm text-gray-500 mt-1">
          Member Portal login is independent from staff roles and household billing responsibility.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Member Portal</div>
          <div className="mt-1 text-sm font-semibold text-gray-900">
            {portalLoading ? 'Loading…' : portalStatus ? portalStatusLabel[portalStatus] : 'Unavailable'}
          </div>
        </div>
        {(portalStatus === 'active' || (portalStatus === 'suspended' && portalAccess?.canRestore)) && (
          <button
            type="button"
            onClick={() => void updatePortalAccess()}
            disabled={updatingPortal || saving}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 disabled:opacity-50"
          >
            {updatingPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
            {portalStatus === 'active' ? 'Suspend login' : 'Restore login'}
          </button>
        )}
      </div>

      {portalBlockers.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {portalBlockers.map((reason) => (
            <div key={reason}>{reason}</div>
          ))}
        </div>
      )}
      {portalAccess?.isStaff && <p className="text-sm text-gray-500">Edit this staff login’s username and password in Staff Access.</p>}

      {message && (
        <div role={message.ok ? 'status' : 'alert'}
          className={`rounded-lg px-3 py-2 text-sm ${
            message.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label htmlFor={`${inputId}-username`} className="block text-xs font-semibold text-gray-600 mb-1">Username</label>
          <input
            id={`${inputId}-username`}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={credentialsBlocked || saving}
            maxLength={50}
            className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
          />
        </div>
        <div>
          <label htmlFor={`${inputId}-password`} className="block text-xs font-semibold text-gray-600 mb-1">New password</label>
          <input
            id={`${inputId}-password`}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={credentialsBlocked || saving}
            className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label htmlFor={`${inputId}-confirm-password`} className="block text-xs font-semibold text-gray-600 mb-1">Confirm password</label>
          <input
            id={`${inputId}-confirm-password`}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={credentialsBlocked || saving}
            className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
            autoComplete="new-password"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => void updateCredentials()}
        disabled={credentialsBlocked || saving || updatingPortal
          || (needsPassword && !newPassword) || (!usernameChanged && !newPassword)
          || (Boolean(newPassword) && !confirmPassword)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-vortex-red text-white text-sm font-semibold disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {settingUpLogin ? 'Enable Member Portal' : 'Save login credentials'}
      </button>
    </div>
  )
}
