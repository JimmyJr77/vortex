import { SCHEDULING_SIGNUP_FIELD_CATALOG } from '../config/schedulingSignupFields'

export type SchedulingNavigationIntent = {
  programsId: number
  classEventId: number
  categorySelection: 'none'
  targetPanel: 'offerings'
}

export function allSignupFieldKeys(): string[] {
  return SCHEDULING_SIGNUP_FIELD_CATALOG.map((f) => f.key)
}

export function defaultForwardFormFields(): string[] {
  return allSignupFieldKeys()
}
