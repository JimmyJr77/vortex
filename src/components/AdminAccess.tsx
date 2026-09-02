import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Power, Save, UserPlus, X } from 'lucide-react'
import { adminApiRequest } from '../utils/api'
import { formatPhoneForDisplay, formatPhoneNumber, PHONE_INPUT_MAX_LENGTH, PHONE_INPUT_PLACEHOLDER } from '../utils/phoneUtils'

interface AccessUser {
  id: number
  email: string | null
  fullName: string
  phone?: string | null
  username?: string | null
  roles: string[]
  isActive: boolean
  isMasterAdmin: boolean
  isOwner?: boolean
  memberId?: number | null
  staffRoles?: Array<'OWNER' | 'ADMINISTRATOR' | 'COACH'>
  portalAccess?: {
    admin: boolean
    coach: boolean
    member: boolean
    memberStatus: 'active' | 'setup_required' | 'suspended' | 'no_login'
  }
}

interface AccessRole {
  key: string
  name: string
  description?: string | null
  permissions: string[]
}

interface Permission {
  key: string
  description?: string | null
}

const assignableRoleOrder = ['ADMIN', 'COACH'] as const
const staffRoleSet = new Set<string>(['MASTER_ADMIN', ...assignableRoleOrder])

const ROLE_LABELS: Record<string, string> = {
  MASTER_ADMIN: 'Owner',
  ADMIN: 'Administrator',
  COACH: 'Coach',
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  MASTER_ADMIN: 'Full company control, including access management and destructive actions.',
  ADMIN: 'Daily account, enrollment, billing, scheduling, and waiver operations.',
  COACH: 'Assignment-scoped coaching, roster, attendance, and safety information.',
}

const roleLabel = (role: string) => ROLE_LABELS[role] ?? role.replaceAll('_', ' ')

function applyRoleToggle(currentRoles: string[], role: string): string[] {
  if (currentRoles.includes(role)) {
    const next = currentRoles.filter((r) => r !== role)
    return next.length > 0 ? next : currentRoles
  }
  let next = [...currentRoles, role]
  if (role === 'MASTER_ADMIN') {
    next = next.filter((r) => r !== 'ADMIN')
  } else if (role === 'ADMIN') {
    next = next.filter((r) => r !== 'MASTER_ADMIN')
  }
  return next
}

const emptyNewStaffForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  username: '',
  password: '',
  roles: ['ADMIN'] as string[],
}

function normalizeAdminRoleSelection(roles: string[]): string[] {
  const staffRoles = roles.filter((role) => staffRoleSet.has(role))
  if (staffRoles.includes('MASTER_ADMIN') && staffRoles.includes('ADMIN')) {
    return staffRoles.filter((role) => role !== 'ADMIN')
  }
  return staffRoles
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

function combineFullName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim()
}

export default function AdminAccess({ currentUserId = null }: { currentUserId?: number | null }) {
  const [users, setUsers] = useState<AccessUser[]>([])
  const [roles, setRoles] = useState<AccessRole[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [allowPermissions, setAllowPermissions] = useState<string[]>([])
  const [denyPermissions, setDenyPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingActive, setUpdatingActive] = useState(false)
  const [showNewStaff, setShowNewStaff] = useState(false)
  const [creatingStaff, setCreatingStaff] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newStaffForm, setNewStaffForm] = useState(emptyNewStaffForm)
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    username: '',
    password: '',
  })

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) ?? null,
    [selectedUserId, users],
  )
  const staffUsers = useMemo(
    () => users.filter((user) => user.isOwner === true || user.roles.some((role) => staffRoleSet.has(role))),
    [users],
  )
  const selectedUserIsOwner = selectedUser?.isOwner === true
  const canEditSelectedProfile = !selectedUserIsOwner
    || (currentUserId != null && selectedUser?.id === currentUserId)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [usersRes, rolesRes] = await Promise.all([
        adminApiRequest('/api/admin/access/users'),
        adminApiRequest('/api/admin/access/roles'),
      ])
      if (!usersRes.ok) throw new Error(`Users request failed: ${usersRes.status}`)
      if (!rolesRes.ok) throw new Error(`Roles request failed: ${rolesRes.status}`)
      const usersJson = await usersRes.json()
      const rolesJson = await rolesRes.json()
      const nextUsers: AccessUser[] = usersJson.data ?? []
      const nextStaffUsers = nextUsers.filter(
        (user) => user.isOwner === true || user.roles.some((role) => staffRoleSet.has(role)),
      )
      setUsers(nextUsers)
      setRoles(rolesJson.data?.roles ?? [])
      setPermissions(rolesJson.data?.permissions ?? [])
      setSelectedUserId((current) => (
        nextStaffUsers.some((user) => user.id === current)
          ? current
          : nextStaffUsers[0]?.id ?? null
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load access settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (selectedUser) {
      setSelectedRoles(normalizeAdminRoleSelection(selectedUser.roles))
      const { firstName, lastName } = splitFullName(selectedUser.fullName)
      setProfileForm({
        firstName,
        lastName,
        email: selectedUser.email ?? '',
        phone: formatPhoneForDisplay(selectedUser.phone ?? ''),
        username: selectedUser.username ?? '',
        password: '',
      })
      setAllowPermissions([])
      setDenyPermissions([])
      let cancelled = false
      const loadOverrides = async () => {
        try {
          const res = await adminApiRequest(`/api/admin/access/users/${selectedUser.id}/permissions`)
          if (!res.ok) return
          const json = await res.json()
          if (cancelled) return
          setAllowPermissions(json.data?.allow ?? [])
          setDenyPermissions(json.data?.deny ?? [])
        } catch (err) {
          if (cancelled) return
          console.warn('Unable to load permission overrides:', err)
          setAllowPermissions([])
          setDenyPermissions([])
        }
      }
      void loadOverrides()
      return () => {
        cancelled = true
      }
    }
  }, [selectedUser])

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) => applyRoleToggle(prev, role))
  }

  const togglePermission = (permission: string) => {
    setAllowPermissions((prev) =>
      prev.includes(permission) ? prev.filter((p) => p !== permission) : [...prev, permission],
    )
    setDenyPermissions((prev) => prev.filter((p) => p !== permission))
  }

  const toggleDenyPermission = (permission: string) => {
    setDenyPermissions((prev) =>
      prev.includes(permission) ? prev.filter((p) => p !== permission) : [...prev, permission],
    )
    setAllowPermissions((prev) => prev.filter((p) => p !== permission))
  }

  const saveProfileAndAccess = async () => {
    if (!selectedUserId || !canEditSelectedProfile) return
    if (profileForm.username.includes('@')) {
      setError('Username cannot contain @. Use the email field for email sign-in.')
      return
    }
    if (profileForm.password && profileForm.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, string> = {
        fullName: combineFullName(profileForm.firstName, profileForm.lastName),
        phone: profileForm.phone.trim(),
        username: profileForm.username.trim(),
      }
      if (profileForm.email.trim()) {
        body.email = profileForm.email.trim()
      }
      if (profileForm.password.trim()) {
        body.password = profileForm.password
      }
      const profileRes = await adminApiRequest(`/api/admin/access/users/${selectedUserId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      if (!profileRes.ok) {
        const data = await profileRes.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to update account profile')
      }

      if (!selectedUserIsOwner) {
        const roleRes = await adminApiRequest(`/api/admin/access/users/${selectedUserId}/roles`, {
          method: 'PUT',
          body: JSON.stringify({
            roles: selectedRoles,
            isMasterAdmin: selectedRoles.includes('MASTER_ADMIN'),
          }),
        })
        if (!roleRes.ok) {
          const data = await roleRes.json().catch(() => ({}))
          throw new Error(data.message || 'Failed to update roles')
        }

        const permRes = await adminApiRequest(`/api/admin/access/users/${selectedUserId}/permissions`, {
          method: 'PUT',
          body: JSON.stringify({ allow: allowPermissions, deny: denyPermissions }),
        })
        if (!permRes.ok) {
          const data = await permRes.json().catch(() => ({}))
          throw new Error(data.message || 'Failed to update permissions')
        }
      }

      setProfileForm((prev) => ({ ...prev, password: '' }))
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile and access settings')
    } finally {
      setSaving(false)
    }
  }

  const createStaff = async () => {
    const fullName = combineFullName(newStaffForm.firstName, newStaffForm.lastName)
    if (!fullName || (!newStaffForm.email.trim() && !newStaffForm.username.trim()) || !newStaffForm.password) {
      setError('Name, password, and either email or username are required.')
      return
    }
    if (newStaffForm.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (newStaffForm.username.includes('@')) {
      setError('Username cannot contain @. Use the email field for email sign-in.')
      return
    }

    setCreatingStaff(true)
    setError(null)
    try {
      const response = await adminApiRequest('/api/admin/access/users', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          email: newStaffForm.email.trim() || null,
          phone: newStaffForm.phone.trim() || null,
          username: newStaffForm.username.trim() || null,
          password: newStaffForm.password,
          roles: newStaffForm.roles,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'Failed to create staff account')

      const createdId = Number(payload.data?.id)
      if (Number.isSafeInteger(createdId)) setSelectedUserId(createdId)
      setNewStaffForm(emptyNewStaffForm)
      setShowNewStaff(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create staff account')
    } finally {
      setCreatingStaff(false)
    }
  }

  const updateActiveStatus = async () => {
    if (!selectedUser || selectedUserIsOwner) return
    const nextActive = !selectedUser.isActive
    if (!nextActive && !window.confirm(`Suspend staff access for ${selectedUser.fullName}?`)) return

    setUpdatingActive(true)
    setError(null)
    try {
      const response = await adminApiRequest(`/api/admin/access/users/${selectedUser.id}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextActive }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'Failed to update staff access')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update staff access')
    } finally {
      setUpdatingActive(false)
    }
  }

  const rolePermissions = useMemo(() => {
    const set = new Set<string>()
    for (const role of roles) {
      if (selectedRoles.includes(role.key)) {
        for (const permission of role.permissions) set.add(permission)
      }
    }
    for (const permission of allowPermissions) set.add(permission)
    for (const permission of denyPermissions) set.delete(permission)
    return set
  }, [allowPermissions, denyPermissions, roles, selectedRoles])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Staff Access</h2>
          <p className="text-sm text-gray-600">
            Assign staff access using clear presets. Member Portal access is managed from the linked member account, not as a staff role.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setNewStaffForm(emptyNewStaffForm)
            setShowNewStaff(true)
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-vortex-red px-4 py-2 text-sm font-medium text-white"
        >
          <UserPlus className="h-4 w-4" />
          New staff
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading access settings...
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(260px,360px)_1fr]">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <span className="font-semibold">Staff</span>
            </div>
            <div className="divide-y divide-gray-100 max-h-[640px] overflow-y-auto">
              {staffUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setSelectedUserId(user.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${
                    selectedUserId === user.id ? 'bg-red-50' : ''
                  }`}
                >
                  <div className="font-semibold text-gray-900">{user.fullName}</div>
                  <div className="text-xs text-gray-500">{user.email || user.username || 'No sign-in identifier'}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {normalizeAdminRoleSelection(user.roles).map(roleLabel).join(', ')} {!user.isActive ? '• Suspended' : ''}
                  </div>
                </button>
              ))}
              {staffUsers.length === 0 && (
                <p className="px-4 py-6 text-sm text-gray-500">No staff accounts found.</p>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-5">
            {selectedUser ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{selectedUser.fullName}</h3>
                    <p className="text-sm text-gray-500">
                      {selectedUser.email || selectedUser.username || 'No sign-in identifier'} • {selectedUser.isActive ? 'Staff access active' : 'Staff access suspended'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    {!selectedUserIsOwner && (
                      <button
                        type="button"
                        onClick={() => void updateActiveStatus()}
                        disabled={updatingActive}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 disabled:opacity-60"
                      >
                        {updatingActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                        {selectedUser.isActive ? 'Suspend access' : 'Restore access'}
                      </button>
                    )}
                    {canEditSelectedProfile ? (
                      <button
                        type="button"
                        onClick={() => void saveProfileAndAccess()}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-vortex-red text-white rounded-lg text-sm disabled:opacity-60"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {selectedUserIsOwner ? 'Save owner profile' : 'Save profile & access'}
                      </button>
                    ) : null}
                  </div>
                </div>

                {selectedUserIsOwner && (
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {canEditSelectedProfile
                      ? 'This is the permanent owner account. Its profile can change, but ownership and full access cannot be removed here.'
                      : 'This is the permanent owner account. Only the Owner can edit this profile; ownership and full access cannot be delegated or removed.'}
                  </p>
                )}

                <fieldset disabled={!canEditSelectedProfile} className="grid gap-3 sm:grid-cols-2 disabled:opacity-70">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">First name</label>
                    <input
                      type="text"
                      value={profileForm.firstName}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, firstName: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Last name</label>
                    <input
                      type="text"
                      value={profileForm.lastName}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, lastName: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, phone: formatPhoneNumber(e.target.value) }))
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder={PHONE_INPUT_PLACEHOLDER}
                      maxLength={PHONE_INPUT_MAX_LENGTH}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Username</label>
                    <input
                      type="text"
                      value={profileForm.username}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, username: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">New password</label>
                    <input
                      type="password"
                      value={profileForm.password}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="Leave blank to keep current"
                      minLength={8}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </fieldset>

                {!selectedUserIsOwner && (
                  <section>
                    <h4 className="font-semibold text-gray-900 mb-2">Staff access</h4>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {assignableRoleOrder.map((role) => (
                        <label key={role} className="flex items-start gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={selectedRoles.includes(role)}
                            onChange={() => toggleRole(role)}
                          />
                          <span>
                            <span className="block font-medium text-gray-900">{roleLabel(role)}</span>
                            {ROLE_DESCRIPTIONS[role] && (
                              <span className="block text-xs text-gray-500">{ROLE_DESCRIPTIONS[role]}</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </section>
                )}

                {!selectedUserIsOwner && (
                  <details className="rounded-lg border border-gray-200 bg-gray-50/60 p-4">
                    <summary className="cursor-pointer font-semibold text-gray-900">
                      Advanced custom access
                    </summary>
                    <p className="text-xs text-gray-500 mt-2 mb-3">
                      Presets should cover normal staff access. Use these exceptions only when a documented business need requires them.
                    </p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {permissions.map((permission) => (
                        <div key={permission.key} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm space-y-2">
                          <div>
                            <span className="block font-medium text-gray-900">{permission.key}</span>
                            {permission.description && <span className="block text-xs text-gray-500">{permission.description}</span>}
                          </div>
                          <div className="flex gap-4 text-xs">
                            <label className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={allowPermissions.includes(permission.key)}
                                onChange={() => togglePermission(permission.key)}
                              />
                              Allow
                            </label>
                            <label className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={denyPermissions.includes(permission.key)}
                                onChange={() => toggleDenyPermission(permission.key)}
                              />
                              Deny
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                    <h5 className="font-semibold text-gray-900 mt-4 mb-2">Effective permissions</h5>
                    <div className="flex flex-wrap gap-2">
                      {[...rolePermissions].sort().map((permission) => (
                        <span key={permission} className="rounded-full bg-white border border-gray-200 px-3 py-1 text-xs text-gray-700">
                          {permission}
                        </span>
                      ))}
                    </div>
                  </details>
                )}
              </>
            ) : (
              <p className="text-gray-500">Select an account to edit access.</p>
            )}
          </div>
        </div>
      )}

      {showNewStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-staff-title"
            className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 id="new-staff-title" className="text-lg font-bold text-gray-900">New staff account</h3>
                <p className="text-sm text-gray-500">Create an Administrator, Coach, or combined staff login.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewStaff(false)}
                aria-label="Close new staff dialog"
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-gray-700">
                First name
                <input
                  autoFocus
                  type="text"
                  value={newStaffForm.firstName}
                  onChange={(event) => setNewStaffForm((current) => ({ ...current, firstName: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs font-medium text-gray-700">
                Last name
                <input
                  type="text"
                  value={newStaffForm.lastName}
                  onChange={(event) => setNewStaffForm((current) => ({ ...current, lastName: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs font-medium text-gray-700">
                Email
                <input
                  type="email"
                  value={newStaffForm.email}
                  onChange={(event) => setNewStaffForm((current) => ({ ...current, email: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs font-medium text-gray-700">
                Phone
                <input
                  type="tel"
                  value={newStaffForm.phone}
                  onChange={(event) => setNewStaffForm((current) => ({ ...current, phone: formatPhoneNumber(event.target.value) }))}
                  maxLength={PHONE_INPUT_MAX_LENGTH}
                  placeholder={PHONE_INPUT_PLACEHOLDER}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs font-medium text-gray-700">
                Username
                <input
                  type="text"
                  value={newStaffForm.username}
                  onChange={(event) => setNewStaffForm((current) => ({ ...current, username: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs font-medium text-gray-700">
                Temporary password
                <input
                  type="password"
                  value={newStaffForm.password}
                  onChange={(event) => setNewStaffForm((current) => ({ ...current, password: event.target.value }))}
                  minLength={8}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <fieldset className="mt-4">
              <legend className="text-sm font-semibold text-gray-900">Staff access</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {assignableRoleOrder.map((role) => (
                  <label key={role} className="flex items-start gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={newStaffForm.roles.includes(role)}
                      onChange={() => setNewStaffForm((current) => ({
                        ...current,
                        roles: current.roles.includes(role)
                          ? current.roles.filter((entry) => entry !== role)
                          : [...current.roles, role],
                      }))}
                    />
                    <span>
                      <span className="block font-medium text-gray-900">{roleLabel(role)}</span>
                      <span className="block text-xs text-gray-500">{ROLE_DESCRIPTIONS[role]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewStaff(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void createStaff()}
                disabled={creatingStaff || newStaffForm.roles.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-vortex-red px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {creatingStaff && <Loader2 className="h-4 w-4 animate-spin" />}
                Create staff account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
