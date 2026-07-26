# Canonical exercise identity resolution

## Result

Migration 252 consolidates 83 redundant canonical definitions into surviving
identities. Migration 299 then consolidates the abbreviated Single-Leg RDL
identity, and migration 300 consolidates five `Med Ball` abbreviations into
their full-name `Medicine Ball` identities. Migration 301 consolidates seven
slam-ball implement, stance, cadence, trajectory, and entry-footwork variants
into their five materially distinct slam identities. Migration 302 consolidates
four 90/90 and shin-box cards whose differences are outcome wording, a reach
overlay, equivalent nomenclature, or continuous-flow delivery. Migration 303
then consolidates a numeric-wording duplicate of 180 Jump to
Stick and a duplicate planned 180-degree turn-and-reaccelerate card whose
approach and turn details are delivery dimensions. Migration 306 consolidates
the duplicate `45-Degree Cut to Stick` wording into `45-Degree Cut and Stick`;
the planned held finish remains distinct from immediate reacceleration and from
an aerial diagonal bound. Migration 307 consolidates twelve Cossack range,
tempo, hold, reach, and implement cards into `Cossack Squat`; the wall-ball
release/reception composite remains separate. Migration 308 consolidates the
generic-reach, explicit T-spine-reach, and half-kneeling-context adductor
rock-back cards into `Adductor Rockback`, with incomplete reach and
half-kneeling execution details explicitly quarantined. Migration 309 resolves
the hanging cluster into distinct `Dead Hang`, `Active Hang`, and
`Scapular Pull-Up` identities, consolidates the exact `Active Hang Scapular
Hold` duplicate, and archives the historical passive-or-active compound source
without making its ambiguous variant selectable. Together, the migrations
preserve:

- all 1,673 legacy source IDs through `exercise_definition_source_v1`;
- all 1,673 source variants and their difficulty, equipment, load, and fatigue
  data;
- all 1,717 contextual delivery profiles;
- provenance and an explicit resolution record for every consolidation.

The resulting library contains 1,553 active canonical definitions, 122 explicit
identity-resolution records, and zero
direct canonical-name, display-name, or alias-to-name collisions. Consolidated
source definitions are archived and remain traceable; they are not deleted.
The quality report expands and normalizes every canonical name, display name,
and alias before matching definition pairs, so an alias equal to another card's
name can no longer escape the collision gate.

## Similar names that remain distinct

The 36 name-based high-similarity pairs identified after migration 252 are
warnings, not automatic identity collisions. Their qualifiers require explicit
content review and must not be silently combined:

- start versus sprint-start; call-out versus cut; turn versus open turn;
- rebound versus pogo or broad rebound;
- bear-plank versus balance, and free movement versus ladder or box;
- two-point versus three-point starts;
- floor versus box, single versus double, and regular versus bottoms-up loading;
- lateral, rotational, forward/backward, inversion, and eversion directions;
- generic kneeling, tall-kneeling, and half-kneeling positions;
- line, low-line, on-cue, split-stance, triple-hop, and wall-target constraints;
- overhead versus overhead-back projection;
- squat-clean versus wall-ball-shot completion;
- press, push press, Z-press, arc press, press-out, deadlift-to-row, and
  180-degree rotation;
- countermovement versus non-countermovement;
- depth drop, depth jump, box jump, and their different execution order.

The final name-similarity pair at score 100 is “Depth Drop to Box Jump” versus
“Box Jump to Depth Drop.” The old bigram score ignored word order. Exact
collision detection now compares normalized identities directly, so this
meaningful order difference no longer blocks either card.

## Governance

Deterministic consolidation never grants publication approval. Every surviving
card remains in review and retains its media, content, relationship, calibration,
and two-person approval gates. A future coach may decide to model one of the
remaining similar pairs as variants of one definition, but that is a card-content
revision—not an unresolved identity collision.
