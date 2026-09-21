# Shared annual contribution capacity preview

Employer payroll previews now compare the full matching and nonelective formula obligation with reviewed annual capacity after proposed ordinary employee deferrals. Catch-up deferrals do not consume annual-additions capacity. Employee and employer calculations must reference the same retained plan, annual source and funding evidence, and all cents must reconcile.

An exhausted limit produces a visible shortfall without reducing the employer obligation. Missing employee evidence or an unresolved obligation remains unknown rather than becoming zero. Nonelective-only eligibility also requests the employee calculation because employee deferrals still share annual capacity.

## Assumptions and limits

This is a gross-obligation comparison before prior employer-funding offsets. An apparent shortfall requires reconciliation of prior funding and allocation; it is not an authorized remittance amount. Existing external annual-additions balances already include external employer contributions and are not added twice. The existing annual-capacity service supplies the applicable limit. No statutory limits were changed.

Employer payroll remains gated until reservations, prior funding, statements, accounting and remittance are integrated. The preview does not change payable payroll or create a ledger reservation. Deployment is not verified by these local tests.

## Verification

52 backend tests passed, zero failed or skipped, in 8.05 seconds against isolated local PostgreSQL. Log: `/tmp/payroll-employer-annual-regression.log`. This covers the employer retirement test group, annual capacity, employee contribution calculations, regular retirement payroll and reservation ledger.

The actual new-hire API journey verifies signed elections, $14 ordinary deferrals leaving $186 capacity on $200 compensation, then a signed decline and exhausted annual capacity. The latter retains the full $4 employer obligation, reports a $4 shortfall, prevents approval and creates zero ledger entries. Focused tests cover the exact capacity boundary, catch-up exclusion, unknown evidence, inconsistent source references, mismatched cents and integer overflow. Whitespace checks passed. No new browser run or production transaction was performed for this increment.
