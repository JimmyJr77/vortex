import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, RefreshCw, Download, Edit2, Archive, X, Save, ChevronDown, ChevronUp } from 'lucide-react'

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

type FilterType = 'all' | 'newsletter' | 'interests'

export default function Admin({ onLogout }: AdminProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editData, setEditData] = useState<Partial<User>>({})
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' }>({ field: 'created_at', direction: 'desc' })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      
      const regResponse = await fetch(`${apiUrl}/api/admin/registrations`)
      if (!regResponse.ok) {
        throw new Error(`Backend returned ${regResponse.status}: ${regResponse.statusText}`)
      }
      const regData = await regResponse.json()
      
      const newsResponse = await fetch(`${apiUrl}/api/admin/newsletter`)
      if (!newsResponse.ok) {
        throw new Error(`Backend returned ${newsResponse.status}: ${newsResponse.statusText}`)
      }
      const newsData = await newsResponse.json()
      
      if (regData.success && newsData.success) {
        const newsletterEmails = new Set(newsData.data.map((sub: any) => sub.email))
        
        const combinedUsers = regData.data.map((user: any) => ({
          ...user,
          newsletter: newsletterEmails.has(user.email)
        }))
        
        setUsers(combinedUsers)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      setError(error instanceof Error ? error.message : 'Unable to connect to backend. Please check if the backend service is running on Render.')
    } finally {
      setLoading(false)
    }
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

  // Filter users based on filter selection
  const filteredUsers = sortedUsers.filter(user => {
    if (filter === 'all') return true
    if (filter === 'newsletter') return user.newsletter
    if (filter === 'interests') return !!user.interests
    return true
  })

  const handleSort = (field: string) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id)
    setEditingId(null)
  }

  const startEdit = (e: React.MouseEvent, user: User) => {
    e.stopPropagation()
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

  const saveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation()
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

  const handleArchive = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
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

  const handleExportClick = () => {
    setShowExportDialog(true)
  }

  const exportToCSV = (exportNewsletter: boolean, exportInterests: boolean) => {
    const headers = ['Name', 'Email', 'Phone', 'Age', 'Interests', 'Newsletter', 'Date']
    
    const dataToExport = users.filter(user => {
      if (exportNewsletter && exportInterests) return user.newsletter || !!user.interests
      if (exportNewsletter) return user.newsletter
      if (exportInterests) return !!user.interests
      return true
    })
    
    if (dataToExport.length === 0) {
      alert('No users match the selected criteria')
      return
    }

    const csv = [
      headers.join(','),
      ...dataToExport.map(user => [
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
    a.download = 'vortex_roster.csv'
    a.click()
    URL.revokeObjectURL(url)
    setShowExportDialog(false)
  }

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
              onClick={handleExportClick}
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

        <div className="bg-gray-800 p-4 md:p-6 rounded-lg shadow-lg">
          <div className="mb-4 md:mb-6">
            <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-4">
              Master Roster ({filteredUsers.length} of {users.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                  filter === 'all'
                    ? 'bg-vortex-red text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                All Users ({users.length})
              </button>
              <button
                onClick={() => setFilter('newsletter')}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                  filter === 'newsletter'
                    ? 'bg-vortex-red text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Newsletter ({users.filter(u => u.newsletter).length})
              </button>
              <button
                onClick={() => setFilter('interests')}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                  filter === 'interests'
                    ? 'bg-vortex-red text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Interested ({users.filter(u => u.interests).length})
              </button>
            </div>
          </div>

          {error ? (
            <div className="text-center py-12">
              <div className="text-red-400 mb-4 font-semibold">Backend Connection Error</div>
              <div className="text-gray-400 mb-4">{error}</div>
              <button
                onClick={fetchData}
                className="bg-vortex-red hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
              >
                Retry
              </button>
            </div>
          ) : loading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No users match the selected filter</div>
          ) : (
            <div className="space-y-2">
              {/* Column Headers */}
              <div className="hidden md:flex items-center bg-gray-600 px-3 py-2 rounded-t-lg">
                <button 
                  onClick={() => handleSort('created_at')}
                  className="px-3 py-3 flex-1 min-w-[80px] text-xs text-gray-300 font-semibold text-left hover:text-white transition-colors"
                >
                  Date {sortConfig.field === 'created_at' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </button>
                <button 
                  onClick={() => handleSort('last_name')}
                  className="px-3 py-3 flex-1 min-w-[100px] text-xs text-gray-300 font-semibold text-left hover:text-white transition-colors"
                >
                  Last Name {sortConfig.field === 'last_name' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </button>
                <button 
                  onClick={() => handleSort('first_name')}
                  className="px-3 py-3 flex-1 min-w-[100px] text-xs text-gray-300 font-semibold text-left hover:text-white transition-colors"
                >
                  First Name {sortConfig.field === 'first_name' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </button>
                <div className="px-3 py-3 w-12 md:w-16 text-xs text-gray-300 font-semibold text-center">Newsletter</div>
                <div className="w-8"></div>
                <div className="px-3 py-3 w-12 md:w-16 text-xs text-gray-300 font-semibold text-center">Interested</div>
              </div>
              {filteredUsers.map((user) => (
                <div key={user.id} className="bg-gray-700 rounded-lg overflow-hidden">
                  {/* Header Row - Always Visible */}
                  <div 
                    className="flex items-center cursor-pointer hover:bg-gray-600 transition-colors"
                    onClick={() => toggleExpand(user.id)}
                  >
                    {/* Date */}
                    <div className="px-3 py-3 flex-1 min-w-[80px] text-xs md:text-sm text-gray-300">
                      {new Date(user.created_at).toLocaleDateString()}
                    </div>
                    
                    {/* Last Name */}
                    <div className="px-3 py-3 flex-1 min-w-[100px] text-xs md:text-sm text-white font-medium">
                      {user.last_name}
                    </div>
                    
                    {/* First Name */}
                    <div className="px-3 py-3 flex-1 min-w-[100px] text-xs md:text-sm text-white font-medium">
                      {user.first_name}
                    </div>
                    
                    {/* Newsletter Checkmark */}
                    <div className="px-3 py-3 w-12 md:w-16 text-center">
                      {user.newsletter && (
                        <span className="inline-flex items-center justify-center w-5 h-5 bg-green-600 rounded-full">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </div>
                    
                    {/* Spacer */}
                    <div className="w-8"></div>
                    
                    {/* Interest Checkmark */}
                    <div className="px-3 py-3 w-12 md:w-16 text-center">
                      {user.interests && (
                        <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-600 rounded-full">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </div>
                    
                    {/* Expand/Collapse Icon */}
                    <div className="px-3 py-3">
                      {expandedId === user.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {expandedId === user.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-2 border-t border-gray-600">
                          {editingId === user.id ? (
                            // Edit Mode
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs text-gray-400 block mb-1">First Name</label>
                                  <input
                                    type="text"
                                    value={editData.first_name || ''}
                                    onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-800 text-white rounded text-sm border border-gray-600"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-400 block mb-1">Last Name</label>
                                  <input
                                    type="text"
                                    value={editData.last_name || ''}
                                    onChange={(e) => setEditData({ ...editData, last_name: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-800 text-white rounded text-sm border border-gray-600"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-400 block mb-1">Email</label>
                                  <input
                                    type="email"
                                    value={editData.email || ''}
                                    onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-800 text-white rounded text-sm border border-gray-600"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-400 block mb-1">Phone</label>
                                  <input
                                    type="tel"
                                    value={editData.phone || ''}
                                    onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-800 text-white rounded text-sm border border-gray-600"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-400 block mb-1">Age</label>
                                  <input
                                    type="number"
                                    value={editData.athlete_age || ''}
                                    onChange={(e) => setEditData({ ...editData, athlete_age: parseInt(e.target.value) })}
                                    className="w-full px-3 py-2 bg-gray-800 text-white rounded text-sm border border-gray-600"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-400 block mb-1">Interests</label>
                                  <input
                                    type="text"
                                    value={editData.interests || ''}
                                    onChange={(e) => setEditData({ ...editData, interests: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-800 text-white rounded text-sm border border-gray-600"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="text-xs text-gray-400 block mb-1">Message</label>
                                <textarea
                                  value={editData.message || ''}
                                  onChange={(e) => setEditData({ ...editData, message: e.target.value })}
                                  rows={3}
                                  className="w-full px-3 py-2 bg-gray-800 text-white rounded text-sm border border-gray-600 resize-none"
                                />
                              </div>
                              <div className="flex gap-2 pt-2">
                                <button
                                  onClick={saveEdit}
                                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm font-medium"
                                >
                                  <Save className="w-4 h-4" />
                                  Save
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEditingId(null); setEditData({}) }}
                                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white text-sm font-medium"
                                >
                                  <X className="w-4 h-4" />
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            // View Mode
                            <div className="space-y-2 text-sm text-gray-300">
                              <div><span className="text-gray-500">Email:</span> {user.email}</div>
                              <div><span className="text-gray-500">Phone:</span> {user.phone || '-'}</div>
                              <div><span className="text-gray-500">Age:</span> {user.athlete_age || '-'}</div>
                              <div><span className="text-gray-500">Interests:</span> {user.interests || '-'}</div>
                              {user.message && <div><span className="text-gray-500">Additional Information or Questions:</span> {user.message}</div>}
                              <div className="flex gap-2 pt-3">
                                <button
                                  onClick={(e) => startEdit(e, user)}
                                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium"
                                >
                                  <Edit2 className="w-4 h-4" />
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => handleArchive(e, user.id)}
                                  className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm font-medium"
                                >
                                  <Archive className="w-4 h-4" />
                                  Archive
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Export Dialog */}
      <AnimatePresence>
        {showExportDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowExportDialog(false)}
            />
            <motion.div
              className="relative bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <h3 className="text-2xl font-display font-bold text-white mb-4">Export Data</h3>
              <p className="text-gray-400 mb-6">Select which data to export:</p>
              <div className="space-y-3 mb-6">
                <button
                  onClick={() => exportToCSV(true, true)}
                  className="w-full bg-vortex-red hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  Export All
                </button>
                <button
                  onClick={() => exportToCSV(true, false)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  Newsletter Only ({users.filter(u => u.newsletter).length})
                </button>
                <button
                  onClick={() => exportToCSV(false, true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  Interested Only ({users.filter(u => u.interests).length})
                </button>
              </div>
              <button
                onClick={() => setShowExportDialog(false)}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
