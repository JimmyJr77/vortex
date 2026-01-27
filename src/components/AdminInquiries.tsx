import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Edit2, Archive, Save, X, ChevronDown, ChevronUp, ArrowUpDown, ArrowUp, ArrowDown, Filter } from 'lucide-react'
import { adminApiRequest } from '../utils/api'

interface User {
  id: number
  first_name: string
  last_name: string
  email: string
  phone: string | null
  athlete_age: number | null
  interests: string | null
  interests_array: string[] | null
  interest: string | null
  class_types: string[] | null
  child_ages: number[] | null
  message: string | null
  created_at: string
  newsletter: boolean
  archived?: boolean
}

type FilterType = 'all' | 'newsletter' | 'interests'

type SortableField = 'created_at' | 'last_name' | 'first_name' | 'email' | 'phone' | 'athlete_age'

export default function AdminInquiries() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editData, setEditData] = useState<Partial<User>>({})
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [sortConfig, setSortConfig] = useState<{ field: SortableField; direction: 'asc' | 'desc' }>({ 
    field: 'created_at', 
    direction: 'desc' 
  })
  const [ageFilter, setAgeFilter] = useState<number[]>([])
  const [interestsFilter, setInterestsFilter] = useState<string[]>([])
  const [classTypesFilter, setClassTypesFilter] = useState<string[]>([])
  const [ageFilterOpen, setAgeFilterOpen] = useState(false)
  const [interestsFilterOpen, setInterestsFilterOpen] = useState(false)
  const [classTypesFilterOpen, setClassTypesFilterOpen] = useState(false)
  const [ageFilterPosition, setAgeFilterPosition] = useState({ top: 0, left: 0 })
  const [interestsFilterPosition, setInterestsFilterPosition] = useState({ top: 0, left: 0 })
  const [classTypesFilterPosition, setClassTypesFilterPosition] = useState({ top: 0, right: 0 })
  const ageFilterRef = useRef<HTMLDivElement>(null)
  const interestsFilterRef = useRef<HTMLDivElement>(null)
  const classTypesFilterRef = useRef<HTMLDivElement>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const regResponse = await adminApiRequest('/api/admin/registrations')
      if (!regResponse.ok) {
        throw new Error(`Backend returned ${regResponse.status}: ${regResponse.statusText}`)
      }
      const regData = await regResponse.json()
      
      const newsResponse = await adminApiRequest('/api/admin/newsletter')
      if (!newsResponse.ok) {
        throw new Error(`Backend returned ${newsResponse.status}: ${newsResponse.statusText}`)
      }
      const newsData = await newsResponse.json()
      
      if (regData.success && newsData.success) {
        interface NewsletterSub {
          email: string
        }
        interface RegistrationUser {
          id: number
          first_name: string
          last_name: string
          email: string
          phone: string | null
          athlete_age: number | null
          interests: string | null
          interests_array: string[] | null
          interest: string | null
          class_types: string[] | null
          child_ages: number[] | null
          message: string | null
          created_at: string
        }
        const newsletterEmails = new Set((newsData.data || []).map((sub: NewsletterSub) => sub.email))
        
        const combinedUsers = (regData.data || []).map((user: RegistrationUser) => ({
          ...user,
          newsletter: newsletterEmails.has(user.email)
        }))
        
        setUsers(combinedUsers)
      } else {
        console.error('Failed to fetch inquiries:', {
          registrations: regData,
          newsletter: newsData
        })
        setUsers([])
        if (!regData.success) {
          setError(regData.message || 'Failed to load registrations')
        } else if (!newsData.success) {
          setError(newsData.message || 'Failed to load newsletter data')
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      setError(error instanceof Error ? error.message : 'Unable to connect to backend. Please check if the backend service is running on Render.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

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
    
    if (sortConfig.field === 'created_at') {
      const aDate = new Date(aValue as string).getTime()
      const bDate = new Date(bValue as string).getTime()
      return sortConfig.direction === 'asc' ? aDate - bDate : bDate - aDate
    }
    
    return 0
  })

  const filteredUsers = sortedUsers.filter(user => {
    // Apply main filter
    if (filter === 'newsletter' && !user.newsletter) return false
    if (filter === 'interests' && !user.interests && !user.interests_array?.length) return false

    // Apply age filter
    if (ageFilter.length > 0) {
      const userAges = user.child_ages && user.child_ages.length > 0 
        ? user.child_ages 
        : (user.athlete_age ? [user.athlete_age] : [])
      const hasMatchingAge = userAges.some(age => ageFilter.includes(age))
      if (!hasMatchingAge) return false
    }

    // Apply interests filter
    if (interestsFilter.length > 0) {
      const userInterests = user.interests_array && user.interests_array.length > 0
        ? user.interests_array
        : (user.interests ? user.interests.split(',').map(i => i.trim()).filter(i => i) : [])
      const hasMatchingInterest = userInterests.some(interest => 
        interestsFilter.some(filterInterest => 
          interest.toLowerCase().includes(filterInterest.toLowerCase()) || 
          filterInterest.toLowerCase().includes(interest.toLowerCase())
        )
      )
      if (!hasMatchingInterest) return false
    }

    // Apply class types filter
    if (classTypesFilter.length > 0) {
      const userClassTypes = (user.class_types || []).map(formatClassType)
      const hasMatchingClassType = userClassTypes.some(type => classTypesFilter.includes(type))
      if (!hasMatchingClassType) return false
    }

    return true
  })

  const handleSort = (field: SortableField) => {
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
      interests_array: user.interests_array,
      interest: user.interest,
      class_types: user.class_types,
      child_ages: user.child_ages,
      message: user.message
    })
  }

  const saveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!editingId) return
    
    try {
      const response = await adminApiRequest(`/api/admin/registrations/${editingId}`, {
        method: 'PUT',
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
    if (!confirm('Archive this inquiry?')) return
    
    try {
      const response = await adminApiRequest(`/api/admin/registrations/${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        await fetchData()
      }
    } catch (error) {
      console.error('Error archiving user:', error)
      alert('Failed to archive inquiry')
    }
  }

  const getSortIcon = (field: SortableField) => {
    if (sortConfig.field !== field) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1" />
      : <ArrowDown className="w-3 h-3 ml-1" />
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  const formatInterests = (user: User) => {
    if (user.interests_array && user.interests_array.length > 0) {
      return user.interests_array.join(', ')
    }
    if (user.interests) {
      return user.interests
    }
    return '-'
  }

  const formatChildAges = (user: User) => {
    if (user.child_ages && user.child_ages.length > 0) {
      return user.child_ages.sort((a, b) => a - b).join(', ')
    }
    if (user.athlete_age) {
      return user.athlete_age.toString()
    }
    return '-'
  }

  const formatClassType = (classType: string): string => {
    if (classType === 'Adult Classes') return 'Adult'
    if (classType === 'Child Classes') return 'Child'
    return classType
  }

  const formatClassTypes = (classTypes: string[] | null): string => {
    if (!classTypes || classTypes.length === 0) return '-'
    return classTypes.map(formatClassType).join(', ')
  }

  const getAllAges = (): number[] => {
    const ages = new Set<number>()
    users.forEach(user => {
      if (user.child_ages && user.child_ages.length > 0) {
        user.child_ages.forEach(age => ages.add(age))
      } else if (user.athlete_age) {
        ages.add(user.athlete_age)
      }
    })
    return Array.from(ages).sort((a, b) => a - b)
  }

  const getAllInterests = (): string[] => {
    const interests = new Set<string>()
    users.forEach(user => {
      if (user.interests_array && user.interests_array.length > 0) {
        user.interests_array.forEach(interest => interests.add(interest))
      } else if (user.interests) {
        // Split legacy interests string by comma
        user.interests.split(',').forEach(interest => {
          const trimmed = interest.trim()
          if (trimmed) interests.add(trimmed)
        })
      }
    })
    return Array.from(interests).sort()
  }

  const getAllClassTypes = (): string[] => {
    const classTypes = new Set<string>()
    users.forEach(user => {
      if (user.class_types && user.class_types.length > 0) {
        user.class_types.forEach(type => {
          const formatted = formatClassType(type)
          classTypes.add(formatted)
        })
      }
    })
    return Array.from(classTypes).sort()
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      const isFilterPopup = (target as Element).closest('[data-filter-popup]')
      
      if (ageFilterOpen && ageFilterRef.current && !ageFilterRef.current.contains(target) && !isFilterPopup) {
        setAgeFilterOpen(false)
      }
      if (interestsFilterOpen && interestsFilterRef.current && !interestsFilterRef.current.contains(target) && !isFilterPopup) {
        setInterestsFilterOpen(false)
      }
      if (classTypesFilterOpen && classTypesFilterRef.current && !classTypesFilterRef.current.contains(target) && !isFilterPopup) {
        setClassTypesFilterOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [ageFilterOpen, interestsFilterOpen, classTypesFilterOpen])

  return (
    <motion.div
      key="inquiries"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-lg shadow-lg border border-gray-200"
    >
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-black">
            Inquiries ({filteredUsers.length} of {users.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                filter === 'all'
                  ? 'bg-vortex-red text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All ({users.length})
            </button>
            <button
              onClick={() => setFilter('newsletter')}
              className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                filter === 'newsletter'
                  ? 'bg-vortex-red text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Newsletter ({users.filter(u => u.newsletter).length})
            </button>
            <button
              onClick={() => setFilter('interests')}
              className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                filter === 'interests'
                  ? 'bg-vortex-red text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Interested ({users.filter(u => u.interests || u.interests_array?.length).length})
            </button>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-6 text-center">
          <div className="text-red-600 mb-4 font-semibold">Backend Connection Error</div>
          <div className="text-gray-600 mb-4">{error}</div>
          <button
            onClick={fetchData}
            className="bg-vortex-red hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && !error && (
        <div className="p-12 text-center text-gray-600">Loading...</div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredUsers.length === 0 && (
        <div className="p-12 text-center text-gray-600">No inquiries match the selected filter</div>
      )}

      {/* Spreadsheet Table */}
      {!loading && !error && filteredUsers.length > 0 && (
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full divide-y divide-gray-200">
              {/* Fixed Header */}
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                    <button
                      onClick={() => handleSort('created_at')}
                      className="flex items-center hover:text-vortex-red transition-colors"
                    >
                      Date {getSortIcon('created_at')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 min-w-[120px]">
                    <button
                      onClick={() => handleSort('last_name')}
                      className="flex items-center hover:text-vortex-red transition-colors"
                    >
                      Last Name {getSortIcon('last_name')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 min-w-[120px]">
                    <button
                      onClick={() => handleSort('first_name')}
                      className="flex items-center hover:text-vortex-red transition-colors"
                    >
                      First Name {getSortIcon('first_name')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 min-w-[200px]">
                    <button
                      onClick={() => handleSort('email')}
                      className="flex items-center hover:text-vortex-red transition-colors"
                    >
                      Email {getSortIcon('email')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 min-w-[130px]">
                    <button
                      onClick={() => handleSort('phone')}
                      className="flex items-center hover:text-vortex-red transition-colors"
                    >
                      Phone {getSortIcon('phone')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 min-w-[120px]">
                    <div className="flex items-center gap-1">
                      <span>Child Ages</span>
                      <div className="relative" ref={ageFilterRef}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!ageFilterOpen && ageFilterRef.current) {
                              const rect = ageFilterRef.current.getBoundingClientRect()
                              setAgeFilterPosition({ top: rect.bottom + 4, left: rect.left })
                            }
                            setAgeFilterOpen(!ageFilterOpen)
                          }}
                          className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                            ageFilter.length > 0 ? 'text-vortex-red' : 'text-gray-400'
                          }`}
                          title="Filter by age"
                        >
                          <Filter className="w-3 h-3" />
                        </button>
                        {ageFilterOpen && (
                          <div 
                            data-filter-popup
                            className="fixed bg-white border border-gray-300 rounded-lg shadow-xl z-[9999] max-h-60 overflow-y-auto min-w-[150px]"
                            style={{ top: `${ageFilterPosition.top}px`, left: `${ageFilterPosition.left}px` }}
                          >
                            <div className="p-2">
                              <div className="text-xs font-semibold text-gray-700 mb-2 px-2">Filter by Age</div>
                              {getAllAges().map(age => (
                                <label key={age} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={ageFilter.includes(age)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setAgeFilter([...ageFilter, age])
                                      } else {
                                        setAgeFilter(ageFilter.filter(a => a !== age))
                                      }
                                    }}
                                    className="w-4 h-4 text-vortex-red focus:ring-vortex-red border-gray-300 rounded"
                                  />
                                  <span className="text-sm text-gray-700">{age}</span>
                                </label>
                              ))}
                              {ageFilter.length > 0 && (
                                <button
                                  onClick={() => setAgeFilter([])}
                                  className="mt-2 w-full text-xs text-vortex-red hover:underline px-2"
                                >
                                  Clear filters
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 min-w-[200px]">
                    <div className="flex items-center gap-1">
                      <span>Interests</span>
                      <div className="relative" ref={interestsFilterRef}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!interestsFilterOpen && interestsFilterRef.current) {
                              const rect = interestsFilterRef.current.getBoundingClientRect()
                              setInterestsFilterPosition({ top: rect.bottom + 4, left: rect.left })
                            }
                            setInterestsFilterOpen(!interestsFilterOpen)
                          }}
                          className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                            interestsFilter.length > 0 ? 'text-vortex-red' : 'text-gray-400'
                          }`}
                          title="Filter by interests"
                        >
                          <Filter className="w-3 h-3" />
                        </button>
                        {interestsFilterOpen && (
                          <div 
                            data-filter-popup
                            className="fixed bg-white border border-gray-300 rounded-lg shadow-xl z-[9999] max-h-60 overflow-y-auto min-w-[200px]"
                            style={{ top: `${interestsFilterPosition.top}px`, left: `${interestsFilterPosition.left}px` }}
                          >
                            <div className="p-2">
                              <div className="text-xs font-semibold text-gray-700 mb-2 px-2">Filter by Interest</div>
                              {getAllInterests().map(interest => (
                                <label key={interest} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={interestsFilter.includes(interest)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setInterestsFilter([...interestsFilter, interest])
                                      } else {
                                        setInterestsFilter(interestsFilter.filter(i => i !== interest))
                                      }
                                    }}
                                    className="w-4 h-4 text-vortex-red focus:ring-vortex-red border-gray-300 rounded"
                                  />
                                  <span className="text-sm text-gray-700 truncate">{interest}</span>
                                </label>
                              ))}
                              {interestsFilter.length > 0 && (
                                <button
                                  onClick={() => setInterestsFilter([])}
                                  className="mt-2 w-full text-xs text-vortex-red hover:underline px-2"
                                >
                                  Clear filters
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 min-w-[100px]">
                    <div className="flex items-center justify-center gap-1">
                      <span>Class Types</span>
                      <div className="relative" ref={classTypesFilterRef}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!classTypesFilterOpen && classTypesFilterRef.current) {
                              const rect = classTypesFilterRef.current.getBoundingClientRect()
                              setClassTypesFilterPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                            }
                            setClassTypesFilterOpen(!classTypesFilterOpen)
                          }}
                          className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                            classTypesFilter.length > 0 ? 'text-vortex-red' : 'text-gray-400'
                          }`}
                          title="Filter by class types"
                        >
                          <Filter className="w-3 h-3" />
                        </button>
                        {classTypesFilterOpen && (
                          <div 
                            data-filter-popup
                            className="fixed bg-white border border-gray-300 rounded-lg shadow-xl z-[9999] max-h-60 overflow-y-auto min-w-[150px]"
                            style={{ top: `${classTypesFilterPosition.top}px`, right: `${classTypesFilterPosition.right}px` }}
                          >
                            <div className="p-2">
                              <div className="text-xs font-semibold text-gray-700 mb-2 px-2">Filter by Class Type</div>
                              {getAllClassTypes().map(classType => (
                                <label key={classType} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={classTypesFilter.includes(classType)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setClassTypesFilter([...classTypesFilter, classType])
                                      } else {
                                        setClassTypesFilter(classTypesFilter.filter(ct => ct !== classType))
                                      }
                                    }}
                                    className="w-4 h-4 text-vortex-red focus:ring-vortex-red border-gray-300 rounded"
                                  />
                                  <span className="text-sm text-gray-700">{classType}</span>
                                </label>
                              ))}
                              {classTypesFilter.length > 0 && (
                                <button
                                  onClick={() => setClassTypesFilter([])}
                                  className="mt-2 w-full text-xs text-vortex-red hover:underline px-2"
                                >
                                  Clear filters
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 min-w-[80px]">
                    Newsletter
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px]">
                    Actions
                  </th>
                </tr>
              </thead>
              {/* Scrollable Body */}
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <>
                    <tr
                      key={user.id}
                      className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                        expandedId === user.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => toggleExpand(user.id)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                        {user.last_name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                        {user.first_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                        <div className="max-w-[200px] truncate" title={user.email}>
                          {user.email}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200">
                        {user.phone || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200 text-center">
                        {formatChildAges(user)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                        <div className="max-w-[200px] truncate" title={formatInterests(user)}>
                          {formatInterests(user)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200 text-center">
                        {formatClassTypes(user.class_types)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center border-r border-gray-200">
                        {user.newsletter ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 bg-green-600 rounded-full">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          {expandedId === user.id ? (
                            <ChevronUp className="w-4 h-4 text-gray-600" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-600" />
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Expanded Row */}
                    <AnimatePresence>
                      {expandedId === user.id && (
                        <tr>
                          <td colSpan={10} className="px-0 py-0">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden bg-gray-50 border-t-2 border-vortex-red"
                            >
                              <div className="p-6">
                                {editingId === user.id ? (
                                  // Edit Mode
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                      <div>
                                        <label className="text-xs text-gray-600 block mb-1 font-semibold">First Name</label>
                                        <input
                                          type="text"
                                          value={editData.first_name || ''}
                                          onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                                          className="w-full px-3 py-2 bg-white text-black rounded text-sm border border-gray-300 focus:ring-2 focus:ring-vortex-red focus:border-transparent"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs text-gray-600 block mb-1 font-semibold">Last Name</label>
                                        <input
                                          type="text"
                                          value={editData.last_name || ''}
                                          onChange={(e) => setEditData({ ...editData, last_name: e.target.value })}
                                          className="w-full px-3 py-2 bg-white text-black rounded text-sm border border-gray-300 focus:ring-2 focus:ring-vortex-red focus:border-transparent"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs text-gray-600 block mb-1 font-semibold">Email</label>
                                        <input
                                          type="email"
                                          value={editData.email || ''}
                                          onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                                          className="w-full px-3 py-2 bg-white text-black rounded text-sm border border-gray-300 focus:ring-2 focus:ring-vortex-red focus:border-transparent"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs text-gray-600 block mb-1 font-semibold">Phone</label>
                                        <input
                                          type="tel"
                                          value={editData.phone || ''}
                                          onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                                          className="w-full px-3 py-2 bg-white text-black rounded text-sm border border-gray-300 focus:ring-2 focus:ring-vortex-red focus:border-transparent"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs text-gray-600 block mb-1 font-semibold">Child Ages (comma-separated, or single age for legacy)</label>
                                        <input
                                          type="text"
                                          value={
                                            editData.child_ages && editData.child_ages.length > 0
                                              ? editData.child_ages.join(', ')
                                              : (editData.athlete_age ? editData.athlete_age.toString() : '')
                                          }
                                          onChange={(e) => {
                                            const ages = e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
                                            if (ages.length > 0) {
                                              setEditData({ 
                                                ...editData, 
                                                child_ages: ages,
                                                athlete_age: ages.length === 1 ? ages[0] : null // Set legacy age if single value
                                              })
                                            } else {
                                              setEditData({ 
                                                ...editData, 
                                                child_ages: null,
                                                athlete_age: null
                                              })
                                            }
                                          }}
                                          className="w-full px-3 py-2 bg-white text-black rounded text-sm border border-gray-300 focus:ring-2 focus:ring-vortex-red focus:border-transparent"
                                          placeholder="2, 4, 6 or 12"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs text-gray-600 block mb-1 font-semibold">Interests (comma-separated)</label>
                                        <input
                                          type="text"
                                          value={editData.interests_array ? editData.interests_array.join(', ') : (editData.interests || '')}
                                          onChange={(e) => {
                                            const interestsList = e.target.value.split(',').map(s => s.trim()).filter(s => s.length > 0)
                                            setEditData({ 
                                              ...editData, 
                                              interests_array: interestsList.length > 0 ? interestsList : null,
                                              interests: interestsList.length > 0 ? interestsList.join(', ') : null
                                            })
                                          }}
                                          className="w-full px-3 py-2 bg-white text-black rounded text-sm border border-gray-300 focus:ring-2 focus:ring-vortex-red focus:border-transparent"
                                          placeholder="Gymnastics (Artistic), Rhythmic Gymnastics"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs text-gray-600 block mb-1 font-semibold">Class Types (comma-separated)</label>
                                        <input
                                          type="text"
                                          value={editData.class_types ? editData.class_types.join(', ') : ''}
                                          onChange={(e) => {
                                            const types = e.target.value.split(',').map(s => s.trim()).filter(s => s.length > 0)
                                            setEditData({ ...editData, class_types: types.length > 0 ? types : null })
                                          }}
                                          className="w-full px-3 py-2 bg-white text-black rounded text-sm border border-gray-300 focus:ring-2 focus:ring-vortex-red focus:border-transparent"
                                          placeholder="Adult Classes, Child Classes"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs text-gray-600 block mb-1 font-semibold">Child Ages (comma-separated)</label>
                                        <input
                                          type="text"
                                          value={editData.child_ages ? editData.child_ages.join(', ') : ''}
                                          onChange={(e) => {
                                            const ages = e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
                                            setEditData({ ...editData, child_ages: ages.length > 0 ? ages : null })
                                          }}
                                          className="w-full px-3 py-2 bg-white text-black rounded text-sm border border-gray-300 focus:ring-2 focus:ring-vortex-red focus:border-transparent"
                                          placeholder="1, 2, 3"
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-600 block mb-1 font-semibold">Message/Comment</label>
                                      <textarea
                                        value={editData.message || ''}
                                        onChange={(e) => setEditData({ ...editData, message: e.target.value })}
                                        rows={3}
                                        className="w-full px-3 py-2 bg-white text-black rounded text-sm border border-gray-300 resize-none focus:ring-2 focus:ring-vortex-red focus:border-transparent"
                                      />
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                      <button
                                        onClick={saveEdit}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm font-medium transition-colors"
                                      >
                                        <Save className="w-4 h-4" />
                                        Save
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setEditingId(null); setEditData({}) }}
                                        className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white text-sm font-medium transition-colors"
                                      >
                                        <X className="w-4 h-4" />
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  // View Mode
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                      <div>
                                        <span className="text-gray-600 font-semibold">Email:</span>
                                        <div className="text-gray-900 mt-1">{user.email}</div>
                                      </div>
                                      <div>
                                        <span className="text-gray-600 font-semibold">Phone:</span>
                                        <div className="text-gray-900 mt-1">{user.phone || '-'}</div>
                                      </div>
                                      <div>
                                        <span className="text-gray-600 font-semibold">Child Ages:</span>
                                        <div className="text-gray-900 mt-1">{formatChildAges(user)}</div>
                                      </div>
                                      {user.interests_array && user.interests_array.length > 0 && (
                                        <div className="md:col-span-2">
                                          <span className="text-gray-600 font-semibold">Interests:</span>
                                          <div className="text-gray-900 mt-1">{user.interests_array.join(', ')}</div>
                                        </div>
                                      )}
                                      {!user.interests_array && user.interests && (
                                        <div className="md:col-span-2">
                                          <span className="text-gray-600 font-semibold">Interests (Legacy):</span>
                                          <div className="text-gray-900 mt-1">{user.interests}</div>
                                        </div>
                                      )}
                                      {user.class_types && user.class_types.length > 0 && (
                                        <div>
                                          <span className="text-gray-600 font-semibold">Class Types:</span>
                                          <div className="text-gray-900 mt-1">{formatClassTypes(user.class_types)}</div>
                                        </div>
                                      )}
                                      {user.child_ages && user.child_ages.length > 0 && (
                                        <div>
                                          <span className="text-gray-600 font-semibold">Child Ages:</span>
                                          <div className="text-gray-900 mt-1">{user.child_ages.join(', ')}</div>
                                        </div>
                                      )}
                                      {user.message && (
                                        <div className="md:col-span-3">
                                          <span className="text-gray-600 font-semibold">Comment/Question:</span>
                                          <div className="text-gray-900 mt-1 whitespace-pre-wrap">{user.message}</div>
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex gap-2 pt-2 border-t border-gray-300">
                                      <button
                                        onClick={(e) => startEdit(e, user)}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium transition-colors"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                        Edit
                                      </button>
                                      <button
                                        onClick={(e) => handleArchive(e, user.id)}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm font-medium transition-colors"
                                      >
                                        <Archive className="w-4 h-4" />
                                        Archive
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  )
}
