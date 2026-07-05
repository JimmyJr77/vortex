const STORAGE_KEY = 'vortex:critical-flash-muted'

function readMutedIds(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.map(Number).filter((id) => Number.isFinite(id) && id > 0))
  } catch {
    return new Set()
  }
}

function writeMutedIds(ids: Set<number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
}

export function isCriticalFlashMuted(messageId: number): boolean {
  return readMutedIds().has(messageId)
}

export function setCriticalFlashMuted(messageId: number, muted: boolean) {
  const ids = readMutedIds()
  if (muted) ids.add(messageId)
  else ids.delete(messageId)
  writeMutedIds(ids)
}
