# Canonical exercise-card governance

## Purpose

Canonical card governance is the production authoring path for generator-ready
exercise content. It is enabled with `CANONICAL_WORKOUT_GENERATOR_ENABLED` and
uses the existing `library.view` and `library.manage` permissions.

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
- An exact-match media review for the current card version.
- A healthy HTTPS video with demonstration quality of at least 80/100.
- Complete identity, family, movement-pattern, body-region, confidence,
  difficulty, delivery-profile, dosage, instruction, quality-gate, and stop-rule
  fields.

The API enforces these rules; disabled buttons in the coach UI are convenience,
not the security boundary.

## Concurrency and audit

Updates and lifecycle changes require `expectedUpdatedAt`. A stale operation
returns HTTP 409 and never overwrites a newer revision.

Every create, update, submission, publication, deprecation, and archive action
stores an immutable snapshot in `coaching.exercise_card_revision_v1`.
Reviewer decisions are version-bound in `coaching.exercise_card_review_v1`.
Media reviews are version-bound in `coaching.exercise_media_review_v1`.

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

Only approved edges should be consumed by production swap and progression
logic.

## API

Read:

- `GET /api/coach/canonical/cards`
- `GET /api/coach/canonical/cards/:id`

Author:

- `POST /api/coach/canonical/cards`
- `PUT /api/coach/canonical/cards/:id`
- `POST /api/coach/canonical/cards/:id/status`
- `POST /api/coach/canonical/cards/:id/reviews`
- `POST /api/coach/canonical/cards/:id/media-review`
- `POST /api/coach/canonical/relationships`
- `POST /api/coach/canonical/relationships/:id/review`

All IDs are UUID-validated and every query is facility-scoped.

## Deployment

1. Apply migrations 240 through 243 in staging.
2. Enable `CANONICAL_WORKOUT_GENERATOR_ENABLED` for an internal facility.
3. Verify creator/reviewer accounts have the intended library permissions.
4. Create a draft, submit it, independently review its video and card, publish
   it, and confirm it appears only in the next explicit library release.
5. Verify a stale browser session receives HTTP 409.
6. Verify creator self-approval is rejected.
7. Monitor due media reviews and return broken or mismatched media to review.

Migration 243 was applied twice successfully to a disposable PostgreSQL 15
schema during implementation, confirming syntax and idempotence.
