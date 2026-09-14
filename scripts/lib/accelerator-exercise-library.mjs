import { createHash } from 'node:crypto'

const STATUS_SUFFIXES = [
  /\s*\((?:primary anchor|proposed(?: variant)?)\)\s*$/i,
  /,\s*proposed(?: exercise)?\s*$/i,
  /\s*\[(?:proposed\b[^\]]*)\]\s*$/i,
  /\s+[—–-]\s+(?:explicit\s+)?proposed\b.*$/i,
  /\s+[—–-]\s+primary anchor(?:,\s*proposed exercise)?\s*$/i,
  /\s+[—–-]\s+(?:deliberately recurring|revisited execution|recurring earlier replacement)\b.*$/i,
]

export function cleanAcceleratorExerciseName(value) {
  let result = String(value ?? '').replace(/\s+/g, ' ').trim()
  let changed = true
  while (changed) {
    changed = false
    for (const suffix of STATUS_SUFFIXES) {
      const next = result.replace(suffix, '').trim()
      if (next !== result) {
        result = next
        changed = true
      }
    }
  }
  return result
}

export function acceleratorExerciseKey(value) {
  return cleanAcceleratorExerciseName(value)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\bmedicine[- ]ball\b/g, 'medicine-ball')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function acceleratorOwnedSlug(value) {
  const key = acceleratorExerciseKey(value)
  if (key.length <= 96) return `accelerator-${key}`
  const digest = createHash('sha256').update(key).digest('hex').slice(0, 10)
  return `accelerator-${key.slice(0, 85).replace(/-+$/g, '')}-${digest}`
}

export function associationMap(manifest) {
  return new Map((manifest?.associations ?? []).map((entry) => [entry.exerciseKey, entry]))
}

export function librarySlugForExercise(value, manifest) {
  return associationMap(manifest).get(acceleratorExerciseKey(value))?.librarySlug ?? null
}

export const YOUTUBE_WATCH_URL = /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}(?:[&#].*)?$/
