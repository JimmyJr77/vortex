# Complete employer remittance source amounts

Finalized remittance source reconciliation now includes retained employer matching and nonelective reservations alongside employee ordinary/catch-up deferrals. Each applicable allocation carries its employer ledger ID, separate employer categories and employee subtotal. Participant/destination readiness uses the combined amount, so an employer-only positive contribution cannot disappear because employee withholding is zero. Source fingerprints include employer ledger evidence when present; employee-only source structures remain unchanged.

Employer ledger entries must match the payroll snapshot exactly. A retained employer-funded plan without its employer reservation is a reconciliation failure, rather than evidence of zero employer contributions.

The allocation format validator and internal CSV encoder support two additional columns together: employerMatchingCents and employerNonelectiveCents. Both exact amounts must be supplied, and all categories must sum to the total. An employee-only format cannot silently drop positive employer contributions. Legacy eight-column files remain supported.

## Verification

17 targeted backend tests passed, zero failed/skipped, in 7.24 seconds (`/tmp/payroll-employer-remittance-final-tests.log`). The isolated approved-producer fixture now verifies $14 employee deferrals plus $6 matching and $4 nonelective, yielding a $24 remittance source with all categories and retained ledger identities. CSV tests verify exact ten-column output and reject missing employer columns, incomplete amounts and inconsistent totals. Existing receipt and remittance authorization cases pass.

The initial broader run found that the CSV encoder was incorrectly requiring administrative review metadata from receipt fixtures that provide only retained format structure. Validation was separated: administrative save still requires review confirmation/reference; encoding validates complete columns and exact formats. The final run above passed after this correction. Whitespace checks passed. No frontend edits, provider writes or production employee transactions were included.

## Remaining integration

This completes source accounting and the internal employer CSV representation, not delivery. Remittance preview rejects positive employer contributions pending matching receipt, timing and payment authorization support. Extended-column file preparation is also held until these contracts are supported together, including when an employee-only plan requests the extended format. The public format UI remains unchanged. Existing eight-column employee delivery is preserved.

Next work must extend provider receipts and cumulative category reconciliation, authorization database totals, delivery/return handling, and the reviewed timing contract before opening employer file preparation and payment. Employer payroll approval and the full onboarding goal remain incomplete. This increment has not been verified in production.
