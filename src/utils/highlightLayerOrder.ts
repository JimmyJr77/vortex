import type { HighlightElement } from '../types/highlights'

export type HighlightLayerAction = 'forward' | 'backward' | 'front' | 'back'

/** Reorder stacking; reassigns zIndex 1..n in paint order (low = back). */
export function applyHighlightLayerAction(
  elements: HighlightElement[],
  elementId: string,
  action: HighlightLayerAction,
): HighlightElement[] {
  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex)
  const idx = sorted.findIndex((e) => e.id === elementId)
  if (idx === -1) return elements

  const reordered = [...sorted]

  switch (action) {
    case 'forward':
      if (idx >= reordered.length - 1) return elements
      ;[reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]]
      break
    case 'backward':
      if (idx <= 0) return elements
      ;[reordered[idx], reordered[idx - 1]] = [reordered[idx - 1], reordered[idx]]
      break
    case 'front': {
      if (idx === reordered.length - 1) return elements
      const [el] = reordered.splice(idx, 1)
      reordered.push(el)
      break
    }
    case 'back': {
      if (idx === 0) return elements
      const [el] = reordered.splice(idx, 1)
      reordered.unshift(el)
      break
    }
  }

  return reordered.map((el, i) => ({ ...el, zIndex: i + 1 }))
}

export function getHighlightLayerInfo(
  elements: HighlightElement[],
  elementId: string,
): { index: number; total: number } | null {
  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex)
  const idx = sorted.findIndex((e) => e.id === elementId)
  if (idx === -1) return null
  return { index: idx + 1, total: sorted.length }
}
