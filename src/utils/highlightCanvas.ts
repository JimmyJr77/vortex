import type { HighlightCanvas, HighlightElement } from '../types/highlights'
import {
  HIGHLIGHT_LETTER_WIDTH_PX,
  HIGHLIGHT_MODAL_HEIGHT_MAX_PX,
  HIGHLIGHT_MODAL_HEIGHT_MIN_PX,
} from './highlightLayout'

function clampCanvasHeight(heightPx: number): number {
  return Math.min(
    HIGHLIGHT_MODAL_HEIGHT_MAX_PX,
    Math.max(HIGHLIGHT_MODAL_HEIGHT_MIN_PX, Math.round(heightPx)),
  )
}

/** Ensure custom canvas uses portal width (680px); scales elements horizontally if needed. */
export function ensureCanvasPortalWidth(canvas: HighlightCanvas): HighlightCanvas {
  const targetW = HIGHLIGHT_LETTER_WIDTH_PX
  if (canvas.width === targetW) return canvas

  const sx = targetW / canvas.width
  const scaleElement = (el: HighlightElement): HighlightElement => {
    const pos = {
      x: Math.round(el.x * sx),
      y: el.y,
      w: Math.max(1, Math.round(el.w * sx)),
      h: el.h,
    }
    if (el.type === 'text') {
      return {
        ...el,
        ...pos,
        fontSize: Math.max(10, Math.round(el.fontSize * sx)),
        borderWidth: Math.max(0, Math.round(el.borderWidth * sx)),
      }
    }
    if (el.type === 'shape') {
      return {
        ...el,
        ...pos,
        strokeWidth: Math.max(1, Math.round(el.strokeWidth * sx)),
      }
    }
    return { ...el, ...pos }
  }

  return {
    ...canvas,
    width: targetW,
    elements: canvas.elements.map(scaleElement),
  }
}

/** Resize custom canvas height and scale element positions/sizes vertically. */
export function resizeCanvasHeight(
  canvas: HighlightCanvas,
  canvasHeightPx: number,
): HighlightCanvas {
  const targetH = clampCanvasHeight(canvasHeightPx)
  const withWidth = ensureCanvasPortalWidth(canvas)
  if (withWidth.height === targetH) return withWidth

  const sy = targetH / withWidth.height
  const scaleElement = (el: HighlightElement): HighlightElement => {
    const pos = {
      x: el.x,
      y: Math.round(el.y * sy),
      w: el.w,
      h: Math.max(1, Math.round(el.h * sy)),
    }
    if (el.type === 'text') {
      return {
        ...el,
        ...pos,
        fontSize: Math.max(10, Math.round(el.fontSize * Math.min(1, sy))),
      }
    }
    if (el.type === 'shape') {
      return {
        ...el,
        ...pos,
        strokeWidth: Math.max(1, Math.round(el.strokeWidth * Math.min(1, sy))),
      }
    }
    return { ...el, ...pos }
  }

  return {
    ...withWidth,
    height: targetH,
    elements: withWidth.elements.map(scaleElement),
  }
}
