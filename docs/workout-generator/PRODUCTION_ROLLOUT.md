# Canonical workout generation production rollout

## Automated release gate

Run:

```sh
cd backend
npm run check:canonical-release -- --facility=<facility-id>
```

The command exits non-zero until the published pool, per-phase substitution
depth, approved relationship graph, calibration anchors, media governance, and
coach-pilot outcomes meet the controlled thresholds in
`canonicalOperationalReadiness.js`. A blocked result is expected before the
human review program finishes.

## Human-reviewed cohort

Start with at least 25 independently approved definitions and at least three
eligible cards in every required phase. Every card must have:

- current-version, exact-match media review;
- an approver who did not author the revision;
- complete coach, athlete, accessibility, programming, measurement, and support
  content;
- approved calibration evidence and reviewed substitution/progression edges;
- no unresolved identity collision, safety issue, or support escalation.

Automated or AI-generated suggestions remain draft evidence. They cannot set
review status, approval identity, media verification, or calibration approval.

## Coach pilot

Collect at least 20 structured workout reviews across different ages, group
sizes, objectives, equipment constraints, and session lengths. Release targets:

- keep or minor-edit rate at least 85%;
- exercise swap rate no more than 15%;
- dose-edit rate no more than 20%;
- no unresolved safety incident.

Record actual execution duration, setup delay, substitutions, stop events,
equipment conflicts, clarity score, and athlete feedback. Do not enter synthetic
reviews to satisfy the gate.

## Member and accessibility study

Test the cohort on supported phone and desktop layouts with representative
members. Include reading-level comprehension, captions, transcript, still-image
sequence, audio description, hearing support, cognitive support, pain
escalation, and localization review. Machine validation confirms only that the
required fields exist; human comprehension testing remains mandatory.

## Staged enablement

1. Apply all migrations to staging and run the complete library audit.
2. Run the release gate and retain its JSON result as release evidence.
3. Generate shadow workouts without showing them to members.
4. Compare selected cards, duration, fatigue, equipment, and substitutions with
   the coach-authored workout.
5. Enable coach-only generation behind a facility-scoped feature flag.
6. Enable member rendering only after coach acceptance and accessibility gates.
7. Expand the published cohort gradually while monitoring rejection, latency,
   swaps, dose edits, duration error, support reports, and stop events.

## Rollback

Disable the facility feature flag, retain generated-workout records for audit,
and quarantine affected card releases. Safety changes invalidate the active
release; instruction changes create a new card version; media changes invalidate
the media review; score changes revalidate saved templates. Database migrations
are additive and should not be rolled back destructively during an incident.
