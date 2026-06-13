import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Edit2, Loader2, Save, Shield, UserPlus, X } from 'lucide-react'
import { adminApiRequest } from '../utils/api'

interface AdminInfo {
  email: string
  name: string
  id?: number
  firstName?: string
  lastName?: string
  phone?: string
  username?: string
  isMaster?: boolean
}

interface AdminData {
  id: number
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  username: string
  isMaster: boolean
  createdAt: string
  updatedAt: string
}

interface AdminUpdateData {
  firstName: string
  lastName: string
  email: string
  phone: string | null
  username: string
  password?: string
}

interface AdminAdminsProps {
  adminInfo: AdminInfo | null
  setAdminInfo: (info: AdminInfo | null) => void
}

const iconBtn =
  'p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none'
const thClass = 'py-3 pr-4 font-semibold whitespace-nowrap'
const tdClass = 'py-3 pr-4 align-middle whitespace-nowrap'

function adminCategoryLabel(isMaster: boolean): string {
  return isMaster ? 'Master' : 'Admin'
}

export default function AdminAdmins({ adminInfo, setAdminInfo }: AdminAdminsProps) {
  const [admins, setAdmins] = useState<AdminData[]>([])
  const [adminsLoading, setAdminsLoading] = useState(false)
  const [showAdminForm, setShowAdminForm] = useState(false)
  const [adminFormData, setAdminFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    username: '',
    password: '',
  })
  const [editingMyAccount, setEditingMyAccount] = useState(false)
  const [myAccountData, setMyAccountData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    username: '',
    password: '',
  })
  const [savingAccount, setSavingAccount] = useState(false)

  const fetchAdmins = useCallback(async () => {
    try {
      setAdminsLoading(true)
      const response = await adminApiRequest('/api/admin/admins')
      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}: ${response.statusText}`)
      }
      const data = await response.json()
      if (data.success) {
        setAdmins(data.data)
      }
    } catch (error) {
      console.error('Error fetching admins:', error)
    } finally {
      setAdminsLoading(false)
    }
  }, [])

  const fetchMyAccount = useCallback(async () => {
    try {
      const adminId = localStorage.getItem('vortex-admin-id')
      if (!adminId) return

      const response = await adminApiRequest(`/api/admin/admins/me?id=${adminId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setMyAccountData({
            firstName: data.data.firstName,
            lastName: data.data.lastName,
            email: data.data.email,
            phone: data.data.phone || '',
            username: data.data.username || '',
            password: '',
          })
          const updatedAdminInfo: AdminInfo = {
            email: data.data.email,
            name: `${data.data.firstName} ${data.data.lastName}`,
            id: data.data.id,
            firstName: data.data.firstName,
            lastName: data.data.lastName,
            phone: data.data.phone,
            username: data.data.username || '',
            isMaster: data.data.isMaster,
          }
          setAdminInfo(updatedAdminInfo)
          localStorage.setItem('vortex-admin-info', JSON.stringify(updatedAdminInfo))
        }
      }
    } catch (error) {
      console.error('Error fetching my account:', error)
    }
  }, [setAdminInfo])

  const handleCreateAdmin = async () => {
    try {
      const response = await adminApiRequest('/api/admin/admins', {
        method: 'POST',
        body: JSON.stringify(adminFormData),
      })

      if (response.ok) {
        await fetchAdmins()
        setShowAdminForm(false)
        setAdminFormData({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          username: '',
          password: '',
        })
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to create admin')
      }
    } catch (error) {
      console.error('Error creating admin:', error)
      alert('Failed to create admin')
    }
  }

  const handleUpdateMyAccount = async () => {
    try {
      const adminId = localStorage.getItem('vortex-admin-id')
      if (!adminId) return

      setSavingAccount(true)
      const updateData: AdminUpdateData = {
        firstName: myAccountData.firstName,
        lastName: myAccountData.lastName,
        email: myAccountData.email,
        phone: myAccountData.phone || null,
        username: myAccountData.username,
      }

      if (myAccountData.password) {
        updateData.password = myAccountData.password
      }

      const response = await adminApiRequest(`/api/admin/admins/${adminId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          const updatedAdmin: AdminInfo = {
            email: data.data.email,
            name: `${data.data.firstName} ${data.data.lastName}`,
            id: data.data.id,
            firstName: data.data.firstName,
            lastName: data.data.lastName,
            phone: data.data.phone,
            username: data.data.username || '',
            isMaster: data.data.isMaster,
          }
          localStorage.setItem('vortex-admin-info', JSON.stringify(updatedAdmin))
          setAdminInfo(updatedAdmin)
          setEditingMyAccount(false)
          await fetchMyAccount()
          await fetchAdmins()
        }
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to update account')
      }
    } catch (error) {
      console.error('Error updating account:', error)
      alert('Failed to update account')
    } finally {
      setSavingAccount(false)
    }
  }

  useEffect(() => {
    fetchAdmins()
    fetchMyAccount()
  }, [fetchAdmins, fetchMyAccount])

  const myAccountId = adminInfo?.id ?? Number(localStorage.getItem('vortex-admin-id') || 0)

  const renderAdminRow = (admin: {
    id: number
    firstName: string
    lastName: string
    email: string
    phone?: string | null
    username: string
    isMaster: boolean
  }, options?: { showEdit?: boolean }) => (
    <tr key={admin.id} className="border-b border-gray-100 hover:bg-gray-50/80">
      <td className={tdClass}>{admin.lastName}</td>
      <td className={tdClass}>{admin.firstName}</td>
      <td className={tdClass}>
        <span
          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
            admin.isMaster ? 'bg-vortex-red/10 text-vortex-red' : 'bg-gray-100 text-gray-700'
          }`}
        >
          {adminCategoryLabel(admin.isMaster)}
        </span>
      </td>
      <td className={tdClass}>{admin.username || '—'}</td>
      <td className={tdClass}>{admin.email}</td>
      <td className={tdClass}>{admin.phone || '—'}</td>
      <td className={`${tdClass} w-0`}>
        {options?.showEdit ? (
          <button
            type="button"
            className={iconBtn}
            title="Edit account"
            aria-label="Edit account"
            onClick={async () => {
              await fetchMyAccount()
              setEditingMyAccount(true)
            }}
          >
            <Edit2 className="w-4 h-4" />
          </button>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
    </tr>
  )

  const adminTableHead = (
    <thead>
      <tr className="border-b border-gray-200 text-left text-gray-600 text-sm">
        <th className={thClass}>Last name</th>
        <th className={thClass}>First name</th>
        <th className={thClass}>Category</th>
        <th className={thClass}>Username</th>
        <th className={thClass}>Email</th>
        <th className={thClass}>Phone</th>
        <th className={thClass}>Actions</th>
      </tr>
    </thead>
  )

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="w-7 h-7 text-vortex-red" />
          Admins
        </h2>
        <p className="text-gray-600 text-sm mt-1">
          Manage admin accounts and update your own login credentials.
        </p>
      </div>

      <section className="space-y-4">
        <h3 className="text-lg font-bold text-black">My account</h3>
        <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
          <table className="w-full text-sm border-collapse min-w-[720px]">
            {adminTableHead}
            <tbody>
              {myAccountData.firstName || myAccountData.lastName ? (
                renderAdminRow(
                  {
                    id: myAccountId,
                    firstName: myAccountData.firstName,
                    lastName: myAccountData.lastName,
                    email: myAccountData.email,
                    phone: myAccountData.phone,
                    username: myAccountData.username,
                    isMaster: Boolean(adminInfo?.isMaster),
                  },
                  { showEdit: true },
                )
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    Loading account…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="text-lg font-bold text-black">All admins ({admins.length})</h3>
          {adminInfo?.isMaster && (
            <button
              type="button"
              onClick={() => setShowAdminForm(true)}
              className="inline-flex items-center gap-2 bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 shrink-0"
            >
              <UserPlus className="w-5 h-5" />
              New admin
            </button>
          )}
        </div>

        {adminsLoading ? (
          <div className="py-12 text-center text-gray-500 inline-flex items-center gap-2 w-full justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading admins…
          </div>
        ) : admins.length === 0 ? (
          <div className="py-12 text-center text-gray-500 border border-dashed rounded-xl">
            No admins yet.
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
            <table className="w-full text-sm border-collapse min-w-[720px]">
              {adminTableHead}
              <tbody>{admins.map((admin) => renderAdminRow(admin))}</tbody>
            </table>
          </div>
        )}
      </section>

      <AnimatePresence>
        {editingMyAccount && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          >
            <motion.div
              className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h3 className="text-xl font-bold">Edit my account</h3>
                <button
                  type="button"
                  onClick={() => {
                    setEditingMyAccount(false)
                    fetchMyAccount()
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First name *</label>
                    <input
                      type="text"
                      value={myAccountData.firstName}
                      onChange={(e) => setMyAccountData({ ...myAccountData, firstName: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last name *</label>
                    <input
                      type="text"
                      value={myAccountData.lastName}
                      onChange={(e) => setMyAccountData({ ...myAccountData, lastName: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      value={myAccountData.email}
                      onChange={(e) => setMyAccountData({ ...myAccountData, email: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={myAccountData.phone}
                      onChange={(e) => setMyAccountData({ ...myAccountData, phone: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                    <input
                      type="text"
                      value={myAccountData.username}
                      onChange={(e) => setMyAccountData({ ...myAccountData, username: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New password (optional)
                    </label>
                    <input
                      type="password"
                      value={myAccountData.password}
                      onChange={(e) => setMyAccountData({ ...myAccountData, password: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="Leave blank to keep current"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50">
                <button
                  type="button"
                  onClick={() => {
                    setEditingMyAccount(false)
                    fetchMyAccount()
                  }}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateMyAccount}
                  disabled={savingAccount}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-vortex-red text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-60"
                >
                  {savingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAdminForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          >
            <motion.div
              className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h3 className="text-xl font-bold">Create new admin</h3>
                <button
                  type="button"
                  onClick={() => setShowAdminForm(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First name *</label>
                    <input
                      type="text"
                      value={adminFormData.firstName}
                      onChange={(e) => setAdminFormData({ ...adminFormData, firstName: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last name *</label>
                    <input
                      type="text"
                      value={adminFormData.lastName}
                      onChange={(e) => setAdminFormData({ ...adminFormData, lastName: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      value={adminFormData.email}
                      onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={adminFormData.phone}
                      onChange={(e) => setAdminFormData({ ...adminFormData, phone: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                    <input
                      type="text"
                      value={adminFormData.username}
                      onChange={(e) => setAdminFormData({ ...adminFormData, username: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                    <input
                      type="password"
                      value={adminFormData.password}
                      onChange={(e) => setAdminFormData({ ...adminFormData, password: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50">
                <button
                  type="button"
                  onClick={() => setShowAdminForm(false)}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateAdmin}
                  className="px-4 py-2 text-sm bg-vortex-red text-white rounded-lg font-semibold hover:bg-red-700"
                >
                  Create admin
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
