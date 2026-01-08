import { useState, useEffect } from 'react'
import { getApiUrl } from '../utils/api'

export interface Program {
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

interface ClassDropdownProps {
  value?: number | null
  onChange: (programId: number | null, program: Program | null) => void
  programs?: Program[] // Optional - if not provided, will fetch from API
  categories?: Category[] // Optional - if not provided, will fetch from API
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
  categories: externalCategories,
  filterActiveOnly = true,
  placeholder = 'Select a class...',
  className = 'w-full px-3 py-2 bg-white text-black rounded border border-gray-300',
  disabled = false,
  required = false
}: ClassDropdownProps) {
  const [programs, setPrograms] = useState<Program[]>([])
  const [categories, setCategories] = useState<Category[]>([])
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

  // Fetch categories if not provided
  useEffect(() => {
    if (externalCategories) {
      setCategories(externalCategories)
      return
    }

    if (externalPrograms) {
      // If programs are provided, we can extract categories from them
      const uniqueCategories = new Map<number, Category>()
      externalPrograms.forEach(program => {
        if (program.categoryId && program.categoryDisplayName && !uniqueCategories.has(program.categoryId)) {
          uniqueCategories.set(program.categoryId, {
            id: program.categoryId,
            name: program.categoryName || program.category,
            displayName: program.categoryDisplayName,
            archived: false,
            createdAt: '',
            updatedAt: ''
          })
        }
      })
      setCategories(Array.from(uniqueCategories.values()))
      return
    }

    const fetchCategories = async () => {
      try {
        const apiUrl = getApiUrl()
        const adminToken = localStorage.getItem('adminToken')
        
        const response = await fetch(`${apiUrl}/api/admin/categories?archived=false`, {
          headers: adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {}
        })
        
        if (response.ok) {
          const data = await response.json()
          const categoriesList = data.categories || data.data || []
          setCategories(categoriesList.filter((c: Category) => !c.archived))
        }
      } catch (error) {
        console.error('Error fetching categories:', error)
      }
    }

    fetchCategories()
  }, [externalCategories, externalPrograms])

  // Process programs: filter, group by category, sort by skill level
  const processedPrograms = programs.filter(p => {
    if (filterActiveOnly) {
      return p.isActive && !p.archived
    }
    return true
  })

  // Group programs by category
  const groupedByCategory = processedPrograms.reduce((acc, program) => {
    const categoryId = program.categoryId || 0
    const categoryName = program.categoryDisplayName || program.categoryName || program.category || 'Uncategorized'
    
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
    const selectedProgram = programId ? programs.find(p => p.id === programId) || null : null
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

