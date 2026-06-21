# Business Rehearsal Automation

One-command launch sign-off flow:

1. member login
2. enrollment
3. billing summary generation
4. external payment reconciliation
5. member/admin portal visibility checks

Script: `scripts/business-rehearsal.mjs`
Sign-off exporter: `scripts/business-signoff-export.mjs`

## Required environment variables

```bash
BUSINESS_BASE_URL=https://your-staging-api.example.com
REHEARSAL_MEMBER_LOGIN=member@example.com
REHEARSAL_MEMBER_PASSWORD=...
REHEARSAL_ADMIN_LOGIN=admin@example.com
REHEARSAL_ADMIN_PASSWORD=...
BUSINESS_REHEARSAL_CONFIRM=I_UNDERSTAND_REHEARSAL_WRITES_DATA
```

## Optional overrides

```bash
REHEARSAL_FAMILY_ID=123
REHEARSAL_MEMBER_ID=456
REHEARSAL_PROGRAM_ID=789
REHEARSAL_ITERATION_ID=321
REHEARSAL_SELECTED_DAYS=Monday,Wednesday
REHEARSAL_DAYS_PER_WEEK=2
REHEARSAL_CHARGE_AMOUNT_CENTS=2500
REHEARSAL_PAYMENT_AMOUNT_CENTS=2500
REHEARSAL_EXTERNAL_REFERENCE=rehearsal-2026-06-20
```

## Run

```bash
npm run rehearsal:business
```

The script prints a JSON sign-off report and exits non-zero on any failed step.

## Run with markdown sign-off export

```bash
npm run rehearsal:signoff
```

This runs the rehearsal and writes artifacts under:

- `artifacts/launch-signoff/launch-signoff-<timestamp>.md`
- `artifacts/launch-signoff/business-rehearsal-<timestamp>.json` (when run completes with structured output)
