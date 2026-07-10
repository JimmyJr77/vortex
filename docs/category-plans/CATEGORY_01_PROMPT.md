# Category 1 — Prerequisite-backed implementation prompt

For **Category 1 — Session structure & phasing** only: all 27 metrics fully assessable (2026-07-09).

## Deliverables (done)

1. `evaluateCategory1Structure()` — C1-MOP-01–17
2. `validatePrescribeBodyMOS()` — C1-MOS-01–02
3. `evaluateCategory1MoeInfo()` — C1-MOE-02–05, 08–09 + review packet
4. `CATEGORY1_KPI_CHECK_IDS` (20) + `CATEGORY1_MOE_CHECK_IDS` (7)
5. `sport_id_preflight` merged into `category1_kpi` in eval CLI
6. [`CATEGORY_1_MOE_RUBRIC.md`](../CATEGORY_1_MOE_RUBRIC.md)

## Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

Golden Test 3 strict PASS.
