# Canonical exercise-library audit

Audit baseline: 2026-07-25, disposable PostgreSQL 15, facility 1.

## Result

The migration preserves every legacy exercise:

| Measure | Count |
|---|---:|
| Legacy exercise rows | 1,673 |
| Canonical definitions | 1,673 |
| Canonical baseline variants | 1,673 |
| Contextual delivery profiles | 1,717 |
| Migration coverage | 100% |
| Published canonical definitions | 0 |
| Quarantined test packets | 1,673 |

No migrated card is treated as production-approved. Migration creates stable
canonical identity and provenance, then leaves the definition, variant, and
delivery profiles in `review`. Migration 246 creates a persisted, versioned test
packet for every card and explicitly marks it `quarantined` until the executable
audit proves all publication gates.

The baseline audit found these blockers on every card:

- anatomy and biomechanics need human completion;
- environment and population constraints need human completion;
- load and fatigue/recovery profiles need calibration;
- programming, sequencing, timing, dose scaling, and measurement need review;
- athlete, accessibility, coach, and support-operations content need review;
- exact-match demonstration media needs external review;
- progression/regression/substitution edges need review;
- score calibration anchors need independent approval.

The initial audit found 215 cards participating in potential identity matches,
70 exact-name pairs, and 54 direct database identity pairs. Migration 252
consolidates 83 redundant definitions while preserving every source variant and
delivery profile. The resulting 1,590-definition library has zero direct
identity collisions. Thirty-six similar-name pairs remain as non-blocking P2
warnings because their modifiers describe meaningful execution differences.
See `IDENTITY_RESOLUTION.md`.

## Run the audit

Apply all migrations, then run:

```sh
DATABASE_URL=postgresql://... DATABASE_SSL=false \
  npm --prefix backend run audit:canonical-library -- --facility=1
```

Use `--json` for the complete per-card packet and `--no-persist` for a read-only
run. The command exits nonzero when one-to-one migration coverage is broken.
Quarantined content is expected and does not make the audit command fail.

After the audit, run `npm --prefix backend run check:canonical-release --
--facility=1`. This second command intentionally exits nonzero while library,
governance, calibration, media, or real coach-pilot gates remain incomplete.

Each stored packet contains named P0–P2 checks for:

- identity, aliases, controlled taxonomy, and duplicate candidates;
- muscles, joints, actions, planes, and laterality;
- difficulty, load, fatigue, impact, and recovery;
- equipment, environment, and population constraints;
- contextual purpose, dosage, logistics, instructions, quality gates, and stop
  rules;
- exact-match media review for the current card version;
- reviewed graph relationships and calibration evidence;
- confidence, source provenance, migration coverage, and publication readiness.

## Human-review protocol

Do not bulk-publish migrated rows. For each card:

1. Resolve duplicate/alias candidates and controlled taxonomy.
2. Complete anatomy, constraints, load, fatigue, and contextual delivery fields.
3. Review scores against approved calibration anchors.
4. Add and independently approve graph relationships.
5. Verify a healthy HTTPS demonstration is an exact match for the current card
   version. Record the reviewer and evidence; do not infer approval from a URL.
6. Run the audit, resolve every P0/P1 blocker, complete two-person card review,
   and publish only into an explicit versioned library release.

Re-running the audit replaces the current packet for that exact card version
without erasing immutable card, media, relationship, or calibration history.
