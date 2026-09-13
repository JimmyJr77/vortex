# Phone formatting, secure documents, and existing accounts

## Delivered

- US phone inputs share a formatter for typing and pasting, including parentheses and a pasted leading +1. Dynamic payroll and billing phone inputs use the same component. SMS delivery still receives E.164 values.
- Payroll employees can verify an existing Vortex account and explicitly confirm its link after opening their hiring invitation. They can subsequently sign in to payroll with that account.
- Links require a valid payroll session, a signed existing-account identity checked against the active user, the same workplace, and explicit confirmation. A workplace account cannot link to multiple employees. Family membership and matching email alone do not grant payroll access.
- Initial PAYROLL_DOCUMENT_KEY configured in Render and deployed September 13, 2026. No secret is recorded here. The health endpoint exposes only document-storage readiness.

## Verified locally

- PostgreSQL integration tests passed: account ownership, workplace isolation, duplicate/conflicting links, linked-account sign-in, inactive account rejection, audit idempotency; encrypted W-4 draft persistence and retry protections.
- Playwright passed: raw/formatted/+1 phone input, dash deletion, explicit account-link confirmation, no browser exceptions. Account login responses were synthetic fixtures; backend JWT verification was independently integration tested.
- TypeScript and Vite production build passed. Vite retains existing large-chunk warnings.

## Assumptions and operating steps

- Phone numbers are US ten-digit numbers; extensions and international formats are outside this requested format.
- New hires first open their invitation, then verify and link their own existing member/coach/admin account. Returning users use the linked account and workplace number on the payroll sign-in page.
- Linking is optional and does not merge household records or change roles. Existing payroll sign-in remains available.
- A link to a different account is rejected; administrative unlink/relink is not included in this change.
- Keep the document encryption key backed up in a restricted secret manager. Replacing or losing it can make previously encrypted documents unreadable. Key rotation needs a planned document migration.
- Production real-person W-4 submission and real-account linking were not performed as tests.
