# Canonical exercise-card governance

## Purpose

Canonical card governance is the production authoring path for generator-ready
exercise content. Authoring is protected by
`CANONICAL_WORKOUT_GENERATOR_ENABLED` and the existing `library.view` and
`library.manage` permissions. Generation and swaps additionally require an
explicit facility rollout enrollment; a global environment switch alone never
enables a facility.

Legacy exercise cards remain available and are not mutated by this workflow.

## Lifecycle

The supported lifecycle is:

`draft → review → published → deprecated → review`

Drafts and review-state cards are editable. Saving a review-state card returns
it to draft, increments `card_version`, invalidates exact-match media approval,
and requires a new review cycle. Published and archived cards are immutable.

Publication requires all of the following:

- A reviewer other than the card creator.
- An approval recorded by the publishing reviewer for the current card version.
- A current version that is already publication-ready when the approval is
  recorded; incomplete cards can receive a request for changes but cannot be
  pre-approved for later publication.
- A current-card-version, manual-playback exact-match media review. The review
  records that the reviewer checked playback, exact variant mechanics, the
  current link, and available accessibility support; candidate metadata,
  oEmbed, or a default UI value never counts as media verification.
- A healthy HTTPS video with demonstration quality of at least 80/100.
- Complete identity, family, movement-pattern, body-region, confidence,
  difficulty, delivery-profile, dosage, instruction, quality-gate, and stop-rule
  fields.
- A complete, independently reviewed exact-variant structured profile for every
  published variation. This covers anatomy roles, movement geometry, equipment
  roles, athlete task demands, stress, scaling, and composition.

The API enforces these rules; disabled buttons in the coach UI are convenience,
not the security boundary.

## Concurrency and audit

Updates and lifecycle changes require `expectedUpdatedAt`. A stale operation
returns HTTP 409 and never overwrites a newer revision.

Every create, update, submission, publication, deprecation, and archive action
stores an immutable snapshot in `coaching.exercise_card_revision_v1`.
Reviewer decisions are version-bound in `coaching.exercise_card_review_v1` and
include at least 20 characters of observed evidence.
Media reviews are version-bound in `coaching.exercise_media_review_v1`.
Relationship decisions snapshot the edge and independent reviewer rationale in
`coaching.exercise_relationship_review_v2` before the edge status changes.
Taxonomy and exact-variant profile reviews also require at least 20 characters
of observed independent-review evidence before their approval records can be
written.

## Runtime admission

The generator does not treat lifecycle status as sufficient evidence. Its
published pool admits a card only when the current card version has the
publisher's independent approval record, the approved video has current
manual-playback exact-match evidence, and every selected variant has an
independently reviewed structured profile. Every taxonomy assignment or
not-applicable decision that belongs to the selected card, variant, or delivery
profile must also have matching immutable independent-review evidence. It
consumes a relationship edge only when that edge has matching immutable
independent-review evidence. Release readiness reports these same
evidence-backed percentages and fails closed when any published card falls
short.

## Relationship graph

Edges support:

- regression
- progression
- lateral substitution
- equipment equivalent
- phase equivalent
- compatible pairing
- contraindicated pairing

Progressions and regressions require at least one controlled changed dimension:
load, leverage, range, speed, stability, complexity, impact, decision demand,
or fatigue. Every edge requires a 1–100 similarity score and reviewed rationale.
New or edited edges return to review state. The edge creator cannot approve the
same edge.

Only evidence-backed approved edges are consumed by production swap and
progression logic. An old status value, automated migration, or candidate
rationale alone never activates an edge.

## API

Read:

- `GET /api/coach/canonical/cards`
- `GET /api/coach/canonical/cards/:id`
- `GET /api/coach/canonical/cards/review-queue`
- `GET /api/coach/canonical/media-verification-queue`
- `GET /api/coach/canonical/relationships/review-queue`

Author:

- `POST /api/coach/canonical/cards`
- `PUT /api/coach/canonical/cards/:id`
- `POST /api/coach/canonical/cards/:id/status`
- `POST /api/coach/canonical/cards/:id/reviews`
- `POST /api/coach/canonical/cards/:id/media-review`
- `POST /api/coach/canonical/relationships`
- `POST /api/coach/canonical/relationships/:id/review`

All IDs are UUID-validated and every query is facility-scoped.

### Structured-profile batch planning

The following read-only command creates a bounded, field-specific authoring
batch. It never writes profile data, review evidence, or approval state:

```sh
npm --prefix backend run report:canonical-structured-profile-queue -- \
  --facility=<facility-id> --missing-field=scalingHandles --limit=25
```

Use `--status=suggested` or `--status=review`, `--offset=<n>`, and
`--sort=alphabetical` as needed. Add `--json` only when a downstream review
tool needs the full queue payload. A non-empty batch is not an approval cohort;
every exact variant must still be authored, independently reviewed with observed
evidence, and separately pass the card/media/relationship/calibration gates.

## Deployment

1. Apply the full registered canonical migration sequence in staging, including
   the structured-profile, facility-rollout, media-evidence, and
   relationship-review, minimum-human-evidence, and deterministic
   identity-boundary migrations (753 through 759).
2. Enable `CANONICAL_WORKOUT_GENERATOR_ENABLED`, then explicitly enroll one
   internal facility in `canonical_generator_facility_rollout_v1` with only the
   needed pilot flags.
3. Verify creator/reviewer accounts have the intended library permissions.
4. Create a draft, submit it, independently review its video and card, publish
   it, and confirm it appears only in the next explicit library release.
5. Verify a stale browser session receives HTTP 409.
6. Verify creator self-approval is rejected.
7. Monitor due media reviews and return broken or mismatched media to review.

Migration 243 was applied twice successfully to a disposable PostgreSQL 15
schema during implementation, confirming syntax and idempotence.
