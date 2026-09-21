# Employer allocation and receipt setup controls

Admins can now select both employer matching and nonelective columns in the allocation format, enter their actual provider headers and arrange all ten columns. The total label changes to combined participant total when employer categories are present.

Receipt setup follows the currently retained allocation format: it shows fifteen fields for combined contributions or thirteen for employee deductions. Changing the allocation format preserves applicable draft headers and references, adds/removes employer fields together, and clears confirmations. Editing a historical receipt also adapts its fields to the current allocation format. Combined receipts require an explicit separate confirmation of cumulative employer matching and nonelective semantics before saving. Saved history identifies reviewed employer categories.

## Verification

TypeScript build checks passed (`/tmp/payroll-employer-contract-types.log`). The first browser run passed both receipt variants but found an ambiguous checkbox selector in the older allocation test after adding the employer checkbox. That selector was changed to the named review confirmation. The complete rerun passed all three browser tests in 1.3 minutes, with no page errors (`/tmp/payroll-employer-contract-browser-final.log`), including legacy allocation download/suspension and both receipt variants. Whitespace checks passed.

The employer browser case saves the ten-column allocation through the UI, verifies its database record, saves and retries the fifteen-column receipt without duplicating it, verifies required employer confirmation, and changes the allocation back to employee-only while preserving the draft and resetting confirmation. It also covers suspension. The mobile employer receipt screenshot `/tmp/payroll-employer-receipt-columns-mobile.png` was inspected; the browser asserts no horizontal overflow. Existing React review patterns were retained: labeled fields, stable field keys, immutable updates, primitive effect dependencies and disabled controls during uncertain retries.

## Limits

These forms capture reviewed provider specifications; they do not infer provider acceptance. The assumed file structure is one participant per row with separate ordinary, catch-up, matching and nonelective categories. Public employer payroll approval and a complete combined provider delivery/settlement test remain outstanding. No live provider write was performed. This increment is not production-verified, and the overall goal remains active. The unrelated AdminAccess edit is excluded.
