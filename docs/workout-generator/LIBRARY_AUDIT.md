# Canonical exercise-library audit

Audit baseline: 2026-07-26, disposable PostgreSQL 15, facility 1.

## Result

The migration preserves every legacy exercise:

| Measure | Count |
|---|---:|
| Legacy exercise rows | 1,673 |
| Active canonical definitions | 1,555 |
| Archived redundant definitions | 118 |
| Canonical baseline variants | 1,673 |
| Contextual delivery profiles | 1,717 |
| Migration coverage | 100% |
| Published canonical definitions | 0 |
| Quarantined test packets | 1,555 |

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
delivery profile. Migrations 299 and 300 consolidate six additional abbreviated
identities. Migration 301 consolidates seven ball-slam cards whose differences
are controlled implement, stance, cadence, trajectory, or entry-footwork
variants. Migration 302 consolidates four 90/90 and shin-box cards whose
differences are outcome wording, reach emphasis, equivalent nomenclature, or
continuous-flow delivery. Migration 303 consolidates the spelled-out-degree
duplicate of 180 Jump to Stick and a duplicate planned 180-degree
turn-and-reaccelerate identity whose approach and turn details are controlled
delivery dimensions. Migration 306 consolidates `45-Degree Cut to Stick` into
`45-Degree Cut and Stick` because the connecting word does not change the
planned 45-degree redirection or held terminal outcome. Immediate
reacceleration and the aerial diagonal bound remain separate identities. The
Migration 307 consolidates twelve Cossack cards whose differences are range,
tempo, isometric hold, bottom-position motion, terminal pause, reach overlay,
or external implement into `Cossack Squat`. The release/reception wall-ball
composite remains separate and identity-quarantined. Migration 308 consolidates
three adductor rock-back reach and half-kneeling-context cards into
`Adductor Rockback`; incomplete generic-reach and half-kneeling execution
dimensions remain explicitly quarantined. The resulting
1,555-definition library preserves all
1,673 source mappings and has zero direct canonical-name, display-name,
alias-to-alias, or alias-to-name collisions. The post-migration-252 audit left
36 name-based similar pairs as non-blocking P2 warnings; later family passes
are adjudicating that historical queue explicitly because modifiers need
movement context rather than an automatic merge. See `IDENTITY_RESOLUTION.md`.

Migration 298 removes exercise-card skill-level classifications while retaining
levels on the dedicated skill library. The fresh-database verification found
zero exercise, scaling, or safety-profile skill levels and 1,112 retained
skill-library levels.

Migrations 304 and 305 complete the enforceable two-axis exercise difficulty
contract. Technical complexity and physical difficulty are assessed
independently, and overall difficulty is derived as their maximum. Existing
traceable difficulty profiles supplied physical scores for 1,661 of 1,673
variants; the other 12 have no source assessment and remain explicitly
quarantined. Overall-difficulty calibration is no longer independently
proposable, and no approval or publication state was created by the backfill.

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
