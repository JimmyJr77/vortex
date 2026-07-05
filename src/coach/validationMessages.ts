import type { ValidationIssue, ValidationResult } from './types'

export function validationStatusLabel(result: ValidationResult | null): string {
  if (!result) return 'Not validated'
  if (result.status === 'valid') return 'Valid'
  if (result.status === 'warning') return 'Warnings'
  return 'Errors'
}

export function hasBlockingValidation(result: ValidationResult | null): boolean {
  return Boolean(result?.errors?.length)
}

export function allValidationIssues(result: ValidationResult | null): ValidationIssue[] {
  if (!result) return []
  return [...(result.errors ?? []), ...(result.warnings ?? []), ...(result.recommendations ?? [])]
}

export function canOverrideIssue(issue: ValidationIssue): boolean {
  return issue.can_override === true
}
