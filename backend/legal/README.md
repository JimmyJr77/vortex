# Staff legal signatures

Legal → Staff Policies and Signatures contains the three Vortex safeguarding documents and the facility-scoped completion report. All current coaches, admins and payroll employees are included. An explicit payroll account link shares acknowledgments across portals; matching email addresses do not establish a link.

The authenticated portal displays pending policies on entry and retains a review button. Each document requires a typed name and affirmative consent. Staff sign for themselves. Administrators cannot mark another person's policy as signed. Reports distinguish pending and signed documents and export to CSV.

Migration `840_staff_legal_signatures.sql` runs through the existing release migration allowlist. Signatures retain authenticated identity, typed name, consent, document hash, title, version and server timestamp. Update/delete triggers protect signed records. Do not replace a signed file: retain historical assets and introduce a new hash/version when publishing revised terms. A changed hash requires a fresh acknowledgment.

The documents retain the approval, appointment and contact fields supplied in the original Word files. Signing acknowledges the policy; it does not complete those organizational appointments or fill their blanks.

Verification uses an isolated localhost database and synthetic staff. Never point it at production:

```sh
LEGAL_TEST_DATABASE_URL=postgresql://user@127.0.0.1:55439/postgres node --test backend/legal/signatures.test.js
LEGAL_TEST_DATABASE_URL=postgresql://user@127.0.0.1:55439/postgres node scripts/verify-staff-legal.mjs
```

The browser test exercises the real React forms, HTTP handlers and PostgreSQL records. Test-only authentication is confined to `testing/harness.js`; production routes use the existing canonical platform authentication and payroll sessions.
