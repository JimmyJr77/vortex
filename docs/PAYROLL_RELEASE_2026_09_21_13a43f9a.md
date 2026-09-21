# Payroll production release: 13a43f9a

Verified September 21, 2026 at 23:06:14 UTC. The overall onboarding/payroll goal remains incomplete.

- Application commit: `13a43f9ab9e1af0956312bd2395599902e5afc39`.
- Vercel deployment `dpl_9kiysMkgWUMdLNajSvDzH5YkwAgg` is READY for this commit and owns the `vortexathletics.com` production alias.
- Render was serving `5fe8a5b5f8f7`. Manually deployed the exact tested commit under existing publishing authorization. Deployment `dep-daorfsv40ujc738dn3n0` reported Deploy succeeded / Live, duration 1m16s.
- Render dashboard: https://dashboard.render.com/web/srv-d3vpuebipnbc739k9mv0/deploys/dep-daorfsv40ujc738dn3n0
- Public health returned HTTP 200 / OK with release `13a43f9ab9e1`, database connected, secure payroll document storage ready, email configured, schema migration tracking present, billing and access schema ready.
- All three originally reported CORS preflights returned HTTP 204, exact allowed origin `https://vortexathletics.com`, and credentials enabled: POST `/api/admin/payroll/employees`, GET `/api/admin/notifications`, GET `/api/admin/billing/cancellation-requests?status=pending`.
- Machine-readable evidence: `/tmp/payroll-live-release-13a43f9a.json`.

The first health request during deployment still showed the old release; only the post-switch response above establishes the new release. Startup again reported coaching-data migration warnings. This is not a clean global migration audit or evidence that every payroll table was checked.

Local verification for this application revision was 52 passing backend tests, zero failures/skips; see `PAYROLL_EMPLOYER_ANNUAL_PREVIEW_2026_09_21.md`. Earlier focused browser evidence is documented with the employer-deferral preview increment. No real hire, document signature, invitation, payment or external accounting write was created for this release check.

## Remaining implementation boundary

Source inspection confirms `retirementLedger.js` reserves employee ordinary/catch-up deductions and counts only ordinary deductions toward internal annual additions. Employer previews remain blocked from approval. Completing employer funding requires separately retained matching/nonelective obligations, shared annual-capacity reservations, approval-time source revalidation, statements, accounting, remittance and exception handling. Deployment does not satisfy those requirements.

Assumption: existing authorization to publish all commits includes deploying the tested main revision to the existing production services. No credentials, infrastructure plan or permissions were changed. The unrelated AdminAccess working-tree edit remains untouched.
