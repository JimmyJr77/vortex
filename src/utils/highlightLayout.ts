/** US Letter page aspect ratio (width ÷ height). */
export const US_LETTER_ASPECT = 8.5 / 11

/** Max content width inside the highlights modal (px). */
export const HIGHLIGHT_LETTER_WIDTH_PX = 680

/** Height for one letter page at {@link HIGHLIGHT_LETTER_WIDTH_PX} width. */
export const HIGHLIGHT_LETTER_HEIGHT_PX = Math.round(
  HIGHLIGHT_LETTER_WIDTH_PX / US_LETTER_ASPECT,
)

/** Default custom canvas size matching letter proportions (100px per inch). */
export const HIGHLIGHT_LETTER_CANVAS_WIDTH = 850
export const HIGHLIGHT_LETTER_CANVAS_HEIGHT = 1100

/** Max height for scrollable highlight body (leaves room for header/footer). */
export const HIGHLIGHT_CONTENT_MAX_HEIGHT = 'calc(90vh - 11rem)'

/** Default public modal content viewport height (letter proportions at portal width). */
export const DEFAULT_HIGHLIGHT_MODAL_HEIGHT_PX = HIGHLIGHT_LETTER_HEIGHT_PX

export const HIGHLIGHT_MODAL_HEIGHT_MIN_PX = 280
export const HIGHLIGHT_MODAL_HEIGHT_MAX_PX = 1600

/** Presets for custom highlight canvas height (not the public modal viewport). */
export const HIGHLIGHT_CANVAS_HEIGHT_PRESETS: { value: number; label: string }[] = [
  { value: 400, label: 'Compact — 400px' },
  { value: 560, label: 'Medium — 560px' },
  { value: HIGHLIGHT_LETTER_HEIGHT_PX, label: 'Standard letter — 881px' },
  { value: 1100, label: 'Tall — 1100px' },
  { value: 1320, label: 'Extra tall — 1320px' },
]

export function resolveHighlightModalHeightPx(
  heightPx: number | null | undefined,
): number {
  if (heightPx == null || !Number.isFinite(heightPx)) {
    return DEFAULT_HIGHLIGHT_MODAL_HEIGHT_PX
  }
  return Math.min(
    HIGHLIGHT_MODAL_HEIGHT_MAX_PX,
    Math.max(HIGHLIGHT_MODAL_HEIGHT_MIN_PX, Math.round(heightPx)),
  )
}
