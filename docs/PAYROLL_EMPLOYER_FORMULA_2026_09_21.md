# Structured employer retirement formulas

This change connects employer formula inputs to the existing immutable plan-review API and history. It does not activate employer-funded payroll. The execution boundary introduced in 97d8f62d remains until calculations, annual-additions reservations, accounting and provider allocations retain employer contributions end to end.

## Retained evidence

- Formula period: per payroll or annual formula with true-up.
- Matching bands: cumulative percentage ceilings of eligible compensation and the employer match rate within each band; catch-up matching is explicitly included or excluded.
- Nonelective percentage, independently of employee deferrals.
- Employer compensation definition for regular wages, overtime, bonuses and paid leave, independently of employee deferral compensation.
- Actual eligibility conditions and vesting terms with their plan references.

A new `employerFormula` object is canonicalized and included in the immutable plan fingerprint. Omitting it preserves existing plan fingerprints. Existing free-text terms remain available for unresolved or more complex arrangements. Changing structured evidence creates a new revision and invalidates downstream evidence tied to the old plan fingerprint through existing source checks. It does not rewrite prior payroll.

## Assumptions and boundaries

Percentages accept two decimal places and are stored as integer basis points. Tiers have strictly increasing cumulative ceilings up to 100% of eligible compensation; a matching rate can range from 0% through 1,000%, with at least one positive tier. Up to ten tiers can be retained. These are supported input ranges, not statutory limits or evidence that a plan is legally valid. A MATCH-only plan has zero nonelective rate; a NONELECTIVE-only plan has no matching bands or catch-up matching. Combined plans require both components.

Eligibility and vesting clauses are retained text, not executable determinations. Annual true-up and per-payroll are distinct retained choices, not implemented payment schedules. This revision does not infer plan-specific cashout compensation, forfeitures, discretionary awards, safe-harbor status, Roth employer contribution treatment, last-day conditions, hours requirements or calendar-year qualification from formula text. These remain part of the employer funding implementation and review scope.

The backend advertises support for the new field. An older backend cannot expose the editor or accept a structured-formula save through this frontend; this prevents a staggered deployment silently discarding the added fields.

## Verification

Twelve unit tests passed, covering canonical fingerprints, round trips, field changes, legacy omission, matching/nonelective consistency and invalid rates, bands or terms (`/tmp/payroll-employer-formula-unit.log`). The final built-app run passed both browser journeys in 15.0 seconds including build/startup (`/tmp/payroll-employer-formula-browser-final.log`). The new journey uses a real isolated database/API and verifies lost-response recovery without duplicate revisions, retained formula amounts, fingerprint changes, edit hydration and rejection of reversed tiers without saving. The initial new browser case timed out at the first implicit select-label locator; switching to the visible control’s role/name passed, with no timeout increase. The initial existing-plan case passed. TypeScript and whitespace checks passed. The 390-pixel form screenshot was visually inspected; there was no horizontal overflow or page error. The full employer-contribution integration remains unfinished; see PAYROLL_EMPLOYER_RETIREMENT_GAP_2026_09_21.md.

The separate older-backend compatibility browser check passed (1/1, 10.0 seconds including build/startup; `/tmp/payroll-employer-formula-compat.log`): selecting employer matching on an API response without the capability leaves the structured editor unavailable and shows the update requirement. No live employee or financial records were created by verification.
