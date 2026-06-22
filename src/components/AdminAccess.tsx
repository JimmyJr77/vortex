import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, Loader2, Save, Trash2, UserPlus } from 'lucide-react'
import { adminApiRequest } from '../utils/api'

interface AccessUser {
  id: number
  email: string
  fullName: string
  phone?: string | null
  username?: string | null
  roles: string[]
  isActive: boolean
  isMasterAdmin: boolean
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

const roleOrder = ['MASTER_ADMIN', 'ADMIN', 'COACH', 'MEMBER_ATHLETE']

const ROLE_LABELS: Record<string, string> = {
  MASTER_ADMIN: 'Master Admin',
  ADMIN: 'Admin',
  COACH: 'Coach',
  MEMBER_ATHLETE: 'Member / Athlete',
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  MASTER_ADMIN: 'Full control over everything. Cannot be limited.',
  ADMIN: 'Full admin access. Master admins can apply limits below.',
  COACH: 'Access to the coaching portal.',
  MEMBER_ATHLETE: 'Logged-in account that registers themselves or family for classes.',
}

const roleLabel = (role: string) => ROLE_LABELS[role] ?? role.replaceAll('_', ' ')

/** Master Admin and Admin are mutually exclusive admin tiers. */
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

function normalizeAdminRoleSelection(roles: string[]): string[] {
  if (roles.includes('MASTER_ADMIN') && roles.includes('ADMIN')) {
    return roles.filter((role) => role !== 'ADMIN')
  }
  return roles
}

interface AdminAccessProps {
  isMasterAdmin?: boolean
  currentUserId?: number | null
}

export default function AdminAccess({ isMasterAdmin = false, currentUserId = null }: AdminAccessProps) {
  const [users, setUsers] = useState<AccessUser[]>([])
  const [roles, setRoles] = useState<AccessRole[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [allowPermissions, setAllowPermissions] = useState<string[]>([])
  const [denyPermissions, setDenyPermissions] = useState<string[]>([])
  const [showCreateAccount, setShowCreateAccount] = useState(false)
  const [createAccount, setCreateAccount] = useState({
    fullName: '',
    email: '',
    username: '',
    phone: '',
    password: '',
    roles: ['MEMBER_ATHLETE'],
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    username: '',
    password: '',
  })
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) ?? null,
    [selectedUserId, users],
  )

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
      setUsers(nextUsers)
      setRoles(rolesJson.data?.roles ?? [])
      setPermissions(rolesJson.data?.permissions ?? [])
      const initial = selectedUserId ?? nextUsers[0]?.id ?? null
      setSelectedUserId(initial)
      const currentUser = nextUsers.find((u) => u.id === initial)
      setSelectedRoles(normalizeAdminRoleSelection(currentUser?.roles ?? []))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load access settings')
    } finally {
      setLoading(false)
    }
  }, [selectedUserId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (selectedUser) {
      setSelectedRoles(normalizeAdminRoleSelection(selectedUser.roles))
      setProfileForm({
        fullName: selectedUser.fullName,
        email: selectedUser.email,
        phone: selectedUser.phone ?? '',
        username: selectedUser.username ?? '',
        password: '',
      })
      const loadOverrides = async () => {
        try {
          const res = await adminApiRequest(`/api/admin/access/users/${selectedUser.id}/permissions`)
          if (!res.ok) return
          const json = await res.json()
          setAllowPermissions(json.data?.allow ?? [])
          setDenyPermissions(json.data?.deny ?? [])
        } catch (err) {
          console.warn('Unable to load permission overrides:', err)
          setAllowPermissions([])
          setDenyPermissions([])
        }
      }
      void loadOverrides()
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
    if (!selectedUserId) return
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, string> = {
        fullName: profileForm.fullName.trim(),
        email: profileForm.email.trim(),
        phone: profileForm.phone.trim(),
        username: profileForm.username.trim(),
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

      setProfileForm((prev) => ({ ...prev, password: '' }))
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile and access settings')
    } finally {
      setSaving(false)
    }
  }

  const createNewAccount = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await adminApiRequest('/api/admin/access/users', {
        method: 'POST',
        body: JSON.stringify(createAccount),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to create account')
      }
      setCreateAccount({ fullName: '', email: '', username: '', phone: '', password: '', roles: ['MEMBER_ATHLETE'] })
      setShowCreateAccount(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account')
    } finally {
      setSaving(false)
    }
  }

  const setAccountActive = async (userId: number, isActive: boolean) => {
    if (!isActive && !confirm('Archive this account? They will lose login access until unarchived.')) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await adminApiRequest(`/api/admin/access/users/${userId}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to update account status')
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account status')
    } finally {
      setSaving(false)
    }
  }

  const deleteAccount = async () => {
    if (!selectedUserId || deleteConfirmText.toLowerCase().trim() !== 'delete') {
      alert('Please type "delete" to confirm permanent deletion')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await adminApiRequest(`/api/admin/access/users/${selectedUserId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to delete account')
      }
      setDeleteConfirmOpen(false)
      setDeleteConfirmText('')
      setSelectedUserId(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account')
    } finally {
      setSaving(false)
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
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Access Control</h2>
        <p className="text-sm text-gray-600">
          Master admins have all permissions. Admins and coaches inherit permissions from roles, with optional user-specific grants.
        </p>
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
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
              <span className="font-semibold">Accounts</span>
              <button
                type="button"
                onClick={() => setShowCreateAccount((value) => !value)}
                className="inline-flex items-center gap-1 text-xs bg-vortex-red text-white px-2 py-1 rounded-lg"
              >
                <UserPlus className="w-3 h-3" />
                New
              </button>
            </div>
            {showCreateAccount && (
              <div className="p-4 border-b border-gray-100 space-y-3 bg-gray-50">
                <input
                  type="text"
                  value={createAccount.fullName}
                  onChange={(e) => setCreateAccount((prev) => ({ ...prev, fullName: e.target.value }))}
                  placeholder="Full name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="email"
                  value={createAccount.email}
                  onChange={(e) => setCreateAccount((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="Email"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={createAccount.username}
                  onChange={(e) => setCreateAccount((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder="Username"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="tel"
                  value={createAccount.phone}
                  onChange={(e) => setCreateAccount((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Phone"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="password"
                  value={createAccount.password}
                  onChange={(e) => setCreateAccount((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="Temporary password"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  {roleOrder.map((role) => (
                    <label key={role} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={createAccount.roles.includes(role)}
                        onChange={() =>
                          setCreateAccount((prev) => ({
                            ...prev,
                            roles: applyRoleToggle(prev.roles, role),
                          }))
                        }
                      />
                      {roleLabel(role)}
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void createNewAccount()}
                  disabled={saving}
                  className="w-full bg-vortex-red text-white rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  Create Account
                </button>
              </div>
            )}
            <div className="divide-y divide-gray-100 max-h-[640px] overflow-y-auto">
              {users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setSelectedUserId(user.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${
                    selectedUserId === user.id ? 'bg-red-50' : ''
                  }`}
                >
                  <div className="font-semibold text-gray-900">{user.fullName}</div>
                  <div className="text-xs text-gray-500">{user.email}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {user.roles.map(roleLabel).join(', ')} {!user.isActive ? '• Inactive' : ''}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-5">
            {selectedUser ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{selectedUser.fullName}</h3>
                    <p className="text-sm text-gray-500">
                      {selectedUser.email} • {selectedUser.isActive ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => void setAccountActive(selectedUser.id, !selectedUser.isActive)}
                      disabled={saving || selectedUser.id === currentUserId}
                      className="inline-flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-60"
                    >
                      <Archive className="w-4 h-4" />
                      {selectedUser.isActive ? 'Archive' : 'Unarchive'}
                    </button>
                    {isMasterAdmin && selectedUser.id !== currentUserId && (
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteConfirmOpen(true)
                          setDeleteConfirmText('')
                        }}
                        disabled={saving}
                        className="inline-flex items-center gap-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-60"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void saveProfileAndAccess()}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-vortex-red text-white rounded-lg text-sm disabled:opacity-60"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Profile & Access
                    </button>
                  </div>
                </div>

                <section className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Full name</label>
                    <input
                      type="text"
                      value={profileForm.fullName}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, fullName: e.target.value }))}
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
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </section>

                <section>
                  <h4 className="font-semibold text-gray-900 mb-2">Roles</h4>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {roleOrder.map((role) => (
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

                <section>
                  <h4 className="font-semibold text-gray-900 mb-2">Permission Overrides &amp; Limits</h4>
                  <p className="text-xs text-gray-500 mb-2">
                    Use <span className="font-medium">Deny</span> to limit what an admin can do, or <span className="font-medium">Allow</span> to grant an extra permission beyond their role. Master admins are never limited.
                  </p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {permissions.map((permission) => (
                      <div key={permission.key} className="rounded-lg border border-gray-200 px-3 py-2 text-sm space-y-2">
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
                </section>

                <section>
                  <h4 className="font-semibold text-gray-900 mb-2">Effective Permissions</h4>
                  <div className="flex flex-wrap gap-2">
                    {[...rolePermissions].sort().map((permission) => (
                      <span key={permission} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                        {permission}
                      </span>
                    ))}
                  </div>
                </section>
              </>
            ) : (
              <p className="text-gray-500">Select an account to edit access.</p>
            )}
          </div>
        </div>
      )}

      {deleteConfirmOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Delete Account</h2>
            <p className="text-gray-700 mb-4">
              Permanently delete <strong>{selectedUser.fullName}</strong>? This removes their login,
              linked member record, coach assignments, and access settings. This cannot be undone.
            </p>
            <p className="text-gray-600 mb-4 text-sm">
              Type <strong>delete</strong> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void deleteAccount()}
                disabled={deleteConfirmText.toLowerCase().trim() !== 'delete' || saving}
                className="flex-1 px-4 py-2 rounded-lg font-semibold bg-red-600 text-white disabled:opacity-50"
              >
                Delete Permanently
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmOpen(false)
                  setDeleteConfirmText('')
                }}
                className="flex-1 px-4 py-2 rounded-lg font-semibold bg-gray-200 text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
