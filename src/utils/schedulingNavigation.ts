import { SCHEDULING_SIGNUP_FIELD_CATALOG } from '../config/schedulingSignupFields'
import type { CategorySelection } from './schedulingApi'

export type SchedulingNavigationIntent = {
  programsId: number
  classEventId: number
  categorySelection: CategorySelection
  targetPanel: 'form' | 'slots'
}

export function allSignupFieldKeys(): string[] {
  return SCHEDULING_SIGNUP_FIELD_CATALOG.map((f) => f.key)
}

export function defaultForwardFormFields(): string[] {
  return allSignupFieldKeys()
}
