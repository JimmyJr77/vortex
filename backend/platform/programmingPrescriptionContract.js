export class ProgrammingPrescriptionError extends Error {
  constructor(code, message, details = {}) { super(message); this.name = 'ProgrammingPrescriptionError'; this.code = code; this.details = details }
}
export function prescriptionInteger(value, field, min = 0, max = 14400) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new ProgrammingPrescriptionError('invalid_prescription_metadata', `${field} must be an integer from ${min} to ${max}`)
  return value
}
