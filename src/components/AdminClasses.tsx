import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Edit2, Archive, X, Save, Plus, Search } from 'lucide-react'
import { getApiUrl } from '../utils/api'

interface Program {
  id: number
  category: 'EARLY_DEVELOPMENT' | 'GYMNASTICS' | 'VORTEX_NINJA' | 'ATHLETICISM_ACCELERATOR' | 'ADULT_FITNESS' | 'HOMESCHOOL'
  categoryId?: number | null
  categoryName?: string | null
  categoryDisplayName?: string | null
  name: string
  displayName: string
  skillLevel: 'EARLY_STAGE' | 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | null
  ageMin: number | null
  ageMax: number | null
  description: string | null
  skillRequirements: string | null
  isActive: boolean
  archived?: boolean
  createdAt: string
  updatedAt: string
}

interface Category {
  id: number
  name: string
  displayName: string
  description?: string | null
  archived: boolean
  createdAt: string
  updatedAt: string
}

export default function AdminClasses() {
  const [error, setError] = useState<string | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [programsLoading, setProgramsLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [editingProgramId, setEditingProgramId] = useState<number | null>(null)
  const [programFormData, setProgramFormData] = useState<Partial<Program>>({})
  const [showArchivedCategories, setShowArchivedCategories] = useState(false)
  const [showArchivedClasses, setShowArchivedClasses] = useState(false)
  const [categoryArchiveSearch, setCategoryArchiveSearch] = useState('')
  const [classArchiveSearch, setClassArchiveSearch] = useState('')
  const [classArchiveCategoryFilter, setClassArchiveCategoryFilter] = useState<number | 'all'>('all')
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [categoryFormData, setCategoryFormData] = useState<Partial<Category>>({})
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showClassModal, setShowClassModal] = useState(false)
  const [selectedCategoryForClass, setSelectedCategoryForClass] = useState<number | null>(null)

  // Get all active classes grouped by category
  const getActiveClassesByCategory = (programsList: Program[]) => {
    // Filter for active, non-archived classes with valid categories
    const activeClasses = programsList.filter(p => {
      if (!p.isActive || p.archived) return false
      // Exclude programs without a valid category (no categoryDisplayName or categoryName)
      const hasCategory = (p.categoryDisplayName && p.categoryDisplayName.trim()) || (p.categoryName && p.categoryName.trim())
      return hasCategory
    })
    
    // Group by category
    const groupedByCategory = activeClasses.reduce((acc, program) => {
      const categoryName = program.categoryDisplayName || program.categoryName || 'Uncategorized'
      if (!acc[categoryName]) {
        acc[categoryName] = []
      }
      acc[categoryName].push(program)
      return acc
    }, {} as Record<string, Program[]>)
    
    // Sort programs within each category by display name
    Object.keys(groupedByCategory).forEach(category => {
      groupedByCategory[category].sort((a, b) => a.displayName.localeCompare(b.displayName))
    })
    
    // Sort categories alphabetically
    const sortedCategories = Object.keys(groupedByCategory).sort()
    
    return { groupedByCategory, sortedCategories }
  }

  const fetchAllPrograms = async () => {
    try {
      setProgramsLoading(true)
      setError(null)
      const apiUrl = getApiUrl()
      
      // Fetch both archived and active programs
      const [activeResponse, archivedResponse] = await Promise.all([
        fetch(`${apiUrl}/api/admin/programs?archived=false`),
        fetch(`${apiUrl}/api/admin/programs?archived=true`)
      ])
      
      if (!activeResponse.ok || !archivedResponse.ok) {
        throw new Error(`Backend returned error`)
      }
      
      const [activeData, archivedData] = await Promise.all([
        activeResponse.json(),
        archivedResponse.json()
      ])
      
      if (activeData.success && archivedData.success) {
        setPrograms([...activeData.data, ...archivedData.data])
      }
    } catch (error) {
      console.error('Error fetching programs:', error)
      setError(error instanceof Error ? error.message : 'Unable to fetch programs')
    } finally {
      setProgramsLoading(false)
    }
  }

  const fetchAllCategories = async () => {
    try {
      setCategoriesLoading(true)
      const apiUrl = getApiUrl()
      
      // Fetch both archived and active categories
      const [activeResponse, archivedResponse] = await Promise.all([
        fetch(`${apiUrl}/api/admin/categories?archived=false`),
        fetch(`${apiUrl}/api/admin/categories?archived=true`)
      ])
      
      if (!activeResponse.ok || !archivedResponse.ok) {
        throw new Error(`Backend returned error`)
      }
      
      const [activeData, archivedData] = await Promise.all([
        activeResponse.json(),
        archivedResponse.json()
      ])
      
      if (activeData.success && archivedData.success) {
        setCategories([...activeData.data, ...archivedData.data])
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    } finally {
      setCategoriesLoading(false)
    }
  }

  const handleArchiveProgram = async (id: number, archived: boolean) => {
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/programs/${id}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived })
      })
      
      if (response.ok) {
        // If unarchiving a class, check if its category is archived and unarchive it too
        if (!archived) {
          const program = programs.find(p => p.id === id)
          if (program && program.categoryId) {
            const category = categories.find(c => c.id === program.categoryId)
            if (category && category.archived) {
              // Unarchive the category as well
              await fetch(`${apiUrl}/api/admin/categories/${category.id}/archive`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ archived: false })
              })
            }
          }
        }
        await fetchAllPrograms()
        await fetchAllCategories()
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to archive program')
      }
    } catch (error) {
      console.error('Error archiving program:', error)
      alert('Failed to archive program')
    }
  }

  const handleDeleteProgram = async (id: number) => {
    if (!confirm('Are you sure you want to delete this program? This action cannot be undone.')) {
      return
    }
    
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/programs/${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        // Refresh both programs and categories to ensure UI is up to date
        await Promise.all([fetchAllPrograms(), fetchAllCategories()])
        // Clear editing state if the deleted program was being edited
        if (editingProgramId === id) {
          setEditingProgramId(null)
          setProgramFormData({})
        }
      } else {
        const data = await response.json()
        const errorMessage = data.errors ? data.errors.join(', ') : (data.message || 'Failed to delete program')
        alert(`Error deleting program: ${errorMessage}`)
        console.error('Delete program error response:', data)
      }
    } catch (error) {
      console.error('Error deleting program:', error)
      const errorMessage = error instanceof Error ? error.message : 'Network error'
      alert(`Failed to delete program: ${errorMessage}`)
    }
  }

  const handleCreateCategory = async () => {
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryFormData)
      })
      
      if (response.ok) {
        await fetchAllCategories()
        await fetchAllPrograms()
        setCategoryFormData({ name: '', displayName: '', description: '' })
        setShowCategoryModal(false)
        setEditingCategoryId(null)
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to create category')
      }
    } catch (error) {
      console.error('Error creating category:', error)
      alert('Failed to create category')
    }
  }

  const handleCreateClass = async () => {
    if (!selectedCategoryForClass) {
      alert('Please select a category')
      return
    }
    
    try {
      const apiUrl = getApiUrl()
      // Create program with category_id
      const classData = {
        ...programFormData,
        categoryId: selectedCategoryForClass
      }
      
      // We need to create a program endpoint that accepts categoryId
      // For now, we'll use the existing structure but need to update backend
      const response = await fetch(`${apiUrl}/api/admin/programs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(classData)
      })
      
      if (response.ok) {
        await fetchAllPrograms()
        setProgramFormData({})
        setShowClassModal(false)
        setSelectedCategoryForClass(null)
      } else {
        const data = await response.json()
        console.error('Create class error response:', data)
        const errorMsg = data.errors ? data.errors.join(', ') : (data.message || 'Failed to create class')
        alert(`Error creating class: ${errorMsg}`)
      }
    } catch (error) {
      console.error('Error creating class:', error)
      const errorMessage = error instanceof Error ? error.message : 'Network error'
      alert(`Failed to create class: ${errorMessage}`)
    }
  }

  const handleUpdateCategory = async () => {
    if (!editingCategoryId) return
    
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/categories/${editingCategoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryFormData)
      })
      
      if (response.ok) {
        await fetchAllCategories()
        await fetchAllPrograms()
        setEditingCategoryId(null)
        setCategoryFormData({})
        setShowCategoryModal(false)
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to update category')
      }
    } catch (error) {
      console.error('Error updating category:', error)
      alert('Failed to update category')
    }
  }

  const handleArchiveCategory = async (id: number, archived: boolean) => {
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/categories/${id}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived })
      })
      
      if (response.ok) {
        await fetchAllCategories()
        await fetchAllPrograms()
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to archive category')
      }
    } catch (error) {
      console.error('Error archiving category:', error)
      alert('Failed to archive category')
    }
  }

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      return
    }
    
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/categories/${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        await fetchAllCategories()
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to delete category')
      }
    } catch (error) {
      console.error('Error deleting category:', error)
      alert('Failed to delete category')
    }
  }

  const handleEditProgram = (program: Program) => {
    setEditingProgramId(program.id)
    setProgramFormData({
      displayName: program.displayName,
      skillLevel: program.skillLevel,
      ageMin: program.ageMin,
      ageMax: program.ageMax,
      description: program.description || '',
      skillRequirements: program.skillRequirements || '',
      isActive: program.isActive,
      archived: program.archived, // Preserve archived status
      categoryId: program.categoryId || null // Store for reference, but don't send in update
    })
  }

  const handleUpdateProgram = async () => {
    if (!editingProgramId) return
    
    try {
      const apiUrl = getApiUrl()
      // Ensure we don't send categoryId or archived in the update (these are managed separately)
      const updateData = { ...programFormData }
      delete updateData.categoryId
      delete updateData.archived
      
      const response = await fetch(`${apiUrl}/api/admin/programs/${editingProgramId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })
      
      if (response.ok) {
        // Refresh both programs and categories to ensure UI is up to date
        await Promise.all([fetchAllPrograms(), fetchAllCategories()])
        setEditingProgramId(null)
        setProgramFormData({})
      } else {
        const data = await response.json()
        const errorMessage = data.errors ? data.errors.join(', ') : (data.message || 'Failed to update program')
        alert(`Error updating program: ${errorMessage}`)
        console.error('Update program error response:', data)
      }
    } catch (error) {
      console.error('Error updating program:', error)
      const errorMessage = error instanceof Error ? error.message : 'Network error'
      alert(`Failed to update program: ${errorMessage}`)
    }
  }

  useEffect(() => {
    fetchAllPrograms()
    fetchAllCategories()
  }, [])

  useEffect(() => {
    fetchAllPrograms()
    fetchAllCategories()
  }, [showArchivedClasses, showArchivedCategories])

  return (
    <>
      <motion.div
        key="classes"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {/* Archive Toggle Buttons */}
        <div className="flex gap-2 mb-4">
          <motion.button
            onClick={() => {
              setShowArchivedCategories(!showArchivedCategories)
              setShowArchivedClasses(false)
            }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
              showArchivedCategories
                ? 'bg-gray-600 text-white hover:bg-gray-700'
                : 'bg-gray-500 text-white hover:bg-gray-600'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Archive className="w-4 h-4" />
            <span>{showArchivedCategories ? 'Show Active Categories' : 'Show Category Archives'}</span>
          </motion.button>
          <motion.button
            onClick={() => {
              setShowArchivedClasses(!showArchivedClasses)
              setShowArchivedCategories(false)
            }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
              showArchivedClasses
                ? 'bg-gray-600 text-white hover:bg-gray-700'
                : 'bg-gray-500 text-white hover:bg-gray-600'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Archive className="w-4 h-4" />
            <span>{showArchivedClasses ? 'Show Active Classes' : 'Show Class Archives'}</span>
          </motion.button>
        </div>

        {/* Category Archives View */}
        {showArchivedCategories && (
          <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
            <h2 className="text-2xl md:text-3xl font-display font-bold text-black mb-4">
              Category Archives
            </h2>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search archived categories..."
                  value={categoryArchiveSearch}
                  onChange={(e) => setCategoryArchiveSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vortex-red focus:border-transparent"
                />
              </div>
            </div>
            {categoriesLoading ? (
              <div className="text-center py-12 text-gray-600">Loading...</div>
            ) : (
              <div className="space-y-4">
                {categories
                  .filter(cat => cat.archived)
                  .filter(cat => 
                    !categoryArchiveSearch.trim() || 
                    cat.displayName.toLowerCase().includes(categoryArchiveSearch.toLowerCase()) ||
                    cat.name.toLowerCase().includes(categoryArchiveSearch.toLowerCase()) ||
                    (cat.description && cat.description.toLowerCase().includes(categoryArchiveSearch.toLowerCase()))
                  )
                  .map((category) => (
                    <div key={category.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-black">{category.displayName}</h3>
                          {category.description && (
                            <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleArchiveCategory(category.id, false)}
                            className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm font-medium"
                          >
                            <Archive className="w-4 h-4" />
                            Unarchive
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(category.id)}
                            className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm font-medium"
                          >
                            <X className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                {categories.filter(cat => cat.archived && 
                  (!categoryArchiveSearch.trim() || 
                    cat.displayName.toLowerCase().includes(categoryArchiveSearch.toLowerCase()) ||
                    cat.name.toLowerCase().includes(categoryArchiveSearch.toLowerCase()) ||
                    (cat.description && cat.description.toLowerCase().includes(categoryArchiveSearch.toLowerCase()))
                  )).length === 0 && (
                  <div className="text-center py-8 text-gray-500">No archived categories found</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Class Archives View */}
        {showArchivedClasses && (
          <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
            <h2 className="text-2xl md:text-3xl font-display font-bold text-black mb-4">
              Class Archives
            </h2>
            <div className="mb-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search archived classes..."
                  value={classArchiveSearch}
                  onChange={(e) => setClassArchiveSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vortex-red focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by Category</label>
                <select
                  value={classArchiveCategoryFilter === 'all' ? 'all' : String(classArchiveCategoryFilter)}
                  onChange={(e) => setClassArchiveCategoryFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                >
                  <option value="all">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={String(cat.id)}>{cat.displayName}</option>
                  ))}
                </select>
              </div>
            </div>
            {programsLoading ? (
              <div className="text-center py-12 text-gray-600">Loading...</div>
            ) : (
              <div className="space-y-4">
                {programs
                  .filter(p => p.archived)
                  .filter(p => {
                    if (classArchiveCategoryFilter === 'all') {
                      return true
                    }
                    // Match by categoryId (handle both number and string comparisons)
                    if (p.categoryId != null && (p.categoryId === classArchiveCategoryFilter || String(p.categoryId) === String(classArchiveCategoryFilter))) {
                      return true
                    }
                    // Match by categoryDisplayName as fallback
                    if (p.categoryDisplayName) {
                      const selectedCategory = categories.find(c => c.id === classArchiveCategoryFilter)
                      if (selectedCategory && selectedCategory.displayName === p.categoryDisplayName) {
                        return true
                      }
                    }
                    return false
                  })
                  .filter(p => 
                    !classArchiveSearch.trim() || 
                    p.displayName.toLowerCase().includes(classArchiveSearch.toLowerCase()) ||
                    p.name.toLowerCase().includes(classArchiveSearch.toLowerCase()) ||
                    (p.description && p.description.toLowerCase().includes(classArchiveSearch.toLowerCase()))
                  )
                  .map((program) => {
                    const programCategory = categories.find(c => 
                      c.id === program.categoryId || 
                      c.displayName === program.categoryDisplayName
                    )
                    return (
                      <div key={program.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        {editingProgramId === program.id ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Display Name *</label>
                                <input
                                  type="text"
                                  value={programFormData.displayName || ''}
                                  onChange={(e) => setProgramFormData({ ...programFormData, displayName: e.target.value })}
                                  className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Skill Level</label>
                                <select
                                  value={programFormData.skillLevel || ''}
                                  onChange={(e) => setProgramFormData({ ...programFormData, skillLevel: e.target.value as Program['skillLevel'] || null })}
                                  className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                                >
                                  <option value="">None (All Levels)</option>
                                  <option value="EARLY_STAGE">Early Stage</option>
                                  <option value="BEGINNER">Beginner</option>
                                  <option value="INTERMEDIATE">Intermediate</option>
                                  <option value="ADVANCED">Advanced</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Minimum Age</label>
                                <input
                                  type="number"
                                  value={programFormData.ageMin ?? ''}
                                  onChange={(e) => setProgramFormData({ ...programFormData, ageMin: e.target.value ? parseInt(e.target.value) : null })}
                                  className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                                  min="0"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Maximum Age</label>
                                <input
                                  type="number"
                                  value={programFormData.ageMax ?? ''}
                                  onChange={(e) => setProgramFormData({ ...programFormData, ageMax: e.target.value ? parseInt(e.target.value) : null })}
                                  className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                                  min="0"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                              <textarea
                                value={programFormData.description || ''}
                                onChange={(e) => setProgramFormData({ ...programFormData, description: e.target.value })}
                                rows={4}
                                className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Skill Requirements</label>
                              <input
                                type="text"
                                value={programFormData.skillRequirements || ''}
                                onChange={(e) => setProgramFormData({ ...programFormData, skillRequirements: e.target.value })}
                                className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                                placeholder="e.g., No Experience Required, Skill Evaluation Required"
                              />
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={programFormData.isActive ?? true}
                                onChange={(e) => setProgramFormData({ ...programFormData, isActive: e.target.checked })}
                                className="w-4 h-4 text-vortex-red bg-white border-gray-300 rounded focus:ring-vortex-red"
                              />
                              <label className="text-sm font-semibold text-gray-700">Active</label>
                            </div>
                            {programCategory && (
                              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                                <p className="text-sm text-gray-700">
                                  <span className="font-semibold">Category:</span> {programCategory.displayName}
                                  <span className="text-xs text-gray-500 ml-2">(Category is preserved when unarchiving)</span>
                                </p>
                              </div>
                            )}
                            <div className="flex gap-2">
                              <button
                                onClick={handleUpdateProgram}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm font-medium"
                              >
                                <Save className="w-4 h-4" />
                                Save Changes
                              </button>
                              <button
                                onClick={() => {
                                  setEditingProgramId(null)
                                  setProgramFormData({})
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
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="text-lg font-semibold text-black">{program.displayName}</h4>
                                  {programCategory && (
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                      {programCategory.displayName}
                                    </span>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
                                  {program.skillLevel && (
                                    <div>
                                      <span className="font-medium text-gray-600">Skill Level:</span> {program.skillLevel.replace('_', ' ')}
                                    </div>
                                  )}
                                  {(program.ageMin !== null || program.ageMax !== null) && (
                                    <div>
                                      <span className="font-medium text-gray-600">Age Range:</span>{' '}
                                      {program.ageMin !== null ? program.ageMin : 'Any'} - {program.ageMax !== null ? program.ageMax : 'Any'}
                                    </div>
                                  )}
                                  {program.skillRequirements && (
                                    <div className="md:col-span-2">
                                      <span className="font-medium text-gray-600">Requirements:</span> {program.skillRequirements}
                                    </div>
                                  )}
                                  {program.description && (
                                    <div className="md:col-span-2">
                                      <span className="font-medium text-gray-600">Description:</span> {program.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEditProgram(program)}
                                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium"
                                >
                                  <Edit2 className="w-4 h-4" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleArchiveProgram(program.id, false)}
                                  className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm font-medium"
                                >
                                  <Archive className="w-4 h-4" />
                                  Unarchive
                                </button>
                                <button
                                  onClick={() => handleDeleteProgram(program.id)}
                                  className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm font-medium"
                                >
                                  <X className="w-4 h-4" />
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                {(() => {
                  const filteredPrograms = programs
                    .filter(p => p.archived)
                    .filter(p => {
                      if (classArchiveCategoryFilter === 'all') {
                        return true
                      }
                      // Match by categoryId (handle both number and string comparisons)
                      if (p.categoryId != null && (p.categoryId === classArchiveCategoryFilter || String(p.categoryId) === String(classArchiveCategoryFilter))) {
                        return true
                      }
                      // Match by categoryDisplayName as fallback
                      if (p.categoryDisplayName) {
                        const selectedCategory = categories.find(c => c.id === classArchiveCategoryFilter)
                        if (selectedCategory && selectedCategory.displayName === p.categoryDisplayName) {
                          return true
                        }
                      }
                      return false
                    })
                    .filter(p => 
                      !classArchiveSearch.trim() || 
                      p.displayName?.toLowerCase().includes(classArchiveSearch.toLowerCase()) ||
                      p.name?.toLowerCase().includes(classArchiveSearch.toLowerCase()) ||
                      (p.description && p.description.toLowerCase().includes(classArchiveSearch.toLowerCase()))
                    )
                  
                  return filteredPrograms.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No archived classes found</div>
                  ) : null
                })()}
              </div>
            )}
          </div>
        )}

        {/* Category & Class Management */}
        {!showArchivedCategories && !showArchivedClasses && (
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl md:text-3xl font-display font-bold text-black">
              Category & Class Management
            </h2>
            <div className="flex gap-2">
              <motion.button
                onClick={() => {
                  setEditingCategoryId(null)
                  setCategoryFormData({ name: '', displayName: '', description: '' })
                  setShowCategoryModal(true)
                }}
                className="flex items-center space-x-2 bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Plus className="w-4 h-4" />
                <span>Add Category</span>
              </motion.button>
            </div>
          </div>

          {programsLoading || categoriesLoading ? (
            <div className="text-center py-12 text-gray-600">Loading...</div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-600 mb-4 font-semibold">Error Loading Data</div>
              <div className="text-gray-600 mb-4">{error}</div>
              <button
                onClick={() => {
                  fetchAllPrograms()
                  fetchAllCategories()
                }}
                className="bg-vortex-red hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {categories
                .filter(cat => !cat.archived)
                .map((category) => {
                  const categoryPrograms = programs.filter(p => 
                    (p.categoryId === category.id || p.categoryDisplayName === category.displayName) &&
                    !p.archived
                  )

                  return (
                    <div key={category.id} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl md:text-2xl font-display font-bold text-black">
                              {category.displayName}
                            </h3>
                          </div>
                          {category.description && (
                            <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedCategoryForClass(category.id)
                              setProgramFormData({})
                              setShowClassModal(true)
                            }}
                            className="flex items-center gap-2 px-3 py-2 bg-vortex-red hover:bg-red-700 rounded text-white text-sm font-medium"
                          >
                            <Plus className="w-4 h-4" />
                            Add Class
                          </button>
                          <button
                            onClick={() => {
                              setEditingCategoryId(category.id)
                              setCategoryFormData({
                                name: category.name,
                                displayName: category.displayName,
                                description: category.description || ''
                              })
                              setShowCategoryModal(true)
                            }}
                            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleArchiveCategory(category.id, true)}
                            className="flex items-center gap-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-white text-sm font-medium"
                          >
                            <Archive className="w-4 h-4" />
                            Archive
                          </button>
                        </div>
                      </div>
                      <div className="space-y-4">
                        {categoryPrograms.length === 0 ? (
                          <div className="text-center py-8 text-gray-500 text-sm">No classes in this category</div>
                        ) : (
                          categoryPrograms.map((program) => (
                        <div key={program.id} className="bg-white rounded-lg p-4 border border-gray-300">
                          {editingProgramId === program.id ? (
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-semibold text-gray-700 mb-2">Display Name *</label>
                                  <input
                                    type="text"
                                    value={programFormData.displayName || ''}
                                    onChange={(e) => setProgramFormData({ ...programFormData, displayName: e.target.value })}
                                    className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                                    required
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-semibold text-gray-700 mb-2">Skill Level</label>
                                  <select
                                    value={programFormData.skillLevel || ''}
                                    onChange={(e) => setProgramFormData({ ...programFormData, skillLevel: e.target.value as Program['skillLevel'] || null })}
                                    className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                                  >
                                    <option value="">None (All Levels)</option>
                                    <option value="EARLY_STAGE">Early Stage</option>
                                    <option value="BEGINNER">Beginner</option>
                                    <option value="INTERMEDIATE">Intermediate</option>
                                    <option value="ADVANCED">Advanced</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-sm font-semibold text-gray-700 mb-2">Minimum Age</label>
                                  <input
                                    type="number"
                                    value={programFormData.ageMin ?? ''}
                                    onChange={(e) => setProgramFormData({ ...programFormData, ageMin: e.target.value ? parseInt(e.target.value) : null })}
                                    className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                                    min="0"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-semibold text-gray-700 mb-2">Maximum Age</label>
                                  <input
                                    type="number"
                                    value={programFormData.ageMax ?? ''}
                                    onChange={(e) => setProgramFormData({ ...programFormData, ageMax: e.target.value ? parseInt(e.target.value) : null })}
                                    className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                                    min="0"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                                <textarea
                                  value={programFormData.description || ''}
                                  onChange={(e) => setProgramFormData({ ...programFormData, description: e.target.value })}
                                  rows={4}
                                  className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Skill Requirements</label>
                                <input
                                  type="text"
                                  value={programFormData.skillRequirements || ''}
                                  onChange={(e) => setProgramFormData({ ...programFormData, skillRequirements: e.target.value })}
                                  className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                                  placeholder="e.g., No Experience Required, Skill Evaluation Required"
                                />
                              </div>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={programFormData.isActive ?? true}
                                  onChange={(e) => setProgramFormData({ ...programFormData, isActive: e.target.checked })}
                                  className="w-4 h-4 text-vortex-red bg-white border-gray-300 rounded focus:ring-vortex-red"
                                />
                                <label className="text-sm font-semibold text-gray-700">Active</label>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={handleUpdateProgram}
                                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm font-medium"
                                >
                                  <Save className="w-4 h-4" />
                                  Save Changes
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingProgramId(null)
                                    setProgramFormData({})
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
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h4 className="text-lg font-semibold text-black">{program.displayName}</h4>
                                    {program.archived && (
                                      <span className="text-xs bg-gray-500 text-white px-2 py-1 rounded">Archived</span>
                                    )}
                                    {!program.isActive && (
                                      <span className="text-xs bg-gray-500 text-white px-2 py-1 rounded">Inactive</span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
                                    {program.skillLevel && (
                                      <div>
                                        <span className="font-medium text-gray-600">Skill Level:</span> {program.skillLevel.replace('_', ' ')}
                                      </div>
                                    )}
                                    {(program.ageMin !== null || program.ageMax !== null) && (
                                      <div>
                                        <span className="font-medium text-gray-600">Age Range:</span>{' '}
                                        {program.ageMin !== null ? program.ageMin : 'Any'} - {program.ageMax !== null ? program.ageMax : 'Any'}
                                      </div>
                                    )}
                                    {program.skillRequirements && (
                                      <div className="md:col-span-2">
                                        <span className="font-medium text-gray-600">Requirements:</span> {program.skillRequirements}
                                      </div>
                                    )}
                                    {program.description && (
                                      <div className="md:col-span-2">
                                        <span className="font-medium text-gray-600">Description:</span> {program.description}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleEditProgram(program)}
                                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleArchiveProgram(program.id, true)}
                                    className="flex items-center gap-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-white text-sm font-medium"
                                  >
                                    <Archive className="w-4 h-4" />
                                    Archive
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                          ))
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
        )}
      </motion.div>

      {/* Category Modal */}
      <AnimatePresence>
        {showCategoryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => {
                setShowCategoryModal(false)
                setEditingCategoryId(null)
                setCategoryFormData({})
              }}
            />
            <motion.div
              className="relative bg-gray-800 rounded-lg p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-display font-bold text-white">
                  {editingCategoryId ? 'Edit Category' : 'Add New Category'}
                </h3>
                <button
                  onClick={() => {
                    setShowCategoryModal(false)
                    setEditingCategoryId(null)
                    setCategoryFormData({})
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Name (Internal) *</label>
                    <input
                      type="text"
                      value={categoryFormData.name || ''}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      placeholder="e.g., GYMNASTICS"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Display Name *</label>
                    <input
                      type="text"
                      value={categoryFormData.displayName || ''}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, displayName: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      placeholder="e.g., Gymnastics"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Description</label>
                  <textarea
                    value={categoryFormData.description || ''}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                    placeholder="Optional description for this category"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowCategoryModal(false)
                      setEditingCategoryId(null)
                      setCategoryFormData({})
                    }}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (editingCategoryId) {
                        await handleUpdateCategory()
                        setShowCategoryModal(false)
                      } else {
                        await handleCreateCategory()
                      }
                    }}
                    className="px-4 py-2 bg-vortex-red hover:bg-red-700 rounded text-white text-sm font-medium"
                  >
                    {editingCategoryId ? 'Save Changes' : 'Create Category'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Class Modal */}
      <AnimatePresence>
        {showClassModal && selectedCategoryForClass && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => {
                setShowClassModal(false)
                setSelectedCategoryForClass(null)
                setProgramFormData({})
              }}
            />
            <motion.div
              className="relative bg-gray-800 rounded-lg p-6 max-w-4xl w-full shadow-xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-display font-bold text-white">
                  Add New Class
                </h3>
                <button
                  onClick={() => {
                    setShowClassModal(false)
                    setSelectedCategoryForClass(null)
                    setProgramFormData({})
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Display Name *</label>
                    <input
                      type="text"
                      value={programFormData.displayName || ''}
                      onChange={(e) => setProgramFormData({ ...programFormData, displayName: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Skill Level</label>
                    <select
                      value={programFormData.skillLevel || ''}
                      onChange={(e) => setProgramFormData({ ...programFormData, skillLevel: e.target.value as Program['skillLevel'] || null })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                    >
                      <option value="">None (All Levels)</option>
                      <option value="EARLY_STAGE">Early Stage</option>
                      <option value="BEGINNER">Beginner</option>
                      <option value="INTERMEDIATE">Intermediate</option>
                      <option value="ADVANCED">Advanced</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Minimum Age</label>
                    <input
                      type="number"
                      value={programFormData.ageMin ?? ''}
                      onChange={(e) => setProgramFormData({ ...programFormData, ageMin: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Maximum Age</label>
                    <input
                      type="number"
                      value={programFormData.ageMax ?? ''}
                      onChange={(e) => setProgramFormData({ ...programFormData, ageMax: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                      min="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Description</label>
                  <textarea
                    value={programFormData.description || ''}
                    onChange={(e) => setProgramFormData({ ...programFormData, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Skill Requirements</label>
                  <input
                    type="text"
                    value={programFormData.skillRequirements || ''}
                    onChange={(e) => setProgramFormData({ ...programFormData, skillRequirements: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                    placeholder="e.g., No Experience Required, Skill Evaluation Required"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={programFormData.isActive ?? true}
                    onChange={(e) => setProgramFormData({ ...programFormData, isActive: e.target.checked })}
                    className="w-4 h-4 text-vortex-red bg-gray-600 border-gray-500 rounded focus:ring-vortex-red"
                  />
                  <label className="text-sm font-semibold text-gray-300">Active</label>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowClassModal(false)
                      setSelectedCategoryForClass(null)
                      setProgramFormData({})
                    }}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateClass}
                    className="px-4 py-2 bg-vortex-red hover:bg-red-700 rounded text-white text-sm font-medium"
                  >
                    Create Class
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

