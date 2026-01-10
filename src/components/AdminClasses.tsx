import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Edit2, Archive, X, Save, Plus, Search, Trash2 } from 'lucide-react'
import { adminApiRequest } from '../utils/api'

interface Program {
  id: number
  category?: string // Legacy enum value - kept for backward compatibility, use categoryId instead
  categoryId?: number | null // Foreign key to program_categories table - SINGLE SOURCE OF TRUTH
  categoryName?: string | null // From database join with program_categories.name
  categoryDisplayName?: string | null // From database join with program_categories.display_name - SINGLE SOURCE OF TRUTH
  name: string // Database column: name
  displayName: string // Database column: display_name
  skillLevel: string | null // Database column: skill_level (enum value from database)
  ageMin: number | null // Database column: age_min
  ageMax: number | null // Database column: age_max
  description: string | null // Database column: description
  skillRequirements: string | null // Database column: skill_requirements
  isActive: boolean // Database column: is_active
  archived?: boolean // Database column: archived
  createdAt: string // Database column: created_at
  updatedAt: string // Database column: updated_at
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

interface TimeBlock {
  daysOfWeek: number[]
  startTime: string
  endTime: string
}

interface ClassIteration {
  id: number
  programId: number
  iterationNumber: number
  daysOfWeek: number[] // Legacy field - kept for backward compatibility
  startTime: string // Legacy field - kept for backward compatibility
  endTime: string // Legacy field - kept for backward compatibility
  timeBlocks?: TimeBlock[] // New field - array of time blocks for this iteration
  durationType: 'indefinite' | '3_month_block' | 'finite'
  startDate?: string | null
  endDate?: string | null
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
  const [programIterations, setProgramIterations] = useState<Partial<ClassIteration>[]>([])
  const [editingIterationIndex, setEditingIterationIndex] = useState<number | null>(null)
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
  const [, setIterations] = useState<ClassIteration[]>([])

  const fetchAllPrograms = async () => {
    try {
      setProgramsLoading(true)
      setError(null)
      // Fetch both archived and active programs
      const [activeResponse, archivedResponse] = await Promise.all([
        adminApiRequest('/api/admin/programs?archived=false'),
        adminApiRequest('/api/admin/programs?archived=true')
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
      
      // Fetch both archived and active categories
      const [activeResponse, archivedResponse] = await Promise.all([
        adminApiRequest('/api/admin/categories?archived=false'),
        adminApiRequest('/api/admin/categories?archived=true')
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
      const response = await adminApiRequest(`/api/admin/programs/${id}/archive`, {
        method: 'PATCH',
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
              await adminApiRequest(`/api/admin/categories/${category.id}/archive`, {
                method: 'PATCH',
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
      const response = await adminApiRequest(`/api/admin/programs/${id}`, {
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
      const response = await adminApiRequest('/api/admin/categories', {
        method: 'POST',
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
      // Create program with category_id
      const classData = {
        ...programFormData,
        categoryId: selectedCategoryForClass
      }
      
      const response = await adminApiRequest('/api/admin/programs', {
        method: 'POST',
        body: JSON.stringify(classData)
      })
      
      if (response.ok) {
        const data = await response.json()
        const newProgramId = data.data?.id
        
        // Create iterations if any were specified
        if (newProgramId && programIterations.length > 0) {
          for (const iteration of programIterations) {
            // Get timeBlocks or convert legacy format
            const timeBlocks = iteration.timeBlocks && iteration.timeBlocks.length > 0
              ? iteration.timeBlocks.map(tb => ({
                  daysOfWeek: tb.daysOfWeek || [],
                  startTime: tb.startTime && tb.startTime.length === 5 ? `${tb.startTime}:00` : (tb.startTime || '18:00:00'),
                  endTime: tb.endTime && tb.endTime.length === 5 ? `${tb.endTime}:00` : (tb.endTime || '19:30:00')
                }))
              : [{
                  daysOfWeek: iteration.daysOfWeek || [1, 2, 3, 4, 5],
                  startTime: (iteration.startTime || '18:00:00').length === 5 ? `${iteration.startTime}:00` : (iteration.startTime || '18:00:00'),
                  endTime: (iteration.endTime || '19:30:00').length === 5 ? `${iteration.endTime}:00` : (iteration.endTime || '19:30:00')
                }]
            
            // For backward compatibility, also send first time block as legacy fields
            const firstTimeBlock = timeBlocks[0]
            
            await adminApiRequest(`/api/admin/programs/${newProgramId}/iterations`, {
              method: 'POST',
              body: JSON.stringify({
                daysOfWeek: firstTimeBlock.daysOfWeek,
                startTime: firstTimeBlock.startTime,
                endTime: firstTimeBlock.endTime,
                timeBlocks: timeBlocks, // Always send timeBlocks (even if single block)
                durationType: iteration.durationType || 'indefinite',
                startDate: iteration.startDate,
                endDate: iteration.endDate
              })
            })
          }
        }
        
        await fetchAllPrograms()
        setProgramFormData({})
        setProgramIterations([])
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
      const response = await adminApiRequest(`/api/admin/categories/${editingCategoryId}`, {
        method: 'PUT',
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
      const response = await adminApiRequest(`/api/admin/categories/${id}/archive`, {
        method: 'PATCH',
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
      const response = await adminApiRequest(`/api/admin/categories/${id}`, {
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

  const fetchIterations = async (programId: number) => {
    try {
      const response = await adminApiRequest(`/api/admin/programs/${programId}/iterations`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          const fetchedIterations = data.data || []
          setIterations(fetchedIterations)
          return fetchedIterations
        }
      } else {
        // If we get a 500 error, it might mean the table doesn't exist yet
        // But the default iteration might have been created, so we'll return empty
        // and let the user know they need to add iterations
        const errorData = await response.json().catch(() => ({}))
        console.error('Error fetching iterations:', errorData.message || 'Unknown error')
        setIterations([])
        return []
      }
      return []
    } catch (error) {
      console.error('Error fetching iterations:', error)
      setIterations([])
      return []
    }
  }

  const handleEditProgram = async (program: Program) => {
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
      categoryId: program.categoryId || null, // Allow updating category
      categoryDisplayName: program.categoryDisplayName || program.categoryName || program.category || null // For display only
    })
    const fetchedIterations = await fetchIterations(program.id)
    // Convert fetched iterations to form data format
    // Convert legacy format to new timeBlocks format
    const iterationsData = fetchedIterations.map((iter: ClassIteration) => {
      // If timeBlocks exists, use it; otherwise convert legacy fields to timeBlocks format
      const timeBlocks = iter.timeBlocks && iter.timeBlocks.length > 0 
        ? iter.timeBlocks 
        : [{ daysOfWeek: iter.daysOfWeek || [], startTime: iter.startTime || '18:00:00', endTime: iter.endTime || '19:30:00' }]
      return {
        daysOfWeek: iter.daysOfWeek, // Keep for backward compatibility
        startTime: iter.startTime, // Keep for backward compatibility
        endTime: iter.endTime, // Keep for backward compatibility
        timeBlocks, // New format
        durationType: iter.durationType,
        startDate: iter.startDate || undefined,
        endDate: iter.endDate || undefined
      }
    })
    
    // If no iterations were fetched but this is a newly created class,
    // it might have a default iteration that we can't fetch yet (table doesn't exist)
    // In that case, we'll show empty and let user add iterations
    // But if fetch failed with 500, show a helpful message
    if (iterationsData.length === 0) {
      // Check if there was an error - if so, the iterations might exist but table is missing
      // We'll still set empty array, but the UI will show a message
      setProgramIterations([])
    } else {
      setProgramIterations(iterationsData)
    }
    setEditingIterationIndex(null)
  }

  const handleUpdateProgram = async () => {
    if (!editingProgramId) return
    
    try {
      // Allow categoryId to be updated, but don't send archived (managed separately)
      // Also remove categoryDisplayName as it's display-only and not allowed by validation
      const updateData = { ...programFormData }
      delete updateData.archived
      delete updateData.categoryDisplayName
      // Keep categoryId if it's set, otherwise don't send it (won't update if not provided)
      
      const response = await adminApiRequest(`/api/admin/programs/${editingProgramId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      })
      
      if (response.ok) {
        // Update iterations - first get existing iterations
        const existingIterationsResponse = await adminApiRequest(`/api/admin/programs/${editingProgramId}/iterations`)
        const existingIterationsData = existingIterationsResponse.ok ? await existingIterationsResponse.json() : { data: [] }
        const existingIterations = existingIterationsData.data || []
        
        // Delete iterations that are no longer in programIterations
        for (const existing of existingIterations) {
          const stillExists = programIterations.some((_iter, idx) => {
            // Match by iteration number or by comparing all fields
            return existing.iterationNumber === idx + 1
          })
          if (!stillExists) {
            await adminApiRequest(`/api/admin/programs/${editingProgramId}/iterations/${existing.id}`, {
              method: 'DELETE'
            })
          }
        }
        
        // Create or update iterations
        for (let i = 0; i < programIterations.length; i++) {
          const iteration = programIterations[i]
          const existing = existingIterations.find((iter: ClassIteration) => iter.iterationNumber === i + 1)
          
          // Get timeBlocks or convert legacy format
          const timeBlocks = iteration.timeBlocks && iteration.timeBlocks.length > 0
            ? iteration.timeBlocks.map(tb => ({
                daysOfWeek: tb.daysOfWeek || [],
                startTime: tb.startTime && tb.startTime.length === 5 ? `${tb.startTime}:00` : (tb.startTime || '18:00:00'),
                endTime: tb.endTime && tb.endTime.length === 5 ? `${tb.endTime}:00` : (tb.endTime || '19:30:00')
              }))
            : [{
                daysOfWeek: iteration.daysOfWeek || [1, 2, 3, 4, 5],
                startTime: (iteration.startTime || '18:00:00').length === 5 ? `${iteration.startTime}:00` : (iteration.startTime || '18:00:00'),
                endTime: (iteration.endTime || '19:30:00').length === 5 ? `${iteration.endTime}:00` : (iteration.endTime || '19:30:00')
              }]
          
          // For backward compatibility, also send first time block as legacy fields
          const firstTimeBlock = timeBlocks[0]
          
          const iterationData = {
            daysOfWeek: firstTimeBlock.daysOfWeek,
            startTime: firstTimeBlock.startTime,
            endTime: firstTimeBlock.endTime,
            timeBlocks: timeBlocks, // Always send timeBlocks (even if single block)
            durationType: iteration.durationType || 'indefinite',
            startDate: iteration.startDate,
            endDate: iteration.endDate
          }
          
          if (existing) {
            // Update existing iteration
            await adminApiRequest(`/api/admin/programs/${editingProgramId}/iterations/${existing.id}`, {
              method: 'PUT',
              body: JSON.stringify(iterationData)
            })
          } else {
            // Create new iteration
            await adminApiRequest(`/api/admin/programs/${editingProgramId}/iterations`, {
              method: 'POST',
              body: JSON.stringify(iterationData)
            })
          }
        }
        
        // Refresh both programs and categories to ensure UI is up to date
        await Promise.all([fetchAllPrograms(), fetchAllCategories()])
        if (editingProgramId) {
          await fetchIterations(editingProgramId)
        }
        setEditingProgramId(null)
        setProgramFormData({})
        setProgramIterations([])
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

  const addIterationToForm = () => {
    // Add new iteration with default values (Mon-Fri, 6pm-7:30pm, indefinite)
    const newIteration = {
      daysOfWeek: [1, 2, 3, 4, 5], // Monday through Friday (legacy, for backward compatibility)
      startTime: '18:00:00', // 6:00 PM (legacy, for backward compatibility)
      endTime: '19:30:00', // 7:30 PM (legacy, for backward compatibility)
      timeBlocks: [{ // New structure - array of time blocks
        daysOfWeek: [1, 2, 3, 4, 5], // Monday through Friday
        startTime: '18:00:00', // 6:00 PM
        endTime: '19:30:00' // 7:30 PM
      }],
      durationType: 'indefinite' as const
    }
    setProgramIterations([...programIterations, newIteration])
    // Automatically start editing the new iteration
    setEditingIterationIndex(programIterations.length)
  }

  const updateIterationInForm = (index: number, iteration: Partial<ClassIteration>) => {
    const updated = [...programIterations]
    updated[index] = { ...updated[index], ...iteration }
    setProgramIterations(updated)
  }

  const removeIterationFromForm = (index: number) => {
    setProgramIterations(programIterations.filter((_, i) => i !== index))
  }

  const addTimeBlockToIteration = (iterationIndex: number) => {
    const updated = [...programIterations]
    const iteration = updated[iterationIndex]
    const timeBlocks = iteration.timeBlocks || [{ daysOfWeek: [], startTime: '18:00:00', endTime: '19:30:00' }]
    timeBlocks.push({ daysOfWeek: [], startTime: '18:00:00', endTime: '19:30:00' })
    updated[iterationIndex] = { ...iteration, timeBlocks }
    setProgramIterations(updated)
  }

  const removeTimeBlockFromIteration = (iterationIndex: number, timeBlockIndex: number) => {
    const updated = [...programIterations]
    const iteration = updated[iterationIndex]
    const timeBlocks = iteration.timeBlocks || []
    if (timeBlocks.length > 1) {
      timeBlocks.splice(timeBlockIndex, 1)
      updated[iterationIndex] = { ...iteration, timeBlocks }
      setProgramIterations(updated)
    }
  }

  const updateTimeBlockInIteration = (
    iterationIndex: number,
    timeBlockIndex: number,
    updates: Partial<TimeBlock>
  ) => {
    const updated = [...programIterations]
    const iteration = updated[iterationIndex]
    const timeBlocks = [...(iteration.timeBlocks || [])]
    timeBlocks[timeBlockIndex] = { ...timeBlocks[timeBlockIndex], ...updates }
    updated[iterationIndex] = { ...iteration, timeBlocks }
    setProgramIterations(updated)
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
                                  onChange={(e) => setProgramFormData({ ...programFormData, skillLevel: e.target.value || null })}
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
                                    onChange={(e) => setProgramFormData({ ...programFormData, skillLevel: e.target.value || null })}
                                    className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                                  >
                                    <option value="">None (All Levels)</option>
                                    {/* TODO: Fetch skill levels from database (skill_levels table) based on selected category */}
                                    {/* For now, using enum values as fallback - Database column: skill_level */}
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
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                                <select
                                  value={programFormData.categoryId ?? ''}
                                  onChange={(e) => setProgramFormData({ ...programFormData, categoryId: e.target.value ? parseInt(e.target.value, 10) : null })}
                                  className="w-full px-3 py-2 bg-white text-black rounded border border-gray-300"
                                >
                                  <option value="">No Category (Uncategorized)</option>
                                  {categories
                                    .filter(cat => !cat.archived)
                                    .map(cat => (
                                      <option key={cat.id} value={cat.id}>
                                        {cat.displayName}
                                      </option>
                                    ))}
                                </select>
                                {program.categoryDisplayName || program.categoryName || program.category ? (
                                  <p className="text-xs text-gray-500 mt-1">
                                    Current: {program.categoryDisplayName || program.categoryName || program.category || 'Uncategorized'}
                                    {program.category && !program.categoryDisplayName && (
                                      <span className="text-yellow-600 ml-2">(Using enum value - please assign to category above)</span>
                                    )}
                                  </p>
                                ) : null}
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
                              
                              {/* Class Iterations Section */}
                              <div className="border-t border-gray-300 pt-4 mt-4">
                                <div className="flex justify-between items-center mb-4">
                                  <h4 className="text-lg font-semibold text-gray-700">Class Iterations</h4>
                                  <button
                                    type="button"
                                    onClick={addIterationToForm}
                                    className="flex items-center gap-2 px-3 py-2 bg-vortex-red hover:bg-red-700 rounded text-white text-sm font-medium"
                                  >
                                    <Plus className="w-4 h-4" />
                                    Add Iteration
                                  </button>
                                </div>
                                {programIterations.length === 0 ? (
                                  <div className="space-y-2">
                                    <p className="text-sm text-gray-500">No iterations loaded. Click "Add Iteration" to create one.</p>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    {programIterations.map((iteration, index) => {
                                      return (
                                        <div key={index} className="bg-gray-50 p-3 rounded border border-gray-200">
                                          <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                              <div className="font-semibold text-gray-800 mb-2">
                                                Iteration {index + 1}
                                              </div>
                                              {editingIterationIndex === index ? (
                                                <div className="space-y-3">
                                                  {/* Time Blocks */}
                                                  <div className="space-y-3">
                                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Time Blocks *</label>
                                                    {((iteration.timeBlocks && iteration.timeBlocks.length > 0) ? iteration.timeBlocks : [{ daysOfWeek: iteration.daysOfWeek || [], startTime: iteration.startTime || '18:00:00', endTime: iteration.endTime || '19:30:00' }]).map((timeBlock, timeBlockIndex) => (
                                                      <div key={timeBlockIndex} className="bg-white p-3 rounded border border-gray-300 relative">
                                                        {timeBlockIndex > 0 && (
                                                          <button
                                                            type="button"
                                                            onClick={() => removeTimeBlockFromIteration(index, timeBlockIndex)}
                                                            className="absolute top-2 right-2 p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                                                            title="Remove this time block"
                                                          >
                                                            <Trash2 className="w-4 h-4" />
                                                          </button>
                                                        )}
                                                        <div className="mb-2">
                                                          <label className="block text-xs font-semibold text-gray-700 mb-1">Days of Week *</label>
                                                          <div className="grid grid-cols-7 gap-1">
                                                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, dayIndex) => (
                                                              <label key={day} className="flex items-center space-x-1">
                                                                <input
                                                                  type="checkbox"
                                                                  checked={(timeBlock.daysOfWeek || []).includes(dayIndex)}
                                                                  onChange={(e) => {
                                                                    const currentDays = timeBlock.daysOfWeek || []
                                                                    let newDays
                                                                    if (e.target.checked) {
                                                                      newDays = [...currentDays, dayIndex].sort()
                                                                    } else {
                                                                      newDays = currentDays.filter((d: number) => d !== dayIndex)
                                                                    }
                                                                    updateTimeBlockInIteration(index, timeBlockIndex, { daysOfWeek: newDays })
                                                                  }}
                                                                  className="w-3 h-3 text-vortex-red bg-white border-gray-300 rounded focus:ring-vortex-red"
                                                                />
                                                                <span className="text-xs text-gray-700">{day}</span>
                                                              </label>
                                                            ))}
                                                          </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                          <div>
                                                            <label className="block text-xs font-semibold text-gray-700 mb-1">Start Time *</label>
                                                            <input
                                                              type="time"
                                                              value={timeBlock.startTime ? timeBlock.startTime.substring(0, 5) : '18:00'}
                                                              onChange={(e) => updateTimeBlockInIteration(index, timeBlockIndex, { startTime: e.target.value || '18:00:00' })}
                                                              className="w-full px-2 py-1 bg-white text-black rounded border border-gray-300 text-sm"
                                                            />
                                                          </div>
                                                          <div>
                                                            <label className="block text-xs font-semibold text-gray-700 mb-1">End Time *</label>
                                                            <input
                                                              type="time"
                                                              value={timeBlock.endTime ? timeBlock.endTime.substring(0, 5) : '19:30'}
                                                              onChange={(e) => updateTimeBlockInIteration(index, timeBlockIndex, { endTime: e.target.value || '19:30:00' })}
                                                              className="w-full px-2 py-1 bg-white text-black rounded border border-gray-300 text-sm"
                                                            />
                                                          </div>
                                                        </div>
                                                      </div>
                                                    ))}
                                                    <button
                                                      type="button"
                                                      onClick={() => addTimeBlockToIteration(index)}
                                                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-white text-xs font-medium w-full justify-center"
                                                    >
                                                      <Plus className="w-3 h-3" />
                                                      Add Another Time Block
                                                    </button>
                                                  </div>
                                                  <div>
                                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Duration Type *</label>
                                                    <select
                                                      value={iteration.durationType || 'indefinite'}
                                                      onChange={(e) => updateIterationInForm(index, { durationType: e.target.value as 'indefinite' | '3_month_block' | 'finite' })}
                                                      className="w-full px-2 py-1 bg-white text-black rounded border border-gray-300 text-sm"
                                                    >
                                                      <option value="indefinite">Indefinite</option>
                                                      <option value="3_month_block">3-Month Block</option>
                                                      <option value="finite">Finite (Specific Dates)</option>
                                                    </select>
                                                  </div>
                                                  {(iteration.durationType === '3_month_block' || iteration.durationType === 'finite') && (
                                                    <div>
                                                      <label className="block text-xs font-semibold text-gray-700 mb-1">Start Date *</label>
                                                      <input
                                                        type="date"
                                                        value={iteration.startDate || ''}
                                                        onChange={(e) => updateIterationInForm(index, { startDate: e.target.value })}
                                                        className="w-full px-2 py-1 bg-white text-black rounded border border-gray-300 text-sm"
                                                      />
                                                    </div>
                                                  )}
                                                  {iteration.durationType === 'finite' && (
                                                    <div>
                                                      <label className="block text-xs font-semibold text-gray-700 mb-1">End Date *</label>
                                                      <input
                                                        type="date"
                                                        value={iteration.endDate || ''}
                                                        onChange={(e) => updateIterationInForm(index, { endDate: e.target.value })}
                                                        className="w-full px-2 py-1 bg-white text-black rounded border border-gray-300 text-sm"
                                                      />
                                                    </div>
                                                  )}
                                                  <div className="flex gap-2">
                                                    <button
                                                      type="button"
                                                      onClick={() => setEditingIterationIndex(null)}
                                                      className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-white text-xs font-medium"
                                                    >
                                                      Done
                                                    </button>
                                                  </div>
                                                </div>
                                              ) : (
                                                <div className="text-sm text-gray-600 space-y-1">
                                                  <div><span className="font-medium">Time Blocks:</span></div>
                                                  {((iteration.timeBlocks && iteration.timeBlocks.length > 0) ? iteration.timeBlocks : [{ daysOfWeek: iteration.daysOfWeek || [], startTime: iteration.startTime || '18:00:00', endTime: iteration.endTime || '19:30:00' }]).map((timeBlock, timeBlockIndex) => {
                                                    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                                                    const timeBlockDays = (timeBlock.daysOfWeek || []).map((d: number) => dayNames[d]).join(', ')
                                                    const startTime = timeBlock.startTime ? timeBlock.startTime.substring(0, 5) : '18:00'
                                                    const endTime = timeBlock.endTime ? timeBlock.endTime.substring(0, 5) : '19:30'
                                                    return (
                                                      <div key={timeBlockIndex} className="ml-2 text-xs">
                                                        {timeBlockDays || 'None'}: {startTime} - {endTime}
                                                      </div>
                                                    )
                                                  })}
                                                  <div><span className="font-medium">Duration:</span> {
                                                    iteration.durationType === 'indefinite' ? 'Indefinite' :
                                                    iteration.durationType === '3_month_block' ? `3-Month Block (from ${iteration.startDate || 'TBD'})` :
                                                    `Finite (${iteration.startDate || 'TBD'} to ${iteration.endDate || 'TBD'})`
                                                  }</div>
                                                </div>
                                              )}
                                            </div>
                                            <div className="flex gap-2 ml-2">
                                              {editingIterationIndex !== index && (
                                                <>
                                                  <button
                                                    type="button"
                                                    onClick={() => setEditingIterationIndex(index)}
                                                    className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-xs font-medium"
                                                  >
                                                    <Edit2 className="w-3 h-3" />
                                                    Edit
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => removeIterationFromForm(index)}
                                                    className="flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-xs font-medium"
                                                  >
                                                    <X className="w-3 h-3" />
                                                    Remove
                                                  </button>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
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
                                    setIterations([])
                                    setProgramIterations([])
                                    setEditingIterationIndex(null)
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
              
              {/* Show orphaned programs that don't match any category */}
              {(() => {
                // Find all active programs
                const allActivePrograms = programs.filter(p => !p.archived)
                
                // Find programs that have been assigned to categories
                const assignedProgramIds = new Set<number>()
                categories
                  .filter(cat => !cat.archived)
                  .forEach(category => {
                    programs
                      .filter(p => 
                        (p.categoryId === category.id || p.categoryDisplayName === category.displayName) &&
                        !p.archived
                      )
                      .forEach(p => assignedProgramIds.add(p.id))
                  })
                
                // Find orphaned programs (not assigned to any category)
                const orphanedPrograms = allActivePrograms.filter(p => !assignedProgramIds.has(p.id))
                
                if (orphanedPrograms.length === 0) {
                  return null
                }
                
                return (
                  <div className="bg-yellow-50 rounded-lg p-6 border-2 border-yellow-400">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl md:text-2xl font-display font-bold text-black">
                            Uncategorized Programs
                          </h3>
                          <span className="text-xs bg-yellow-500 text-white px-2 py-1 rounded">
                            {orphanedPrograms.length} program{orphanedPrograms.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <p className="text-sm text-yellow-800 mt-1">
                          These programs are not assigned to any category. Please assign them to the correct category or archive them.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {orphanedPrograms.map((program) => (
                        <div key={program.id} className="bg-white rounded-lg p-4 border border-yellow-300">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="text-lg font-semibold text-black">{program.displayName}</h4>
                                {program.category && (
                                  <span className="text-xs bg-gray-500 text-white px-2 py-1 rounded">
                                    Enum: {program.category}
                                  </span>
                                )}
                                {program.categoryDisplayName && (
                                  <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">
                                    Category Display: {program.categoryDisplayName}
                                  </span>
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
                                <div className="md:col-span-2">
                                  <span className="font-medium text-gray-600">Category ID:</span> {program.categoryId || 'None'}
                                  {program.categoryId && (
                                    <span className="text-xs text-gray-500 ml-2">(Category may not exist or is archived)</span>
                                  )}
                                </div>
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
                      ))}
                    </div>
                  </div>
                )
              })()}
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
                setProgramIterations([])
                setEditingIterationIndex(null)
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
                    setProgramIterations([])
                    setEditingIterationIndex(null)
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

                {/* Class Iterations Section */}
                <div className="border-t border-gray-600 pt-4 mt-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-semibold text-gray-300">Class Iterations</h4>
                    <button
                      type="button"
                      onClick={addIterationToForm}
                      className="flex items-center gap-2 px-3 py-2 bg-vortex-red hover:bg-red-700 rounded text-white text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Add Iteration
                    </button>
                  </div>
                  {programIterations.length === 0 ? (
                    <p className="text-sm text-gray-400">No iterations yet. Add one to set class schedule. A default iteration will be created if none are specified.</p>
                  ) : (
                    <div className="space-y-3">
                      {programIterations.map((iteration, index) => {
                        return (
                          <div key={index} className="bg-gray-700 p-3 rounded border border-gray-600">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="font-semibold text-gray-200 mb-2">
                                  Iteration {index + 1}
                                </div>
                                {editingIterationIndex === index ? (
                                  <div className="space-y-3">
                                    {/* Time Blocks */}
                                    <div className="space-y-3">
                                      <label className="block text-xs font-semibold text-gray-300 mb-1">Time Blocks *</label>
                                      {((iteration.timeBlocks && iteration.timeBlocks.length > 0) ? iteration.timeBlocks : [{ daysOfWeek: iteration.daysOfWeek || [], startTime: iteration.startTime || '18:00:00', endTime: iteration.endTime || '19:30:00' }]).map((timeBlock, timeBlockIndex) => (
                                        <div key={timeBlockIndex} className="bg-gray-600 p-3 rounded border border-gray-500 relative">
                                          {timeBlockIndex > 0 && (
                                            <button
                                              type="button"
                                              onClick={() => removeTimeBlockFromIteration(index, timeBlockIndex)}
                                              className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded"
                                              title="Remove this time block"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </button>
                                          )}
                                          <div className="mb-2">
                                            <label className="block text-xs font-semibold text-gray-300 mb-1">Days of Week *</label>
                                            <div className="grid grid-cols-7 gap-1">
                                              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, dayIndex) => (
                                                <label key={day} className="flex items-center space-x-1">
                                                  <input
                                                    type="checkbox"
                                                    checked={(timeBlock.daysOfWeek || []).includes(dayIndex)}
                                                    onChange={(e) => {
                                                      const currentDays = timeBlock.daysOfWeek || []
                                                      let newDays
                                                      if (e.target.checked) {
                                                        newDays = [...currentDays, dayIndex].sort()
                                                      } else {
                                                        newDays = currentDays.filter((d: number) => d !== dayIndex)
                                                      }
                                                      updateTimeBlockInIteration(index, timeBlockIndex, { daysOfWeek: newDays })
                                                    }}
                                                    className="w-3 h-3 text-vortex-red bg-gray-600 border-gray-500 rounded focus:ring-vortex-red"
                                                  />
                                                  <span className="text-xs text-gray-300">{day}</span>
                                                </label>
                                              ))}
                                            </div>
                                          </div>
                                          <div className="grid grid-cols-2 gap-2">
                                            <div>
                                              <label className="block text-xs font-semibold text-gray-300 mb-1">Start Time *</label>
                                              <input
                                                type="time"
                                                value={timeBlock.startTime ? timeBlock.startTime.substring(0, 5) : '18:00'}
                                                onChange={(e) => updateTimeBlockInIteration(index, timeBlockIndex, { startTime: e.target.value || '18:00:00' })}
                                                className="w-full px-2 py-1 bg-gray-700 text-white rounded border border-gray-500 text-sm"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-xs font-semibold text-gray-300 mb-1">End Time *</label>
                                              <input
                                                type="time"
                                                value={timeBlock.endTime ? timeBlock.endTime.substring(0, 5) : '19:30'}
                                                onChange={(e) => updateTimeBlockInIteration(index, timeBlockIndex, { endTime: e.target.value || '19:30:00' })}
                                                className="w-full px-2 py-1 bg-gray-700 text-white rounded border border-gray-500 text-sm"
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                      <button
                                        type="button"
                                        onClick={() => addTimeBlockToIteration(index)}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-white text-xs font-medium w-full justify-center"
                                      >
                                        <Plus className="w-3 h-3" />
                                        Add Another Time Block
                                      </button>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold text-gray-300 mb-1">Duration Type *</label>
                                      <select
                                        value={iteration.durationType || 'indefinite'}
                                        onChange={(e) => updateIterationInForm(index, { durationType: e.target.value as 'indefinite' | '3_month_block' | 'finite' })}
                                        className="w-full px-2 py-1 bg-gray-600 text-white rounded border border-gray-500 text-sm"
                                      >
                                        <option value="indefinite">Indefinite</option>
                                        <option value="3_month_block">3-Month Block</option>
                                        <option value="finite">Finite (Specific Dates)</option>
                                      </select>
                                    </div>
                                    {(iteration.durationType === '3_month_block' || iteration.durationType === 'finite') && (
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-300 mb-1">Start Date *</label>
                                        <input
                                          type="date"
                                          value={iteration.startDate || ''}
                                          onChange={(e) => updateIterationInForm(index, { startDate: e.target.value })}
                                          className="w-full px-2 py-1 bg-gray-600 text-white rounded border border-gray-500 text-sm"
                                        />
                                      </div>
                                    )}
                                    {iteration.durationType === 'finite' && (
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-300 mb-1">End Date *</label>
                                        <input
                                          type="date"
                                          value={iteration.endDate || ''}
                                          onChange={(e) => updateIterationInForm(index, { endDate: e.target.value })}
                                          className="w-full px-2 py-1 bg-gray-600 text-white rounded border border-gray-500 text-sm"
                                        />
                                      </div>
                                    )}
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setEditingIterationIndex(null)}
                                        className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-white text-xs font-medium"
                                      >
                                        Done
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-sm text-gray-400 space-y-1">
                                    <div><span className="font-medium">Time Blocks:</span></div>
                                    {((iteration.timeBlocks && iteration.timeBlocks.length > 0) ? iteration.timeBlocks : [{ daysOfWeek: iteration.daysOfWeek || [], startTime: iteration.startTime || '18:00:00', endTime: iteration.endTime || '19:30:00' }]).map((timeBlock, timeBlockIndex) => {
                                      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                                      const timeBlockDays = (timeBlock.daysOfWeek || []).map((d: number) => dayNames[d]).join(', ')
                                      const startTime = timeBlock.startTime ? timeBlock.startTime.substring(0, 5) : '18:00'
                                      const endTime = timeBlock.endTime ? timeBlock.endTime.substring(0, 5) : '19:30'
                                      return (
                                        <div key={timeBlockIndex} className="ml-2 text-xs">
                                          {timeBlockDays || 'None'}: {startTime} - {endTime}
                                        </div>
                                      )
                                    })}
                                    <div><span className="font-medium">Duration:</span> {
                                      iteration.durationType === 'indefinite' ? 'Indefinite' :
                                      iteration.durationType === '3_month_block' ? `3-Month Block (from ${iteration.startDate || 'TBD'})` :
                                      `Finite (${iteration.startDate || 'TBD'} to ${iteration.endDate || 'TBD'})`
                                    }</div>
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-2 ml-2">
                                {editingIterationIndex !== index && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setEditingIterationIndex(index)}
                                      className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-xs font-medium"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeIterationFromForm(index)}
                                      className="flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-xs font-medium"
                                    >
                                      <X className="w-3 h-3" />
                                      Remove
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowClassModal(false)
                      setSelectedCategoryForClass(null)
                      setProgramFormData({})
                      setProgramIterations([])
                      setEditingIterationIndex(null)
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

