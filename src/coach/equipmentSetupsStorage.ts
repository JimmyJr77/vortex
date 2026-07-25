export interface EquipmentSetupItem {
  id: string | number
  label: string
  meta?: string
}

export interface SavedEquipmentSetup {
  id: string
  name: string
  equipment: EquipmentSetupItem[]
}

const STORAGE_KEY = 'vortex_needs_engine_equipment_setups_v1'

function isSavedEquipmentSetup(value: unknown): value is SavedEquipmentSetup {
  if (!value || typeof value !== 'object') return false
  const row = value as SavedEquipmentSetup
  return typeof row.id === 'string'
    && typeof row.name === 'string'
    && Array.isArray(row.equipment)
}

export function listSavedEquipmentSetups(): SavedEquipmentSetup[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isSavedEquipmentSetup) : []
  } catch {
    return []
  }
}

export function saveEquipmentSetup(
  name: string,
  equipment: EquipmentSetupItem[],
): SavedEquipmentSetup[] {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('Enter a setup name.')

  const current = listSavedEquipmentSetups()
  const existing = current.find((row) => row.name.toLowerCase() === trimmedName.toLowerCase())
  const saved: SavedEquipmentSetup = {
    id: existing?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmedName,
    equipment,
  }
  const next = existing
    ? current.map((row) => row.id === existing.id ? saved : row)
    : [...current, saved]
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export function deleteEquipmentSetup(id: string): SavedEquipmentSetup[] {
  const next = listSavedEquipmentSetups().filter((row) => row.id !== id)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}
