import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Edit2, X, Save, UserPlus } from 'lucide-react'
import { getApiUrl } from '../utils/api'

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
    password: ''
  })
  const [editingMyAccount, setEditingMyAccount] = useState(false)
  const [myAccountData, setMyAccountData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    username: '',
    password: ''
  })

  const fetchAdmins = useCallback(async () => {
    try {
      setAdminsLoading(true)
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/admins`)
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
      
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/admins/me?id=${adminId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setMyAccountData({
            firstName: data.data.firstName,
            lastName: data.data.lastName,
            email: data.data.email,
            phone: data.data.phone || '',
            username: data.data.username || '',
            password: ''
          })
          // Update adminInfo with the latest data including isMaster
          const updatedAdminInfo: AdminInfo = {
            email: data.data.email,
            name: `${data.data.firstName} ${data.data.lastName}`,
            id: data.data.id,
            firstName: data.data.firstName,
            lastName: data.data.lastName,
            phone: data.data.phone,
            username: data.data.username || '',
            isMaster: data.data.isMaster
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
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminFormData)
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
          password: ''
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

      const apiUrl = getApiUrl()
      const updateData: AdminUpdateData = {
        firstName: myAccountData.firstName,
        lastName: myAccountData.lastName,
        email: myAccountData.email,
        phone: myAccountData.phone || null,
        username: myAccountData.username
      }
      
      if (myAccountData.password) {
        updateData.password = myAccountData.password
      }

      const response = await fetch(`${apiUrl}/api/admin/admins/${adminId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Update localStorage with new info
          const updatedAdmin: AdminInfo = {
            email: data.data.email,
            name: `${data.data.firstName} ${data.data.lastName}`,
            id: data.data.id,
            firstName: data.data.firstName,
            lastName: data.data.lastName,
            phone: data.data.phone,
            username: data.data.username || '',
            isMaster: data.data.isMaster
          }
          localStorage.setItem('vortex-admin-info', JSON.stringify(updatedAdmin))
          setAdminInfo(updatedAdmin)
          // Close edit mode and refresh account data
          setEditingMyAccount(false)
          await fetchMyAccount()
        }
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to update account')
      }
    } catch (error) {
      console.error('Error updating account:', error)
      alert('Failed to update account')
    }
  }

  // Fetch admins and my account on mount
  useEffect(() => {
    fetchAdmins()
    fetchMyAccount()
  }, [fetchAdmins, fetchMyAccount])

  return (
    <>
      <motion.div
        key="admins"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200"
      >
        {/* My Account Section */}
        <div className="mb-8 bg-gray-50 rounded-lg p-6 border border-gray-200">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-black mb-4">
            My Account
          </h2>
          {editingMyAccount ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">First Name *</label>
                  <input
                    type="text"
                    value={myAccountData.firstName}
                    onChange={(e) => setMyAccountData({ ...myAccountData, firstName: e.target.value })}
                    className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Last Name *</label>
                  <input
                    type="text"
                    value={myAccountData.lastName}
                    onChange={(e) => setMyAccountData({ ...myAccountData, lastName: e.target.value })}
                    className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    value={myAccountData.email}
                    onChange={(e) => setMyAccountData({ ...myAccountData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={myAccountData.phone}
                    onChange={(e) => setMyAccountData({ ...myAccountData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Username *</label>
                  <input
                    type="text"
                    value={myAccountData.username}
                    onChange={(e) => setMyAccountData({ ...myAccountData, username: e.target.value })}
                    className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">New Password (leave blank to keep current)</label>
                  <input
                    type="password"
                    value={myAccountData.password}
                    onChange={(e) => setMyAccountData({ ...myAccountData, password: e.target.value })}
                    className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                    placeholder="Enter new password (optional)"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleUpdateMyAccount}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm font-medium"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
                <button
                  onClick={() => {
                    setEditingMyAccount(false)
                    fetchMyAccount()
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white text-sm font-medium"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="text-lg font-semibold text-black">{myAccountData.firstName} {myAccountData.lastName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="text-lg font-semibold text-black">{myAccountData.email}</p>
                </div>
                {myAccountData.phone && (
                  <div>
                    <p className="text-sm text-gray-600">Phone</p>
                    <p className="text-lg font-semibold text-black">{myAccountData.phone}</p>
                  </div>
                )}
                {myAccountData.username && (
                  <div>
                    <p className="text-sm text-gray-600">Username</p>
                    <p className="text-lg font-semibold text-black">{myAccountData.username}</p>
                  </div>
                )}
              </div>
              <button
                onClick={async () => {
                  // Ensure we have the latest account data before editing
                  await fetchMyAccount()
                  setEditingMyAccount(true)
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium mt-4"
              >
                <Edit2 className="w-4 h-4" />
                Edit My Account
              </button>
            </div>
          )}
        </div>

        {/* Admins Management Section */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-black">
            Admins ({admins.length})
          </h2>
          {adminInfo?.isMaster && (
            <motion.button
              onClick={() => setShowAdminForm(true)}
              className="flex items-center space-x-2 bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <UserPlus className="w-4 h-4" />
              <span>Create Admin</span>
            </motion.button>
          )}
        </div>

        {adminsLoading ? (
          <div className="text-center py-12 text-gray-600">Loading admins...</div>
        ) : admins.length === 0 ? (
          <div className="text-center py-12 text-gray-600">No admins yet</div>
        ) : (
          <div className="space-y-4">
            {admins.map((admin) => (
              <div key={admin.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-black font-semibold text-lg">
                        {admin.firstName} {admin.lastName}
                        {admin.isMaster && (
                          <span className="ml-2 text-xs bg-vortex-red text-white px-2 py-1 rounded">Master</span>
                        )}
                      </div>
                    </div>
                    <div className="text-gray-600 text-sm mt-1">{admin.email}</div>
                    {admin.phone && <div className="text-gray-600 text-sm">Phone: {admin.phone}</div>}
                    <div className="text-gray-600 text-sm">Username: {admin.username}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Create Admin Modal */}
      <AnimatePresence>
        {showAdminForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowAdminForm(false)}
            />
            <motion.div
              className="relative bg-gray-800 rounded-lg p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-display font-bold text-white">Create New Admin</h3>
                <button
                  onClick={() => setShowAdminForm(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">First Name *</label>
                    <input
                      type="text"
                      value={adminFormData.firstName}
                      onChange={(e) => setAdminFormData({ ...adminFormData, firstName: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Last Name *</label>
                    <input
                      type="text"
                      value={adminFormData.lastName}
                      onChange={(e) => setAdminFormData({ ...adminFormData, lastName: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Email *</label>
                    <input
                      type="email"
                      value={adminFormData.email}
                      onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Phone</label>
                    <input
                      type="tel"
                      value={adminFormData.phone}
                      onChange={(e) => setAdminFormData({ ...adminFormData, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Username *</label>
                    <input
                      type="text"
                      value={adminFormData.username}
                      onChange={(e) => setAdminFormData({ ...adminFormData, username: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Password *</label>
                    <input
                      type="password"
                      value={adminFormData.password}
                      onChange={(e) => setAdminFormData({ ...adminFormData, password: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={handleCreateAdmin}
                    className="flex-1 bg-vortex-red hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition-colors"
                  >
                    Create Admin
                  </button>
                  <button
                    onClick={() => setShowAdminForm(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

