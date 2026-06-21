# Production Alerting Runbook

## Objective

Detect and respond to failures before clients are blocked from enrolling, signing waivers, or viewing billing.

## Minimum Alerts (must-have)

- API 5xx error rate > 2% for 5 minutes
- P95 response time > 1200ms for 10 minutes
- `/api/health` non-200 for 2 consecutive checks
- Database connectivity failures
- Failed payment reconciliation write attempts
- Failed transactional email sends

## Optional High-Value Alerts

- Sudden drop in enrollments (hour-over-hour anomaly)
- Spike in password reset requests
- Spike in auth failures
- Slowest SQL query P95 > 500ms

## Routing

- Primary: on-call engineering owner
- Secondary: product/operations owner
- Escalation: incident lead within 10 minutes if unresolved

## Triage Steps

1. Confirm user impact:
   - Can users reach homepage?
   - Can users log in?
   - Can enrollments be submitted?
   - Can payments be reconciled?
2. Check backend logs for `requestId` and correlate failing requests.
3. Validate DB health and migration state via `/api/health`.
4. If issue is external provider related (email/payment), degrade gracefully and notify operations.

## Incident Severity

- **SEV-1**: Enrollment/login down, billing writes failing globally
- **SEV-2**: Major feature degraded, workaround exists
- **SEV-3**: Minor user impact, no direct conversion risk

## Immediate Mitigations

- Roll back latest deployment if failure started post-deploy.
- Disable high-risk feature flags (`STRIPE_ENABLED`, migration endpoint flags).
- Switch to manual operational fallback for payment reconciliation.

## Exit Criteria

Incident closes only when:

- Alert condition clears
- Critical flows pass manual smoke check
- Root cause and prevention steps are documented
