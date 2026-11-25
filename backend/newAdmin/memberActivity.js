// Share the current-enrollment boundary with the CRM directory. A future start,
// paused/cancelled enrollment or historical import does not count as active.
export const currentEnrollmentSql = (asOfDate, alias = 's') => `NOT ${alias}.historical_only AND ${alias}.archived_at IS NULL AND ${alias}.orphaned_at IS NULL
  AND ${alias}.status = 'confirmed' AND ${alias}.enrollment_start_date <= ${asOfDate}
  AND (${alias}.cancel_effective_date IS NULL OR ${alias}.cancel_effective_date > ${asOfDate})
  AND (${alias}.pause_effective_date IS NULL OR ${alias}.pause_effective_date > ${asOfDate})
  AND (${alias}.record_program_end IS NULL OR ${alias}.record_program_end >= ${asOfDate})`
