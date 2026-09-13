# Payroll onboarding availability incident — 2026-09-13

The browser reported missing CORS headers for employee creation, notifications,
and billing cancellation requests. Healthy preflights returned 204 with the
correct allowed origin. Failed responses were Render HTTP 502 pages with
`x-render-routing: dynamic-paid-error`, without application CORS headers.

Render events showed repeating five-second health-check timeouts and restarts,
including before release `777eef0d`. Application logs showed SIGTERM followed by
scheduler attempts against an ending database pool. The memory chart was around
20% of its 512 MB limit during the observed failures. Earlier exit status 137
alone does not establish an out-of-memory cause.

Read-only database diagnostics during the repeating failure showed ten idle
backend connections retained by scheduler advisory-lock operations. Several
sweeps acquire a lock client and then acquire another client from the same pool.
Simultaneous startup timers can fill the default ten-client pool with lock
holders and leave both their nested work and the HTTP health check waiting.
A restart of the unchanged release temporarily recovered service, but 502s
recurred during the observed background-job cycle.

## Fix and assumptions

- Serialize all 32 payroll schedulers through one queue per database pool.
- Preserve existing intervals, first-run delays, enable flags, advisory locks,
  provider authorization, and recovery behavior.
- Coalesce repeat ticks while a job is queued or running; keep distinct jobs in
  arrival order. A slow job can delay later sweeps, rather than starting more
  overlapping work and exhausting database connections.
- Await the actual sweep promise, including timer callbacks that previously
  discarded it with `void`.
- Keep HTTP requests outside the queue. No CORS allowlist change is required.
- No employee, payment, or other production business records were modified for
  diagnosis or verification.

## Local verification

Four tests passed with no skips on the isolated local PostgreSQL database:
queue ordering and coalescing; recovery after a failed job; real connection
exhaustion followed by 32 successful queued jobs with a two-client pool; and
the real timer callbacks for ten carrier/retirement schedulers completing
without leaving checked-out clients or blocked API queries.

All 32 modified scheduler modules parsed successfully, and all 45 timer
callbacks were checked for queue wiring. `git diff --check` passed.

Production verification must be recorded after deployment; local passing tests
alone do not establish recovery of the live onboarding flow.
