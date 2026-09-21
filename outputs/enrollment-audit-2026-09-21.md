# Family enrollment flow — September 21, 2026

## Problem

The member portal used one cart for the currently selected athlete. Switching athletes reassigned the selected classes instead of retaining separate selections. Family signup also made it easy to change the athlete on an existing row when intending to add another enrollment.

## Changes

- Each athlete has an independent enrollment panel and draft: classes, packages, start date, pricing choices, and discount codes.
- Drafts are scoped to the signed-in account and athlete, retained across athlete switches and payment navigation, and cleared on logout. Only the athlete submitted to payment is removed when checkout opens; other athletes remain ready to enroll.
- The UI names the athlete whose classes are selected, lists athletes with pending selections, explains the separate checkout requirement, and offers an explicit next-athlete action after enrollment.
- Pricing requests are cancelled logically when their selection changes. Confirmation requires a successful current preview.
- Family signup includes a button to copy a class enrollment into a separate row for another family member without changing the original assignment.
- The Jackrabbit login link now points to the parent login portal.

## Scope

These changes apply to all families. No client identifiers, account records, or family-specific branches are part of the implementation or test fixtures. The existing server authorization and one-athlete checkout contract remain in use. A combined multi-athlete payment is not introduced.

The broader audit also identified separate follow-up work: athlete selection on direct scheduling/event and drop-in routes, an existing-account handoff from public enrollment, and a configured basketball domain that showed a parked page. These require separate flow/domain changes and are not represented as fixed here.

## Verification

See the generic family-enrollment browser regressions in `tests/e2e/family-enrollment.spec.ts`. They exercise switching athletes, selecting the same class for siblings, independent dates and discounts, checkout request ownership, preserving the other athlete after checkout, stale pricing, and the family-signup copy action. All six browser regressions passed, along with 28 existing family/authorization/drop-in tests, 22 management/launch smoke checks, targeted ESLint, TypeScript, and the production build. Production payments were not submitted. Browser API requests were mocked with synthetic identities.
