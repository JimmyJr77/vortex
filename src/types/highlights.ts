import { STUB_SITES } from '../config/stubSites'
import {
  HIGHLIGHT_LETTER_HEIGHT_PX,
  HIGHLIGHT_LETTER_WIDTH_PX,
} from '../utils/highlightLayout'

export type HighlightContentType = 'event' | 'document' | 'custom'

export type HighlightDisplayFrequency =
  | 'first_visit'
  | 'every_visit'
  | 'daily'
  | 'weekly'
  | 'never'

export interface HighlightEventData {
  id: number
  eventName: string
  shortDescription: string
  longDescription: string
  startDate?: Date | string
  endDate?: Date | string
  type?: string
  address?: string
  datesAndTimes?: Array<{
    date?: Date | string
    startTime?: string
    endTime?: string
    description?: string
    allDay?: boolean
  }>
  keyDetails?: string[]
  images?: string[]
}

export interface HighlightTextElement {
  id: string
  type: 'text'
  x: number
  y: number
  w: number
  h: number
  zIndex: number
  text: string
  fontSize: number
  color: string
  backgroundColor: string
  borderColor: string
  borderWidth: number
}

export interface HighlightImageElement {
  id: string
  type: 'image'
  x: number
  y: number
  w: number
  h: number
  zIndex: number
  src: string
}

export type HighlightLineOrientation = 'horizontal' | 'vertical'

export interface HighlightShapeElement {
  id: string
  type: 'shape'
  shape: 'rect' | 'circle' | 'line'
  x: number
  y: number
  w: number
  h: number
  zIndex: number
  fill: string
  stroke: string
  strokeWidth: number
  /** Lines only: explicit axis (inferred from w/h if omitted). */
  lineOrientation?: HighlightLineOrientation
}

export type HighlightElement =
  | HighlightTextElement
  | HighlightImageElement
  | HighlightShapeElement

export interface HighlightCanvas {
  width: number
  height: number
  backgroundColor: string
  elements: HighlightElement[]
}

export interface Highlight {
  id: number
  title: string
  contentType: HighlightContentType
  eventId?: number | null
  documentMime?: string | null
  documentData?: string | null
  customContent?: HighlightCanvas | null
  siteKeys: string[]
  displayFrequency: HighlightDisplayFrequency
  published: boolean
  sortOrder: number
  buttonEnabled?: boolean
  buttonLabel?: string | null
  buttonUrl?: string | null
  buttonTextAbove?: string | null
  buttonTextBelow?: string | null
  createdAt?: string
  updatedAt?: string
  event?: HighlightEventData | null
}

export interface HighlightFormData {
  title: string
  contentType: HighlightContentType
  eventId?: number | null
  documentMime?: string | null
  documentData?: string | null
  customContent?: HighlightCanvas | null
  siteKeys: string[]
  displayFrequency: HighlightDisplayFrequency
  published: boolean
  sortOrder: number
  buttonEnabled: boolean
  buttonLabel: string
  buttonUrl: string
  buttonTextAbove: string
  buttonTextBelow: string
}

export const DEFAULT_HIGHLIGHT_BUTTON_LABEL = 'Learn more'

export const DEFAULT_HIGHLIGHT_CANVAS: HighlightCanvas = {
  width: HIGHLIGHT_LETTER_WIDTH_PX,
  height: HIGHLIGHT_LETTER_HEIGHT_PX,
  backgroundColor: '#ffffff',
  elements: [],
}

const stubKeys = [...new Set(Object.values(STUB_SITES).map((s) => s.key))].sort()

export const HIGHLIGHT_SITE_OPTIONS: { key: string; label: string }[] = [
  { key: 'hub', label: 'Master site (vortexathletics.com)' },
  ...stubKeys.map((key) => {
    const site = Object.values(STUB_SITES).find((s) => s.key === key)!
    const hostLabel =
      key === 'gymnastics'
        ? 'Gymnastics site (vortex-gymnastics.com)'
        : `Vortex ${site.sportLabel} (${site.canonicalHost})`
    return { key, label: hostLabel }
  }),
]

export const DISPLAY_FREQUENCY_OPTIONS: { value: HighlightDisplayFrequency; label: string }[] = [
  { value: 'first_visit', label: 'First time on site' },
  { value: 'every_visit', label: 'Every visit (home page)' },
  { value: 'daily', label: 'Once per day' },
  { value: 'weekly', label: 'Once per week' },
  { value: 'never', label: 'Never auto-show (button only)' },
]
