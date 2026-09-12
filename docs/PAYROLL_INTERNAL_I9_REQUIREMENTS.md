# Internal I-9 implementation requirements

Checkpoint 509 (encrypted employee I-9 drafts): Added scoped I-9 draft GET/POST endpoints under employee authentication and the locked employee transaction wrapper. Drafts are encrypted with facility/employee/task/cycle context, resume across sessions, retain revision/retry metadata and bind to the current checklist status/response hash. A changed checklist invalidates the old draft context; stale tabs cannot overwrite it. Database guards enforce matching employee task/session, revision increments and no destructive row deletion. Draft saving does not submit the task or change employee identity. Eight final serial checks passed without skips (/tmp/payroll-i9-draft-storage-final.log, 13.9 seconds), including encrypted storage, cross-session resume, uppercase/exact/concurrent retries, stale/conflicting requests, foreign employee isolation, no-store headers, revoked sessions, no PII in checklist/audit, changed-response invalidation, database guard rejection, audit-failure rollback and missing vault-key failure; neighboring W-4/MW507 draft and route-boundary checks passed. Scoped lint and whitespace passed. Assumptions: generic checklist changes invalidate an unfinished draft context, unanswered employee questions remain unanswered, and signature intent cannot be embedded in a draft. Remaining: employee UI resume, preview/signature transactions, preparer and employer signing/examination, current-regulation verification, lifecycle and the broader full onboarding/production goal. No production migration or real signature occurred.

Source review September 12, 2026. This is implementation groundwork, not a completed I-9 workflow or a finding of regulatory compliance.

## Retained official sources

Downloaded directly from USCIS after browser retrieval returned 403; shell retrieval succeeded. Both PDFs identify edition 01/20/25. The form expires 05/31/2027.

- [Official form](https://www.uscis.gov/sites/default/files/document/forms/i-9.pdf): `backend/payroll/forms/uscis-i9-012025.pdf`, four pages, 133 AcroForm fields, SHA-256 `780f348c34df694bb0b4dbbfaf9f22b99b9757b80d16a37ba89aadf069597281`.
- [Official instructions](https://www.uscis.gov/sites/default/files/document/forms/i-9instr.pdf): `backend/payroll/forms/uscis-i9-instructions-012025.pdf`, eight pages, SHA-256 `c66c3818fbecbfb87b5f0560f4dfd4086905daf72ca29dba15ce4c8d49dc4ca3`.

Recheck the current USCIS edition before production rollout. Existing tax-form signing machinery is a possible implementation dependency; it does not establish I-9 compliance by itself.

## Required employee flow

1. Make all instructions available during completion. Section 1 follows accepted employment offer and is due by the first day of employment. Preserve actual signing time; late completion must not backdate evidence.
2. Capture legal name, other last names, address and date of birth. Preserve punctuation and the official single-name handling. Allow nonapplicable fields to remain blank. SSN is voluntary unless the employer participates in E-Verify; a pending SSN must have the instruction-supported follow-up path. Do not reuse mandatory tax-form SSN rules without checking this distinction.
3. Present all four citizenship/immigration attestations equally. Capture the identifier appropriate to the employee's chosen attestation: permanent-resident identifier, or one of the authorized-worker identifier alternatives and applicable authorization expiration. Do not infer a status from personal characteristics or documents.
4. Display the exact attestation and capture affirmative acknowledgment and the employee's own signature bound to the exact reviewed content. Keep identity, birth date and immigration identifiers encrypted and out of generic checklist responses, audit summaries, browser storage and diagnostics.
5. Ask whether a preparer/translator assisted. Every assisting person needs a distinct Supplement A certification and signature; support additional sheets without a fixed four-person limit. Never sign on another person's behalf.
6. Let the employee choose acceptable List A documentation or the List B plus C combination. Do not require a particular document as the default path.

## Required employer flow

1. Complete Section 2 within three business days after employment begins. For hires lasting fewer than three business days, it is due on the first day. The current generic three-weekday calculation is not sufficient to establish all deadline cases.
2. Capture document titles, issuing authorities, identifiers and applicable expiration dates in their original List A/B/C structure. Support multi-document List A combinations, receipt follow-ups, extensions and additional-information notations.
3. Record actual examination by the employer/authorized representative. An upload does not establish examination. An authorized alternative procedure needs its own eligibility and evidence requirements; it must not be selected automatically.
4. Bind the employer's certification, representative identity/title, first employment date, employer details and actual signature date to the retained employee Section 1. Corrections and amendments need attributable history and cannot silently replace earlier signed evidence.
5. Keep employer examination separate from E-Verify. E-Verify enrollment, cases, notices and resolution require a distinct integration and workflow. Do not claim verification from form completion alone.

## Lifecycle and electronic-system requirements

- Supplement B supports qualifying rehire within three years, reverification and name changes. Document choice for reverification remains with the employee; implement the applicable List A/C rules and exceptions from the instructions and M-274.
- Retain the completed form and applicable supplements; do not send completed I-9s to USCIS or ICE as a normal filing step.
- Before implementation signoff, verify current 8 CFR 274a.2 electronic-generation/signature/storage requirements, M-274 retention periods, inspection export, indexing, access controls, tamper detection, attribution, backups and quality-assurance procedures. These have not all been verified in this checkpoint.
- Test employee, multiple-preparer, employer, correction, receipt, extension, rehire, reverification, inspection/export and retention journeys. Narrow PDF-rendering or signature tests are not sufficient to mark internal I-9 complete.

## Current authoritative gap

`backend/payroll/onboarding.js` creates employee I9 and admin I9_REVIEW steps. `workforceRoutes.js` accepts a document/provider reference and generic admin review. There is no native I-9 draft, employee/preparer/employer signature chain, document examination workflow or Supplement B implementation yet. Retaining the official PDFs does not change that status.

## Electronic-signature source review

[Official 2025 annual CFR, 8 CFR 274a.2(e)–(i), pages 11–13](https://www.govinfo.gov/content/pkg/CFR-2025-title8-vol1/pdf/CFR-2025-title8-vol1-part274a.pdf) provides the implementation baseline below. Current eCFR retrieval returned 406; this annual edition is not asserted to establish all September 2026 changes.

- Employee signature capture must acknowledge reading the attestation, associate the signature with the completed record, apply it at the transaction, retain signer-identity verification and provide printable confirmation on request.
- Employer/representative signature capture has its own attestation requirement; implement affirmative acknowledgment for that role too.
- Preserve attributable, permanent change records and inspection access to requested forms, supporting documents, audit trails and obtainable structured summaries.
- Document creation, maintenance, authenticity and indexing processes. Verify access controls, backups/recovery, operator training and periodic quality checks before claiming electronic-system compliance.

Implementation decision: separate each signer's authenticated transaction from PDF rendering. A generic document-upload receipt or a checkbox completing the hiring checklist cannot stand in for a signer transaction or document examination. Existing encrypted-document primitives may be reused only after their identity, audit, confirmation and export coverage is proven for I-9.

## Reproducible form inventory

Run `python3 scripts/payroll/extract-i9-fields.py --check` in an environment with `pypdf`. The extractor verifies the pinned form digest and compares field-tree entries, page widget locations, inherited maximum lengths and appearance-state names to the retained JSON inventory. It passed on September 12, 2026.

The PDF contains 133 field-tree entries and 130 page widgets; a field-tree count is not a count of visible inputs. Some List A parent/child entries have no direct widget. Citizenship checkboxes use `/On` appearance names, while alternative-procedure boxes use `/Yes` and `/Off`. The eventual renderer must handle these actual structures and re-read canonical values and widget appearances after filling. This inventory does not prove that any filled or signed I-9 renders correctly.

## Section 1 structural validator groundwork

`backend/payroll/i9Section1.js` validates the pinned edition, accepted-offer/E-Verify context, employee information, actual calendar dates, optional fields, SSN/pending-SSN distinction, all four attestation branches and one authorized-worker identifier alternative. It rejects cross-branch identifier fields and signatures embedded in an answers payload. It preserves the need for preparer certification rather than treating assistance as completed.

Two standalone unit tests and scoped lint passed. These tests were added after the full payroll suite began and are not included in that running suite's count. This module is not imported by the current onboarding routes and did not change the runtime under regression testing.

Limitations to resolve before integration: I-94 and passport numbers currently receive structural text/length checks, not a definitive issuance-format validation; verify current I-94 alphanumeric guidance before tightening these rules. The validator does not establish status, authorization validity or document authenticity. It does not perform signature capture, actual employer E-Verify enrollment lookup, preparer identity verification, Section 2 examination, rendering, persistence, corrections or lifecycle handling. Authorization-expiration treatment and extensions require the separate review workflow; no historical attestation is silently rewritten.

## Unsigned Section 1 PDF preview groundwork

`i9Section1Pdf.js` fills the retained original form with a pinned embedded font, preserves all four pages, leaves employee/date/employer signatures blank, and reopens the output to check canonical text. All four attestation checkbox variants were tested for matching canonical and widget appearance states. Optional SSN stays blank. Overlong/unprintable fields fail before a PDF is returned. Two renderer tests passed (`/tmp/payroll-i9-renderer-tests.log`, 4.1 seconds); a synthetic citizen preview was rendered and visually inspected. These standalone tests are separate from the already-running full suite.

The preview is unsigned and is not connected to onboarding routes. The intended UI must clearly identify it as a preview outside the original form content. The original form language is preserved. Subsequent employee/preparer/employer signatures, document examination, private storage, confirmation and audit/export workflows still require implementation and verification.

## Partial draft input groundwork

`i9DraftInput.js` accepts unfinished employee fields, partial SSN/date entries and selected identifier alternatives. Pending-SSN and preparer-assistance answers can remain null instead of defaulting to an attestation. Signatures, signing dates, employer approval and unknown/nested fields are rejected. Two focused tests and scoped lint passed. This is input normalization only: encrypted revisioned storage, scoped sessions, retry semantics, clearing after signature and UI resume still need implementation. Its new tests are separate from the full suite already in progress.

## Draft-to-preview boundary

`i9DraftToSection1.js` converts validated draft fields into the final Section 1 input and includes only identifiers for the employee's selected attestation. Unselected alternative fields remain in the draft but do not become part of another attestation. Incomplete identity, unanswered assistance questions and missing required passport-country entries cannot become a complete preview. Two focused tests and scoped lint passed; this module remains separate from current onboarding routes and the in-progress full regression suite.
