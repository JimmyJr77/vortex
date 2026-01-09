import { useState, useEffect } from 'react'
import { getApiUrl } from '../utils/api'

export interface Program {
  id: number // Database column: id
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

interface ClassDropdownProps {
  value?: number | null
  onChange: (programId: number | null, program: Program | null) => void
  programs?: Program[] // Optional - if not provided, will fetch from API
  filterActiveOnly?: boolean // Only show active, non-archived programs
  placeholder?: string
  className?: string
  disabled?: boolean
  required?: boolean
}

// Skill level order: EARLY_STAGE -> BEGINNER -> INTERMEDIATE -> ADVANCED
const skillLevelOrder: Record<string, number> = {
  'EARLY_STAGE': 0,
  'BEGINNER': 1,
  'INTERMEDIATE': 2,
  'ADVANCED': 3
}

const getSkillLevelOrder = (skillLevel: string | null): number => {
  if (!skillLevel) return 999 // Put nulls at the end
  return skillLevelOrder[skillLevel] ?? 999
}

export default function ClassDropdown({
  value,
  onChange,
  programs: externalPrograms,
  filterActiveOnly = true,
  placeholder = 'Select a class...',
  className = 'w-full px-3 py-2 bg-white text-black rounded border border-gray-300',
  disabled = false,
  required = false
}: ClassDropdownProps) {
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch programs if not provided
  useEffect(() => {
    if (externalPrograms) {
      setPrograms(externalPrograms)
      return
    }

    const fetchPrograms = async () => {
      setLoading(true)
      try {
        const apiUrl = getApiUrl()
        const adminToken = localStorage.getItem('adminToken')
        
        const [activeResponse, archivedResponse] = await Promise.all([
          fetch(`${apiUrl}/api/admin/programs?archived=false`, {
            headers: adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {}
          }),
          filterActiveOnly 
            ? Promise.resolve({ ok: false, json: async () => ({ success: true, data: [] }) })
            : fetch(`${apiUrl}/api/admin/programs?archived=true`, {
                headers: adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {}
              })
        ])
        
        const [activeData, archivedData] = await Promise.all([
          activeResponse.ok ? activeResponse.json() : { success: true, data: [] },
          archivedResponse.ok ? archivedResponse.json() : { success: true, data: [] }
        ])
        
        if (activeData.success && archivedData.success) {
          const allPrograms = [...activeData.data, ...archivedData.data]
          setPrograms(allPrograms)
        }
      } catch (error) {
        console.error('Error fetching programs:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPrograms()
  }, [externalPrograms, filterActiveOnly])

  // Categories are not needed - we group programs by categoryDisplayName from programs directly

  // Process programs: filter, group by category, sort by skill level
  const processedPrograms = programs.filter(p => {
    if (filterActiveOnly) {
      // Only show active, non-archived programs WITH valid category assignments
      // Programs without categoryDisplayName are orphaned and should be fixed in AdminClasses first
      return p.isActive && !p.archived && (p.categoryDisplayName || p.categoryName)
    }
    return true
  })

  // Group programs by category
  // Prefer categoryDisplayName from database join, fall back to categoryName, then enum value as last resort
  const groupedByCategory = processedPrograms.reduce((acc, program) => {
    let categoryName = 'Uncategorized'
    
    if (program.categoryDisplayName) {
      // Use proper category display name from database
      categoryName = program.categoryDisplayName
    } else if (program.categoryName) {
      // Fall back to category name if display name not available
      categoryName = program.categoryName
    } else if (program.category) {
      // Last resort: use enum value (only happens when filterActiveOnly is false)
      // When filterActiveOnly is true, programs without categoryDisplayName are filtered out above
      // This fallback is for archived/inactive programs that may not have proper category assignments
      categoryName = program.category
    }
    
    if (!acc[categoryName]) {
      acc[categoryName] = []
    }
    acc[categoryName].push(program)
    return acc
  }, {} as Record<string, Program[]>)

  // Sort categories (alphabetically)
  const sortedCategories = Object.keys(groupedByCategory).sort()

  // Sort programs within each category by skill level
  sortedCategories.forEach(categoryName => {
    groupedByCategory[categoryName].sort((a, b) => {
      const orderA = getSkillLevelOrder(a.skillLevel)
      const orderB = getSkillLevelOrder(b.skillLevel)
      if (orderA !== orderB) {
        return orderA - orderB
      }
      // If same skill level, sort alphabetically by display name
      return a.displayName.localeCompare(b.displayName)
    })
  })

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const programId = e.target.value ? parseInt(e.target.value, 10) : null
    console.log('ClassDropdown handleChange:', { 
      programId, 
      programIdType: typeof programId,
      programsCount: programs.length, 
      programIds: programs.map(p => ({ id: p.id, idType: typeof p.id, name: p.displayName }))
    })
    
    // Try to find in both the local programs state and externalPrograms if provided
    // Use == instead of === to handle type coercion (number vs string)
    let selectedProgram = programId ? programs.find(p => p.id == programId || p.id === programId) || null : null
    
    if (!selectedProgram && programId) {
      console.log('Not found in local programs, checking externalPrograms...')
      // If not found in local programs and externalPrograms is provided, try there
      if (externalPrograms) {
        selectedProgram = externalPrograms.find(p => p.id == programId || p.id === programId) || null
        console.log('Found in externalPrograms:', selectedProgram)
      }
    }
    
    console.log('Selected program:', selectedProgram)
    onChange(programId, selectedProgram)
  }

  return (
    <select
      value={value || ''}
      onChange={handleChange}
      disabled={disabled || loading}
      required={required}
      className={className}
    >
      <option value="">{placeholder}</option>
      {sortedCategories.map(categoryName => (
        <optgroup key={categoryName} label={categoryName}>
          {groupedByCategory[categoryName].map(program => (
            <option key={program.id} value={program.id}>
              {program.displayName}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

