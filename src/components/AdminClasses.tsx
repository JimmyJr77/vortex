import { useState, useEffect, Fragment, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Edit2, Archive, X, Plus, Search, ChevronDown, ChevronUp, Loader2, Trash2, Layers, ArrowUpDown, ArrowUp, ArrowDown, ArrowRight, Table2, RefreshCw } from 'lucide-react'
import { adminApiRequest } from '../utils/api'
import ClassEventModal from './programs/ClassEventModal'
import type { ClassEvent } from '../utils/programsApi'
import { syncSchedulingCategories } from '../utils/programsApi'
import type { SchedulingNavigationIntent } from '../utils/schedulingNavigation'
import AdminClassesEventsSpreadsheet from './classes/AdminClassesEventsSpreadsheet'
import ClassSchedulingExpandPanel from './classes/ClassSchedulingExpandPanel'

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
  programIsActive?: boolean // Parent program active flag
  schedulingCategoryId?: number | null // program.scheduling_category_id — the single mapped scheduling category
  schedulingCategoryName?: string | null // Scheduling category label, computed server-side
  sportTags?: string | null // Comma-joined sport tags from the parent program
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
  isActive?: boolean
  createdAt: string
  updatedAt: string
}

const iconBtn =
  'p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none'
const iconBtnDanger =
  'p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:pointer-events-none'
const thClass = 'px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider'
const tdClass = 'px-4 py-3 align-middle text-sm text-gray-900'

type ClassSortField = 'sportTag' | 'program' | 'class' | 'category' | 'ageRange' | 'skillLevel' | 'status'

function SortableColumnHeader({
  label,
  field,
  sortConfig,
  onSort,
}: {
  label: string
  field: ClassSortField
  sortConfig: { field: ClassSortField; direction: 'asc' | 'desc' }
  onSort: (field: ClassSortField) => void
}) {
  const icon =
    sortConfig.field !== field ? (
      <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />
    ) : sortConfig.direction === 'asc' ? (
      <ArrowUp className="w-3 h-3 ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1" />
    )
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="flex items-center hover:text-vortex-red transition-colors"
    >
      {label} {icon}
    </button>
  )
}

function formatAgeRange(ageMin: number | null, ageMax: number | null): string {
  if (ageMin == null && ageMax == null) return 'Any age'
  return `${ageMin ?? 'Any'} – ${ageMax ?? 'Any'}`
}

function formatSkillLevel(skillLevel: string | null): string {
  if (!skillLevel) return 'ALL LEVELS'
  return skillLevel.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function programNameForClass(program: Program, categories: Category[]): string {
  const match = categories.find(
    (c) => c.id === program.categoryId || c.displayName === program.categoryDisplayName,
  )
  return match?.displayName || program.categoryDisplayName || program.categoryName || 'Unassigned'
}

function toClassEvent(program: Program): ClassEvent {
  return {
    id: program.id,
    programsId: program.categoryId ?? undefined,
    categoryId: program.categoryId ?? undefined,
    name: program.name,
    displayName: program.displayName,
    skillLevel: program.skillLevel,
    ageMin: program.ageMin,
    ageMax: program.ageMax,
    description: program.description,
    skillRequirements: program.skillRequirements,
    isActive: program.isActive,
    archived: program.archived,
    schedulingCategoryId: program.schedulingCategoryId ?? null,
    schedulingCategoryName: program.schedulingCategoryName ?? null,
    sportTags: program.sportTags ?? null,
    createdAt: program.createdAt,
    updatedAt: program.updatedAt,
  }
}

function programIsActiveFlag(category: Category): boolean {
  return category.isActive !== false
}

function parentProgramActiveForClass(program: Program, categories: Category[]): boolean {
  const parent = categories.find(
    (c) =>
      (program.categoryId != null && c.id === program.categoryId) ||
      (program.categoryDisplayName != null && c.displayName === program.categoryDisplayName),
  )
  if (parent) return programIsActiveFlag(parent)
  return program.programIsActive !== false
}

function effectiveClassActive(program: Program, categories: Category[]): boolean {
  return parentProgramActiveForClass(program, categories) && program.isActive
}

function classStoredActive(program: Program): boolean {
  return program.isActive
}

function ActiveToggle({
  checked,
  disabled,
  onChange,
  title,
}: {
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
  title: string
}) {
  return (
    <label
      className={`inline-flex items-center gap-2 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      title={title}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 text-vortex-red border-gray-300 rounded focus:ring-vortex-red"
      />
      <span className="text-sm text-gray-700">{checked ? 'Active' : 'Inactive'}</span>
    </label>
  )
}

export default function AdminClasses({
  onOpenScheduling,
}: {
  onOpenScheduling?: (intent: SchedulingNavigationIntent) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [programsLoading, setProgramsLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
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
  const [editingClassEvent, setEditingClassEvent] = useState<ClassEvent | null>(null)
  const [expandedProgramId, setExpandedProgramId] = useState<number | null>(null)
  const [expandedClassId, setExpandedClassId] = useState<number | null>(null)
  const [classSearch, setClassSearch] = useState('')
  const [classSortConfig, setClassSortConfig] = useState<{ field: ClassSortField; direction: 'asc' | 'desc' }>({
    field: 'program',
    direction: 'asc',
  })
  const [viewMode, setViewMode] = useState<'default' | 'spreadsheet'>('default')
  const [syncing, setSyncing] = useState(false)

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
        if (editingClassEvent?.id === id) {
          setEditingClassEvent(null)
          setShowClassModal(false)
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
      const displayName = categoryFormData.displayName?.trim()
      if (!displayName) {
        alert('Display name is required')
        return
      }
      const name = displayName.toUpperCase().replace(/\s+/g, '_')
      const response = await adminApiRequest('/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify({
          name,
          displayName,
          description: categoryFormData.description,
        })
      })
      
      if (response.ok) {
        await fetchAllCategories()
        await fetchAllPrograms()
        setCategoryFormData({ displayName: '', description: '' })
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

  const handleSyncCategories = async () => {
    setSyncing(true)
    try {
      await syncSchedulingCategories()
      await fetchAllPrograms()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to refresh from scheduling')
    } finally {
      setSyncing(false)
    }
  }

  const handleEditClass = (program: Program) => {
    setEditingClassEvent(toClassEvent(program))
    setSelectedCategoryForClass(program.categoryId ?? null)
    setShowClassModal(true)
  }

  const toggleProgramExpand = (id: number) => {
    setExpandedProgramId((prev) => (prev === id ? null : id))
  }

  const toggleClassExpand = (id: number) => {
    setExpandedClassId((prev) => (prev === id ? null : id))
  }

  const handleToggleProgramActive = async (category: Category, next: boolean) => {
    const prevCategories = categories
    setCategories((cats) =>
      cats.map((c) => (c.id === category.id ? { ...c, isActive: next } : c)),
    )
    try {
      const response = await adminApiRequest(`/api/admin/categories/${category.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: next }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to update program status')
      }
      await Promise.all([fetchAllPrograms(), fetchAllCategories()])
    } catch (err) {
      setCategories(prevCategories)
      alert(err instanceof Error ? err.message : 'Failed to update program status')
    }
  }

  const handleToggleClassActive = async (program: Program, next: boolean) => {
    if (!parentProgramActiveForClass(program, categories) && next) {
      alert('Activate the program before activating this class.')
      return
    }
    try {
      const response = await adminApiRequest(`/api/admin/programs/${program.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: next }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to update class status')
      }
      await fetchAllPrograms()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update class status')
    }
  }

  const handleOpenScheduling = (program: Program) => {
    if (!program.categoryId) {
      alert('Assign this class to a program before setting up scheduling.')
      return
    }
    onOpenScheduling?.({
      programsId: program.categoryId,
      classEventId: program.id,
      categorySelection: 'none',
      targetPanel: 'offerings',
    })
  }

  useEffect(() => {
    fetchAllPrograms()
    fetchAllCategories()
  }, [])

  useEffect(() => {
    fetchAllPrograms()
    fetchAllCategories()
  }, [showArchivedClasses, showArchivedCategories])

  const activePrograms = categories.filter((c) => !c.archived)
  const activeClasses = programs.filter((p) => !p.archived)
  const archivedProgramsList = categories.filter((c) => c.archived)

  const schedulingCategoryById = useMemo(() => {
    const map = new Map<number, string>()
    for (const p of programs) map.set(p.id, p.schedulingCategoryName ?? 'No Category')
    return map
  }, [programs])

  const schedulingCategoryLabel = useCallback(
    (classId: number) => schedulingCategoryById.get(classId) ?? 'No Category',
    [schedulingCategoryById],
  )

  const handleClassSort = (field: ClassSortField) => {
    setClassSortConfig((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const compareActiveClasses = (a: Program, b: Program): number => {
    const dir = classSortConfig.direction === 'asc' ? 1 : -1
    let cmp = 0

    switch (classSortConfig.field) {
      case 'sportTag':
        cmp = (a.sportTags || '').localeCompare(b.sportTags || '')
        break
      case 'program':
        cmp = programNameForClass(a, categories).localeCompare(programNameForClass(b, categories))
        break
      case 'class':
        cmp = a.displayName.localeCompare(b.displayName)
        break
      case 'category':
        cmp = schedulingCategoryLabel(a.id).localeCompare(schedulingCategoryLabel(b.id))
        break
      case 'ageRange': {
        const aMin = a.ageMin ?? Number.MAX_SAFE_INTEGER
        const bMin = b.ageMin ?? Number.MAX_SAFE_INTEGER
        if (aMin !== bMin) {
          cmp = aMin - bMin
        } else {
          const aMax = a.ageMax ?? Number.MAX_SAFE_INTEGER
          const bMax = b.ageMax ?? Number.MAX_SAFE_INTEGER
          cmp = aMax - bMax
        }
        break
      }
      case 'skillLevel':
        cmp = formatSkillLevel(a.skillLevel).localeCompare(formatSkillLevel(b.skillLevel))
        break
      case 'status': {
        const aActive = effectiveClassActive(a, categories) ? 1 : 0
        const bActive = effectiveClassActive(b, categories) ? 1 : 0
        cmp = aActive - bActive
        break
      }
    }

    if (cmp !== 0) return cmp * dir

    const progCmp = programNameForClass(a, categories).localeCompare(programNameForClass(b, categories))
    if (progCmp !== 0) return progCmp
    return a.displayName.localeCompare(b.displayName)
  }

  const filteredActiveClasses = activeClasses
    .filter((p) => {
      if (!classSearch.trim()) return true
      const q = classSearch.toLowerCase()
      return (
        p.displayName.toLowerCase().includes(q) ||
        programNameForClass(p, categories).toLowerCase().includes(q) ||
        schedulingCategoryLabel(p.id).toLowerCase().includes(q) ||
        (p.sportTags?.toLowerCase().includes(q) ?? false) ||
        (p.description?.toLowerCase().includes(q) ?? false) ||
        (p.skillRequirements?.toLowerCase().includes(q) ?? false)
      )
    })
    .sort(compareActiveClasses)

  const classCountForProgram = (programId: number, displayName: string) =>
    activeClasses.filter(
      (p) => p.categoryId === programId || p.categoryDisplayName === displayName,
    ).length

  const programNameById = useCallback(
    (programId: number) => {
      const cat = categories.find((c) => c.id === programId)
      return cat?.displayName ?? 'Unassigned'
    },
    [categories],
  )

  const spreadsheetClasses = useMemo(
    () =>
      activeClasses.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        categoryId: p.categoryId,
        description: p.description,
        skillRequirements: p.skillRequirements,
      })),
    [activeClasses],
  )

  const renderClassDetailPanel = (program: Program) => (
    <ClassSchedulingExpandPanel
      classId={program.id}
      className={program.displayName}
      description={program.description}
      skillRequirements={program.skillRequirements}
      skillLevelLabel={formatSkillLevel(program.skillLevel)}
      storedActiveLabel={classStoredActive(program) ? 'Active' : 'Inactive'}
      effectiveActiveLabel={effectiveClassActive(program, categories) ? 'Active' : 'Inactive'}
    />
  )

  return (
    <>
      <motion.div
        key="classes"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="space-y-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Layers className="w-7 h-7 text-vortex-red" />
              Programs &amp; Classes
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              {viewMode === 'spreadsheet'
                ? 'All classes and events with offerings. Expand a row for offering dates, time slots, and signup.'
                : 'Top-level programs and their classes/events. Expand a row for offerings, slots, and signup.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setViewMode((mode) => (mode === 'spreadsheet' ? 'default' : 'spreadsheet'))
                setExpandedProgramId(null)
                setExpandedClassId(null)
              }}
              className="inline-flex items-center gap-2 border border-gray-300 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:bg-gray-50"
            >
              <Table2 className="w-5 h-5" />
              {viewMode === 'spreadsheet' ? 'Back to Programs & Classes' : 'View All Classes/Events'}
            </button>
            {viewMode === 'default' && (
            <button
              type="button"
              onClick={() => {
                setEditingCategoryId(null)
                setCategoryFormData({ displayName: '', description: '' })
                setShowCategoryModal(true)
              }}
              className="inline-flex items-center gap-2 bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700"
            >
              <Plus className="w-5 h-5" />
              New program
            </button>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-800 rounded-lg text-sm flex items-center justify-between gap-4">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => {
                setError(null)
                fetchAllPrograms()
                fetchAllCategories()
              }}
              className="text-sm font-semibold text-vortex-red hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {viewMode === 'spreadsheet' ? (
          <AdminClassesEventsSpreadsheet
            classes={spreadsheetClasses}
            programNameFor={programNameById}
            skillLevelFor={(classId) => {
              const program = activeClasses.find((p) => p.id === classId)
              return program ? formatSkillLevel(program.skillLevel) : '—'
            }}
            storedActiveFor={(classId) => {
              const program = activeClasses.find((p) => p.id === classId)
              return program && classStoredActive(program) ? 'Active' : 'Inactive'
            }}
            effectiveActiveFor={(classId) => {
              const program = activeClasses.find((p) => p.id === classId)
              return program && effectiveClassActive(program, categories) ? 'Active' : 'Inactive'
            }}
          />
        ) : showArchivedCategories ? (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-black">Program archives</h3>
              <button
                type="button"
                onClick={() => {
                  setShowArchivedCategories(false)
                  setShowArchivedClasses(false)
                }}
                title="Show active programs"
                aria-label="Show active programs"
                className={`${iconBtn} bg-gray-200 text-gray-900`}
              >
                <Archive className="w-5 h-5" />
              </button>
            </div>
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="search"
                placeholder="Search archived programs…"
                value={categoryArchiveSearch}
                onChange={(e) => setCategoryArchiveSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2.5 text-sm"
              />
            </div>
            {categoriesLoading ? (
              <div className="py-12 text-center text-gray-500 inline-flex items-center gap-2 justify-center w-full">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading…
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className={thClass}>Program</th>
                      <th className={thClass}>Description</th>
                      <th className={`${thClass} w-0`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {archivedProgramsList
                      .filter((cat) =>
                        !categoryArchiveSearch.trim() ||
                        cat.displayName.toLowerCase().includes(categoryArchiveSearch.toLowerCase()) ||
                        cat.name.toLowerCase().includes(categoryArchiveSearch.toLowerCase()) ||
                        (cat.description?.toLowerCase().includes(categoryArchiveSearch.toLowerCase()) ?? false),
                      )
                      .map((category) => (
                        <tr key={category.id} className="hover:bg-gray-50/80">
                          <td className={tdClass}>{category.displayName}</td>
                          <td className={`${tdClass} max-w-md truncate`}>{category.description || '—'}</td>
                          <td className={`${tdClass} w-0`}>
                            <div className="flex items-center gap-0.5">
                              <button type="button" className={iconBtn} title="Unarchive" aria-label="Unarchive" onClick={() => handleArchiveCategory(category.id, false)}>
                                <Archive className="w-4 h-4" />
                              </button>
                              <button type="button" className={iconBtnDanger} title="Delete" aria-label="Delete" onClick={() => handleDeleteCategory(category.id)}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : showArchivedClasses ? (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-black">Class archives</h3>
              <button
                type="button"
                onClick={() => {
                  setShowArchivedClasses(false)
                  setShowArchivedCategories(false)
                }}
                title="Show active classes"
                aria-label="Show active classes"
                className={`${iconBtn} bg-gray-200 text-gray-900`}
              >
                <Archive className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="search"
                  placeholder="Search archived classes…"
                  value={classArchiveSearch}
                  onChange={(e) => setClassArchiveSearch(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2.5 text-sm"
                />
              </div>
              <select
                value={classArchiveCategoryFilter === 'all' ? 'all' : String(classArchiveCategoryFilter)}
                onChange={(e) => setClassArchiveCategoryFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm max-w-xs"
              >
                <option value="all">All programs</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={String(cat.id)}>{cat.displayName}</option>
                ))}
              </select>
            </div>
            {programsLoading ? (
              <div className="py-12 text-center text-gray-500 inline-flex items-center gap-2 justify-center w-full">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading…
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className={thClass}>Sport Tag</th>
                      <th className={thClass}>Program</th>
                      <th className={thClass}>Class</th>
                      <th className={thClass}>Category</th>
                      <th className={thClass}>Age range</th>
                      <th className={`${thClass} w-0`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {programs
                      .filter((p) => p.archived)
                      .filter((p) => {
                        if (classArchiveCategoryFilter === 'all') return true
                        return p.categoryId === classArchiveCategoryFilter || p.categoryDisplayName === categories.find((c) => c.id === classArchiveCategoryFilter)?.displayName
                      })
                      .filter((p) =>
                        !classArchiveSearch.trim() ||
                        p.displayName.toLowerCase().includes(classArchiveSearch.toLowerCase()) ||
                        programNameForClass(p, categories).toLowerCase().includes(classArchiveSearch.toLowerCase()),
                      )
                      .map((program) => (
                        <tr key={program.id} className="hover:bg-gray-50/80">
                          <td className={tdClass}>{program.sportTags || '—'}</td>
                          <td className={tdClass}>{programNameForClass(program, categories)}</td>
                          <td className={tdClass}>{program.displayName}</td>
                          <td className={tdClass}>{schedulingCategoryLabel(program.id)}</td>
                          <td className={tdClass}>{formatAgeRange(program.ageMin, program.ageMax)}</td>
                          <td className={`${tdClass} w-0`}>
                            <div className="flex items-center gap-0.5">
                              <button type="button" className={iconBtn} title="Edit" aria-label="Edit" onClick={() => handleEditClass(program)}>
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button type="button" className={iconBtn} title="Unarchive" aria-label="Unarchive" onClick={() => handleArchiveProgram(program.id, false)}>
                                <Archive className="w-4 h-4" />
                              </button>
                              <button type="button" className={iconBtnDanger} title="Delete" aria-label="Delete" onClick={() => handleDeleteProgram(program.id)}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-black">Programs ({activePrograms.length})</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowArchivedCategories(true)
                    setShowArchivedClasses(false)
                  }}
                  title="Show program archives"
                  aria-label="Show program archives"
                  className={iconBtn}
                >
                  <Archive className="w-5 h-5" />
                </button>
              </div>
              {categoriesLoading ? (
                <div className="py-8 text-center text-gray-500 inline-flex items-center gap-2 justify-center w-full">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading programs…
                </div>
              ) : activePrograms.length === 0 ? (
                <div className="py-12 text-center text-gray-500 border border-dashed rounded-xl">No programs yet.</div>
              ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className={thClass}>Program</th>
                        <th className={thClass}>Classes</th>
                        <th className={thClass}>Status</th>
                        <th className={`${thClass} w-12 text-center`}>Details</th>
                        <th className={`${thClass} w-0`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {activePrograms.map((category) => (
                        <Fragment key={category.id}>
                          <tr
                            key={category.id}
                            className={`hover:bg-gray-50/80 cursor-pointer ${expandedProgramId === category.id ? 'bg-gray-50/50' : ''}`}
                            onClick={() => toggleProgramExpand(category.id)}
                          >
                            <td className={`${tdClass} font-medium`}>{category.displayName}</td>
                            <td className={tdClass}>{classCountForProgram(category.id, category.displayName)}</td>
                            <td className={tdClass}>
                              <ActiveToggle
                                checked={programIsActiveFlag(category)}
                                onChange={(next) => handleToggleProgramActive(category, next)}
                                title={
                                  programIsActiveFlag(category)
                                    ? 'Deactivate program and all its classes'
                                    : 'Activate program (classes keep their own settings)'
                                }
                              />
                            </td>
                            <td className={`${tdClass} text-center`} onClick={(e) => e.stopPropagation()}>
                              <button type="button" className={iconBtn} onClick={() => toggleProgramExpand(category.id)} aria-label="Toggle details">
                                {expandedProgramId === category.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </td>
                            <td className={`${tdClass} w-0`} onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  className={iconBtn}
                                  title="Add class"
                                  aria-label="Add class"
                                  onClick={() => {
                                    setSelectedCategoryForClass(category.id)
                                    setEditingClassEvent(null)
                                    setShowClassModal(true)
                                  }}
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  className={iconBtn}
                                  title="Edit program"
                                  aria-label="Edit program"
                                  onClick={() => {
                                    setEditingCategoryId(category.id)
                                    setCategoryFormData({
                                      displayName: category.displayName,
                                      description: category.description || '',
                                      isActive: programIsActiveFlag(category),
                                    })
                                    setShowCategoryModal(true)
                                  }}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button type="button" className={iconBtn} title="Archive program" aria-label="Archive program" onClick={() => handleArchiveCategory(category.id, true)}>
                                  <Archive className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expandedProgramId === category.id && (
                            <tr>
                              <td colSpan={5} className="px-0 py-0">
                                <div className="p-6 bg-gray-50 border-t-2 border-vortex-red text-sm text-gray-700">
                                  <span className="font-semibold text-gray-900">Description</span>
                                  <p className="mt-1 whitespace-pre-wrap">{category.description || '—'}</p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-black">Classes ({filteredActiveClasses.length})</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowArchivedClasses(true)
                      setShowArchivedCategories(false)
                    }}
                    title="Show class archives"
                    aria-label="Show class archives"
                    className={iconBtn}
                  >
                    <Archive className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleSyncCategories}
                    disabled={syncing}
                    title="Refresh from Scheduling (split merged classes, sync categories)"
                    aria-label="Refresh from Scheduling"
                    className={iconBtn}
                  >
                    <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="relative max-w-md w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="search"
                    placeholder="Search classes…"
                    value={classSearch}
                    onChange={(e) => setClassSearch(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2.5 text-sm"
                  />
                </div>
              </div>
              {programsLoading ? (
                <div className="py-8 text-center text-gray-500 inline-flex items-center gap-2 justify-center w-full">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading classes…
                </div>
              ) : filteredActiveClasses.length === 0 ? (
                <div className="py-12 text-center text-gray-500 border border-dashed rounded-xl">No classes match your search.</div>
              ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className={thClass}>
                          <SortableColumnHeader label="Sport Tag" field="sportTag" sortConfig={classSortConfig} onSort={handleClassSort} />
                        </th>
                        <th className={thClass}>
                          <SortableColumnHeader label="Program" field="program" sortConfig={classSortConfig} onSort={handleClassSort} />
                        </th>
                        <th className={thClass}>
                          <SortableColumnHeader label="Class" field="class" sortConfig={classSortConfig} onSort={handleClassSort} />
                        </th>
                        <th className={thClass}>
                          <SortableColumnHeader label="Category" field="category" sortConfig={classSortConfig} onSort={handleClassSort} />
                        </th>
                        <th className={thClass}>
                          <SortableColumnHeader label="Age range" field="ageRange" sortConfig={classSortConfig} onSort={handleClassSort} />
                        </th>
                        <th className={thClass}>
                          <SortableColumnHeader label="Skill level" field="skillLevel" sortConfig={classSortConfig} onSort={handleClassSort} />
                        </th>
                        <th className={thClass}>
                          <SortableColumnHeader label="Status" field="status" sortConfig={classSortConfig} onSort={handleClassSort} />
                        </th>
                        <th className={`${thClass} w-12 text-center`}>Details</th>
                        <th className={`${thClass} w-0`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredActiveClasses.map((program) => {
                        const parentProgramActive = parentProgramActiveForClass(program, categories)
                        return (
                        <Fragment key={program.id}>
                          <tr
                            key={program.id}
                            className={`hover:bg-gray-50/80 cursor-pointer ${expandedClassId === program.id ? 'bg-gray-50/50' : ''}`}
                            onClick={() => toggleClassExpand(program.id)}
                          >
                            <td className={tdClass}>{program.sportTags || '—'}</td>
                            <td className={tdClass}>{programNameForClass(program, categories)}</td>
                            <td className={`${tdClass} font-medium`}>{program.displayName}</td>
                            <td className={tdClass}>{schedulingCategoryLabel(program.id)}</td>
                            <td className={tdClass}>{formatAgeRange(program.ageMin, program.ageMax)}</td>
                            <td className={tdClass}>{formatSkillLevel(program.skillLevel)}</td>
                            <td className={tdClass}>
                              <div className="space-y-1">
                                <ActiveToggle
                                  checked={classStoredActive(program)}
                                  disabled={!parentProgramActive}
                                  onChange={(next) => handleToggleClassActive(program, next)}
                                  title={
                                    !parentProgramActive
                                      ? 'Activate the program first'
                                      : classStoredActive(program)
                                        ? 'Deactivate this class'
                                        : 'Activate this class'
                                  }
                                />
                                {!parentProgramActive && (
                                  <span className="text-xs text-amber-700 block">Program inactive</span>
                                )}
                              </div>
                            </td>
                            <td className={`${tdClass} text-center`} onClick={(e) => e.stopPropagation()}>
                              <button type="button" className={iconBtn} onClick={() => toggleClassExpand(program.id)} aria-label="Toggle details">
                                {expandedClassId === program.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </td>
                            <td className={`${tdClass} w-0`} onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-0.5">
                                <button type="button" className={iconBtn} title="Edit class" aria-label="Edit class" onClick={() => handleEditClass(program)}>
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  className={iconBtn}
                                  title="Set up scheduling"
                                  aria-label="Set up scheduling"
                                  onClick={() => handleOpenScheduling(program)}
                                  disabled={!onOpenScheduling || program.categoryId == null}
                                >
                                  <ArrowRight className="w-4 h-4" />
                                </button>
                                <button type="button" className={iconBtn} title="Archive class" aria-label="Archive class" onClick={() => handleArchiveProgram(program.id, true)}>
                                  <Archive className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expandedClassId === program.id && (
                            <tr>
                              <td colSpan={9} className="px-0 py-0">{renderClassDetailPanel(program)}</td>
                            </tr>
                          )}
                        </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
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
              className="relative bg-white rounded-2xl p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-black">
                  {editingCategoryId ? 'Edit program' : 'Add new program'}
                </h3>
                <button
                  onClick={() => {
                    setShowCategoryModal(false)
                    setEditingCategoryId(null)
                    setCategoryFormData({})
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display name *</label>
                  <input
                    type="text"
                    value={categoryFormData.displayName || ''}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, displayName: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="e.g., Gymnastics"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={categoryFormData.description || ''}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="Optional description for this program"
                  />
                </div>
                {editingCategoryId && (
                  <div>
                    <ActiveToggle
                      checked={categoryFormData.isActive !== false}
                      onChange={(next) => setCategoryFormData({ ...categoryFormData, isActive: next })}
                      title={
                        categoryFormData.isActive !== false
                          ? 'Deactivate program and all its classes'
                          : 'Activate program (classes keep their own settings)'
                      }
                    />
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowCategoryModal(false)
                      setEditingCategoryId(null)
                      setCategoryFormData({})
                    }}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
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
                    className="px-4 py-2 text-sm bg-vortex-red hover:bg-red-700 rounded-lg text-white font-semibold"
                  >
                    {editingCategoryId ? 'Save changes' : 'Create program'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ClassEventModal
        open={showClassModal && (selectedCategoryForClass != null || editingClassEvent != null)}
        programsId={selectedCategoryForClass ?? editingClassEvent?.programsId ?? editingClassEvent?.categoryId ?? 0}
        programsDisplayName={
          categories.find((c) => c.id === (selectedCategoryForClass ?? editingClassEvent?.categoryId))?.displayName
        }
        lockProgram={selectedCategoryForClass != null || editingClassEvent != null}
        parentProgramActive={
          (() => {
            const pid = selectedCategoryForClass ?? editingClassEvent?.categoryId ?? editingClassEvent?.programsId
            const parent = categories.find((c) => c.id === pid)
            return parent ? programIsActiveFlag(parent) : true
          })()
        }
        editing={editingClassEvent}
        onClose={() => {
          setShowClassModal(false)
          setSelectedCategoryForClass(null)
          setEditingClassEvent(null)
        }}
        onSaved={async () => {
          await fetchAllPrograms()
          setShowClassModal(false)
          setSelectedCategoryForClass(null)
          setEditingClassEvent(null)
        }}
      />

    </>
  )
}

