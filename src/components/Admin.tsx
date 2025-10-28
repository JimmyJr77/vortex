import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, RefreshCw, Download, Edit2, Archive, X, Save, ArrowUpDown } from 'lucide-react'

interface AdminProps {
  onLogout: () => void
}

interface User {
  id: number
  first_name: string
  last_name: string
  email: string
  phone: string | null
  athlete_age: number | null
  interests: string | null
  message: string | null
  created_at: string
  newsletter: boolean
  archived?: boolean
}

export default function Admin({ onLogout }: AdminProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editData, setEditData] = useState<Partial<User>>({})
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' }>({ field: 'created_at', direction: 'desc' })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      
      // Fetch registrations
      const regResponse = await fetch(`${apiUrl}/api/admin/registrations`)
      const regData = await regResponse.json()
      
      // Fetch newsletter subscribers
      const newsResponse = await fetch(`${apiUrl}/api/admin/newsletter`)
      const newsData = await newsResponse.json()
      
      if (regData.success && newsData.success) {
        // Create a set of newsletter subscriber emails
        const newsletterEmails = new Set(newsData.data.map((sub: any) => sub.email))
        
        // Combine registrations with newsletter status
        const combinedUsers = regData.data.map((user: any) => ({
          ...user,
          newsletter: newsletterEmails.has(user.email)
        }))
        
        setUsers(combinedUsers)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (field: string) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const sortedUsers = [...users].sort((a, b) => {
    const aValue = a[sortConfig.field as keyof User]
    const bValue = b[sortConfig.field as keyof User]
    
    if (aValue === null || aValue === undefined) return 1
    if (bValue === null || bValue === undefined) return -1
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortConfig.direction === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    }
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
    }
    
    return 0
  })

  const startEdit = (user: User) => {
    setEditingId(user.id)
    setEditData({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone,
      athlete_age: user.athlete_age,
      interests: user.interests,
      message: user.message
    })
  }

  const saveEdit = async () => {
    if (!editingId) return
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const response = await fetch(`${apiUrl}/api/admin/registrations/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      })
      
      if (response.ok) {
        await fetchData()
        setEditingId(null)
        setEditData({})
      }
    } catch (error) {
      console.error('Error updating user:', error)
      alert('Failed to update user')
    }
  }

  const handleArchive = async (id: number) => {
    if (!confirm('Archive this user?')) return
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const response = await fetch(`${apiUrl}/api/admin/registrations/${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        await fetchData()
      }
    } catch (error) {
      console.error('Error archiving user:', error)
      alert('Failed to archive user')
    }
  }

  const exportToCSV = () => {
    if (users.length === 0) return

    const headers = ['Name', 'Email', 'Phone', 'Age', 'Interests', 'Newsletter', 'Date']
    const csv = [
      headers.join(','),
      ...users.map(user => [
        `"${user.first_name} ${user.last_name}"`,
        user.email,
        user.phone || '',
        user.athlete_age || '',
        user.interests || '',
        user.newsletter ? 'Yes' : 'No',
        new Date(user.created_at).toLocaleDateString()
      ].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'vortex_master_roster.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const SortableHeader = ({ field, label }: { field: string; label: string }) => (
    <th 
      className="py-3 px-2 md:px-4 text-xs md:text-sm cursor-pointer hover:bg-gray-600 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{label}</span>
        {sortConfig.field === field && (
          <ArrowUpDown className={`w-3 h-3 ${sortConfig.direction === 'asc' ? '' : 'rotate-180'}`} />
        )}
      </div>
    </th>
  )

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-8">
      <div className="max-w-full mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl md:text-5xl font-display font-bold text-white text-center md:text-left">
            VORTEX <span className="text-vortex-red">ADMIN</span>
          </h1>
          <div className="flex gap-2">
            <motion.button
              onClick={fetchData}
              className="flex items-center space-x-2 bg-gray-700 text-white px-3 md:px-4 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors text-sm"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden md:inline">Refresh</span>
            </motion.button>
            <motion.button
              onClick={exportToCSV}
              className="flex items-center space-x-2 bg-gray-700 text-white px-3 md:px-4 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors text-sm"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">Export</span>
            </motion.button>
            <motion.button
              onClick={onLogout}
              className="flex items-center space-x-2 bg-vortex-red text-white px-3 md:px-6 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors text-sm"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </motion.button>
          </div>
        </div>

        {/* Master Roster Section */}
        <div className="bg-gray-800 p-4 md:p-6 rounded-lg shadow-lg">
          <div className="mb-4 md:mb-6">
            <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-2">
              Master Roster ({users.length})
            </h2>
            <p className="text-gray-400 text-sm">All registered users with newsletter subscription status</p>
          </div>

          <div className="overflow-x-auto -mx-4 px-4">
            <table className="min-w-full bg-gray-700 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-600 text-left text-gray-200 uppercase text-xs">
                  <SortableHeader field="last_name" label="Name" />
                  <SortableHeader field="email" label="Email" />
                  <SortableHeader field="phone" label="Phone" />
                  <SortableHeader field="athlete_age" label="Age" />
                  <SortableHeader field="interests" label="Interest" />
                  <SortableHeader field="newsletter" label="Newsletter" />
                  <SortableHeader field="created_at" label="Date" />
                  <th className="py-3 px-2 text-xs">Actions</th>
                </tr>
              </thead>
              <tbody className="text-gray-300 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-4 text-center">Loading...</td>
                  </tr>
                ) : sortedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-4 text-center">No registrations yet</td>
                  </tr>
                ) : (
                  sortedUsers.map((user) => (
                    <AnimatePresence key={user.id}>
                      {editingId === user.id ? (
                        <motion.tr
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="border-b border-gray-700 bg-gray-600"
                        >
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={editData.first_name || ''}
                              onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                              className="w-full px-2 py-1 bg-gray-700 text-white rounded text-xs"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={editData.last_name || ''}
                              onChange={(e) => setEditData({ ...editData, last_name: e.target.value })}
                              className="w-full px-2 py-1 bg-gray-700 text-white rounded text-xs"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="email"
                              value={editData.email || ''}
                              onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                              className="w-full px-2 py-1 bg-gray-700 text-white rounded text-xs"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="tel"
                              value={editData.phone || ''}
                              onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                              className="w-full px-2 py-1 bg-gray-700 text-white rounded text-xs"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              value={editData.athlete_age || ''}
                              onChange={(e) => setEditData({ ...editData, athlete_age: parseInt(e.target.value) })}
                              className="w-full px-2 py-1 bg-gray-700 text-white rounded text-xs"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={editData.interests || ''}
                              onChange={(e) => setEditData({ ...editData, interests: e.target.value })}
                              className="w-full px-2 py-1 bg-gray-700 text-white rounded text-xs"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span className={user.newsletter ? 'text-green-400' : 'text-gray-500'}>
                              {user.newsletter ? '✓' : '✗'}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center whitespace-nowrap">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex gap-1">
                              <button
                                onClick={saveEdit}
                                className="p-1 bg-green-600 hover:bg-green-700 rounded text-white"
                                title="Save"
                              >
                                <Save className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => { setEditingId(null); setEditData({}) }}
                                className="p-1 bg-gray-600 hover:bg-gray-700 rounded text-white"
                                title="Cancel"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ) : (
                        <motion.tr
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="border-b border-gray-700 hover:bg-gray-700"
                        >
                          <td className="py-2 px-2">{user.first_name} {user.last_name}</td>
                          <td className="py-2 px-2 break-all">{user.email}</td>
                          <td className="py-2 px-2">{user.phone || '-'}</td>
                          <td className="py-2 px-2">{user.athlete_age || '-'}</td>
                          <td className="py-2 px-2">{user.interests || '-'}</td>
                          <td className="py-2 px-2 text-center">
                            <span className={user.newsletter ? 'text-green-400' : 'text-gray-500'}>
                              {user.newsletter ? '✓' : '✗'}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center whitespace-nowrap">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex gap-1">
                              <button
                                onClick={() => startEdit(user)}
                                className="p-1 bg-blue-600 hover:bg-blue-700 rounded text-white"
                                title="Edit"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleArchive(user.id)}
                                className="p-1 bg-red-600 hover:bg-red-700 rounded text-white"
                                title="Archive"
                              >
                                <Archive className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
