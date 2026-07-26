# Canonical exercise-library audit

Audit baseline: 2026-07-26, disposable PostgreSQL 15, facility 1.

## Result

The migration preserves every legacy exercise:

| Measure | Count |
|---|---:|
| Legacy exercise rows | 1,676 |
| Active canonical definitions | 1,531 |
| Archived redundant definitions | 145 |
| Canonical variant rows | 1,734 |
| Contextual delivery profiles | 1,818 |
| Migration coverage | 100% |
| Published canonical definitions | 0 |
| Active quarantined test packets | 1,531 |

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
reacceleration and the aerial diagonal bound remain separate identities.
Migration 307 consolidates twelve Cossack cards whose differences are range,
tempo, isometric hold, bottom-position motion, terminal pause, reach overlay,
or external implement into `Cossack Squat`. The release/reception wall-ball
composite remains separate and identity-quarantined. Migration 308 consolidates
three adductor rock-back reach and half-kneeling-context cards into
`Adductor Rockback`; incomplete generic-reach and half-kneeling execution
dimensions remain explicitly quarantined. Migration 309 then resolves the
hanging cluster into `Dead Hang`,
`Active Hang`, and `Scapular Pull-Up`, consolidating the exact Active Hang hold
duplicate and archiving the ambiguous passive-or-active compound source.
Migration 310 consolidates four hanging knee/leg-raise source identities into
`Hanging Leg Raise`, with bent-knee, straight-leg, and eccentric-lower variants
and an archived exact tuck-knee duplicate. Migration 311 consolidates the
historical Tuck L-Sit Hold into L-Sit as a short-lever variant, adds explicit
one-leg, straddle, and ring-support variants, and creates a distinct,
unpublished Hanging L-Sit source and canonical definition for overhead
suspension. At the migration-311 checkpoint, the 1,550-definition library preserved all
1,674 source mappings and has zero direct canonical-name, display-name,
alias-to-alias, or alias-to-name collisions. The post-migration-252 audit left
36 name-based similar pairs as non-blocking P2 warnings; later family passes
are adjudicating that historical queue explicitly because modifiers need
movement context rather than an automatic merge. See `IDENTITY_RESOLUTION.md`.

Migration 312 resolves the adjacent grounded- and supported-compression family.
The historical `Straddle Compression Lift` source now represents a broader
four-variant `Seated Compression Lift` identity while retaining its stable
canonical slug and historical aliases. It adds distinct review-only `V-Sit`
and `Manna Hold` exercise definitions because their leg-height, hip-height,
shoulder relationship, support, supervision, fatigue, and exit demands cross
identity boundaries.

Migrations 313 and 314 then finish the three hang-family cards without changing
their resolved identities. Each card now has baseline, foot-assisted,
band-assisted, ring, weighted, and single-arm variants with complete
difficulty, load, fatigue, programming, dosage, timing, measurement, athlete,
coach, accessibility, and support contracts. Dead Hang also retains its
breathing-context restore profile. Detailed mechanics remain qualifiers while
the selectable definitions use controlled `hang`, `pull`, and `brace`
taxonomy.

Migration 315 archives two final exact semantic duplicates while keeping the
reversed sequences distinct. `Depth Jump to Box Jump` consolidates into `Depth
Drop to Box Jump`; `Box Jump with Altitude Landing` consolidates into `Box Jump
to Depth Drop`. Migration 316 completes both survivors with exact ordered
contacts, anatomy and biomechanics, baseline and hands-on-hips difficulty
scores, load/fatigue/recovery contracts, equipment and population constraints,
two contextual profiles per variant, athlete and coach instructions, stop
rules, support operations, candidate relationships, and quarantined card test
packets. The migration creates no publication, review, calibration,
relationship, or media approval.

Migration 317 then consolidates `Tall-Kneeling Medicine Ball Chest Pass`,
`Tall-Kneeling Chest Pass to Wall`, and `Half-Kneeling Chest Pass to Wall`
under the stable `Kneeling Medicine Ball Chest Pass` identity. Migration 318
adds four exact selectable variants: tall- and half-kneeling, each with
throw-only and rebound-and-catch delivery. The two generic legacy sources never
declared stance or catch behavior, so their variants remain archived,
nonselectable provenance rather than being assigned by assumption. The
explicit wall sources also lose unrelated squat, overhead-reach, and
triple-extension requirements.

The completed card has 16 candidate evidence sections, five currently healthy
oEmbed candidates, 12 alternate assessments, four scored variants, eight
contextual profiles, six review-only relationship edges, and 12 review-only
calibration proposals. Video exact match, graph approval, independent
calibration, and publication remain human gates. No exercise-card proficiency
level, media approval, relationship approval, calibration approval, or
publication state is created.

Migration 319 then consolidates `Medicine Ball Rotational Wall Throw` into the
stable `Medicine Ball Rotational Throw` identity. The wall is a delivery
target, not a different primary action. Because neither source declares whether
the athlete retrieves the ball or catches a rebound, both source variants
remain archived and nonselectable. Migration 320 adds exact
throw-and-retrieve and rebound-and-catch variants with output and technique
profiles, side-balanced dosage, cumulative fatigue budgets, instructions,
support operations, stop rules, candidate graph edges, calibration proposals,
and evidence. Migration 321 maps card and profile equipment to controlled keys
while retaining detailed wall, target, tracking, and feedback requirements in
contextual JSON.

The completed rotational card has 16 candidate evidence sections, five current
healthy oEmbed candidates, 12 alternate assessments, two scored variants, four
contextual profiles, two review-only relationship edges, and six review-only
calibration proposals. Exact-match media review, graph approval, independent
calibration, and publication remain human gates.

Migration 322 then consolidates `Med Ball Shuffle-to-Rotation Throw` into
`Shuffle-to-Rotational Medicine Ball Throw`. Both source cards define the same
lateral shuffle or crow-hop, plant, pivot, and two-hand rotational medicine-ball
projection; their 40-versus-50 seed difference was not an identity boundary.
Migration 323 completes the survivor with exact throw-and-retrieve and
predictable-rebound-and-catch variants, two contextual profiles per variant,
controlled equipment, approach and plant logistics, cumulative lateral-contact
and rotational-throw budgets, support contracts, candidate graph edges,
calibration proposals, and a quarantined test packet. Planned versus reactive
cueing remains an explicit modifier and is never silently introduced.

The completed shuffle rotational card has 16 candidate evidence sections, five
current healthy oEmbed candidates, 12 alternate assessments, two scored
variants, four contextual profiles, four review-only relationship edges, and
six review-only calibration proposals. Full-video exact-match and safety
review, captions/accessibility review, graph approval, independent calibration,
and publication remain human gates.

Migration 324 consolidates `Single-Leg Box Jump to Single-Leg Landing` into the
stable `standing-box-jump-to-single-leg-landing` definition and names the
survivor `Box Jump to Single-Leg Landing`. Migration 325 adds exact
bilateral-takeoff and same-leg-unilateral-takeoff variants, two profiles per
variant, controlled box and optional setup equipment, complete anatomy,
load/fatigue/recovery and support contracts, four review-only graph edges, six
review-only calibration proposals, 16 evidence sections, five current oEmbed
candidates, 12 alternate assessments, and a quarantined test packet.

Migration 326 consolidates `Lateral Line Hop to Single-Leg Stick` into
`Single-Leg Lateral Hop to Stick`; a line is a target constraint, while the
terminal controlled stick defines the card. Migration 327 adds exact
low-amplitude-control and distance-output variants, two profiles per variant,
controlled optional setup equipment, complete anatomy, load/fatigue/recovery
and support contracts, four review-only graph edges, six review-only
calibration proposals, 16 evidence sections, five current oEmbed candidates,
12 alternate assessments, and a quarantined test packet. Continuous rebound
line hops remain a distinct exercise. Neither family migration pass assigned an
exercise-card skill level or created an approval.

Migration 328 consolidates `Dumbbell Dead Bug Pullover`,
`Band-Resisted Dead Bug Pullover`, `Medicine Ball Dead Bug Pullover`, and
`Dead Bug Pullover with Exhale` into the stable `Dead Bug Pullover` identity.
Implement, declared leg action, load, range, breathing emphasis, and phase
intent are variant or delivery dimensions; the rotation-resist pulldown,
dead-bug presses, and ordinary unloaded dead bug remain separate actions.
Migration 329 adds five exact implement/leg-action variants, ten contextual
profiles, six review-only graph edges, 15 review-only calibration proposals,
16 evidence sections, five current oEmbed candidates, 12 alternate
assessments, and a quarantined test packet. Overall difficulty is the maximum
of exercise complexity and physical difficulty. No exercise-card skill level
or approval is created.

Migration 330 consolidates `Dumbbell Romanian Deadlift`, `Kettlebell Romanian
Deadlift`, `Double Kettlebell Romanian Deadlift`, `Sandbag Romanian Deadlift`,
`Landmine Romanian Deadlift`, and `Romanian Deadlift Eccentric` into the stable
`Romanian Deadlift` identity. Implement type and quantity, grip, mass
distribution, load path, range, and tempo are exact variant dimensions of the
same bilateral standing loaded hip hinge. Single-leg and staggered-stance
RDLs, RDL-to-row, conventional deadlifts, good mornings, and swings remain
separate.

Migration 331 adds eight exact implement/tempo variants, 16 contextual
profiles, eight review-only graph edges, 24 review-only calibration proposals,
16 evidence sections, five current oEmbed candidates, 12 alternate
assessments, and a quarantined test packet. Overall difficulty is mechanically
derived from exercise complexity and physical difficulty. No exercise-card
skill level, media approval, relationship approval, calibration approval, or
publication state is created.

Migration 332 consolidates `Front-Foot-Elevated Dumbbell Split Squat` and
`Front-Foot-Elevated Sandbag Split Squat` into the stable
`Front-Foot-Elevated Split Squat` identity. All three legacy cards preserve the
same stationary split stance, whole lead-foot platform support, rear-foot
floor contact, descent, and ascent. Migration 333 adds unsupported and
supported bodyweight, two-dumbbell suitcase, contralateral and ipsilateral
single-dumbbell, and front-held-sandbag variants, 12 contextual profiles, ten
review-only graph edges, 18 review-only calibration proposals, 16 evidence
sections, five current oEmbed candidates, 12 alternate assessments, and a
quarantined test packet.

Rear-foot elevation, heel-only elevation, stepping lunges, and jumping split
squats remain distinct exercise boundaries. Overall difficulty is mechanically
derived from exercise complexity and physical difficulty. No exercise-card
skill level, media approval, relationship approval, calibration approval, or
publication state is created.

The final 1,531-definition library preserves all 1,676 source mappings, 1,734
variant rows, and 1,818 delivery profiles and still has zero direct
canonical-name, display-name, alias-to-alias, or alias-to-name collisions.

Migration 298 removes exercise-card skill-level classifications while retaining
levels on the dedicated skill library. The fresh-database verification found
zero exercise, scaling, or safety-profile skill levels and 1,112 retained
skill-library levels.

Migrations 304 and 305 complete the enforceable two-axis exercise difficulty
contract. Technical complexity and physical difficulty are assessed
independently, and overall difficulty is derived as their maximum. Existing
traceable difficulty profiles supplied complete core scores for 1,663 of 1,676
legacy exercises; the other 13 have no source assessment and remain explicitly
quarantined. Overall-difficulty calibration is no longer independently
proposable, and no approval or publication state was created by the backfill.

After migration 333 and the full persisted audit, nineteen cards have complete
automated structure and are blocked only by the four honest human gates:
exact-match media approval, coach-approved graph relationships, approved
difficulty calibration, and publication approval. All 1,531 definitions remain
quarantined and none are published.

The all-library audit now precomputes normalized identity names and bigrams once.
The same indexed all-card duplicate semantics avoid rebuilding identity terms
inside every pairwise comparison. The 1,531-card disposable audit retains that
optimization.

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
