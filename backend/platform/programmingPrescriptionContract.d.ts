export class ProgrammingPrescriptionError extends Error {
  readonly code: string
  readonly details: Readonly<Record<string, unknown>>
  constructor(code: string, message: string, details?: Readonly<Record<string, unknown>>)
}
export function prescriptionInteger(value: unknown, field: string, min?: number, max?: number): number
