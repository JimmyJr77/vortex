/**
 * Compatibility hook retained for callers that predate boot-time billing
 * readiness. Startup now verifies the charge/link/metadata schema before the
 * process accepts traffic, so a request must never mutate database structure.
 */
export async function ensureBillingChargeSchema() {
  // Intentionally read/write-free.
}
