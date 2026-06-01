import type { HighlightShapeElement } from '../types/highlights'

export type LineOrientation = 'horizontal' | 'vertical'

export function getLineOrientation(el: HighlightShapeElement): LineOrientation {
  if (el.lineOrientation) return el.lineOrientation
  return el.h > el.w ? 'vertical' : 'horizontal'
}

export function toggleLineOrientation(
  el: HighlightShapeElement,
): Pick<HighlightShapeElement, 'lineOrientation' | 'w' | 'h'> {
  const next: LineOrientation =
    getLineOrientation(el) === 'horizontal' ? 'vertical' : 'horizontal'
  return {
    lineOrientation: next,
    w: el.h,
    h: el.w,
  }
}
