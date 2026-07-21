import { useState, useEffect, Fragment, useCallback, useMemo, useRef, type RefObject } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Edit2, Archive, X, Plus, Search, ChevronDown, ChevronUp, Loader2, Trash2, Layers, ArrowUpDown, ArrowUp, ArrowDown, ArrowRight, RefreshCw, Filter } from 'lucide-react'
import { adminApiRequest } from '../utils/api'
import ClassEventModal from './programs/ClassEventModal'
import PrimarySportPicker from './programs/PrimarySportPicker'
import type { ClassEvent } from '../utils/programsApi'
import { fetchDisciplineTags, consolidateClasses, deleteTopProgram, type DisciplineTag } from '../utils/programsApi'
import type { SchedulingNavigationIntent } from '../utils/schedulingNavigation'
import AdminClassesEventsSpreadsheet from './classes/AdminClassesEventsSpreadsheet'
import ClassSchedulingExpandPanel from './classes/ClassSchedulingExpandPanel'
import { loadSchedulingCountsForClasses } from '../utils/classSchedulingSummary'
import { compareSkillLevels, formatAgeRange, formatSkillLevel } from '../utils/classDisplayUtils'

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
  sportTags?: string | null // Comma-joined additional sport tags from the parent program
  primarySport?: string | null // Primary sport name from the parent program
  offeringCount?: number
  slotCount?: number
  archived?: boolean // Database column: archived
  createdAt: string // Database column: created_at
  updatedAt: string // Database column: updated_at
}

interface Category {
  id: number
  name: string
  displayName: string
  abridgedName?: string | null
  description?: string | null
  primarySportId?: number | null
  primarySportName?: string | null
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

type ClassSortField = 'primarySport' | 'program' | 'class' | 'offerings' | 'slots'

type StatusFilter = 'all' | 'active' | 'inactive'

type SkillLevelFilter = 'all' | 'none' | 'EARLY_STAGE' | 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'

const SKILL_LEVEL_FILTER_OPTIONS: { id: Exclude<SkillLevelFilter, 'all'>; label: string }[] = [
  { id: 'none', label: 'All levels' },
  { id: 'EARLY_STAGE', label: 'Early stage' },
  { id: 'BEGINNER', label: 'Beginner' },
  { id: 'INTERMEDIATE', label: 'Intermediate' },
  { id: 'ADVANCED', label: 'Advanced' },
]

function parseSportTags(sportTags: string | null | undefined): string[] {
  if (!sportTags?.trim()) return []
  return sportTags.split(',').map((tag) => tag.trim()).filter(Boolean)
}

function formatSportTagDisplay(sportTags: string | null | undefined): string {
  const tags = parseSportTags(sportTags)
  if (tags.length === 0) return '—'
  if (tags.length === 1) return tags[0]
  return 'Multiple'
}

function programHasSportTag(
  program: Program,
  tagName: string,
): boolean {
  const needle = tagName.toLowerCase()
  return parseSportTags(program.sportTags).some((name) => name.toLowerCase() === needle)
}

function rowKey(program: Program): string {
  return `${program.id}`
}

function programHasPrimarySport(program: Program, tagName: string): boolean {
  return (program.primarySport?.toLowerCase() ?? '') === tagName.toLowerCase()
}

function SportTagFilterHeader({
  activeFilterName,
  filterOpen,
  onToggleFilter,
  allSportTags,
  tagsLoading,
  selectedTagId,
  onSelectTag,
  onClearFilter,
  filterRef,
}: {
  activeFilterName: string | null
  filterOpen: boolean
  onToggleFilter: () => void
  allSportTags: DisciplineTag[]
  tagsLoading: boolean
  selectedTagId: number | null
  onSelectTag: (tagId: number) => void
  onClearFilter: () => void
  filterRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <div className="relative" ref={filterRef}>
      <button
        type="button"
        onClick={onToggleFilter}
        className="flex items-center hover:text-vortex-red transition-colors"
      >
        Sport Tag
        <Filter
          className={`w-3 h-3 ml-1 ${activeFilterName ? 'text-vortex-red' : 'opacity-50'}`}
        />
      </button>
      {filterOpen && (
        <div className="absolute z-30 top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          <button
            type="button"
            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
              selectedTagId == null ? 'bg-red-50 text-vortex-red font-medium' : ''
            }`}
            onClick={onClearFilter}
          >
            All sports
          </button>
          {tagsLoading ? (
            <p className="px-3 py-2 text-sm text-gray-500 inline-flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading…
            </p>
          ) : allSportTags.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">No sport tags yet.</p>
          ) : (
            allSportTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                  selectedTagId === tag.id ? 'bg-red-50 text-vortex-red font-medium' : ''
                }`}
                onClick={() => onSelectTag(tag.id)}
              >
                {tag.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function PrimarySportFilterHeader({
  activeFilterName,
  filterOpen,
  onToggleFilter,
  allSportTags,
  tagsLoading,
  selectedTagId,
  onSelectTag,
  onClearFilter,
  filterRef,
  sortConfig,
  onSort,
}: {
  activeFilterName: string | null
  filterOpen: boolean
  onToggleFilter: () => void
  allSportTags: DisciplineTag[]
  tagsLoading: boolean
  selectedTagId: number | null
  onSelectTag: (tagId: number) => void
  onClearFilter: () => void
  filterRef: RefObject<HTMLDivElement | null>
  sortConfig: { field: ClassSortField; direction: 'asc' | 'desc' }
  onSort: (field: ClassSortField) => void
}) {
  const sortIcon =
    sortConfig.field !== 'primarySport' ? (
      <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />
    ) : sortConfig.direction === 'asc' ? (
      <ArrowUp className="w-3 h-3 ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1" />
    )

  return (
    <div className="relative flex items-center gap-1" ref={filterRef}>
      <button
        type="button"
        onClick={() => onSort('primarySport')}
        className="flex items-center hover:text-vortex-red transition-colors"
      >
        Primary Sport
        {sortIcon}
      </button>
      <button
        type="button"
        onClick={onToggleFilter}
        className="p-0.5 hover:text-vortex-red transition-colors"
        aria-label="Filter primary sport"
      >
        <Filter
          className={`w-3 h-3 ${activeFilterName ? 'text-vortex-red' : 'opacity-50'}`}
        />
      </button>
      {filterOpen && (
        <div className="absolute z-30 top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          <button
            type="button"
            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
              selectedTagId == null ? 'bg-red-50 text-vortex-red font-medium' : ''
            }`}
            onClick={onClearFilter}
          >
            All primary sports
          </button>
          {tagsLoading ? (
            <p className="px-3 py-2 text-sm text-gray-500 inline-flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading…
            </p>
          ) : allSportTags.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">No sport tags yet.</p>
          ) : (
            allSportTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                  selectedTagId === tag.id ? 'bg-red-50 text-vortex-red font-medium' : ''
                }`}
                onClick={() => onSelectTag(tag.id)}
              >
                {tag.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function StatusFilterHeader({
  activeFilterLabel,
  filterOpen,
  onToggleFilter,
  selectedFilter,
  onSelectFilter,
  onClearFilter,
  filterRef,
}: {
  activeFilterLabel: string | null
  filterOpen: boolean
  onToggleFilter: () => void
  selectedFilter: StatusFilter
  onSelectFilter: (filter: StatusFilter) => void
  onClearFilter: () => void
  filterRef: RefObject<HTMLDivElement | null>
}) {
  const options: { id: StatusFilter; label: string }[] = [
    { id: 'active', label: 'Active' },
    { id: 'inactive', label: 'Inactive' },
  ]

  return (
    <div className="relative" ref={filterRef}>
      <button
        type="button"
        onClick={onToggleFilter}
        className="flex items-center hover:text-vortex-red transition-colors"
      >
        Status
        <Filter
          className={`w-3 h-3 ml-1 ${activeFilterLabel ? 'text-vortex-red' : 'opacity-50'}`}
        />
      </button>
      {filterOpen && (
        <div className="absolute z-30 top-full left-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <button
            type="button"
            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
              selectedFilter === 'all' ? 'bg-red-50 text-vortex-red font-medium' : ''
            }`}
            onClick={onClearFilter}
          >
            All statuses
          </button>
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                selectedFilter === option.id ? 'bg-red-50 text-vortex-red font-medium' : ''
              }`}
              onClick={() => onSelectFilter(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SkillLevelFilterHeader({
  activeFilterLabel,
  filterOpen,
  onToggleFilter,
  selectedFilter,
  onSelectFilter,
  onClearFilter,
  filterRef,
}: {
  activeFilterLabel: string | null
  filterOpen: boolean
  onToggleFilter: () => void
  selectedFilter: SkillLevelFilter
  onSelectFilter: (filter: SkillLevelFilter) => void
  onClearFilter: () => void
  filterRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <div className="relative" ref={filterRef}>
      <button
        type="button"
        onClick={onToggleFilter}
        className="flex items-center hover:text-vortex-red transition-colors"
      >
        Skill level
        <Filter
          className={`w-3 h-3 ml-1 ${activeFilterLabel ? 'text-vortex-red' : 'opacity-50'}`}
        />
      </button>
      {filterOpen && (
        <div className="absolute z-30 top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <button
            type="button"
            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
              selectedFilter === 'all' ? 'bg-red-50 text-vortex-red font-medium' : ''
            }`}
            onClick={onClearFilter}
          >
            All skill levels
          </button>
          {SKILL_LEVEL_FILTER_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                selectedFilter === option.id ? 'bg-red-50 text-vortex-red font-medium' : ''
              }`}
              onClick={() => onSelectFilter(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SortFilterColumnHeader({
  label,
  field,
  sortConfig,
  onSort,
  filterOpen,
  onToggleFilter,
  activeFilterLabel,
  filterRef,
  options,
  selectedKey,
  onSelectKey,
  onClearFilter,
  clearLabel,
  optionsLoading,
}: {
  label: string
  field: ClassSortField
  sortConfig: { field: ClassSortField; direction: 'asc' | 'desc' }
  onSort: (field: ClassSortField) => void
  filterOpen: boolean
  onToggleFilter: () => void
  activeFilterLabel: string | null
  filterRef: RefObject<HTMLDivElement | null>
  options: { key: string; label: string }[]
  selectedKey: string | null
  onSelectKey: (key: string) => void
  onClearFilter: () => void
  clearLabel: string
  optionsLoading?: boolean
}) {
  const sortIcon =
    sortConfig.field !== field ? (
      <ArrowUpDown className="w-3 h-3 opacity-50" />
    ) : sortConfig.direction === 'asc' ? (
      <ArrowUp className="w-3 h-3" />
    ) : (
      <ArrowDown className="w-3 h-3" />
    )

  return (
    <div className="relative flex items-center gap-1" ref={filterRef}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="flex items-center hover:text-vortex-red transition-colors"
      >
        {label}
        <span className="ml-1">{sortIcon}</span>
      </button>
      <button
        type="button"
        onClick={onToggleFilter}
        className="p-0.5 hover:text-vortex-red transition-colors"
        aria-label={`Filter ${label}`}
      >
        <Filter
          className={`w-3 h-3 ${activeFilterLabel ? 'text-vortex-red' : 'opacity-50'}`}
        />
      </button>
      {filterOpen && (
        <div className="absolute z-30 top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          <button
            type="button"
            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
              selectedKey == null ? 'bg-red-50 text-vortex-red font-medium' : ''
            }`}
            onClick={onClearFilter}
          >
            {clearLabel}
          </button>
          {optionsLoading ? (
            <p className="px-3 py-2 text-sm text-gray-500 inline-flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading…
            </p>
          ) : options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">No options yet.</p>
          ) : (
            options.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                  selectedKey === option.key ? 'bg-red-50 text-vortex-red font-medium' : ''
                }`}
                onClick={() => onSelectKey(option.key)}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

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
    sportTags: program.sportTags ?? null,
    primarySport: program.primarySport ?? null,
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

function StatusLabel({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
        active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  )
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
  spreadsheetOnly = false,
}: {
  onOpenScheduling?: (intent: SchedulingNavigationIntent) => void
  spreadsheetOnly?: boolean
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
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null)
  const [classSearch, setClassSearch] = useState('')
  const [classSortConfig, setClassSortConfig] = useState<{ field: ClassSortField; direction: 'asc' | 'desc' }>({
    field: 'program',
    direction: 'asc',
  })
  const viewMode: 'default' | 'spreadsheet' = spreadsheetOnly ? 'spreadsheet' : 'default'
  const [syncing, setSyncing] = useState(false)
  const [allSportTags, setAllSportTags] = useState<DisciplineTag[]>([])
  const [sportTagsLoading, setSportTagsLoading] = useState(false)
  const [sportTagFilterId, setSportTagFilterId] = useState<number | null>(null)
  const [sportTagFilterOpen, setSportTagFilterOpen] = useState(false)
  const sportTagFilterRef = useRef<HTMLDivElement>(null)
  const [primarySportFilterId, setPrimarySportFilterId] = useState<number | null>(null)
  const [primarySportFilterOpen, setPrimarySportFilterOpen] = useState(false)
  const primarySportFilterRef = useRef<HTMLDivElement>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [statusFilterOpen, setStatusFilterOpen] = useState(false)
  const statusFilterRef = useRef<HTMLDivElement>(null)
  const [skillLevelFilter, setSkillLevelFilter] = useState<SkillLevelFilter>('all')
  const [skillLevelFilterOpen, setSkillLevelFilterOpen] = useState(false)
  const skillLevelFilterRef = useRef<HTMLDivElement>(null)
  const [programFilterKey, setProgramFilterKey] = useState<string | null>(null)
  const [programFilterOpen, setProgramFilterOpen] = useState(false)
  const programFilterRef = useRef<HTMLDivElement>(null)
  const [classFilterKey, setClassFilterKey] = useState<string | null>(null)
  const [classFilterOpen, setClassFilterOpen] = useState(false)
  const classFilterRef = useRef<HTMLDivElement>(null)

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
        const merged = [...activeData.data, ...archivedData.data]
        setPrograms(merged)
        const countTargets = merged.filter((p) => !p.archived).map((p) => ({ id: p.id }))
        loadSchedulingCountsForClasses(countTargets)
          .then((countsMap) => {
            setPrograms((prev) =>
              prev.map((p) => {
                const counts = countsMap.get(p.id)
                if (!counts) return p
                return {
                  ...p,
                  offeringCount: counts.offeringCount,
                  slotCount: counts.slotCount,
                }
              }),
            )
          })
          .catch(() => {})
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
      const abridgedName = categoryFormData.abridgedName?.trim() || displayName
      const name = displayName.toUpperCase().replace(/\s+/g, '_')
      const response = await adminApiRequest('/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify({
          name,
          displayName,
          abridgedName,
          description: categoryFormData.description,
          primarySportId: categoryFormData.primarySportId ?? null,
        })
      })
      
      if (response.ok) {
        await fetchAllCategories()
        await fetchAllPrograms()
        setCategoryFormData({ displayName: '', abridgedName: '', description: '', primarySportId: null })
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
        body: JSON.stringify({
          displayName: categoryFormData.displayName,
          abridgedName:
            categoryFormData.abridgedName?.trim() || categoryFormData.displayName?.trim() || undefined,
          description: categoryFormData.description,
          isActive: categoryFormData.isActive,
          primarySportId: categoryFormData.primarySportId ?? null,
        }),
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

  const handleDeleteCategory = async (category: Category) => {
    const count = classCountForProgram(category.id, category.displayName)
    const message =
      count > 0
        ? `Permanently delete "${category.displayName}" and its ${count} class(es)? This cannot be undone.`
        : `Permanently delete "${category.displayName}"? This cannot be undone.`
    if (!confirm(message)) {
      return
    }

    try {
      await deleteTopProgram(category.id)
      await Promise.all([fetchAllCategories(), fetchAllPrograms()])
      if (expandedProgramId === category.id) setExpandedProgramId(null)
    } catch (error) {
      console.error('Error deleting program:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete program')
    }
  }

  const handleSyncCategories = async () => {
    setSyncing(true)
    try {
      await consolidateClasses()
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

  const toggleClassExpand = (key: string) => {
    setExpandedClassId((prev) => (prev === key ? null : key))
  }

  const handleOpenScheduling = (program: Program) => {
    if (!program.categoryId) {
      alert('Assign this class to a program before setting up scheduling.')
      return
    }
    onOpenScheduling?.({
      programsId: program.categoryId,
      classEventId: program.id,
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

  useEffect(() => {
    setSportTagsLoading(true)
    fetchDisciplineTags()
      .then(setAllSportTags)
      .catch(() => setAllSportTags([]))
      .finally(() => setSportTagsLoading(false))
  }, [])

  useEffect(() => {
    if (!sportTagFilterOpen) return
    const handleMouseDown = (e: MouseEvent) => {
      if (sportTagFilterRef.current && !sportTagFilterRef.current.contains(e.target as Node)) {
        setSportTagFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [sportTagFilterOpen])

  useEffect(() => {
    if (!primarySportFilterOpen) return
    const handleMouseDown = (e: MouseEvent) => {
      if (primarySportFilterRef.current && !primarySportFilterRef.current.contains(e.target as Node)) {
        setPrimarySportFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [primarySportFilterOpen])

  useEffect(() => {
    if (!statusFilterOpen) return
    const handleMouseDown = (e: MouseEvent) => {
      if (statusFilterRef.current && !statusFilterRef.current.contains(e.target as Node)) {
        setStatusFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [statusFilterOpen])

  useEffect(() => {
    if (!skillLevelFilterOpen) return
    const handleMouseDown = (e: MouseEvent) => {
      if (skillLevelFilterRef.current && !skillLevelFilterRef.current.contains(e.target as Node)) {
        setSkillLevelFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [skillLevelFilterOpen])

  useEffect(() => {
    if (!programFilterOpen) return
    const handleMouseDown = (e: MouseEvent) => {
      if (programFilterRef.current && !programFilterRef.current.contains(e.target as Node)) {
        setProgramFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [programFilterOpen])

  useEffect(() => {
    if (!classFilterOpen) return
    const handleMouseDown = (e: MouseEvent) => {
      if (classFilterRef.current && !classFilterRef.current.contains(e.target as Node)) {
        setClassFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [classFilterOpen])

  const activeSportTagFilterName = useMemo(() => {
    if (sportTagFilterId == null) return null
    return allSportTags.find((t) => t.id === sportTagFilterId)?.name ?? null
  }, [sportTagFilterId, allSportTags])

  const activePrimarySportFilterName = useMemo(() => {
    if (primarySportFilterId == null) return null
    return allSportTags.find((t) => t.id === primarySportFilterId)?.name ?? null
  }, [primarySportFilterId, allSportTags])

  const activeStatusFilterLabel =
    statusFilter === 'active' ? 'Active' : statusFilter === 'inactive' ? 'Inactive' : null

  const activeSkillLevelFilterLabel =
    skillLevelFilter === 'all'
      ? null
      : (SKILL_LEVEL_FILTER_OPTIONS.find((o) => o.id === skillLevelFilter)?.label ?? null)

  const activePrograms = categories.filter((c) => !c.archived)
  const activeClasses = programs.filter((p) => !p.archived)
  const archivedProgramsList = categories.filter((c) => c.archived)

  const programFilterOptions = useMemo(
    () =>
      activePrograms
        .map((c) => ({ key: String(c.id), label: c.displayName }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [activePrograms],
  )

  const classFilterOptions = useMemo(
    () =>
      activeClasses
        .map((p) => ({ key: String(p.id), label: p.displayName }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [activeClasses],
  )

  const activeProgramFilterLabel =
    programFilterKey == null
      ? null
      : (programFilterOptions.find((o) => o.key === programFilterKey)?.label ?? null)

  const activeClassFilterLabel =
    classFilterKey == null
      ? null
      : (classFilterOptions.find((o) => o.key === classFilterKey)?.label ?? null)

  const handleClassSort = (field: ClassSortField) => {
    setClassSortConfig((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const compareSameProgramClasses = (a: Program, b: Program): number => {
    const skillCmp = compareSkillLevels(a.skillLevel, b.skillLevel)
    if (skillCmp !== 0) return skillCmp
    return a.displayName.localeCompare(b.displayName)
  }

  const compareActiveClassRows = (a: Program, b: Program): number => {
    const dir = classSortConfig.direction === 'asc' ? 1 : -1
    let cmp = 0

    switch (classSortConfig.field) {
      case 'primarySport':
        cmp = (a.primarySport ?? '').localeCompare(b.primarySport ?? '')
        break
      case 'program':
        cmp = programNameForClass(a, categories).localeCompare(programNameForClass(b, categories))
        break
      case 'class':
        cmp = a.displayName.localeCompare(b.displayName)
        break
      case 'offerings': {
        const aCount = a.offeringCount ?? 0
        const bCount = b.offeringCount ?? 0
        cmp = aCount - bCount
        break
      }
      case 'slots': {
        const aCount = a.slotCount ?? 0
        const bCount = b.slotCount ?? 0
        cmp = aCount - bCount
        break
      }
    }

    if (cmp !== 0) return cmp * dir

    if (classSortConfig.field === 'program') {
      return compareSameProgramClasses(a, b)
    }

    const progCmp = programNameForClass(a, categories).localeCompare(programNameForClass(b, categories))
    if (progCmp !== 0) return progCmp
    return compareSameProgramClasses(a, b)
  }

  const filteredActiveClassRows = activeClasses
    .filter((p) => {
      if (programFilterKey != null) {
        const programId = Number(programFilterKey)
        const matchesProgram =
          p.categoryId === programId ||
          programNameForClass(p, categories) ===
            categories.find((c) => c.id === programId)?.displayName
        if (!matchesProgram) return false
      }
      if (classFilterKey != null && String(p.id) !== classFilterKey) return false
      if (primarySportFilterId != null) {
        const tagName = allSportTags.find((t) => t.id === primarySportFilterId)?.name
        if (tagName && !programHasPrimarySport(p, tagName)) return false
      }
      if (sportTagFilterId != null) {
        const tagName = allSportTags.find((t) => t.id === sportTagFilterId)?.name
        if (tagName && !programHasSportTag(p, tagName)) return false
      }
      if (statusFilter === 'active' && !classStoredActive(p)) return false
      if (statusFilter === 'inactive' && classStoredActive(p)) return false
      if (skillLevelFilter === 'none' && p.skillLevel != null) return false
      if (
        skillLevelFilter !== 'all' &&
        skillLevelFilter !== 'none' &&
        p.skillLevel !== skillLevelFilter
      ) {
        return false
      }
      if (!classSearch.trim()) return true
      const q = classSearch.toLowerCase()
      return (
        p.displayName.toLowerCase().includes(q) ||
        programNameForClass(p, categories).toLowerCase().includes(q) ||
        (p.primarySport?.toLowerCase().includes(q) ?? false) ||
        (p.sportTags?.toLowerCase().includes(q) ?? false) ||
        (p.description?.toLowerCase().includes(q) ?? false) ||
        (p.skillRequirements?.toLowerCase().includes(q) ?? false)
      )
    })
    .sort(compareActiveClassRows)

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
        skillLevel: p.skillLevel,
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
      ageRangeLabel={formatAgeRange(program.ageMin, program.ageMax)}
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
            {viewMode === 'default' && (
            <button
              type="button"
              onClick={() => {
                setEditingCategoryId(null)
                setCategoryFormData({ displayName: '', abridgedName: '', description: '', primarySportId: null })
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
                              <button type="button" className={iconBtnDanger} title="Delete" aria-label="Delete" onClick={() => handleDeleteCategory(category)}>
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
                      <th className={thClass}>Primary Sport</th>
                      <th className={thClass}>Sport Tag</th>
                      <th className={thClass}>Program</th>
                      <th className={thClass}>Class</th>
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
                        programNameForClass(p, categories).toLowerCase().includes(classArchiveSearch.toLowerCase()) ||
                        (p.primarySport?.toLowerCase().includes(classArchiveSearch.toLowerCase()) ?? false),
                      )
                      .map((program) => (
                        <tr key={rowKey(program)} className="hover:bg-gray-50/80">
                          <td className={tdClass}>{program.primarySport || '—'}</td>
                          <td className={tdClass}>{formatSportTagDisplay(program.sportTags)}</td>
                          <td className={tdClass}>{programNameForClass(program, categories)}</td>
                          <td className={tdClass}>{program.displayName}</td>
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
                        <th className={thClass}>Primary Sport</th>
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
                            <td className={tdClass}>{category.primarySportName || '—'}</td>
                            <td className={tdClass}>{classCountForProgram(category.id, category.displayName)}</td>
                            <td className={tdClass}>
                              <StatusLabel active={programIsActiveFlag(category)} />
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
                                      abridgedName: category.abridgedName ?? category.displayName,
                                      description: category.description || '',
                                      isActive: programIsActiveFlag(category),
                                      primarySportId:
                                        category.primarySportId != null
                                          ? Number(category.primarySportId)
                                          : null,
                                    })
                                    setShowCategoryModal(true)
                                  }}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button type="button" className={iconBtn} title="Archive program" aria-label="Archive program" onClick={() => handleArchiveCategory(category.id, true)}>
                                  <Archive className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  className={iconBtnDanger}
                                  title="Delete program"
                                  aria-label="Delete program"
                                  onClick={() => handleDeleteCategory(category)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expandedProgramId === category.id && (
                            <tr>
                              <td colSpan={6} className="px-0 py-0">
                                <div className="p-6 bg-gray-50 border-t-2 border-vortex-red text-sm text-gray-700 space-y-2">
                                  <div>
                                    <span className="font-semibold text-gray-900">Primary sport</span>
                                    <p className="mt-1">{category.primarySportName || '—'}</p>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-900">Description</span>
                                    <p className="mt-1 whitespace-pre-wrap">{category.description || '—'}</p>
                                  </div>
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
                  <h3 className="text-lg font-bold text-black">Classes ({filteredActiveClassRows.length})</h3>
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
              ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className={thClass}>
                          <PrimarySportFilterHeader
                            activeFilterName={activePrimarySportFilterName}
                            filterOpen={primarySportFilterOpen}
                            onToggleFilter={() => setPrimarySportFilterOpen((open) => !open)}
                            allSportTags={allSportTags}
                            tagsLoading={sportTagsLoading}
                            selectedTagId={primarySportFilterId}
                            onSelectTag={(tagId) => {
                              setPrimarySportFilterId(tagId)
                              setPrimarySportFilterOpen(false)
                            }}
                            onClearFilter={() => {
                              setPrimarySportFilterId(null)
                              setPrimarySportFilterOpen(false)
                            }}
                            filterRef={primarySportFilterRef}
                            sortConfig={classSortConfig}
                            onSort={handleClassSort}
                          />
                        </th>
                        <th className={thClass}>
                          <SportTagFilterHeader
                            activeFilterName={activeSportTagFilterName}
                            filterOpen={sportTagFilterOpen}
                            onToggleFilter={() => setSportTagFilterOpen((open) => !open)}
                            allSportTags={allSportTags}
                            tagsLoading={sportTagsLoading}
                            selectedTagId={sportTagFilterId}
                            onSelectTag={(tagId) => {
                              setSportTagFilterId(tagId)
                              setSportTagFilterOpen(false)
                            }}
                            onClearFilter={() => {
                              setSportTagFilterId(null)
                              setSportTagFilterOpen(false)
                            }}
                            filterRef={sportTagFilterRef}
                          />
                        </th>
                        <th className={thClass}>
                          <SortFilterColumnHeader
                            label="Program"
                            field="program"
                            sortConfig={classSortConfig}
                            onSort={handleClassSort}
                            filterOpen={programFilterOpen}
                            onToggleFilter={() => setProgramFilterOpen((open) => !open)}
                            activeFilterLabel={activeProgramFilterLabel}
                            filterRef={programFilterRef}
                            options={programFilterOptions}
                            selectedKey={programFilterKey}
                            onSelectKey={(key) => {
                              setProgramFilterKey(key)
                              setProgramFilterOpen(false)
                            }}
                            onClearFilter={() => {
                              setProgramFilterKey(null)
                              setProgramFilterOpen(false)
                            }}
                            clearLabel="All programs"
                          />
                        </th>
                        <th className={thClass}>
                          <SortFilterColumnHeader
                            label="Class"
                            field="class"
                            sortConfig={classSortConfig}
                            onSort={handleClassSort}
                            filterOpen={classFilterOpen}
                            onToggleFilter={() => setClassFilterOpen((open) => !open)}
                            activeFilterLabel={activeClassFilterLabel}
                            filterRef={classFilterRef}
                            options={classFilterOptions}
                            selectedKey={classFilterKey}
                            onSelectKey={(key) => {
                              setClassFilterKey(key)
                              setClassFilterOpen(false)
                            }}
                            onClearFilter={() => {
                              setClassFilterKey(null)
                              setClassFilterOpen(false)
                            }}
                            clearLabel="All classes"
                          />
                        </th>
                        <th className={thClass}>
                          <SortableColumnHeader label="Offerings" field="offerings" sortConfig={classSortConfig} onSort={handleClassSort} />
                        </th>
                        <th className={thClass}>
                          <SortableColumnHeader label="Slots" field="slots" sortConfig={classSortConfig} onSort={handleClassSort} />
                        </th>
                        <th className={thClass}>
                          <SkillLevelFilterHeader
                            activeFilterLabel={activeSkillLevelFilterLabel}
                            filterOpen={skillLevelFilterOpen}
                            onToggleFilter={() => setSkillLevelFilterOpen((open) => !open)}
                            selectedFilter={skillLevelFilter}
                            onSelectFilter={(filter) => {
                              setSkillLevelFilter(filter)
                              setSkillLevelFilterOpen(false)
                            }}
                            onClearFilter={() => {
                              setSkillLevelFilter('all')
                              setSkillLevelFilterOpen(false)
                            }}
                            filterRef={skillLevelFilterRef}
                          />
                        </th>
                        <th className={thClass}>
                          <StatusFilterHeader
                            activeFilterLabel={activeStatusFilterLabel}
                            filterOpen={statusFilterOpen}
                            onToggleFilter={() => setStatusFilterOpen((open) => !open)}
                            selectedFilter={statusFilter}
                            onSelectFilter={(filter) => {
                              setStatusFilter(filter)
                              setStatusFilterOpen(false)
                            }}
                            onClearFilter={() => {
                              setStatusFilter('all')
                              setStatusFilterOpen(false)
                            }}
                            filterRef={statusFilterRef}
                          />
                        </th>
                        <th className={`${thClass} w-12 text-center`}>Details</th>
                        <th className={`${thClass} w-0`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredActiveClassRows.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                            No classes match your search or filter.
                          </td>
                        </tr>
                      ) : (
                      filteredActiveClassRows.map((program) => {
                        const key = rowKey(program)
                        return (
                        <Fragment key={key}>
                          <tr
                            className={`hover:bg-gray-50/80 cursor-pointer ${expandedClassId === key ? 'bg-gray-50/50' : ''}`}
                            onClick={() => toggleClassExpand(key)}
                          >
                            <td className={tdClass}>{program.primarySport || '—'}</td>
                            <td className={tdClass}>{formatSportTagDisplay(program.sportTags)}</td>
                            <td className={tdClass}>{programNameForClass(program, categories)}</td>
                            <td className={`${tdClass} font-medium`}>{program.displayName}</td>
                            <td className={`${tdClass} text-center`}>{program.offeringCount ?? 0}</td>
                            <td className={`${tdClass} text-center`}>{program.slotCount ?? 0}</td>
                            <td className={tdClass}>{formatSkillLevel(program.skillLevel)}</td>
                            <td className={tdClass}>
                              <StatusLabel active={classStoredActive(program)} />
                            </td>
                            <td className={`${tdClass} text-center`} onClick={(e) => e.stopPropagation()}>
                              <button type="button" className={iconBtn} onClick={() => toggleClassExpand(key)} aria-label="Toggle details">
                                {expandedClassId === key ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleOpenScheduling(program)
                                  }}
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
                          {expandedClassId === key && (
                            <tr>
                              <td colSpan={10} className="px-0 py-0">{renderClassDetailPanel(program)}</td>
                            </tr>
                          )}
                        </Fragment>
                        )
                      })
                      )}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Abridged name</label>
                  <input
                    type="text"
                    value={categoryFormData.abridgedName ?? ''}
                    onChange={(e) =>
                      setCategoryFormData({ ...categoryFormData, abridgedName: e.target.value })
                    }
                    placeholder={categoryFormData.displayName?.trim() || 'Short calendar label'}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Shorter label used on the calendar. Defaults to the display name.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary sport</label>
                  <PrimarySportPicker
                    key={editingCategoryId ?? 'new'}
                    value={categoryFormData.primarySportId ?? null}
                    selectedLabel={
                      editingCategoryId != null
                        ? categories.find((c) => c.id === editingCategoryId)?.primarySportName ?? null
                        : null
                    }
                    onChange={(primarySportId) =>
                      setCategoryFormData({ ...categoryFormData, primarySportId })
                    }
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
          categories.find((c) => c.id === (selectedCategoryForClass ?? editingClassEvent?.categoryId ?? editingClassEvent?.programsId))?.displayName
        }
        availablePrograms={categories
          .filter((category) => !category.archived)
          .map((category) => ({
            id: category.id,
            displayName: category.displayName,
            primarySportId: category.primarySportId ?? null,
            isActive: programIsActiveFlag(category),
          }))}
        lockProgram={selectedCategoryForClass != null || editingClassEvent != null}
        parentProgramActive={
          (() => {
            const pid = selectedCategoryForClass ?? editingClassEvent?.categoryId ?? editingClassEvent?.programsId
            const parent = categories.find((c) => c.id === pid)
            return parent ? programIsActiveFlag(parent) : true
          })()
        }
        editing={editingClassEvent}
        programPrimarySportId={
          categories.find(
            (c) => c.id === (selectedCategoryForClass ?? editingClassEvent?.categoryId ?? editingClassEvent?.programsId),
          )?.primarySportId ?? null
        }
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
